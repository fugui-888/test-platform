import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import CloseIcon from '@mui/icons-material/Close';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import {
  Box,
  Button,
  Card,
  CardContent,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  useMediaQuery,
  useTheme,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Typography,
} from '@mui/material';
import { getAllKlineDataByInterval, KlineRecord } from '../../utils/db';
import getKLineData from '../../utils/fetch/getKLineData';
import type { MEXCKLINE } from '../../types/mexcKline';
import type { TradeLinePoint } from '../../utils/binance/watchlistMonitorKline';
import {
  buildKlineAndTradeLineFromFetchedRows,
  fetchIntervalForChart,
  type ChartPipelineInterval,
} from '../../utils/filter/chartKlineFromRows';
import Top10KlineChart from '../watchlist/Top10KlineChart';
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

const INTERVALS = ['5m', '15m', '30m', '1h', '4h', '1d'];
const FILTER_CHART_KLINE_LIMIT = 400;
const MAIN_CHART_Z = 2.5;
const FILTER_CHART_POLL_MS = 1000;
const CHART_INTERVALS: ChartPipelineInterval[] = [
  '1m',
  '5m',
  '10m',
  '15m',
  '30m',
  '1d',
];
const thCellSx = {
  textAlign: 'center' as const,
  px: 0.5,
  py: 0.75,
  whiteSpace: 'nowrap' as const,
  lineHeight: 1.2,
  fontSize: '0.72rem',
};
const sortCenter = {
  justifyContent: 'center',
  width: '100%',
  mx: 'auto',
  whiteSpace: 'nowrap',
  flexDirection: 'row' as const,
  gap: 0.25,
  '& .MuiTableSortLabel-icon': { margin: 0 },
};

function fmtPx(v: number): string {
  if (!Number.isFinite(v)) return '—';
  const a = Math.abs(v);
  if (a >= 1000) return v.toFixed(2);
  if (a >= 1) return v.toFixed(4);
  if (a >= 0.01) return v.toFixed(6);
  return v.toFixed(8);
}

