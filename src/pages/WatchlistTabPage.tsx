import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { DateTime } from 'luxon';
import CloseIcon from '@mui/icons-material/Close';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import Top10KlineChart from '../components/watchlist/Top10KlineChart';
import {
  FAPI_BASE,
  fetchJsonWith429Backoff,
  sleep,
} from '../utils/binance/futuresKlineFetch';
import { fetchUsdtPerpSymbolsMeta } from '../utils/binance/futuresExchangeInfo';
import {
  aggregate5mRowsTo10mKline,
  aggregate5mRowsTo10mTradeLine,
  buildTopMonitorZPairFrom5mRows,
  parseHourBars,
  rowsToKline,
  rowsToTradeLine,
} from '../utils/binance/watchlistMonitorKline';
import type { TradeLinePoint } from '../utils/binance/watchlistMonitorKline';
import {
  calcRisePct,
  computeMetric,
  type MinuteCandle,
  type SymbolMetric,
} from '../utils/binance/watchlistMinuteMetrics';
import {
  applyTopDisplaySort,
  type TopDisplayRow,
  type TopTableSortKey,
  type TopTableSortState,
} from '../utils/binance/watchlistTableSort';
import type { MEXCKLINE } from '../types/mexcKline';
import {
  clearLookbackCacheByBucket,
  getAnchorBucketKey,
  loadLookbackSeriesCache,
  saveLookbackSeriesCache,
  type LookbackHourBar,
} from '../utils/watchlistAnchorCache';

const WS_URL = 'wss://fstream.binance.com/ws/!ticker@arr';
const CANDLE_KEEP_MIN = 360;
const QUERY_KLINE_LIMIT = 300;
const QUERY_KLINE_POLL_MS = 2000;
const TOP_MONITOR_KLINE_LIMIT = 240;
const TOP_MONITOR_POLL_MS = 5000;
const ADV_TABLE_HEIGHT = 258;
const LOOKBACK_BASE_BATCH = 10;
const LOOKBACK_BASE_GAP_MS = 80;
const LOOKBACK_REQUEST_GAP_MS = 70;
const LS_WATCHLIST_CHART_SYMBOL = 'WATCHLIST_TAB_CHART_SYMBOL';
const CHART_Z = 2.5;

type TickerLite = {
  symbol: string;
  price: number;
  dayChangePct: number | null;
};
type TopRowWithMetrics = TickerLite & SymbolMetric;

type TopDisplayRowFull = TopRowWithMetrics & { dayRank: number | null };
type ChartInterval = '1m' | '5m' | '10m' | '30m' | '1d';

function loadChartSymbolFromLS(): string | null {
  try {
    const s = localStorage.getItem(LS_WATCHLIST_CHART_SYMBOL);
    if (!s || !/^[A-Z0-9]+$/.test(s)) return null;
    return s;
  } catch {
    return null;
  }
}

function localDateTimeToUtcHourOpenMs(dt: DateTime): number {
  const localStart = dt.setZone('local').startOf('hour');
  const instantMs = localStart.toMillis();
  return Math.floor(instantMs / 3600000) * 3600000;
}

function defaultAnchorDateTimeWatchlist(): DateTime {
  const now = DateTime.now().setZone('local');
  const today10 = now
    .startOf('day')
    .set({ hour: 10, minute: 0, second: 0, millisecond: 0 });
  if (now < today10) {
    return now.startOf('day');
  }
  return today10;
}

function maxHourForLocalDate(dayStart: DateTime): number {
  const now = DateTime.now().setZone('local');
  if (dayStart.hasSame(now, 'day')) return now.hour;
  return 23;
}

function normalizeAnchorDateTime(dt: DateTime): DateTime {
  const local = dt.setZone('local').startOf('hour');
  const maxH = maxHourForLocalDate(local.startOf('day'));
  return local.set({ hour: Math.min(local.hour, maxH) });
}

function getBaseFromAnchorHourBar(
  rows: LookbackHourBar[],
  anchorUtcMs: number,
): number | null {
  if (rows.length === 0) return null;
  const hit = rows.find((r) => r.ts === anchorUtcMs);
  const base = hit?.open ?? rows[0]?.open;
  return Number.isFinite(base) && (base as number) > 0
    ? (base as number)
    : null;
}

