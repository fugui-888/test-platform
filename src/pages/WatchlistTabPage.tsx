import React, { useCallback, useEffect, useMemo, useState } from 'react';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import {
  Alert,
  Box,
  Button,
  ButtonGroup,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import KlineWithVolAndMA from '../components/highPoint/KlineWithVolAndMA';
import { useBinanceUsdtWatchlist } from '../context/BinanceUsdtWatchlistContext';
import getKLineData from '../utils/fetch/getKLineData';

const INTERVALS = ['5m', '15m', '30m', '1h', '4h', '1d'] as const;
const DEFAULT_Z = 2.3;
const KLINES_LIMIT = 300;

type RowMetrics = {
  symbol: string;
  price: number;
  lastThreeBarsTotalPct: number;
  z: number | null;
};

function buildRowMetrics(
  klines: string[][],
): Omit<RowMetrics, 'symbol'> | null {
  if (!klines?.length) return null;
  const candles = [...klines]
    .map((k) => ({
      open: Number(k[1]),
      high: Number(k[2]),
      low: Number(k[3]),
      close: Number(k[4]),
      t: Number(k[0]),
    }))
    .sort((a, b) => a.t - b.t);
  const n = candles.length;
  if (n === 0) return null;
  const price = candles[n - 1].close;
  const iFirst = Math.max(0, n - 3);
  const o0 = candles[iFirst].open;
  const cLast = candles[n - 1].close;
  const lastThreeBarsTotalPct = o0 !== 0 ? ((cLast - o0) / o0) * 100 : 0;
  let z: number | null = null;
  if (n >= 30) {
    const closes = candles.map((c) => c.close);
    const endIdx = n - 1;
    const window = closes.slice(endIdx - 29, endIdx + 1);
    const mean = window.reduce((s, v) => s + v, 0) / 30;
    const variance = window.reduce((s, v) => s + (v - mean) ** 2, 0) / 30;
    const sigma = Math.sqrt(variance);
    if (sigma > 0) z = (closes[endIdx] - mean) / sigma;
  }
  return { price, lastThreeBarsTotalPct, z };
}

export default function WatchlistTabPage() {
  const { selectedSymbols } = useBinanceUsdtWatchlist();
  const [interval, setInterval] = useState<string>('5m');
  const [zInput, setZInput] = useState(String(DEFAULT_Z));
  const zThreshold = useMemo(() => {
    const n = parseFloat(zInput);
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_Z;
  }, [zInput]);

  const [listening, setListening] = useState(false);
  const [klineBySymbol, setKlineBySymbol] = useState<
    Record<string, string[][]>
  >({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasFetchedOnce, setHasFetchedOnce] = useState(false);
  const [selectedChartSymbol, setSelectedChartSymbol] = useState<string | null>(
    null,
  );

  const loadKlines = useCallback(
    async (opts?: { quiet?: boolean }) => {
      const quiet = opts?.quiet ?? false;
      if (selectedSymbols.length === 0) {
        setKlineBySymbol({});
        setError(null);
        if (!quiet) setLoading(false);
        setHasFetchedOnce(false);
        return;
      }
      if (!quiet) setLoading(true);
      setError(null);
      try {
        const settled = await Promise.allSettled(
          selectedSymbols.map(async (sym) => {
            const res = await getKLineData({
              symbol: sym,
              interval,
              limit: String(KLINES_LIMIT),
            });
            return { sym, rows: res.klines };
          }),
        );
        const next: Record<string, string[][]> = {};
        let fail = 0;
        for (const s of settled) {
          if (s.status === 'fulfilled') {
            next[s.value.sym] = s.value.rows;
          } else {
            fail += 1;
          }
        }
        setKlineBySymbol(next);
        setHasFetchedOnce(true);
        if (fail > 0) {
          setError(`${fail} 个交易对请求失败（可能网络或交易对无效）`);
        }
      } catch {
        setError('加载 K 线失败');
        setKlineBySymbol({});
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [selectedSymbols, interval],
  );

  useEffect(() => {
    if (!listening) return;
    void loadKlines({ quiet: true });
    const id = window.setInterval(() => {
      void loadKlines({ quiet: true });
    }, 3000);
    return () => window.clearInterval(id);
  }, [listening, loadKlines]);

  const tableRows: RowMetrics[] = useMemo(() => {
    return selectedSymbols
      .map((sym) => {
        const kl = klineBySymbol[sym];
        const m = buildRowMetrics(kl);
        if (!m) return null;
        return { symbol: sym, ...m };
      })
      .filter((x): x is RowMetrics => x != null);
  }, [selectedSymbols, klineBySymbol]);

  useEffect(() => {
    if (tableRows.length === 0) {
      setSelectedChartSymbol(null);
      return;
    }
    setSelectedChartSymbol((prev) => {
      if (prev && tableRows.some((r) => r.symbol === prev)) return prev;
      return tableRows[0].symbol;
    });
  }, [tableRows]);

  const handleLoadOnce = () => {
    void loadKlines({ quiet: false });
  };

  const handleListenToggle = () => {
    setListening((v) => !v);
  };

  const handleNavigate = (direction: 'up' | 'down') => {
    if (!selectedChartSymbol || tableRows.length === 0) return;
    const currentIndex = tableRows.findIndex(
      (row) => row.symbol === selectedChartSymbol,
    );
    if (currentIndex < 0) return;
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex >= 0 && newIndex < tableRows.length) {
      setSelectedChartSymbol(tableRows[newIndex].symbol);
    }
  };

  const chartIndex = selectedChartSymbol
    ? tableRows.findIndex((row) => row.symbol === selectedChartSymbol)
    : -1;
  const canNavigateUp = chartIndex > 0;
  const canNavigateDown = chartIndex >= 0 && chartIndex < tableRows.length - 1;

  const noSymbols = selectedSymbols.length === 0;

  const selectedKlines =
    selectedChartSymbol && klineBySymbol[selectedChartSymbol]?.length
      ? klineBySymbol[selectedChartSymbol]
      : null;

  return (
    <Box sx={{ p: 1 }}>
      <Paper sx={{ p: 1.5, mb: 2 }}>
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 1.5,
            alignItems: 'flex-end',
          }}
        >
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>interval</InputLabel>
            <Select
              label="interval"
              value={interval}
              onChange={(e) => setInterval(e.target.value)}
            >
              {INTERVALS.map((int) => (
                <MenuItem key={int} value={int}>
                  {int}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            size="small"
            label="z 阈值 (vs MA30)"
            type="number"
            value={zInput}
            onChange={(e) => setZInput(e.target.value)}
            inputProps={{ step: 0.01, min: 0.01 }}
            sx={{ width: 140 }}
          />
          <Button
            variant={listening ? 'outlined' : 'contained'}
            color={listening ? 'error' : 'primary'}
            onClick={handleListenToggle}
            disabled={noSymbols}
          >
            {listening ? 'stop' : 'listen'}
          </Button>
          <Button
            variant="contained"
            color="secondary"
            onClick={handleLoadOnce}
            disabled={noSymbols || loading}
          >
            load
          </Button>
        </Box>
        {noSymbols && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ mt: 1, display: 'block' }}
          >
            请先在左下角自选里选择交易对
          </Typography>
        )}
      </Paper>

      {error && (
        <Alert severity="warning" sx={{ mb: 1 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {loading && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <CircularProgress size={20} />
          <Typography variant="caption" color="text.secondary">
            加载中…
          </Typography>
        </Box>
      )}

      {hasFetchedOnce && tableRows.length > 0 && (
        <Paper sx={{ mb: 2, borderRadius: 1, overflow: 'hidden' }}>
          <TableContainer sx={{ maxHeight: 240 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>币名</TableCell>
                  <TableCell align="right">价格</TableCell>
                  <TableCell align="right">最近3根</TableCell>
                  <TableCell align="right">z(MA30)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tableRows.map((row) => (
                  <TableRow
                    key={row.symbol}
                    hover
                    selected={selectedChartSymbol === row.symbol}
                    onClick={() => setSelectedChartSymbol(row.symbol)}
                    sx={{
                      cursor: 'pointer',
                      '&.Mui-selected': {
                        backgroundColor: 'action.selected',
                      },
                      '&.Mui-selected:hover': {
                        backgroundColor: 'action.selected',
                      },
                    }}
                  >
                    <TableCell>{row.symbol.replace('USDT', '')}</TableCell>
                    <TableCell align="right">
                      {Number.isFinite(row.price)
                        ? row.price.toFixed(row.price < 1 ? 6 : 4)
                        : '—'}
                    </TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      {row.lastThreeBarsTotalPct >= 0 ? '+' : ''}
                      {row.lastThreeBarsTotalPct.toFixed(2)}%
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        fontWeight:
                          row.z != null && row.z > zThreshold ? 700 : 400,
                        color:
                          row.z != null && row.z > zThreshold
                            ? 'error.main'
                            : 'inherit',
                      }}
                    >
                      {row.z == null ? '—' : row.z.toFixed(3)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {selectedKlines && selectedChartSymbol && (
        <Box sx={{ mb: 2, mt: 1 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              mb: 0.5,
            }}
          >
            <Typography variant="subtitle2">
              {selectedChartSymbol.replace('USDT', '')} · {interval}
            </Typography>
            <ButtonGroup size="small">
              <Button
                onClick={() => handleNavigate('up')}
                disabled={!canNavigateUp}
              >
                <KeyboardArrowUpIcon fontSize="small" />
              </Button>
              <Button
                onClick={() => handleNavigate('down')}
                disabled={!canNavigateDown}
              >
                <KeyboardArrowDownIcon fontSize="small" />
              </Button>
            </ButtonGroup>
          </Box>
          <Paper sx={{ p: 1, borderRadius: 1 }}>
            <KlineWithVolAndMA
              symbol={selectedChartSymbol}
              klines={selectedKlines}
              zThreshold={zThreshold}
            />
          </Paper>
        </Box>
      )}

      {!noSymbols && !loading && hasFetchedOnce && tableRows.length === 0 && (
        <Typography variant="caption" color="text.disabled">
          暂无 K 线数据，请重试 load / listen
        </Typography>
      )}

      {!noSymbols && !hasFetchedOnce && !loading && (
        <Typography variant="caption" color="text.disabled">
          点击 load 或 listen 加载
        </Typography>
      )}
    </Box>
  );
}
