import { useState } from 'react';
import {
  Box,
  TextField,
  Button,
  Select,
  MenuItem,
  Typography,
  CircularProgress,
} from '@mui/material';
import getAllPrice from '../../utils/fetch/getAllPrice';
import getKLineData from '../../utils/fetch/getKLineData';
import KlineWithVol from '../KlineWithVol';

type Interval =
  | '1m'
  | '3m'
  | '5m'
  | '15m'
  | '30m'
  | '1h'
  | '2h'
  | '4h'
  | '6h'
  | '8h'
  | '12h'
  | '1d'
  | '3d'
  | '1w';

interface FilterType {
  dayCount: string;
  kInterval: Interval;
  kCount: string;
}

const defaultFilter: FilterType = {
  dayCount: '30',
  kInterval: '1d',
  kCount: '70',
};

export default function TopList() {
  const [filter, setFilter] = useState<FilterType>(defaultFilter);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [toplist, setToplist] = useState<
    {
      date: string;
      top3: {
        symbol: string;
        gain: number;
      }[];
    }[]
  >([]);

  const getData = getKLineData;

  const [viewingData, setViewingData] = useState<{
    symbol: string;
    klines: string[][];
  }>({ symbol: '', klines: [] });

  const onFilterChange = (value: string | Interval, type: keyof FilterType) => {
    const newFilter = {
      ...filter,
      [type]: value,
    };
    setFilter(newFilter);
  };

  const getListForAll = async () => {
    const allTicks = await getAllPrice();
    let all: { klines: string[][]; symbol: string }[] = [];
    const chunkSize = 400;

    for (let i = 0; i < allTicks.length; i += chunkSize) {
      const chunk = allTicks.slice(i, i + chunkSize);
      await Promise.all(
        chunk.map((item) =>
          getData({
            symbol: item.symbol,
            interval: '1d',
            limit: filter.dayCount,
          }),
        ),
      ).then((values) => {
        all = all.concat(values);
      });

      if (i + chunkSize < allTicks.length) {
        console.log(
          `已处理批次 ${i / chunkSize + 1}，等待1分钟后继续处理下一批...`,
        );
        await new Promise((resolve) => setTimeout(resolve, 60000));
      }
    }

    return all;
  };

  const calculateTopGainersByDate = async () => {
    setIsLoading(true);
    const allData = await getListForAll();
    const dailyGains: Record<string, { symbol: string; gain: number }[]> = {};

    allData.forEach(({ klines, symbol }) => {
      klines.forEach((kline) => {
        const date = new Date(Number(kline[0])).toISOString().split('T')[0];
        const open = Number(kline[1]);
        const close = Number(kline[4]);
        const gain = ((close - open) / open) * 100;

        if (!dailyGains[date]) {
          dailyGains[date] = [];
        }

        dailyGains[date].push({ symbol, gain });
      });
    });

    const topGainersByDate = Object.entries(dailyGains).map(
      ([date, gainers]) => {
        const top3 = gainers.sort((a, b) => b.gain - a.gain).slice(0, 3);

        const btcusdtData = gainers.find((entry) => entry.symbol === 'BTCUSDT');

        if (btcusdtData && !top3.some((entry) => entry.symbol === 'BTCUSDT')) {
          top3.push(btcusdtData);
        }

        return { date, top3 };
      },
    );

    setToplist(topGainersByDate.reverse());
    setIsLoading(false);
  };
  const onSymbolClick = async (symbol: string) => {
    const res = await getKLineData({
      symbol: symbol,
      interval: filter.kInterval,
      limit: filter.kCount,
    });

    setViewingData({ symbol, klines: res.klines });
  };

  return (
    <Box sx={{ marginTop: '16px' }}>
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <TextField
          label="DCount"
          size="small"
          variant="outlined"
          value={filter.dayCount}
          onChange={(e) => onFilterChange(e.target.value, 'dayCount')}
          sx={{ width: '70px', marginRight: '5px' }}
        />
        <Button onClick={calculateTopGainersByDate}>get!</Button>
        {isLoading && <CircularProgress color="secondary" size={20} />}
      </Box>
      <Box marginTop="16px">
        <Box>
          <Box
            sx={{
              background: '#001A6E',
              padding: '8px',
              paddingBottom: '2px',
              borderRadius: '8px',
              height: '340px',
              maxHeight: '340px',
              overflow: 'auto',
            }}
          >
            {toplist.map((data) => {
              return (
                <Box key={`top-data-${data.date}`}>
                  <Typography color="white">{data.date}</Typography>
                  {data.top3.map((item) => {
                    return (
                      <Box
                        key={`${data.date}-${item.symbol}`}
                        sx={{
                          background: 'white',
                          padding: '4px 8px',
                          borderRadius: '8px',
                          marginBottom: '6px',
                          border:
                            viewingData.symbol === item.symbol
                              ? '3px solid #E1AA8D'
                              : 'unset',
                        }}
                        component={'div'}
                        onClick={() => onSymbolClick(item.symbol)}
                      >
                        <Box
                          display="flex"
                          alignItems="center"
                          justifyContent="space-between"
                        >
                          <Box display="flex" alignItems="center">
                            <Typography>{`${item.symbol}: ${item.gain.toFixed(
                              2,
                            )}%`}</Typography>
                          </Box>
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              );
            })}
          </Box>
        </Box>
      </Box>
      <Box
        sx={{
          background: 'white',
          padding: '4px 0px',
          borderRadius: '8px',
          marginTop: '16px',
        }}
      >
        <Box>
          <Select
            id="k-line-interval-select"
            size="small"
            value={filter.kInterval}
            label="kInterval"
            onChange={(event) =>
              onFilterChange(event.target.value, 'kInterval')
            }
            sx={{ marginRight: '5px' }}
          >
            {[
              '1m',
              '3m',
              '5m',
              '15m',
              '30m',
              '1h',
              '2h',
              '4h',
              '6h',
              '8h',
              '12h',
              '1d',
              '3d',
              '1w',
            ].map((i) => (
              <MenuItem value={i} key={i}>
                {i}
              </MenuItem>
            ))}
          </Select>
          <TextField
            label="kCount"
            size="small"
            variant="outlined"
            value={filter.kCount}
            onChange={(event) => onFilterChange(event.target.value, 'kCount')}
          />
        </Box>
        {viewingData.klines.length > 0 && (
          <KlineWithVol klineData={viewingData.klines} />
        )}
      </Box>
    </Box>
  );
}