function formatPct(v: number | null, digits = 2): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return `${v.toFixed(digits)}%`;
}

export default function WatchlistTabPage() {
  const theme = useTheme();
  const isNarrow = useMediaQuery(theme.breakpoints.down('md'));
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [elapsedMin, setElapsedMin] = useState(0);
  const [utcOpenLoadedA, setUtcOpenLoadedA] = useState(0);
  const [utcOpenTotalA, setUtcOpenTotalA] = useState(0);
  const [utcOpenLoadingA, setUtcOpenLoadingA] = useState(false);
  const [cachedAnchorSymbolsA, setCachedAnchorSymbolsA] = useState(0);
  const [lookbackCacheHitA, setLookbackCacheHitA] = useState(false);
  const [alphaSymbolSet, setAlphaSymbolSet] = useState<Set<string>>(new Set());
  const [tick, setTick] = useState(0);
  const [topPickSymbol, setTopPickSymbol] = useState<string | null>(() =>
    loadChartSymbolFromLS(),
  );
  const [anchorDateTimeA, setAnchorDateTimeA] = useState<DateTime>(() =>
    defaultAnchorDateTimeWatchlist(),
  );
  const [topNInput, setTopNInput] = useState('10');
  const [chartInterval, setChartInterval] = useState<ChartInterval>('5m');
  const [queryKline, setQueryKline] = useState<MEXCKLINE | null>(null);
  const [queryTradeLine, setQueryTradeLine] = useState<TradeLinePoint[]>([]);
  const [queryKlineLoading, setQueryKlineLoading] = useState(false);
  const [topMonitoring, setTopMonitoring] = useState(false);
  const [topMonitorLoading, setTopMonitorLoading] = useState(false);
  const [topMonitorZMap, setTopMonitorZMap] = useState<
    Record<string, ReturnType<typeof buildTopMonitorZPairFrom5mRows>>
  >({});
  const [topTableSortA, setTopTableSortA] = useState<TopTableSortState>(null);
  const [candleStartMinute, setCandleStartMinute] = useState<number | null>(
    null,
  );

  const wsRef = useRef<WebSocket | null>(null);
  const stopRef = useRef(false);
  const beatTimerRef = useRef<number | null>(null);
  const startedAtRef = useRef<number>(0);
  const candleStartMinuteRef = useRef<number>(0);
  const topUpSymbolsRef = useRef<string[]>([]);
  const tickerMapRef = useRef<Map<string, TickerLite>>(new Map());
  const candleMapRef = useRef<Map<string, MinuteCandle[]>>(new Map());
  const allowedSymbolsRef = useRef<Set<string>>(new Set());
  const lookbackBaseMapRefA = useRef<Map<string, number>>(new Map());

  const anchorUtcMsA = useMemo(
    () => localDateTimeToUtcHourOpenMs(anchorDateTimeA),
    [anchorDateTimeA],
  );
  const anchorLabelShortA = useMemo(
    () => anchorDateTimeA.setZone('local').toFormat('MM-dd HH:00'),
    [anchorDateTimeA],
  );
  const anchorElapsedLabelA = useMemo(() => {
    void tick;
    const elapsedHours = Math.max(
      1,
      Math.floor((Date.now() - anchorUtcMsA) / 3600000),
    );
    const formatHours = (hours: number) => {
      if (hours <= 24) return `${hours}小时`;
      const days = Math.floor(hours / 24);
      const remHours = hours % 24;
      return `${days}天${remHours}小时`;
    };
    return formatHours(elapsedHours);
  }, [anchorUtcMsA, tick]);

  const topN = useMemo(() => {
    const n = Number.parseFloat(topNInput);
    if (!Number.isFinite(n)) return 10;
    return Math.max(1, Math.floor(n));
  }, [topNInput]);

  const anchorMaxHour = useMemo(
    () => maxHourForLocalDate(anchorDateTimeA.startOf('day')),
    [anchorDateTimeA],
  );
  const anchorHourOptions = useMemo(
    () => Array.from({ length: anchorMaxHour + 1 }, (_, i) => i),
    [anchorMaxHour],
  );

  const dayChangeReadyA =
    utcOpenTotalA > 0 && !utcOpenLoadingA && utcOpenLoadedA >= utcOpenTotalA;

  const stopMonitor = useCallback(() => {
    stopRef.current = true;
    setRunning(false);
    setTopMonitoring(false);
    setTopMonitorLoading(false);
    setTopMonitorZMap({});
    if (beatTimerRef.current != null) {
      window.clearInterval(beatTimerRef.current);
      beatTimerRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  useEffect(() => () => stopMonitor(), [stopMonitor]);

  useEffect(() => {
    try {
      if (topPickSymbol)
        localStorage.setItem(LS_WATCHLIST_CHART_SYMBOL, topPickSymbol);
      else localStorage.removeItem(LS_WATCHLIST_CHART_SYMBOL);
    } catch {}
  }, [topPickSymbol]);

  const allTickers = useMemo(() => {
    void tick;
    return Array.from(tickerMapRef.current.values());
  }, [tick]);

  const topUpRowsA = useMemo<TopDisplayRowFull[]>(() => {
    void tick;
    const rows: TopRowWithMetrics[] = allTickers
      .filter((x) => x.dayChangePct != null)
      .map((row) => ({
        ...row,
        ...computeMetric(candleMapRef.current.get(row.symbol) ?? []),
      }));
    rows.sort(
      (a, b) => (b.dayChangePct as number) - (a.dayChangePct as number),
    );
    return rows.slice(0, topN).map((r, idx) => ({ ...r, dayRank: idx + 1 }));
  }, [allTickers, tick, topN]);

  useEffect(() => {
    topUpSymbolsRef.current = topUpRowsA.map((r) => r.symbol);
  }, [topUpRowsA]);

  const toggleTopTableSortA = useCallback((key: TopTableSortKey) => {
    setTopTableSortA((prev) => {
      if (!prev || prev.key !== key) return { key, dir: 'desc' };
      if (prev.dir === 'desc') return { key, dir: 'asc' };
      return null;
    });
  }, []);

  const topRowsForDisplayA = useMemo(
    () =>
      applyTopDisplaySort(
        topUpRowsA as TopDisplayRow[],
        topTableSortA,
        topMonitorZMap,
        [],
      ) as TopDisplayRowFull[],
    [topUpRowsA, topTableSortA, topMonitorZMap],
  );

  const countAnchorCacheHits = useCallback(
    (
      symbols: string[],
      seriesMap: Map<string, LookbackHourBar[]>,
      anchorMs: number,
    ) => {
      let n = 0;
      for (const symbol of symbols) {
        const rows = seriesMap.get(symbol);
        if (!rows?.length) continue;
        if (rows.some((r) => r.ts === anchorMs && r.open > 0)) n += 1;
      }
      return n;
    },
    [],
  );

  const syncTickerDayChangeFromBaseMaps = useCallback(() => {
    tickerMapRef.current.forEach((t) => {
      const b1 = lookbackBaseMapRefA.current.get(t.symbol);
      t.dayChangePct = b1 && b1 > 0 ? calcRisePct(t.price, b1) : null;
    });
    setTick((x) => x + 1);
  }, []);

  const warmupLookbackBasePrices = useCallback(
    async (symbols: string[]) => {
      const anchorA = anchorUtcMsA;
      const bucketA = getAnchorBucketKey(anchorA);

      setUtcOpenLoadingA(true);
      setUtcOpenTotalA(symbols.length);

      const seriesMapA = await loadLookbackSeriesCache(symbols, bucketA);
      const missingA = symbols.filter(
        (s) =>
          !(seriesMapA.get(s) ?? []).some(
            (r) => r.ts === anchorA && r.open > 0,
          ),
      );

      setLookbackCacheHitA(missingA.length === 0);
      setCachedAnchorSymbolsA(
        countAnchorCacheHits(symbols, seriesMapA, anchorA),
      );
      setUtcOpenLoadedA(symbols.length - missingA.length);

      const applyBases = () => {
        const nextA = new Map<string, number>();
        symbols.forEach((symbol) => {
          const a = getBaseFromAnchorHourBar(
            seriesMapA.get(symbol) ?? [],
            anchorA,
          );
          if (a != null) nextA.set(symbol, a);
        });
        lookbackBaseMapRefA.current = nextA;
        syncTickerDayChangeFromBaseMaps();
      };
      applyBases();

      if (missingA.length === 0) {
        setUtcOpenLoadingA(false);
        return;
      }

      for (let i = 0; i < missingA.length; i += LOOKBACK_BASE_BATCH) {
        if (stopRef.current) break;
        const seg = missingA.slice(i, i + LOOKBACK_BASE_BATCH);
        await Promise.all(
          seg.map(async (symbol, idx) => {
            if (idx > 0) await sleep(idx * LOOKBACK_REQUEST_GAP_MS);
            if (stopRef.current) return;
            try {
              const url = `${FAPI_BASE}/fapi/v1/klines?symbol=${encodeURIComponent(
                symbol,
              )}&interval=1h&limit=1&startTime=${anchorA}`;
              const r = await fetchJsonWith429Backoff(url);
              const data = await r.json();
              if (r.ok && Array.isArray(data) && data.length > 0) {
                const rows = parseHourBars(data as unknown[][]);
                if (rows.some((x) => x.ts === anchorA)) {
                  seriesMapA.set(symbol, rows);
                  await saveLookbackSeriesCache(symbol, bucketA, rows);
                }
              }
            } catch {
            } finally {
              setUtcOpenLoadedA((n) => n + 1);
            }
          }),
        );
        await sleep(LOOKBACK_BASE_GAP_MS);
      }

      setCachedAnchorSymbolsA(
        countAnchorCacheHits(symbols, seriesMapA, anchorA),
      );
      applyBases();
      setUtcOpenLoadingA(false);
    },
    [anchorUtcMsA, countAnchorCacheHits, syncTickerDayChangeFromBaseMaps],
  );

  useEffect(() => {
    if (!running) return;
    const symbols = Array.from(allowedSymbolsRef.current);
    if (symbols.length === 0) return;
    void warmupLookbackBasePrices(symbols);
  }, [running, anchorUtcMsA, warmupLookbackBasePrices]);

  useEffect(() => {
    if (!topMonitoring) return;
    let cancelled = false;
    const load = async () => {
      const symbols = topUpSymbolsRef.current;
      if (symbols.length === 0) {
        if (!cancelled) {
          setTopMonitorZMap({});
          setTopMonitorLoading(false);
        }
        return;
      }
      if (!cancelled) setTopMonitorLoading(true);
      const pairs = await Promise.all(
        symbols.map(async (symbol) => {
          try {
            const url = `${FAPI_BASE}/fapi/v1/klines?symbol=${encodeURIComponent(
              symbol,
            )}&interval=5m&limit=${TOP_MONITOR_KLINE_LIMIT}`;
            const r = await fetchJsonWith429Backoff(url);
            const data = await r.json();
            if (!r.ok || !Array.isArray(data))
              throw new Error('top monitor kline failed');
            return [
              symbol,
              buildTopMonitorZPairFrom5mRows(data as unknown[][]),
            ] as const;
          } catch {
            return [
              symbol,
              {
                streakDir: null,
                streakCount: null,
                streakPct: null,
                streak10mDir: null,
                streak10mCount: null,
                streak10mPct: null,
                tradeCount15m: null,
                maTouch5mPct: null,
                maTouch5mBars: null,
                maTouch10mPct: null,
                maTouch10mBars: null,
              },
            ] as const;
          }
        }),
      );
      if (!cancelled) {
        const next: Record<
          string,
          ReturnType<typeof buildTopMonitorZPairFrom5mRows>
        > = {};
        pairs.forEach(([symbol, zPair]) => {
          next[symbol] = zPair;
        });
        setTopMonitorZMap(next);
        setTopMonitorLoading(false);
      }
    };
    void load();
    const id = window.setInterval(() => {
      void load();
    }, TOP_MONITOR_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [topMonitoring]);

  useEffect(() => {
    if (!topPickSymbol) {
      setQueryKline(null);
      setQueryTradeLine([]);
      setQueryKlineLoading(false);
      return;
    }
    let cancelled = false;
    setQueryKlineLoading(true);
    const load = async () => {
      try {
        const queryInterval = chartInterval === '10m' ? '5m' : chartInterval;
        const url = `${FAPI_BASE}/fapi/v1/klines?symbol=${encodeURIComponent(
          topPickSymbol,
        )}&interval=${queryInterval}&limit=${QUERY_KLINE_LIMIT}`;
        const r = await fetchJsonWith429Backoff(url);
        const data = await r.json();
        if (!r.ok || !Array.isArray(data))
          throw new Error('kline query failed');
        if (!cancelled) {
          const rows = data as unknown[][];
          if (chartInterval === '10m') {
            setQueryKline(aggregate5mRowsTo10mKline(rows));
            setQueryTradeLine(aggregate5mRowsTo10mTradeLine(rows));
          } else {
            setQueryKline(rowsToKline(rows));
            setQueryTradeLine(rowsToTradeLine(rows));
          }
        }
      } catch {
        if (!cancelled) {
          setQueryKline(null);
          setQueryTradeLine([]);
        }
      } finally {
        if (!cancelled) setQueryKlineLoading(false);
      }
    };
    void load();
    const timerId = window.setInterval(() => {
      void load();
    }, QUERY_KLINE_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timerId);
    };
  }, [topPickSymbol, chartInterval]);

  const startMonitor = async () => {
    stopMonitor();
    stopRef.current = false;
    setError(null);
    setLastUpdated(null);
    tickerMapRef.current = new Map();
    candleMapRef.current = new Map();
    setTopPickSymbol(null);
    setQueryKline(null);
    setQueryTradeLine([]);
    setTopMonitorZMap({});
    setLookbackCacheHitA(false);
    setCachedAnchorSymbolsA(0);
    setUtcOpenLoadedA(0);
    setUtcOpenTotalA(0);
    setUtcOpenLoadingA(false);
    lookbackBaseMapRefA.current.clear();

    const startTs = Date.now();
    startedAtRef.current = startTs;
    const firstWholeMinute = Math.floor(startTs / 60000) * 60000 + 60000;
    candleStartMinuteRef.current = firstWholeMinute;
    setCandleStartMinute(firstWholeMinute);
    setElapsedMin(0);

    try {
      const { symbols: allowedSymbols, alphaSymbols } =
        await fetchUsdtPerpSymbolsMeta();
      allowedSymbolsRef.current = new Set(allowedSymbols);
      setAlphaSymbolSet(alphaSymbols);
      setRunning(true);

      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onmessage = (evt) => {
        if (stopRef.current) return;
        let arr: unknown[] = [];
        try {
          arr = JSON.parse(evt.data) as unknown[];
        } catch {
          return;
        }
        if (!Array.isArray(arr)) return;

        const nowTs = Date.now();
        const nowMinuteTs = Math.floor(nowTs / 60000) * 60000;

        for (const item of arr) {
          const t = item as { s?: string; c?: string };
          const symbol = String(t?.s ?? '');
          if (!allowedSymbolsRef.current.has(symbol)) continue;

          const price = parseFloat(String(t?.c));
          if (!Number.isFinite(price)) continue;

          const b1 = lookbackBaseMapRefA.current.get(symbol);
          const dayChangePct = b1 && b1 > 0 ? calcRisePct(price, b1) : null;
          tickerMapRef.current.set(symbol, { symbol, price, dayChangePct });

          if (nowMinuteTs < candleStartMinuteRef.current) continue;

          const candles = candleMapRef.current.get(symbol) ?? [];
          const last = candles[candles.length - 1];

          if (!last) {
            candles.push({
              minuteTs: nowMinuteTs,
              open: price,
              high: price,
              low: price,
              close: price,
              vol: 1,
            });
          } else if (last.minuteTs === nowMinuteTs) {
            last.close = price;
            if (price > last.high) last.high = price;
            if (price < last.low) last.low = price;
            last.vol += 1;
          } else if (last.minuteTs < nowMinuteTs) {
            let fillTs = last.minuteTs + 60000;
            let prevClose = last.close;
            while (fillTs < nowMinuteTs) {
              candles.push({
                minuteTs: fillTs,
                open: prevClose,
                high: prevClose,
                low: prevClose,
                close: prevClose,
                vol: 0,
              });
              prevClose = candles[candles.length - 1].close;
              fillTs += 60000;
            }
            candles.push({
              minuteTs: nowMinuteTs,
              open: price,
              high: price,
              low: price,
              close: price,
              vol: 1,
            });
          }

          while (candles.length > CANDLE_KEEP_MIN) candles.shift();
          candleMapRef.current.set(symbol, candles);
        }

        setLastUpdated(new Date());
      };

      ws.onerror = () => setError('WebSocket 连接异常');
      ws.onclose = () => {
        if (!stopRef.current) setError('WebSocket 已断开');
      };

      beatTimerRef.current = window.setInterval(() => {
        if (stopRef.current) return;
        setTick((x) => x + 1);
        if (startedAtRef.current > 0) {
          setElapsedMin(
            Math.floor((Date.now() - startedAtRef.current) / 60000),
          );
        }
      }, 1000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
      stopMonitor();
    }
  };

  const handleClearAnchorCache = () => {
    void (async () => {
      await clearLookbackCacheByBucket(getAnchorBucketKey(anchorUtcMsA));
      lookbackBaseMapRefA.current.clear();
      setUtcOpenLoadedA(0);
      setUtcOpenTotalA(0);
      setUtcOpenLoadingA(false);
      setCachedAnchorSymbolsA(0);
      setLookbackCacheHitA(false);
    })();
  };

  return (
    <Box sx={{ p: 1 }}>
      <Card sx={{ mb: 1 }}>
        <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
          <Stack spacing={0.75}>
            <Stack
              direction="row"
              alignItems="center"
              spacing={0.5}
              flexWrap="nowrap"
              sx={{ width: '100%', minWidth: 0 }}
            >
              <TextField
                label="date"
                type="date"
                size="small"
                value={anchorDateTimeA.toFormat('yyyy-MM-dd')}
                onChange={(e) => {
                  const v = e.target.value;
                  if (!v) return;
                  const d = DateTime.fromISO(v, { zone: 'local' }).set({
                    hour: anchorDateTimeA.hour,
                    minute: 0,
                    second: 0,
                    millisecond: 0,
                  });
                  setAnchorDateTimeA(normalizeAnchorDateTime(d));
                }}
                disabled={running}
                InputLabelProps={{ shrink: true }}
                inputProps={{
                  max: DateTime.now().setZone('local').toFormat('yyyy-MM-dd'),
                }}
                sx={{ flex: '1 1 0', minWidth: 0 }}
              />
              <FormControl
                size="small"
                sx={{ flex: '0 0 86px', minWidth: 86 }}
                disabled={running}
              >
                <InputLabel id="watchlist-anchor-hour-label">时</InputLabel>
                <Select
                  labelId="watchlist-anchor-hour-label"
                  label="时"
                  value={Math.min(anchorDateTimeA.hour, anchorMaxHour)}
                  onChange={(e) => {
                    const h = Number(e.target.value);
                    setAnchorDateTimeA(
                      normalizeAnchorDateTime(
                        anchorDateTimeA.set({
                          hour: h,
                          minute: 0,
                          second: 0,
                          millisecond: 0,
                        }),
                      ),
                    );
                  }}
                >
                  {anchorHourOptions.map((h) => (
                    <MenuItem key={h} value={h}>
                      {String(h).padStart(2, '0')}:00
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                size="small"
                label="N"
                value={topNInput}
                onChange={(e) => setTopNInput(e.target.value)}
                disabled={running}
                inputProps={{ inputMode: 'numeric' }}
                sx={{ flex: '0 0 64px', width: 64 }}
              />
            </Stack>
            <Stack
              direction="row"
              spacing={0.5}
              flexWrap="nowrap"
              sx={{ width: '100%', minWidth: 0 }}
            >
              <Button
                size="small"
                variant={running ? 'outlined' : 'contained'}
                color={running ? 'error' : 'primary'}
                onClick={() => {
                  if (running) stopMonitor();
                  else void startMonitor();
                }}
                sx={{
                  flex: 1,
                  minWidth: 0,
                  px: 0.5,
                  fontSize: '0.72rem',
                  whiteSpace: 'nowrap',
                }}
              >
                {running ? '停止' : '开始'}监听
              </Button>
              <Button
                size="small"
                variant="text"
                color="inherit"
                onClick={handleClearAnchorCache}
                disabled={running}
                sx={{
                  flex: 1,
                  minWidth: 0,
                  px: 0.5,
                  fontSize: '0.72rem',
                  whiteSpace: 'nowrap',
                }}
              >
                清缓存
              </Button>
              <Button
                size="small"
                variant={topMonitoring ? 'outlined' : 'contained'}
                onClick={() => setTopMonitoring((v) => !v)}
                disabled={!running}
                sx={{
                  flex: 1,
                  minWidth: 0,
                  px: 0.5,
                  fontSize: '0.72rem',
                  whiteSpace: 'nowrap',
                }}
              >
                <Stack
                  direction="row"
                  alignItems="center"
                  justifyContent="center"
                  spacing={0.5}
                >
                  <Box
                    sx={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      flexShrink: 0,
                      bgcolor: !topMonitoring
                        ? 'grey.500'
                        : topMonitorLoading
                        ? 'info.main'
                        : 'success.main',
                    }}
                  />
                  <span>{topMonitoring ? '停' : '开'}监控</span>
                </Stack>
              </Button>
            </Stack>
          </Stack>
          {error && (
            <Alert severity="warning" sx={{ mt: 1, py: 0 }}>
              {error}
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card sx={{ mb: 1 }}>
        <CardContent sx={{ py: 1, '&:last-child': { pb: 1 } }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 500, mb: 0.5 }}>
            Top {topN}
            <Typography
              component="span"
              variant="caption"
              color="text.secondary"
              sx={{ ml: 1, fontWeight: 500 }}
            >
              （{anchorElapsedLabelA}）
            </Typography>
            {!dayChangeReadyA && running && (
              <Typography
                component="span"
                variant="caption"
                color="warning.main"
                sx={{ ml: 1 }}
              >
                基准加载中
              </Typography>
            )}
          </Typography>
          <TableContainer
            component={Paper}
            sx={{ height: ADV_TABLE_HEIGHT, maxHeight: ADV_TABLE_HEIGHT }}
          >
            <Table
              size="small"
              stickyHeader
              sx={{
                '& .MuiTableCell-root': {
                  py: isNarrow ? 0.25 : 0.35,
                  px: isNarrow ? 0.5 : 1,
                  fontSize: isNarrow ? '0.68rem' : '0.75rem',
                },
                '& .MuiTableCell-head': { py: isNarrow ? 0.35 : 0.5 },
              }}
            >
              <TableHead>
                <TableRow>
                  <TableCell>{isNarrow ? '序' : '涨幅序'}</TableCell>
                  <TableCell>{isNarrow ? '币' : '币种'}</TableCell>
                  <TableCell align="right">
                    {isNarrow ? '%' : '相对基准涨幅'}
                  </TableCell>
                  <TableCell align="right">
                    <TableSortLabel
                      active={topTableSortA?.key === 'streak10m'}
                      direction={
                        topTableSortA?.key === 'streak10m'
                          ? topTableSortA.dir
                          : 'desc'
                      }
                      onClick={() => toggleTopTableSortA('streak10m')}
                    >
                      {isNarrow ? '10m' : '连续10m涨跌'}
                    </TableSortLabel>
                  </TableCell>
                  <TableCell align="right">
                    <TableSortLabel
                      active={topTableSortA?.key === 'streak5m'}
                      direction={
                        topTableSortA?.key === 'streak5m'
                          ? topTableSortA.dir
                          : 'desc'
                      }
                      onClick={() => toggleTopTableSortA('streak5m')}
                    >
                      {isNarrow ? '5m' : '连续5m涨跌'}
                    </TableSortLabel>
                  </TableCell>
                  <TableCell align="right">
                    <TableSortLabel
                      active={topTableSortA?.key === 'tradeCount15m'}
                      direction={
                        topTableSortA?.key === 'tradeCount15m'
                          ? topTableSortA.dir
                          : 'desc'
                      }
                      onClick={() => toggleTopTableSortA('tradeCount15m')}
                    >
                      {isNarrow ? '笔' : '最近15m成交笔数'}
                    </TableSortLabel>
                  </TableCell>
                  <TableCell align="right">
                    {isNarrow ? '价' : '现价'}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {dayChangeReadyA &&
                  topRowsForDisplayA.map((r) => {
                    const zPair = topMonitorZMap[r.symbol];
                    const streakText =
                      topMonitoring &&
                      zPair?.streakPct != null &&
                      zPair?.streakCount != null
                        ? `${zPair.streakPct.toFixed(2)}%（${
                            zPair.streakCount
                          }）`
                        : '—';
                    const streakSx =
                      topMonitoring && zPair?.streakDir === 'up'
                        ? { color: '#2e7d32', fontWeight: 700 }
                        : topMonitoring && zPair?.streakDir === 'down'
                        ? { color: '#c62828', fontWeight: 700 }
                        : undefined;
                    const streak10mText =
                      topMonitoring &&
                      zPair?.streak10mPct != null &&
                      zPair?.streak10mCount != null
                        ? `${zPair.streak10mPct.toFixed(2)}%（${
                            zPair.streak10mCount
                          }）`
                        : '—';
                    const streak10mSx =
                      topMonitoring && zPair?.streak10mDir === 'up'
                        ? { color: '#2e7d32', fontWeight: 700 }
                        : topMonitoring && zPair?.streak10mDir === 'down'
                        ? { color: '#c62828', fontWeight: 700 }
                        : undefined;
                    return (
                      <TableRow
                        key={`up-a-${r.symbol}`}
                        hover
                        onClick={() => setTopPickSymbol(r.symbol)}
                        selected={topPickSymbol === r.symbol}
                        sx={{ cursor: 'pointer' }}
                      >
                        <TableCell>
                          {r.dayRank == null ? '—' : r.dayRank}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>
                          {alphaSymbolSet.has(r.symbol)
                            ? `*${r.symbol}`
                            : r.symbol}
                        </TableCell>
                        <TableCell
                          align="right"
                          sx={{ color: '#c62828', fontWeight: 700 }}
                        >
                          {formatPct(r.dayChangePct)}
                        </TableCell>
                        <TableCell align="right" sx={streak10mSx}>
                          {streak10mText}
                        </TableCell>
                        <TableCell align="right" sx={streakSx}>
                          {streakText}
                        </TableCell>
                        <TableCell align="right">
                          {topMonitoring && zPair?.tradeCount15m != null
                            ? Math.round(zPair.tradeCount15m).toLocaleString()
                            : '—'}
                        </TableCell>
                        <TableCell align="right">
                          {r.price.toFixed(4)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                {dayChangeReadyA && topRowsForDisplayA.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      align="center"
                      sx={{ color: 'text.secondary' }}
                    >
                      暂无数据
                    </TableCell>
                  </TableRow>
                )}
                {!dayChangeReadyA && running && (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      <CircularProgress size={22} />
                    </TableCell>
                  </TableRow>
                )}
                {!running && (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      align="center"
                      sx={{ color: 'text.secondary' }}
                    >
                      点击「开始监听」加载
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      <Card>
        <CardContent sx={{ py: 1, '&:last-child': { pb: 1 } }}>
          <Stack
            direction="row"
            alignItems="center"
            spacing={1}
            flexWrap="wrap"
            sx={{ mb: 0.5 }}
          >
            <ToggleButtonGroup
              size="small"
              exclusive
              value={chartInterval}
              onChange={(_, next: ChartInterval | null) => {
                if (next) setChartInterval(next);
              }}
            >
              <ToggleButton value="1m">1m</ToggleButton>
              <ToggleButton value="5m">5m</ToggleButton>
              <ToggleButton value="10m">10m</ToggleButton>
              <ToggleButton value="30m">30m</ToggleButton>
              <ToggleButton value="1d">1d</ToggleButton>
            </ToggleButtonGroup>
            <Typography
              variant="subtitle2"
              sx={{ fontWeight: 800, color: '#1565c0', fontSize: '0.95rem' }}
            >
              {topPickSymbol ?? '未选'}
            </Typography>
            <Box sx={{ flex: 1 }} />
            {topPickSymbol && (
              <IconButton
                size="small"
                color="inherit"
                title="清空选中并关闭K线"
                onClick={() => {
                  setTopPickSymbol(null);
                  setQueryKline(null);
                  setQueryTradeLine([]);
                }}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            )}
            {topPickSymbol && queryKlineLoading && (
              <Typography variant="caption" color="text.secondary">
                加载中…
              </Typography>
            )}
            {topPickSymbol && !queryKlineLoading && !queryKline && (
              <Typography variant="caption" color="error">
                失败
              </Typography>
            )}
          </Stack>

          {topPickSymbol && queryKline && (
            <Top10KlineChart
              klines={queryKline}
              chartHeight={280}
              zThreshold={CHART_Z}
              tradeCountLine={queryTradeLine}
              seriesKey={topPickSymbol}
              intervalKey={chartInterval}
            />
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
