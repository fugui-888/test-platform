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
import { getAllKlineDataByInterval, KlineRecord } from '../../utils/db';
import KlineWithVolAndMA from '../highPoint/KlineWithVolAndMA';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import InfoIcon from '@mui/icons-material/Info';

interface ResultRow {
  symbol: string;
  score: number;
  pumpHeight: number;
  retracement: number;
  volRatio: number;
  distToMA: number;
  pumpTimestamp: number;
  dailyChange: number;
}

const INTERVALS = ['5m', '15m', '30m', '1h', '4h', '1d'];

const PullbackAnalysisPage: React.FC = () => {
  const [lookback, setLookback] = useState<number>(150);
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

  const calculatePullbackScore = (klines: string[][]) => {
    if (klines.length < 60) return null;

    // 1. 寻找过去 lookback 范围内的最高点 (作为起爆后的顶)
    const recentKlines = klines.slice(-lookback);
    let maxHigh = -1;
    let maxIdx = -1;

    // 我们不希望最高点就在最后几根线（那样还没回调），所以排除最后 5 根
    for (let i = 0; i < recentKlines.length - 10; i++) {
      const high = parseFloat(recentKlines[i][2]);
      if (high > maxHigh) {
        maxHigh = high;
        maxIdx = i;
      }
    }

    if (maxIdx < 10) return null; // 顶太靠前了

    // 2. 寻找这个顶之前的起爆点 (低点)
    let minLow = maxHigh;
    let minIdx = -1;
    // 往前看 30 根找起跳点
    const preMaxRange = recentKlines.slice(Math.max(0, maxIdx - 30), maxIdx);
    if (preMaxRange.length === 0) return null;

    minLow = Math.min(...preMaxRange.map((k) => parseFloat(k[3])));

    const pumpHeight = (maxHigh - minLow) / minLow;
    if (pumpHeight < 0.05) return null; // 涨幅不足 5% 不算爆拉

    // 3. 计算当前回调深度
    const currentPrice = parseFloat(recentKlines[recentKlines.length - 1][4]);
    const currentRetrace = (maxHigh - currentPrice) / (maxHigh - minLow);

    // 回调分数: 理想在 0.382 - 0.618 之间 (黄金分割)
    let rScore = 0;
    if (currentRetrace > 0.2 && currentRetrace < 0.8) {
      // 越接近 0.5 分数越高
      rScore = (1 - Math.abs(currentRetrace - 0.5) * 2) * 100;
    } else {
      return null; // 回调太多或太少都不行
    }

    // 4. 成交量缩减分数 (回调缩量)
    const pumpPeakVol = parseFloat(recentKlines[maxIdx][5]);
    const recentAvgVol =
      recentKlines.slice(-5).reduce((sum, k) => sum + parseFloat(k[5]), 0) / 5;
    const volRatio = recentAvgVol / pumpPeakVol;
    // 缩量越厉害 (volRatio 越小) 分数越高
    const vScore = Math.max(0, (1 - volRatio) * 100);

    // 5. 均线支撑 (MA25)
    const maPeriod = 25;
    const ma25 =
      recentKlines
        .slice(-maPeriod)
        .reduce((sum, k) => sum + parseFloat(k[4]), 0) / maPeriod;
    const distToMA = Math.abs(currentPrice - ma25) / ma25;
    // 距离 MA25 越近 (2%以内) 分数越高
    const mScore = Math.max(0, (1 - distToMA / 0.03) * 100);

    // 6. 趋势强度 (Pump 越猛分数越高)
    const sScore = Math.min(pumpHeight * 500, 100);

    const totalScore =
      rScore * 0.3 + vScore * 0.2 + mScore * 0.3 + sScore * 0.2;

    // 7. 计算今日涨幅 (从 UTC 00:00 开始，即悉尼时间 11:00 AM)
    const now = new Date();
    const startOfTodayUtc = Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
    );
    const todayKlines = klines.filter((k) => Number(k[0]) >= startOfTodayUtc);
    let dailyChange = 0;
    if (todayKlines.length > 0) {
      const dayOpen = parseFloat(todayKlines[0][1]);
      dailyChange = (currentPrice - dayOpen) / dayOpen;
    } else {
      // 如果数据不够长，回退到使用全部数据的第一个点
      const dayOpen = parseFloat(klines[0][1]);
      dailyChange = (currentPrice - dayOpen) / dayOpen;
    }

    return {
      score: Math.round(totalScore),
      pumpHeight,
      retracement: currentRetrace,
      volRatio,
      distToMA,
      pumpTimestamp: Number(recentKlines[maxIdx][0]) / 1000,
      dailyChange,
    };
  };

  const handleSearch = async () => {
    setIsLoading(true);
    try {
      const storedData = await getAllKlineDataByInterval(interval);
      const newResults: ResultRow[] = [];
      const validKlineData: KlineRecord[] = [];

      storedData.forEach((record) => {
        const scoreData = calculatePullbackScore(record.klines);
        if (scoreData && scoreData.score > 40) {
          newResults.push({
            symbol: record.symbol,
            ...scoreData,
          });
          validKlineData.push(record);
        }
      });

      newResults.sort((a, b) => b.score - a.score);
      setResults(newResults);
      setAllKlineData(validKlineData);
      setSelectedRow(null);
    } catch (error) {
      console.error('分析失败:', error);
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

    if (diffDays > 0)
      return `${diffDays}天${remainingHours}小时${remainingMins}分钟`;
    if (diffHours > 0) return `${diffHours}小时${remainingMins}分钟`;
    return `${diffMins}分钟`;
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
                label="回溯范围"
                type="number"
                size="small"
                fullWidth
                value={lookback}
                onChange={(e) => setLookback(Number(e.target.value))}
              />
            </Grid>
            <Grid item xs={12} sm="auto">
              <Button
                variant="contained"
                color="secondary"
                onClick={handleSearch}
                disabled={isLoading || totalAvailable === 0}
                size="small"
              >
                回调分析 (二波)
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
        <Typography variant="subtitle2">
          回调潜力榜 ({results.length})
        </Typography>
        <Tooltip title="打分逻辑: 回调深度(30%) + 缩量程度(20%) + 均线支撑(30%) + 起爆强度(20%)">
          <InfoIcon fontSize="small" color="action" />
        </Tooltip>
      </Box>

      <Paper sx={{ mb: 2 }}>
        <TableContainer sx={{ maxHeight: 300 }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell>币名</TableCell>
                <TableCell align="right">综合分</TableCell>
                <TableCell align="right">今日涨幅</TableCell>
                <TableCell align="right">爆拉幅度</TableCell>
                <TableCell align="right">回调深度</TableCell>
                <TableCell align="right">距MA25</TableCell>
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
                      color: row.score > 70 ? 'secondary.main' : 'inherit',
                    }}
                  >
                    {row.score}
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      color:
                        row.dailyChange >= 0 ? 'success.main' : 'error.main',
                      fontWeight: 'bold',
                    }}
                  >
                    {(row.dailyChange * 100).toFixed(1)}%
                  </TableCell>
                  <TableCell align="right">
                    {(row.pumpHeight * 100).toFixed(1)}%
                  </TableCell>
                  <TableCell align="right">
                    {(row.retracement * 100).toFixed(0)}%
                  </TableCell>
                  <TableCell align="right">
                    {(row.distToMA * 100).toFixed(1)}%
                  </TableCell>
                </TableRow>
              ))}
              {results.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    未发现符合回调形态的币种
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
            <Box>
              <Typography variant="h6" component="span" sx={{ mr: 2 }}>
                {selectedRow.symbol}
              </Typography>
              <Typography
                variant="h6"
                component="span"
                sx={{
                  color:
                    selectedRow.dailyChange >= 0
                      ? 'success.main'
                      : 'error.main',
                  fontWeight: 'bold',
                  mr: 2,
                }}
              >
                今日: {(selectedRow.dailyChange * 100).toFixed(2)}%
              </Typography>
              <Typography
                variant="subtitle1"
                component="span"
                color="text.secondary"
              >
                评分: {selectedRow.score}
              </Typography>
            </Box>
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
              selectedDate={selectedRow.pumpTimestamp}
            />
          </Paper>
        </Box>
      )}
    </Box>
  );
};

export default PullbackAnalysisPage;
