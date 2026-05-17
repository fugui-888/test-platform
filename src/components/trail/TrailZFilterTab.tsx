import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  FormControl,
  IconButton,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Typography,
} from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import CloseIcon from '@mui/icons-material/Close';
import { getAllKlineDataByInterval, getKlineData } from '../../utils/db';
import {
  getOKEXKLineData,
  type OkexKlineInterval,
} from '../../utils/fetch/getOKEXKLineData';
import {
  computeZFilterFilteredRow,
  sortZFilterRows,
  Z_FILTER_MIN_BARS_SINCE_MA30_TOUCH,
  formatRelativeZhPast,
  type ZFilterSortKey,
  type ZFilterTableRow,
} from '../../utils/trail/zFilterMetrics';
import {
  readZFilterSnapshotFromLS,
  writeZFilterSnapshotToLS,
} from '../../utils/trail/zFilterStorage';
import TrailTrackChart, { type TrackCandle } from './TrailTrackChart';

const INTERVALS: OkexKlineInterval[] = [
  '5m',
  '15m',
  '30m',
  '1H',
  '4H',
  '1Dutc',
];

function dbInterval(interval: OkexKlineInterval) {
  return `okex-${interval}`;
}

function fmtPx(v: number): string {
  if (!Number.isFinite(v)) return '—';
  const a = Math.abs(v);
  if (a >= 1000) return v.toFixed(2);
  if (a >= 1) return v.toFixed(4);
  if (a >= 0.01) return v.toFixed(6);
  return v.toFixed(8);
}

function klinesToTrackCandles(klines: string[][]): TrackCandle[] {
  return klines
    .map((k) => ({
      ts: Math.floor(Number(k[0]) / 1000),
      open: Number(k[1]),
      high: Number(k[2]),
      low: Number(k[3]),
      close: Number(k[4]),
      vol: Number(k[5]),
    }))
    .filter((c) => Number.isFinite(c.ts) && Number.isFinite(c.open));
}

