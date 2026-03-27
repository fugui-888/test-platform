import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  Typography,
} from '@mui/material';
import getKLineData from '../utils/fetch/getKLineData';
import { parseBinanceKlinesToCandles5m } from '../utils/fetch/binanceKlinesToCandles';
import MEXCListen5mChart, {
  type ListenCandle5m,
} from '../views/MEXCBoard/MEXCListen5mChart';
import MEXCListen30mChart, {
  type ListenCandle30,
} from '../views/MEXCBoard/MEXCListen30mChart';

type Candle = {
  ts: number;
  open: number;
  high: number;
  low: number;
  close: number;
  vol: number;
};

async function fetchBTC5min() {
  const { klines } = await getKLineData({
    symbol: 'BTCUSDT',
    interval: '5m',
    limit: '1500',
  });
  return { data: { klines } };
}

function parseBtc5mResponse(raw: any): Candle[] {
  return parseBinanceKlinesToCandles5m(raw?.data?.klines ?? []);
}

function buildAnchored30mFromLast5m(candles5: ListenCandle5m[]): {
  candles30: ListenCandle30[];
  selected30Index: number | null;
} {
  const n = candles5.length;
  if (n < 6) return { candles30: [], selected30Index: null };
  const clicked5Index = n - 1;
  const mod = clicked5Index % 6;
  let end = mod;
  while (end < 5) end += 6;
  const candles30: ListenCandle30[] = [];
  let selected30Index: number | null = null;

  for (; end < n; end += 6) {
    const start = end - 5;
    const slice = candles5.slice(start, end + 1);
    if (slice.length !== 6) break;
    const open = slice[0].open;
    const close = slice[5].close;
    let high = slice[0].high;
    let low = slice[0].low;
    for (let i = 1; i < 6; i++) {
      high = Math.max(high, slice[i].high);
      low = Math.min(low, slice[i].low);
    }
    const vol = slice.reduce((s, c) => s + c.vol, 0);
    const idx30 = candles30.length;
    candles30.push({
      ts: slice[5].ts,
      open,
      high,
      low,
      close,
      vol,
      startIndex: start,
      endIndex: end,
    });
    if (end === clicked5Index) selected30Index = idx30;
  }
  return { candles30, selected30Index };
}

function last30mAsSixth5m(candles5: Candle[]): Candle | null {
  if (candles5.length < 6) return null;
  const chunk = candles5.slice(-6);
  const open = chunk[0].open;
  const close = chunk[5].close;
  let high = chunk[0].high;
  let low = chunk[0].low;
  for (let i = 1; i < 6; i++) {
    high = Math.max(high, chunk[i].high);
    low = Math.min(low, chunk[i].low);
  }
  return {
    ts: chunk[5].ts,
    open,
    high,
    low,
    close,
    vol: chunk.reduce((s, c) => s + c.vol, 0),
  };
}

function secondsUntilNextFiveMin(d: Date): number {
  const next = new Date(d);
  next.setMilliseconds(0);
  next.setSeconds(0);
  const mod = next.getMinutes() % 5;
  const addMinutes = mod === 0 ? 5 : 5 - mod;
  next.setMinutes(next.getMinutes() + addMinutes);
  return Math.max(0, Math.floor((next.getTime() - d.getTime()) / 1000));
}