const PullbackAnalysisPage: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const tableMaxHeight = isMobile ? '34vh' : 400;
  const chartHeight = isMobile ? 220 : 280;

  const [interval, setInterval] = useState<string>('30m');
  const [rows, setRows] = useState<ZFilterTableRow[]>([]);
  const [klineBySymbol, setKlineBySymbol] = useState<
    Record<string, KlineRecord>
  >({});
  const [computedAtMs, setComputedAtMs] = useState<number | null>(null);
  const [pickSymbol, setPickSymbol] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [totalAvailable, setTotalAvailable] = useState(0);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [relativeTick, setRelativeTick] = useState(0);
  const [sort, setSort] = useState<{
    key: ZFilterSortKey;
    order: 'asc' | 'desc';
  }>({
    key: 'zMa30',
    order: 'desc',
  });
  const [chartInterval, setChartInterval] =
    useState<ChartPipelineInterval>('30m');
  const [chartKline, setChartKline] = useState<MEXCKLINE | null>(null);
  const [chartTradeLine, setChartTradeLine] = useState<TradeLinePoint[]>([]);
  const [chartLoading, setChartLoading] = useState(false);
  const chartReqRef = useRef(0);

  const displayRows = useMemo(
    () => sortZFilterRows(rows, sort.key, sort.order),
    [rows, sort],
  );

  const pickIndex = useMemo(() => {
    if (!pickSymbol) return -1;
    return displayRows.findIndex((r) => r.symbol === pickSymbol);
  }, [pickSymbol, displayRows]);

  const computedRelative =
    computedAtMs != null ? formatRelativeZhPast(computedAtMs) : null;
  void relativeTick;

  useEffect(() => {
    const id = window.setInterval(() => setRelativeTick((x) => x + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const checkDataAvailability = async () => {
      try {
        const storedData = await getAllKlineDataByInterval(interval);
        setTotalAvailable(storedData.length);
      } catch {
        setTotalAvailable(0);
      }
    };
    void checkDataAvailability();
  }, [interval]);

  const restoreSnapshot = useCallback((iv: string) => {
    const snap = readZFilterSnapshotFromLS(iv);
    setRows(snap.rows);
    setComputedAtMs(snap.computedAtMs);
    setKlineBySymbol({});
    setPickSymbol(null);
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

  const handleSearch = async () => {
    setIsLoading(true);
    setProgress({ done: 0, total: 0 });
    try {
      const storedData = await getAllKlineDataByInterval(interval);
      if (storedData.length === 0) {
        setRows([]);
        setKlineBySymbol({});
        setPickSymbol(null);
        return;
      }
      setProgress({ done: 0, total: storedData.length });
      const acc: ZFilterTableRow[] = [];
      const bySym: Record<string, KlineRecord> = {};
      for (let i = 0; i < storedData.length; i++) {
        const record = storedData[i];
        const row = computeZFilterFilteredRow(record.symbol, record.klines);
        if (row) {
          acc.push(row);
          bySym[record.symbol] = record;
        }
        if (i % 20 === 19 || i === storedData.length - 1) {
          setProgress({ done: i + 1, total: storedData.length });
          await new Promise((r) => setTimeout(r, 0));
        }
      }
      const at = Date.now();
      setRows(acc);
      setKlineBySymbol(bySym);
      setComputedAtMs(at);
      writeZFilterSnapshotToLS(interval, acc, at);
      setPickSymbol(acc.length > 0 ? acc[0].symbol : null);
    } catch (error) {
      console.error('Filter 分析失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNavigate = (direction: 'up' | 'down') => {
    if (pickIndex < 0) return;
    const next = direction === 'up' ? pickIndex - 1 : pickIndex + 1;
    if (next >= 0 && next < displayRows.length) {
      setPickSymbol(displayRows[next].symbol);
    }
  };

  useEffect(() => {
    if (!pickSymbol) {
      setChartKline(null);
      setChartTradeLine([]);
      setChartLoading(false);
      return;
    }
    let cancelled = false;
    const load = async (touchLoading: boolean) => {
      const req = ++chartReqRef.current;
      if (touchLoading) setChartLoading(true);
      try {
        const qi = fetchIntervalForChart(chartInterval);
        const res = await getKLineData({
          symbol: pickSymbol,
          interval: qi,
          limit: String(FILTER_CHART_KLINE_LIMIT),
        });
        if (cancelled || req !== chartReqRef.current) return;
        const { kline, tradeLine } = buildKlineAndTradeLineFromFetchedRows(
          res.klines as unknown[][],
          chartInterval,
        );
        setChartKline(kline);
        setChartTradeLine(tradeLine);
      } catch {
        if (!cancelled && req === chartReqRef.current) {
          setChartKline(null);
          setChartTradeLine([]);
        }
      } finally {
        if (touchLoading && !cancelled && req === chartReqRef.current) {
          setChartLoading(false);
        }
      }
    };
    void load(true);
    const timerId = window.setInterval(
      () => void load(false),
      FILTER_CHART_POLL_MS,
    );
    return () => {
      cancelled = true;
      chartReqRef.current += 1;
      window.clearInterval(timerId);
    };
  }, [pickSymbol, chartInterval]);

  const canNavigateUp = pickIndex > 0;
  const canNavigateDown = pickIndex >= 0 && pickIndex < displayRows.length - 1;

  const sortDir = (key: ZFilterSortKey) =>
    sort.key === key ? sort.order : false;

  return (
    <Box sx={{ p: { xs: 0.5, sm: 1 } }}>
      <Card sx={{ mb: { xs: 1, sm: 2 } }}>
        <CardContent
          sx={{ p: { xs: 1, sm: 2 }, '&:last-child': { pb: { xs: 1, sm: 2 } } }}
        >
          <Grid container spacing={1} alignItems="center">
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <FormControl size="small" sx={{ minWidth: 100 }}>
                  <InputLabel>间隔</InputLabel>
                  <Select
                    value={interval}
                    label="间隔"
                    disabled={isLoading}
                    onChange={(e) => setInterval(e.target.value)}
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
                  onClick={() => void handleSearch()}
                  disabled={isLoading || totalAvailable === 0}
                  size="small"
                >
                  {isLoading ? '计算中…' : 'Filter'}
                </Button>
              </Box>
            </Grid>
            <Grid item xs={12}>
              <Typography
                variant="caption"
                sx={{
                  color: totalAvailable > 0 ? 'success.main' : 'error.main',
                  display: 'block',
                }}
              >
                {totalAvailable > 0
                  ? `本地已缓存: ${totalAvailable} 个币种`
                  : '请先在 Data 页加载 Binance 数据'}
                {computedAtMs != null && rows.length > 0
                  ? ` · 命中 ${rows.length} · ${computedRelative ?? ''}`
                  : ''}
              </Typography>
            </Grid>
          </Grid>
          {isLoading && progress.total > 0 && (
            <LinearProgress
              sx={{ mt: 1 }}
              variant="determinate"
              value={Math.min(100, (progress.done / progress.total) * 100)}
            />
          )}
        </CardContent>
      </Card>

      <Paper sx={{ mb: { xs: 1, sm: 2 } }}>
        <TableContainer
          sx={{
            maxHeight: tableMaxHeight,
            overflow: 'auto',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <Table
            stickyHeader
            size="small"
            sx={{
              minWidth: 560,
              tableLayout: 'auto',
              '& th': thCellSx,
              '& td': {
                ...thCellSx,
                fontSize: '0.75rem',
                py: 0.5,
              },
            }}
          >
            <TableHead>
              <TableRow>
                <TableCell align="center" sortDirection={sortDir('symbol')}>
                  <TableSortLabel
                    active={sort.key === 'symbol'}
                    direction={sort.key === 'symbol' ? sort.order : 'asc'}
                    onClick={() => handleSort('symbol')}
                    sx={sortCenter}
                  >
                    币名
                  </TableSortLabel>
                </TableCell>
                <TableCell align="center" sortDirection={sortDir('lastClose')}>
                  <TableSortLabel
                    active={sort.key === 'lastClose'}
                    direction={sort.key === 'lastClose' ? sort.order : 'desc'}
                    onClick={() => handleSort('lastClose')}
                    sx={sortCenter}
                  >
                    价格
                  </TableSortLabel>
                </TableCell>
                <TableCell align="center" sortDirection={sortDir('volLast2')}>
                  <TableSortLabel
                    active={sort.key === 'volLast2'}
                    direction={sort.key === 'volLast2' ? sort.order : 'desc'}
                    onClick={() => handleSort('volLast2')}
                    sx={sortCenter}
                  >
                    笔数
                  </TableSortLabel>
                </TableCell>
                <TableCell align="center" sortDirection={sortDir('zMa30')}>
                  <TableSortLabel
                    active={sort.key === 'zMa30'}
                    direction={sort.key === 'zMa30' ? sort.order : 'desc'}
                    onClick={() => handleSort('zMa30')}
                    sx={sortCenter}
                  >
                    z(MA30)
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
                    sx={sortCenter}
                  >
                    连涨
                  </TableSortLabel>
                </TableCell>
                <TableCell
                  align="center"
                  sortDirection={sortDir('consecUpPct')}
                >
                  <TableSortLabel
                    active={sort.key === 'consecUpPct'}
                    direction={sort.key === 'consecUpPct' ? sort.order : 'desc'}
                    onClick={() => handleSort('consecUpPct')}
                    sx={sortCenter}
                  >
                    连涨%
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
                    sx={sortCenter}
                  >
                    触碰根
                  </TableSortLabel>
                </TableCell>
                <TableCell
                  align="center"
                  sortDirection={sortDir('pctSinceUpCross')}
                >
                  <TableSortLabel
                    active={sort.key === 'pctSinceUpCross'}
                    direction={
                      sort.key === 'pctSinceUpCross' ? sort.order : 'desc'
                    }
                    onClick={() => handleSort('pctSinceUpCross')}
                    sx={sortCenter}
                  >
                    触碰%
                  </TableSortLabel>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {displayRows.map((row) => (
                <TableRow
                  key={row.symbol}
                  hover
                  selected={pickSymbol === row.symbol}
                  onClick={() => setPickSymbol(row.symbol)}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell align="center" sx={{ fontWeight: 700 }}>
                    {row.symbol.replace('USDT', '')}
                  </TableCell>
                  <TableCell align="center">{fmtPx(row.lastClose)}</TableCell>
                  <TableCell align="center">
                    {row.volLast2.toLocaleString()}
                  </TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700 }}>
                    {row.zMa30.toFixed(2)}
                  </TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700 }}>
                    {row.consecUpCount}
                  </TableCell>
                  <TableCell
                    align="center"
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
                    align="center"
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
              {!isLoading && displayRows.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    align="center"
                    sx={{ color: 'text.secondary', textAlign: 'center' }}
                  >
                    {totalAvailable === 0
                      ? '请先在 Data 页加载数据'
                      : `点击 Filter 计算；无币种满足 MA30 过滤（距触碰≥${Z_FILTER_MIN_BARS_SINCE_MA30_TOUCH} 根）`}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Card elevation={1} sx={{ width: '100%', minWidth: 0 }}>
        <CardContent sx={{ py: 0.75, px: 1, '&:last-child': { pb: 0.75 } }}>
          <Stack
            direction="row"
            alignItems="center"
            spacing={0.5}
            sx={{ mb: 0.5, width: '100%', minWidth: 0 }}
          >
            <FormControl size="small" sx={{ flexShrink: 0, minWidth: 58 }}>
              <Select
                value={chartInterval}
                onChange={(e) =>
                  setChartInterval(e.target.value as ChartPipelineInterval)
                }
                sx={{
                  fontSize: '0.75rem',
                  '& .MuiSelect-select': { py: 0.45, px: 1 },
                }}
              >
                {CHART_INTERVALS.map((iv) => (
                  <MenuItem key={iv} value={iv} dense>
                    {iv}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Typography
              noWrap
              sx={{
                flex: 1,
                minWidth: 0,
                fontWeight: 800,
                color: '#1565c0',
                fontSize: '0.8rem',
              }}
            >
              {pickSymbol ? pickSymbol.replace(/USDT$/i, '') : '点表看K线'}
            </Typography>
            <IconButton
              size="small"
              sx={{ p: 0.4 }}
              disabled={!canNavigateUp}
              onClick={() => handleNavigate('up')}
            >
              <KeyboardArrowUpIcon sx={{ fontSize: 20 }} />
            </IconButton>
            <IconButton
              size="small"
              sx={{ p: 0.4 }}
              disabled={!canNavigateDown}
              onClick={() => handleNavigate('down')}
            >
              <KeyboardArrowDownIcon sx={{ fontSize: 20 }} />
            </IconButton>
            {pickIndex >= 0 && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ flexShrink: 0, fontSize: '0.7rem' }}
              >
                {pickIndex + 1}/{displayRows.length}
              </Typography>
            )}
            {pickSymbol && (
              <IconButton
                size="small"
                sx={{ p: 0.4 }}
                onClick={() => {
                  setPickSymbol(null);
                  setChartKline(null);
                  setChartTradeLine([]);
                }}
              >
                <CloseIcon sx={{ fontSize: 20 }} />
              </IconButton>
            )}
          </Stack>
          {pickSymbol && chartKline && (
            <Top10KlineChart
              klines={chartKline}
              chartHeight={chartHeight}
              zThreshold={MAIN_CHART_Z}
              tradeCountLine={chartTradeLine}
              seriesKey={pickSymbol}
              intervalKey={chartInterval}
            />
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default PullbackAnalysisPage;
