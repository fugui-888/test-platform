import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Grid,
  TextField,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  ButtonGroup,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { DateTime } from 'luxon';
import { getAllKlineDataByInterval, KlineRecord } from '../../utils/db';
import KlineWithVolAndMA from './KlineWithVolAndMA';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';

interface Filter {
  count: number;
  minRatio: number;
}

interface ResultRow {
  symbol: string;
  ratio: number;
  open: number;
  close: number;
  minLow: number;
  minLowDate: number;
}

const INTERVALS = ['5m', '15m', '30m', '1h', '4h', '1d'];

const HighPointPage: React.FC = () => {
  const [filter, setFilter] = useState<Filter>({
    count: 100,
    minRatio: 2.5,
  });
  const [interval, setInterval] = useState<string>('1d');
  const [results, setResults] = useState<ResultRow[]>([]);
  const [selectedRow, setSelectedRow] = useState<ResultRow | null>(null);
  const [allKlineData, setAllKlineData] = useState<KlineRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [totalAvailable, setTotalAvailable] = useState<number>(0);
  const [lastUpdatedTime, setLastUpdatedTime] = useState<number | null>(null);

  const handleFilterChange = (field: keyof Filter, value: any) => {
    setFilter((prev) => ({ ...prev, [field]: value }));
  };

  const formatTimeDiff = (timestamp: number) => {
    const diffMs = Date.now() - timestamp;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    const remainingHours = diffHours % 24;
    const remainingMins = diffMins % 60;

    if (diffDays > 0) {
      return `${diffDays}天${remainingHours}小时${remainingMins}分钟`;
    } else if (diffHours > 0) {
      return `${diffHours}小时${remainingMins}分钟`;
    } else {
      return `${diffMins}分钟`;
    }
  };

  useEffect(() => {
    const checkDataAvailability = async () => {
      try {
        const storedData = await getAllKlineDataByInterval(interval);
        setTotalAvailable(storedData.length);
        if (storedData.length > 0) {
          const maxTime = Math.max(...storedData.map((r) => r.lastUpdated));
          setLastUpdatedTime(maxTime);
        } else {
          setLastUpdatedTime(null);
        }
      } catch (error) {
        console.error('检查数据可用性失败:', error);
        setTotalAvailable(0);
        setLastUpdatedTime(null);
      }
    };
    checkDataAvailability();
  }, [interval]);

  const handleSearch = async () => {
    setIsLoading(true);
    try {
      const storedData = await getAllKlineDataByInterval(interval);
      setTotalAvailable(storedData.length);
      if (storedData.length === 0) {
        setResults([]);
        setAllKlineData([]);
        return;
      }

      const newResults: ResultRow[] = [];
      const validKlineData: KlineRecord[] = [];

      storedData.forEach((record) => {
        const klines = record.klines;
        const length = klines.length;
        if (length === 0) return;

        const endIdx = length - 1;
        const startIdx = Math.max(0, endIdx - filter.count + 1);
        const slice = klines.slice(startIdx, endIdx + 1);

        const lows = slice.map((k) => parseFloat(k[3]));
        if (lows.length === 0) return;

        const minLow = Math.min(...lows);
        const minLowIdx = lows.findIndex((v) => v === minLow);
        const minLowDate = Number(klines[startIdx + minLowIdx][0]);

        const close = parseFloat(klines[endIdx][4]);
        const open = parseFloat(klines[endIdx][1]);
        const ratio = close / minLow;

        if (ratio >= filter.minRatio) {
          newResults.push({
            symbol: record.symbol,
            ratio: ratio,
            open,
            close,
            minLow,
            minLowDate: minLowDate / 1000,
          });
          validKlineData.push(record);
        }
      });

      newResults.sort((a, b) => b.ratio - a.ratio);
      setResults(newResults);
      setAllKlineData(validKlineData);
      setSelectedRow(null);
    } catch (error) {
      console.error('搜索过程中发生错误:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNavigate = (direction: 'up' | 'down') => {
    if (!selectedRow) return;
    const currentIndex = results.findIndex(
      (row) => row.symbol === selectedRow.symbol,
    );
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex >= 0 && newIndex < results.length) {
      setSelectedRow(results[newIndex]);
    }
  };

  const canNavigateUp =
    selectedRow &&
    results.findIndex((row) => row.symbol === selectedRow.symbol) > 0;
  const canNavigateDown =
    selectedRow &&
    results.findIndex((row) => row.symbol === selectedRow.symbol) <
      results.length - 1;

  return (
    <Box sx={{ p: 1, backgroundColor: 'transparent' }}>
      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Grid container spacing={1} alignItems="center">
            <Grid item xs={6} sm="auto">
              <FormControl size="small" fullWidth sx={{ minWidth: 80 }}>
                <InputLabel>间隔</InputLabel>
                <Select
                  value={interval}
                  label="间隔"
                  onChange={(e) => setInterval(e.target.value)}
                >
                  {INTERVALS.map((int) => (
                    <MenuItem key={int} value={int}>
                      {int}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6} sm="auto">
              <TextField
                label="回测"
                type="number"
                size="small"
                fullWidth
                value={filter.count}
                onChange={(e) =>
                  handleFilterChange('count', Number(e.target.value))
                }
              />
            </Grid>
            <Grid item xs={6} sm="auto">
              <TextField
                label="倍数"
                type="number"
                size="small"
                fullWidth
                value={filter.minRatio}
                onChange={(e) =>
                  handleFilterChange('minRatio', Number(e.target.value))
                }
              />
            </Grid>
            <Grid item xs={6} sm="auto">
              <Button
                variant="contained"
                onClick={handleSearch}
                disabled={isLoading || totalAvailable === 0}
                fullWidth
                size="small"
              >
                分析
              </Button>
            </Grid>
            <Grid item xs={12} sm="auto">
              <Typography
                variant="caption"
                sx={{
                  color: totalAvailable > 0 ? 'success.main' : 'error.main',
                  fontWeight: 'bold',
                  display: 'block',
                }}
              >
                {totalAvailable > 0
                  ? `本地已缓存: ${totalAvailable} 个币种`
                  : '本地无数据, 请先在加载页面加载数据'}
              </Typography>
              {lastUpdatedTime && (
                <Typography
                  variant="caption"
                  sx={{ color: 'text.secondary', display: 'block' }}
                >
                  数据更新于: {formatTimeDiff(lastUpdatedTime)}前
                </Typography>
              )}
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Box sx={{ mb: 1 }}>
        <Typography variant="caption" color="text.secondary">
          筛选出 {results.length} 条
        </Typography>
        <Paper sx={{ borderRadius: 1, overflow: 'hidden', mt: 0.5 }}>
          <TableContainer sx={{ maxHeight: 300, overflow: 'auto' }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ py: 0.5, px: 1 }}>币名</TableCell>
                  <TableCell sx={{ py: 0.5, px: 1 }}>倍数</TableCell>
                  <TableCell sx={{ py: 0.5, px: 1 }}>最小值日期</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {results.map((row) => (
                  <TableRow
                    key={row.symbol}
                    hover
                    selected={selectedRow?.symbol === row.symbol}
                    onClick={() => setSelectedRow(row)}
                    style={{ cursor: 'pointer' }}
                  >
                    <TableCell sx={{ py: 0.5, px: 1 }}>
                      {row.symbol.replace('USDT', '')}
                    </TableCell>
                    <TableCell sx={{ py: 0.5, px: 1 }}>
                      {row.ratio.toFixed(2)}
                    </TableCell>
                    <TableCell sx={{ py: 0.5, px: 1 }}>
                      {DateTime.fromSeconds(row.minLowDate).toFormat(
                        'MM-dd HH:mm',
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {results.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} align="center">
                      <Typography variant="caption" color="text.disabled">
                        无数据
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Box>

      {selectedRow && (
        <Box sx={{ mt: 2 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              mb: 0.5,
            }}
          >
            <Typography variant="subtitle2">
              {selectedRow.symbol.replace('USDT', '')} ({interval})
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
              symbol={selectedRow.symbol}
              klines={
                allKlineData.find((item) => item.symbol === selectedRow.symbol)
                  ?.klines || []
              }
              selectedDate={selectedRow.minLowDate}
            />
          </Paper>
        </Box>
      )}
    </Box>
  );
};

export default HighPointPage;
