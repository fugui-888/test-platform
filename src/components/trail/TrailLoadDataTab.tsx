import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  FormControl,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Typography,
} from '@mui/material';
import {
  saveKlineData,
  openDB,
  KlineRecord,
  clearKlineDataByInterval,
} from '../../utils/db';
import { getOKEXSymbolList } from '../../utils/fetch/getOKEXSymbolList';
import {
  getOKEXKLineData,
  OkexKlineInterval,
} from '../../utils/fetch/getOKEXKLineData';

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

const TrailLoadDataTab: React.FC = () => {
  const [interval, setInterval] = useState<OkexKlineInterval>('5m');
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [lastUpdate, setLastUpdate] = useState<{ [key: string]: number }>({});
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    const checkStatus = async () => {
      const db = await openDB();
      const transaction = db.transaction('klines', 'readonly');
      const store = transaction.objectStore('klines');
      const request = store.getAll();
      request.onsuccess = () => {
        const all = request.result as (KlineRecord & { id: string })[];
        const updates: { [key: string]: number } = {};
        all.forEach((r) => {
          if (!r.interval.startsWith('okex-')) return;
          if (!updates[r.interval] || r.lastUpdated > updates[r.interval]) {
            updates[r.interval] = r.lastUpdated;
          }
        });
        setLastUpdate(updates);
      };
    };
    checkStatus();
  }, [isLoading, refreshTrigger]);

  const handleLoadData = async () => {
    setIsLoading(true);
    setProgress({ current: 0, total: 0 });

    try {
      const symbols = await getOKEXSymbolList();
      const total = symbols.length;
      setProgress({ current: 0, total });

      const chunkSize = 20;
      for (let i = 0; i < symbols.length; i += chunkSize) {
        const chunk = symbols.slice(i, i + chunkSize);
        await Promise.all(
          chunk.map(async (item) => {
            try {
              const res = await getOKEXKLineData({
                symbol: item.symbol,
                instId: item.instId,
                interval,
                limit: 320, // z 值页至少 30 根，这里多拉一些
              });
              if (res.klines.length >= 30) {
                await saveKlineData(
                  item.symbol,
                  dbInterval(interval),
                  res.klines,
                );
              }
            } catch (err) {
              console.error(`Error loading ${item.symbol}:`, err);
            }
          }),
        );

        setProgress((prev) => ({
          ...prev,
          current: Math.min(i + chunkSize, total),
        }));
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error('加载 OKEX 数据失败:', error);
    } finally {
      setIsLoading(false);
      setRefreshTrigger((v) => v + 1);
    }
  };

  const handleClearData = async (int: OkexKlineInterval) => {
    const key = dbInterval(int);
    if (window.confirm(`确定要清除 ${key} 的本地数据吗？`)) {
      await clearKlineDataByInterval(key);
      setRefreshTrigger((prev) => prev + 1);
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
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 1,
            mb: 2,
          }}
        >
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>间隔</InputLabel>
            <Select
              value={interval}
              label="间隔"
              onChange={(e) => setInterval(e.target.value as OkexKlineInterval)}
              disabled={isLoading}
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
            onClick={handleLoadData}
            disabled={isLoading}
            size="small"
            startIcon={
              isLoading ? <CircularProgress size={16} color="inherit" /> : null
            }
          >
            {isLoading ? '加载中' : '从 OKEX 开始加载'}
          </Button>
        </Box>

        {isLoading && progress.total > 0 && (
          <Box sx={{ width: '100%', mb: 2 }}>
            <LinearProgress
              variant="determinate"
              value={(progress.current / progress.total) * 100}
            />
            <Typography
              variant="caption"
              display="block"
              color="text.secondary"
              align="center"
              sx={{ mt: 0.5 }}
            >
              进度: {progress.current}/{progress.total} (
              {((progress.current / progress.total) * 100).toFixed(0)}%)
            </Typography>
          </Box>
        )}

        <Typography
          variant="caption"
          color="text.secondary"
          gutterBottom
          display="block"
        >
          本地存储状态（OKEX）:
        </Typography>
        {INTERVALS.map((int) => {
          const key = dbInterval(int);
          return (
            <Box
              key={int}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                mb: 0.5,
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  color: lastUpdate[key] ? 'success.main' : 'text.disabled',
                }}
              >
                • {key}:{' '}
                {lastUpdate[key]
                  ? `${formatTimeDiff(lastUpdate[key])}前`
                  : '无'}
              </Typography>
              {lastUpdate[key] && (
                <Button
                  size="small"
                  onClick={() => handleClearData(int)}
                  sx={{ py: 0, minWidth: 'auto', fontSize: '10px' }}
                  color="error"
                >
                  清除
                </Button>
              )}
            </Box>
          );
        })}
      </Paper>
    </Box>
  );
};

export default TrailLoadDataTab;