function formatMinSec(totalSec: number): string {
  const sec = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m${s}s`;
}

const BinanceFutureEventSubscription: React.FC = () => {
  const [listening, setListening] = useState(false);
  const [lastFetchAt, setLastFetchAt] = useState<Date | null>(null);
  const [nowTick, setNowTick] = useState<Date>(new Date());
  const [latestCandles, setLatestCandles] = useState<ListenCandle5m[]>([]);
  const anchored30 = useMemo(
    () => buildAnchored30mFromLast5m(latestCandles),
    [latestCandles],
  );

  const lastQuerySecondRef = useRef<string>('');

  const runListenFetch = useCallback(async () => {
    try {
      setLastFetchAt(new Date());
      const raw = await fetchBTC5min();
      const candles5 = parseBtc5mResponse(raw);
      if (candles5.length < 6) {
        return;
      }
      setLatestCandles(candles5);
      const bars30 = buildAnchored30mFromLast5m(candles5).candles30;
      const bar30 = last30mAsSixth5m(candles5);
      if (!bar30 || bars30.length < 2) {
        return;
      }
    } catch (e: any) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNowTick(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!listening) return;
    void runListenFetch();
    const id = window.setInterval(() => {
      const now = new Date();
      if (now.getSeconds() % 5 !== 0) return;
      const secSlot = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}-${now.getMinutes()}-${now.getSeconds()}`;
      if (lastQuerySecondRef.current === secSlot) return;
      lastQuerySecondRef.current = secSlot;
      void runListenFetch();
    }, 1000);
    return () => window.clearInterval(id);
  }, [listening, runListenFetch]);

  useEffect(() => {
    if (!listening) {
      lastQuerySecondRef.current = '';
    }
  }, [listening]);

  const secToNext5m = secondsUntilNextFiveMin(nowTick);
  const inNotifyWindow = secToNext5m < 30;

  return (
    <Box>
      <Card sx={{ mt: 4, mb: 2 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={6}>
              <Button
                fullWidth
                variant="contained"
                color={listening ? 'error' : 'primary'}
                onClick={() => setListening((v) => !v)}
              >
                {listening ? 'stop' : 'start(5s)'}
              </Button>
            </Grid>
            <Grid item xs={6}>
              <Button
                fullWidth
                variant="outlined"
                onClick={() => void runListenFetch()}
              >
                refresh
              </Button>
            </Grid>
          </Grid>

          <Box
            sx={{
              mt: 1.5,
              display: 'flex',
              gap: 1.25,
              flexWrap: 'wrap',
              alignItems: 'stretch',
            }}
          >
            <Box
              sx={{
                p: 1,
                borderRadius: 1.5,
                border: '1px solid',
                borderColor: inNotifyWindow ? 'error.main' : 'divider',
                width: '100%',
              }}
            >
              <Box>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 1,
                  }}
                >
                  <Box component="span">
                    now: {nowTick.toLocaleTimeString()} · last:{' '}
                    {lastFetchAt ? lastFetchAt.toLocaleTimeString() : '—'}
                  </Box>
                  <Box
                    component="span"
                    sx={{ textAlign: 'right', whiteSpace: 'nowrap' }}
                  >
                    to 5m: {formatMinSec(secToNext5m)}
                  </Box>
                </Typography>
              </Box>
            </Box>
          </Box>

          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <Box sx={{ position: 'relative' }}>
                <Box
                  sx={{
                    position: 'absolute',
                    top: '-3px',
                    left: 8,
                    zIndex: 20,
                    px: 0.75,
                    py: 0.2,
                    borderRadius: 1,
                    bgcolor: 'rgba(0,0,0,0.56)',
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{ color: '#fff', fontWeight: 700, lineHeight: 2 }}
                  >
                    5m
                  </Typography>
                </Box>
                {latestCandles.length > 0 ? (
                  <MEXCListen5mChart
                    candles5={latestCandles}
                    height={300}
                    zAbsThreshold={2.3}
                  />
                ) : (
                  <Alert severity="info">no data</Alert>
                )}
              </Box>
            </Grid>
            <Grid item xs={12}>
              <Box sx={{ position: 'relative' }}>
                <Box
                  sx={{
                    position: 'absolute',
                    top: '-3px',
                    left: 8,
                    zIndex: 20,
                    px: 0.75,
                    py: 0.2,
                    borderRadius: 1,
                    bgcolor: 'rgba(0,0,0,0.56)',
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{ color: '#fff', fontWeight: 700, lineHeight: 2 }}
                  >
                    30m
                  </Typography>
                </Box>
                {anchored30.candles30.length > 0 &&
                anchored30.selected30Index != null ? (
                  <MEXCListen30mChart
                    candles30={anchored30.candles30}
                    height={300}
                  />
                ) : (
                  <Alert severity="info">no data</Alert>
                )}
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
};

export default BinanceFutureEventSubscription;
