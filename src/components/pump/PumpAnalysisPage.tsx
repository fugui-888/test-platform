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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
} from '@mui/material';
import { DateTime } from 'luxon';
import { getAllKlineDataByInterval, KlineRecord } from '../../utils/db';
import KlineWithVolAndMA from '../highPoint/KlineWithVolAndMA';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import InfoIcon from '@mui/icons-material/Info';

interface ResultRow {
  symbol: string;
  score: number;
  volRatio: number;
  priceChange: number;
  isNewHigh: boolean;
  vScore: number;
  pScore: number;
  hScore: number;
  tScore: number;
  offset: number;
  timestamp: number; // 起爆点的时间戳
}

const INTERVALS = ['5m', '15m', '30m', '1h', '4h', '1d'];

const PumpAnalysisPage: React.FC = () => {
  const [lookback, setLookback] = useState<number>(150);
  const [scanWindow, setScanWindow] = useState<number>(20);
  const [interval, setInterval] = useState<string>('5m');
  const [results, setResults] = useState<ResultRow[]>([]);
  const [selectedRow, setSelectedRow] = useState<ResultRow | null>(null);
  const [allKlineData, setAllKlineData] = useState<KlineRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [totalAvailable, setTotalAvailable] = useState<number>(0);
  const [lastUpdatedTime, setLastUpdatedTime] = useState<number | null>(null);

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

  const calculateScoreAtSlice = (
    fullKlines: string[][],
    currentIndex: number,
  ) => {
    const startIdx = Math.max(0, currentIndex - lookback + 1);
    const slice = fullKlines.slice(startIdx, currentIndex + 1);

    if (slice.length < 20) return null;

    // 1. Volume Score
    const shortLookback = 5;
    const recentSlice = slice.slice(-shortLookback);
    const recentAvgVol =
      recentSlice.reduce((sum, k) => sum + parseFloat(k[5]), 0) / shortLookback;
    const longAvgVol =
      slice.reduce((sum, k) => sum + parseFloat(k[5]), 0) / slice.length;
    const volRatio = longAvgVol > 0 ? recentAvgVol / longAvgVol : 0;
    const vScore = Math.min(volRatio * 10, 100);

    // 2. Price Score
    const prices = slice.map((k) => parseFloat(k[4]));
    const minPrice = Math.min(...prices);
    const currentPrice = prices[prices.length - 1];
    const priceChange = minPrice > 0 ? (currentPrice - minPrice) / minPrice : 0;
    const pScore = Math.min(priceChange * 200, 100);

    // 3. New High Score
    const highs = slice.map((k) => parseFloat(k[2]));
    const maxHigh = Math.max(...highs.slice(0, -1));
    const isNewHigh = currentPrice >= maxHigh * 0.98;
    const hScore = isNewHigh ? 100 : 0;

    // 4. Trend Score
    const bullishCount = recentSlice.filter(
      (k) => parseFloat(k[4]) > parseFloat(k[1]),
    ).length;
    const tScore = (bullishCount / shortLookback) * 100;

    const totalScore =
      vScore * 0.4 + pScore * 0.3 + hScore * 0.2 + tScore * 0.1;

    return {
      score: Math.round(totalScore),
      volRatio,
      priceChange,
      isNewHigh,
      vScore,
      pScore,
      hScore,
      tScore,
    };
  };

  const handleSearch = async () => {
    setIsLoading(true);
    try {
      const storedData = await getAllKlineDataByInterval(interval);
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
        if (length < lookback) return;

        let bestScore = -1;
        let bestScoreData: any = null;
        let bestOffset = 0;
        let bestTimestamp = 0;

        // 在最近的 scanWindow 范围内寻找最高分
        const startScan = Math.max(lookback, length - scanWindow);
        for (let i = startScan; i < length; i++) {
          const scoreData = calculateScoreAtSlice(klines, i);
          if (scoreData && scoreData.score > bestScore) {
            bestScore = scoreData.score;
            bestScoreData = scoreData;
            bestOffset = length - 1 - i;
            bestTimestamp = Number(klines[i][0]);
          }
        }

        if (bestScoreData && bestScoreData.score > 30) {
          newResults.push({
            symbol: record.symbol,
            ...bestScoreData,
            offset: bestOffset,
            timestamp: bestTimestamp / 1000, // 秒级
          });
          validKlineData.push(record);
        }
      });

      newResults.sort((a, b) => b.score - a.score);
      setResults(newResults);
      setAllKlineData(validKlineData);
      setSelectedRow(null);
    } catch (error) {
      console.error('分析过程中发生错误:', error);
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

  return (
    <Box sx={{ p: 1 }}>
      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ p: 2 }}>
          <Grid container spacing={1} alignItems="center">
            <Grid item xs={6} sm="auto">
              <FormControl size="small" fullWidth sx={{ minWidth: 100 }}>
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
                label="回溯基准"
                type="number"
                size="small"
                fullWidth
                value={lookback}
                onChange={(e) => setLookback(Number(e.target.value))}
              />
            </Grid>
            <Grid item xs={6} sm="auto">
              <TextField
                label="搜索范围"
                type="number"
                size="small"
                fullWidth
                value={scanWindow}
                onChange={(e) => setScanWindow(Number(e.target.value))}
                placeholder="最近多少根"
              />
            </Grid>
            <Grid item xs={12} sm="auto">
              <Button
                variant="contained"
                onClick={handleSearch}
                disabled={isLoading || totalAvailable === 0}
                size="small"
              >
                爆破分析
              </Button>
            </Grid>
            <Grid item xs={12} sm="auto">
              <Typography
                variant="caption"
                sx={{
                  color: totalAvailable > 0 ? 'success.main' : 'error.main',
                  display: 'block',
                }}
              >
                {totalAvailable > 0
                  ? `本地已缓存: ${totalAvailable} 个币种`
                  : '请先加载数据'}
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

      <Box sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="subtitle2">爆破榜单 ({results.length})</Typography>
        <Tooltip title="打分逻辑: 交易量突增(40%) + 价格涨幅(30%) + 接近前高(20%) + 近期连阳(10%)">
          <InfoIcon fontSize="small" color="action" />
        </Tooltip>
      </Box>

      <Paper sx={{ mb: 2 }}>
        <TableContainer sx={{ maxHeight: 300 }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell>币名</TableCell>
                <TableCell align="right">最高分</TableCell>
                <TableCell align="right">位置</TableCell>
                <TableCell align="right">量比</TableCell>
                <TableCell align="right">涨幅</TableCell>
                <TableCell align="right">状态</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {results.map((row) => (
                <TableRow
                  key={row.symbol}
                  hover
                  selected={selectedRow?.symbol === row.symbol}
                  onClick={() => setSelectedRow(row)}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell>{row.symbol.replace('USDT', '')}</TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      fontWeight: 'bold',
                      color: row.score > 70 ? 'error.main' : 'inherit',
                    }}
                  >
                    {row.score}
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      color:
                        row.offset === 0 ? 'success.main' : 'text.secondary',
                    }}
                  >
                    {row.offset === 0 ? '当前' : `${row.offset}根前`}
                  </TableCell>
                  <TableCell align="right">
                    {row.volRatio.toFixed(1)}x
                  </TableCell>
                  <TableCell align="right">
                    {(row.priceChange * 100).toFixed(1)}%
                  </TableCell>
                  <TableCell align="right">
                    {row.isNewHigh ? '突破' : '放量'}
                  </TableCell>
                </TableRow>
              ))}
              {results.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    未发现明显爆破迹象
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {selectedRow && (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="h6">
              {selectedRow.symbol} ({interval}) - 评分: {selectedRow.score}
            </Typography>
            <ButtonGroup size="small">
              <Button
                onClick={() => handleNavigate('up')}
                disabled={results.indexOf(selectedRow) === 0}
              >
                <KeyboardArrowUpIcon />
              </Button>
              <Button
                onClick={() => handleNavigate('down')}
                disabled={results.indexOf(selectedRow) === results.length - 1}
              >
                <KeyboardArrowDownIcon />
              </Button>
            </ButtonGroup>
          </Box>
          <Paper sx={{ p: 1 }}>
            <KlineWithVolAndMA
              symbol={selectedRow.symbol}
              klines={
                allKlineData.find((k) => k.symbol === selectedRow.symbol)
                  ?.klines || []
              }
              selectedDate={selectedRow.timestamp}
            />
          </Paper>
        </Box>
      )}
    </Box>
  );
};

export default PumpAnalysisPage;
