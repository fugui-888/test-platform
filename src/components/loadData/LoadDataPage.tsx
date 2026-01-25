import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  CircularProgress,
  LinearProgress,
  Paper,
} from '@mui/material';
import getAllPrice from '../../utils/fetch/getAllPrice';
import getKLineData from '../../utils/fetch/getKLineData';
import {
  saveKlineData,
  openDB,
  KlineRecord,
  clearKlineDataByInterval,
} from '../../utils/db';

const INTERVALS = ['5m', '15m', '30m', '1h', '4h', '1d'];

const LoadDataPage: React.FC = () => {
  const [interval, setInterval] = useState<string>('5m');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [progress, setProgress] = useState<{ current: number; total: number }>({
    current: 0,
    total: 0,
  });
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
      const allTicks = await getAllPrice();
      // 过滤掉不带USDT的或者一些特殊的币种（如果需要）
      const usdtTicks = allTicks.filter((t) => t.symbol.endsWith('USDT'));
      const total = usdtTicks.length;
      setProgress({ current: 0, total });

      const chunkSize = 20; // 调小一点以保证稳定性
      for (let i = 0; i < usdtTicks.length; i += chunkSize) {
        const chunk = usdtTicks.slice(i, i + chunkSize);

        await Promise.all(
          chunk.map(async (item) => {
            try {
              const res = await getKLineData({
                symbol: item.symbol,
                interval: interval as any,
                limit: '400',
              });
              if (res && res.klines && res.klines.length > 0) {
                await saveKlineData(item.symbol, interval, res.klines);
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

        // 稍微停顿一下，防止请求过快
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearData = async (int: string) => {
    if (window.confirm(`确定要清除 ${int} 的本地数据吗？`)) {
      await clearKlineDataByInterval(int);
      setRefreshTrigger((prev) => prev + 1);
    }
  };

  return (
    <Box sx={{ p: 1 }}>
      <Typography variant="h6" gutterBottom>
        数据加载
      </Typography>

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
          <FormControl size="small" sx={{ minWidth: 100 }}>
            <InputLabel>间隔</InputLabel>
            <Select
              value={interval}
              label="间隔"
              onChange={(e) => setInterval(e.target.value)}
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
            {isLoading ? '加载中' : '开始加载'}
          </Button>
        </Box>

        {isLoading && (
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

        <Box sx={{ mt: 1 }}>
          <Typography
            variant="caption"
            color="text.secondary"
            gutterBottom
            display="block"
          >
            本地存储状态:
          </Typography>
          {INTERVALS.map((int) => (
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
                  color: lastUpdate[int] ? 'success.main' : 'text.disabled',
                }}
              >
                • {int}:{' '}
                {lastUpdate[int]
                  ? `${new Date(lastUpdate[int]).toLocaleString()}`
                  : '无'}
              </Typography>
              {lastUpdate[int] && (
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
          ))}
        </Box>
      </Paper>
    </Box>
  );
};

export default LoadDataPage;
