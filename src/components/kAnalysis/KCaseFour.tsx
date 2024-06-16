import { useState } from 'react';
import styled from 'styled-components';
import { DateTime } from 'luxon';
import {
  Box,
  TextField,
  Button,
  Select,
  MenuItem,
  Typography,
} from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterLuxon } from '@mui/x-date-pickers/AdapterLuxon';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import getKLineData from '../../utils/fetch/getKLineData';
import getAllPrice from '../../utils/fetch/getAllPrice';
import getKLineDataByStartTime from '../../utils/fetch/getKLineDataByStartTime';
import { ignoredSymbols } from '../../utils/ignoredSymbols';
import { CardData } from '../Card';

// fitler给定时间的open price用来计算与当前的价格变化
export interface KlineData {
  symbol: string;
  openPrice: number;
}

type Interval = '1m' | '3m' | '5m' | '15m';

interface FilterType {
  interval: Interval;
  count: string;
}

interface KCaseFourProps {
  onButtonClick: (filteredSymbols: CardData[]) => void;
}

// 4小时 defaults
const defaultFilter: FilterType = {
  interval: '15m',
  count: '16',
};

const getPriceChange = (open: number, latest: number) => {
  const change = (latest - open) / open;
  return change;
};

const DateTimePickerContainer = styled(Box)`
  display: flex;
  align-items: center;
  input {
    padding: 10px 10px;
  }
`;

export default function KCaseFour(props: KCaseFourProps) {
  const { onButtonClick } = props;
  const [filter, setFilter] = useState<FilterType>(defaultFilter);
  const [startTime, setStartTime] = useState<DateTime | null>(DateTime.now());
  const [lastQueryTime, setLastQueryTime] = useState<DateTime | null>(null);
  const [allKlineData, setAllKlineData] = useState<Record<string, KlineData>>(
    {},
  );
  const getData = getKLineData;
  const allTicks = Object.keys(allKlineData);

  const onFilterChange = (value: string | Interval, type: keyof FilterType) => {
    const newFilter = {
      ...filter,
      [type]: value,
    };
    setFilter(newFilter);
  };

  const getListForAllByStartTime = async () => {
    const allTicks = await getAllPrice();
    let all: Record<string, KlineData> = {};
    await Promise.all(
      allTicks.map((item) =>
        getKLineDataByStartTime({
          symbol: item.symbol,
          interval: '1m',
          limit: '1',
          startTime: startTime!.startOf('minute').toMillis(),
        }),
      ),
    ).then((values) => {
      values.forEach((value) => {
        // 只考虑usdt 而且不考虑下架的
        if (
          value.symbol.slice(-4) === 'USDT' &&
          !ignoredSymbols.includes(value.symbol)
        ) {
          const kline = value.klines && value.klines[0];

          const openPrice = Number(kline[1]);

          all[value.symbol] = {
            symbol: value.symbol,
            openPrice,
          };
        }
      });
    });

    return all;
  };

  const onPrepare = async () => {
    const allKLine = await getListForAllByStartTime();
    setAllKlineData(allKLine);
    setLastQueryTime(startTime);
  };

  const getListForAll = async () => {
    let all: {
      symbol: string;
      currentPrice: number;
      periodPriceChange: number;
      highestSoFar: number;
      changeFromHighest: number;
    }[] = [];
    await Promise.all(
      allTicks.map((item) =>
        getData({
          symbol: item,
          interval: filter.interval,
          limit: filter.count,
        }),
      ),
    ).then((values) => {
      values.forEach((value) => {
        const symbol = value.symbol;
        const periodKlineData = allKlineData[symbol] || {};
        const klines = value.klines || [];
        const length = klines.length;
        const latest = klines[length - 1];
        const currentPrice = Number(latest[4]);

        let highestSoFar = 0;

        klines.forEach((l) => {
          const high = Number(l[2]);

          if (highestSoFar === 0) {
            highestSoFar = high;
          } else if (high > highestSoFar) {
            highestSoFar = high;
          }
        });

        all.push({
          symbol: value.symbol,
          currentPrice,
          periodPriceChange: getPriceChange(
            periodKlineData.openPrice,
            currentPrice,
          ),
          highestSoFar,
          changeFromHighest: getPriceChange(highestSoFar, currentPrice),
        });
      });
    });

    return all;
  };

  const getUpListPriceChange = async () => {
    const allChangeList = await getListForAll();
    allChangeList.sort((a, b) => b.periodPriceChange - a.periodPriceChange);
    const first30 = allChangeList.slice(0, 30).map((tick) => ({
      detail: `${tick.symbol} - ($${tick.currentPrice}) // ${(
        tick.periodPriceChange * 100
      ).toFixed(2)}% // [${(tick.changeFromHighest! * 100).toFixed(
        2,
      )}% (from: $${tick.highestSoFar})]`,
      symbol: tick.symbol,
    }));
    onButtonClick(first30);
  };

  return (
    <Box sx={{ marginTop: '20px' }}>
      <Box sx={{ marginBottom: '5px', display: 'flex', alignItems: 'center' }}>
        <DateTimePickerContainer>
          <LocalizationProvider dateAdapter={AdapterLuxon}>
            <DateTimePicker
              value={startTime}
              onChange={(newValue) => setStartTime(newValue)}
              maxDateTime={DateTime.now()}
            />
          </LocalizationProvider>
        </DateTimePickerContainer>
        <Button onClick={onPrepare}>Prepare K</Button>
      </Box>
      <Box sx={{ marginBottom: '5px', display: 'flex', alignItems: 'center' }}>
        <Select
          id="interval-select"
          size="small"
          value={filter.interval}
          label="Interval"
          onChange={(event) => onFilterChange(event.target.value, 'interval')}
          sx={{ marginRight: '5px' }}
        >
          {['1m', '3m', '5m', '15m'].map((i) => (
            <MenuItem value={i} key={i}>
              {i}
            </MenuItem>
          ))}
        </Select>
        <TextField
          label="Count"
          size="small"
          variant="outlined"
          value={filter.count}
          onChange={(e) => onFilterChange(e.target.value, 'count')}
          sx={{ width: '70px', marginRight: '5px' }}
        />
        <Button
          onClick={getUpListPriceChange}
          variant="outlined"
          disabled={Number(filter.count) < 2}
          sx={{ marginRight: '5px' }}
        >
          Up
        </Button>
      </Box>
      <Box sx={{ marginBottom: '5px', display: 'flex', alignItems: 'center' }}>
        <Typography>
          {lastQueryTime ? lastQueryTime.toFormat('dd/MM/yyyy hh:mm a') : ''}
        </Typography>
      </Box>
    </Box>
  );
}