const TrailZFilterTab: React.FC = () => {
  const [interval, setInterval] = useState<OkexKlineInterval>('30m');
  const [rows, setRows] = useState<ZFilterTableRow[]>([]);
  const [computedAtMs, setComputedAtMs] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [relativeTick, setRelativeTick] = useState(0);
  const [sort, setSort] = useState<{
    key: ZFilterSortKey;
    order: 'asc' | 'desc';
  }>({
    key: 'zMa30',
    order: 'desc',
  });
  const [pickSymbol, setPickSymbol] = useState<string | null>(null);
  const [chartCandles, setChartCandles] = useState<TrackCandle[]>([]);
  const [chartNote, setChartNote] = useState('');
  const [tracking, setTracking] = useState(false);

  const displayRows = useMemo(
    () => sortZFilterRows(rows, sort.key, sort.order),
    [rows, sort],
  );

  const pickIndex = useMemo(() => {
    if (!pickSymbol) return -1;
    return displayRows.findIndex((r) => r.symbol === pickSymbol);
  }, [pickSymbol, displayRows]);

  const chartCanPrev = pickIndex > 0;
  const chartCanNext = pickIndex >= 0 && pickIndex < displayRows.length - 1;

  // relativeTick 每 30s +1，触发重渲染以更新「X 分钟前」
  const computedRelative =
    computedAtMs != null ? formatRelativeZhPast(computedAtMs) : null;
  void relativeTick;

  useEffect(() => {
    const id = window.setInterval(() => setRelativeTick((x) => x + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const restoreSnapshot = useCallback((iv: OkexKlineInterval) => {
    const snap = readZFilterSnapshotFromLS(iv);
    setRows(snap.rows);
    setComputedAtMs(snap.computedAtMs);
    setPickSymbol(null);
    setChartCandles([]);
    setChartNote('');
    setTracking(false);
    setError(null);
  }, []);

  useEffect(() => {
    restoreSnapshot(interval);
  }, [interval, restoreSnapshot]);

  const handleSort = useCallback((key: ZFilterSortKey) => {
    setSort((s) => {
      if (s.key === key) {
        return { key, order: s.order === 'asc' ? 'desc' : 'asc' };
      }
      return { key, order: key === 'symbol' ? 'asc' : 'desc' };
    });
  }, []);

  const runCompute = useCallback(async () => {
    setLoading(true);
    setError(null);
    setProgress({ done: 0, total: 0 });
    try {
      const all = await getAllKlineDataByInterval(dbInterval(interval));
      if (all.length === 0) {
        setRows([]);
        setComputedAtMs(null);
        setError('本地无该周期 K 线，请先在 Data 页加载 OKEX 数据');
        return;
      }
      setProgress({ done: 0, total: all.length });
      const acc: ZFilterTableRow[] = [];
      for (let i = 0; i < all.length; i++) {
        const record = all[i];
        const row = computeZFilterFilteredRow(record.symbol, record.klines);
        if (row) acc.push(row);
        if (i % 20 === 19 || i === all.length - 1) {
          setProgress({ done: i + 1, total: all.length });
          await new Promise((r) => setTimeout(r, 0));
        }
      }
      const at = Date.now();
      setRows(acc);
      setComputedAtMs(at);
      writeZFilterSnapshotToLS(interval, acc, at);
      setPickSymbol(null);
      setChartCandles([]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [interval]);

  const loadChartFromCache = useCallback(
    async (symbol: string) => {
      const rec = await getKlineData(symbol, dbInterval(interval));
      if (!rec?.klines?.length) {
        setChartCandles([]);
        setChartNote('本地无该币种 K 线');
        return;
      }
      const candles = klinesToTrackCandles(rec.klines);
      setChartCandles(candles);
      setChartNote(
        `缓存 · ${candles.length} 根 · ${interval} · ${new Date(
          rec.lastUpdated,
        ).toLocaleString()}`,
      );
    },
    [interval],
  );

  useEffect(() => {
    if (!pickSymbol) {
      setChartCandles([]);
      setChartNote('');
      return;
    }
    void loadChartFromCache(pickSymbol);
  }, [pickSymbol, interval, loadChartFromCache]);

  useEffect(() => {
    if (!pickSymbol) return;
    if (!rows.some((r) => r.symbol === pickSymbol)) {
      setPickSymbol(null);
    }
  }, [rows, pickSymbol]);

  const toInstId = (symbol: string) => {
    const base = symbol.endsWith('USDT') ? symbol.replace('USDT', '') : symbol;
    return `${base}-USDT-SWAP`;
  };

  const fetchTrackLive = useCallback(async () => {
    if (!pickSymbol) return;
    try {
      const res = await getOKEXKLineData({
        symbol: pickSymbol,
        instId: toInstId(pickSymbol),
        interval,
        limit: 320,
      });
      const candles = klinesToTrackCandles(res.klines);
      setChartCandles(candles);
      setChartNote(
        `实时 · ${new Date().toLocaleTimeString()} · ${candles.length} 根`,
      );
    } catch (e: unknown) {
      setChartNote(`追踪失败: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [pickSymbol, interval]);

  useEffect(() => {
    if (!tracking || !pickSymbol) return;
    void fetchTrackLive();
    const id = window.setInterval(() => void fetchTrackLive(), 1000);
    return () => clearInterval(id);
  }, [tracking, pickSymbol, interval, fetchTrackLive]);

  const handleChartPrev = () => {
    if (pickIndex <= 0) return;
    setPickSymbol(displayRows[pickIndex - 1].symbol);
  };

  const handleChartNext = () => {
    if (pickIndex < 0 || pickIndex >= displayRows.length - 1) return;
    setPickSymbol(displayRows[pickIndex + 1].symbol);
  };

  const sortDir = (key: ZFilterSortKey) =>
    sort.key === key ? sort.order : false;

  return (
    <Box sx={{ p: 1 }}>
      <Card elevation={1} sx={{ mb: 1.5 }}>
        <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
            Z Filter（MA30 + 触碰过滤）
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', mb: 1 }}
          >
            基于 Data 页载入的 OKEX 本地 K 线，按所选周期计算。过滤条件与
            monitor-platform 全局 30m 一致：最后一根收盘在 MA30 之上、存在 K
            线触碰 MA30、且距触碰 ≥{Z_FILTER_MIN_BARS_SINCE_MA30_TOUCH}{' '}
            根。表头可排序；结果按周期保存在本机。
          </Typography>
          <Stack
            direction="row"
            alignItems="center"
            spacing={1}
            flexWrap="wrap"
            useFlexGap
            sx={{ gap: 1, mb: 1 }}
          >
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>K 线周期</InputLabel>
              <Select
                value={interval}
                label="K 线周期"
                disabled={loading}
                onChange={(e) =>
                  setInterval(e.target.value as OkexKlineInterval)
                }
              >
                {INTERVALS.map((int) => (
                  <MenuItem key={int} value={int}>
                    {int}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button
              variant="contained"
              size="small"
              disabled={loading}
              onClick={() => void runCompute()}
              sx={{ minWidth: 112 }}
            >
              {loading ? '计算中…' : '计算 Z Filter'}
            </Button>
            {computedAtMs != null && (
              <Typography variant="caption" color="text.secondary">
                上次计算：{new Date(computedAtMs).toLocaleString()}
                {computedRelative ? ` · ${computedRelative}` : ''}
                {` · 共 ${rows.length} 条`}
              </Typography>
            )}
          </Stack>
          {loading && progress.total > 0 && (
            <LinearProgress
              variant="determinate"
              value={Math.min(100, (progress.done / progress.total) * 100)}
              sx={{ mb: 1 }}
            />
          )}
          {loading && (
            <Typography
              variant="caption"
              color="primary"
              sx={{ display: 'block', mb: 0.5 }}
            >
              {progress.total === 0
                ? '读取本地 K 线…'
                : `扫描 ${progress.done}/${progress.total}`}
            </Typography>
          )}
          {error && (
            <Typography variant="caption" color="error" display="block">
              {error}
            </Typography>
          )}
        </CardContent>
      </Card>

      <Paper sx={{ mb: 1.5 }}>
        <TableContainer sx={{ maxHeight: 420, overflow: 'auto' }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sortDirection={sortDir('symbol')}>
                  <TableSortLabel
                    active={sort.key === 'symbol'}
                    direction={sort.key === 'symbol' ? sort.order : 'asc'}
                    onClick={() => handleSort('symbol')}
                  >
                    币种
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right" sortDirection={sortDir('lastClose')}>
                  <TableSortLabel
                    active={sort.key === 'lastClose'}
                    direction={sort.key === 'lastClose' ? sort.order : 'desc'}
                    onClick={() => handleSort('lastClose')}
                    sx={{ justifyContent: 'flex-end', width: '100%' }}
                  >
                    价格
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right" sortDirection={sortDir('volLast2')}>
                  <TableSortLabel
                    active={sort.key === 'volLast2'}
                    direction={sort.key === 'volLast2' ? sort.order : 'desc'}
                    onClick={() => handleSort('volLast2')}
                    sx={{ justifyContent: 'flex-end', width: '100%' }}
                  >
                    量(近2)
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right" sortDirection={sortDir('zMa30')}>
                  <TableSortLabel
                    active={sort.key === 'zMa30'}
                    direction={sort.key === 'zMa30' ? sort.order : 'desc'}
                    onClick={() => handleSort('zMa30')}
                    sx={{ justifyContent: 'flex-end', width: '100%' }}
                  >
                    z
                  </TableSortLabel>
                </TableCell>
                <TableCell
                  align="center"
                  sortDirection={sortDir('consecUpCount')}
                >
                  <TableSortLabel
                    active={sort.key === 'consecUpCount'}
                    direction={
                      sort.key === 'consecUpCount' ? sort.order : 'desc'
                    }
                    onClick={() => handleSort('consecUpCount')}
                    sx={{ justifyContent: 'center', width: '100%' }}
                  >
                    连涨根数
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right" sortDirection={sortDir('consecUpPct')}>
                  <TableSortLabel
                    active={sort.key === 'consecUpPct'}
                    direction={sort.key === 'consecUpPct' ? sort.order : 'desc'}
                    onClick={() => handleSort('consecUpPct')}
                    sx={{ justifyContent: 'flex-end', width: '100%' }}
                  >
                    连涨涨幅
                  </TableSortLabel>
                </TableCell>
                <TableCell
                  align="center"
                  sortDirection={sortDir('barsSinceUpCross')}
                >
                  <TableSortLabel
                    active={sort.key === 'barsSinceUpCross'}
                    direction={
                      sort.key === 'barsSinceUpCross' ? sort.order : 'desc'
                    }
                    onClick={() => handleSort('barsSinceUpCross')}
                    sx={{ justifyContent: 'center', width: '100%' }}
                  >
                    触碰根数
                  </TableSortLabel>
                </TableCell>
                <TableCell
                  align="right"
                  sortDirection={sortDir('pctSinceUpCross')}
                >
                  <TableSortLabel
                    active={sort.key === 'pctSinceUpCross'}
                    direction={
                      sort.key === 'pctSinceUpCross' ? sort.order : 'desc'
                    }
                    onClick={() => handleSort('pctSinceUpCross')}
                    sx={{ justifyContent: 'flex-end', width: '100%' }}
                  >
                    触碰涨幅
                  </TableSortLabel>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {!loading && rows.length === 0 && !error && (
                <TableRow>
                  <TableCell colSpan={8} sx={{ color: 'text.secondary' }}>
                    选择周期后点击「计算 Z Filter」。需先在 Data
                    页加载对应周期的 OKEX K 线。
                  </TableCell>
                </TableRow>
              )}
              {!loading && rows.length === 0 && computedAtMs != null && (
                <TableRow>
                  <TableCell colSpan={8} sx={{ color: 'text.secondary' }}>
                    本轮无币种满足：收盘在 MA30 之上、存在触碰 MA30、且距触碰 ≥
                    {Z_FILTER_MIN_BARS_SINCE_MA30_TOUCH} 根。
                  </TableCell>
                </TableRow>
              )}
              {displayRows.map((row) => (
                <TableRow
                  key={row.symbol}
                  hover
                  selected={pickSymbol === row.symbol}
                  onClick={() => setPickSymbol(row.symbol)}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell sx={{ fontWeight: 700 }}>{row.symbol}</TableCell>
                  <TableCell align="right">{fmtPx(row.lastClose)}</TableCell>
                  <TableCell align="right">
                    {row.volLast2.toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })}
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      fontWeight: 700,
                      color:
                        Math.abs(row.zMa30) >= 2 ? 'error.main' : undefined,
                    }}
                  >
                    {row.zMa30.toFixed(2)}
                  </TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700 }}>
                    {row.consecUpCount}
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      fontWeight: 700,
                      color:
                        row.consecUpPct > 0
                          ? '#2e7d32'
                          : row.consecUpPct < 0
                          ? '#c62828'
                          : undefined,
                    }}
                  >
                    {row.consecUpPct.toFixed(2)}%
                  </TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700 }}>
                    {row.barsSinceUpCross}
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      fontWeight: 700,
                      color:
                        row.pctSinceUpCross > 0
                          ? '#2e7d32'
                          : row.pctSinceUpCross < 0
                          ? '#c62828'
                          : undefined,
                    }}
                  >
                    {row.pctSinceUpCross.toFixed(2)}%
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Card elevation={1}>
        <CardContent sx={{ py: 1, '&:last-child': { pb: 1 } }}>
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            flexWrap="wrap"
            sx={{ mb: 1 }}
          >
            <Typography
              variant="subtitle2"
              sx={{ fontWeight: 800, color: '#1565c0' }}
            >
              {pickSymbol ?? '未选币种'}
            </Typography>
            <Box sx={{ flex: 1 }} />
            <IconButton
              size="small"
              disabled={!chartCanPrev}
              onClick={handleChartPrev}
              title="上一币"
            >
              <KeyboardArrowUpIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              disabled={!chartCanNext}
              onClick={handleChartNext}
              title="下一币"
            >
              <KeyboardArrowDownIcon fontSize="small" />
            </IconButton>
            {pickIndex >= 0 && displayRows.length > 0 && (
              <Typography variant="caption" color="text.secondary">
                {pickIndex + 1}/{displayRows.length}
              </Typography>
            )}
            {pickSymbol && (
              <IconButton
                size="small"
                title="关闭"
                onClick={() => {
                  setPickSymbol(null);
                  setTracking(false);
                }}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            )}
          </Stack>
          {pickSymbol && (
            <Stack
              direction="row"
              alignItems="center"
              spacing={1}
              sx={{ mb: 1 }}
            >
              <Button
                variant={tracking ? 'outlined' : 'contained'}
                size="small"
                onClick={() => setTracking((v) => !v)}
              >
                {tracking ? '停止实时追踪' : 'OKEX 实时追踪'}
              </Button>
              {chartNote && (
                <Typography variant="caption" color="text.secondary">
                  {chartNote}
                </Typography>
              )}
            </Stack>
          )}
          {!pickSymbol && (
            <Typography variant="caption" color="text.secondary">
              点击表格行查看 K 线（默认用本地缓存）
            </Typography>
          )}
          {chartCandles.length > 0 && (
            <TrailTrackChart candles={chartCandles} height={420} />
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default TrailZFilterTab;
