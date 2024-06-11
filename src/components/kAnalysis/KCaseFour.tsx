import { useState } from 'react';
import { Box, TextField, Button, Select, MenuItem } from '@mui/material';
import { useDataContext } from '../../context/DataContext';
import getAllPrice from '../../utils/fetch/getAllPrice';
import getKLineData from '../../utils/fetch/getKLineData';
import { CardData } from '../Card';

type Interval = '1m' | '3m' | '5m' | '15m';

interface FilterType {
  interval: Interval; // k线时间间隔
  count: string; // 用来做分析的k线数量，与trend联合， 在k线query里是limit = count + 1
}

interface KCaseFourProps {
  onButtonClick: (filteredSymbols: CardData[]) => void;
}

const defaultFilter: FilterType = {
  interval: '15m',
  count: '18',
};

const getPriceChange = (open: number, latest: number) => {
  const change = (latest - open) / open;
  return change;
};

export default function KCaseFour(props: KCaseFourProps) {
  const { allKlineData } = useDataContext();
  const { onButtonClick } = props;
  const [filter, setFilter] = useState<FilterType>(defaultFilter);
  const getData = getKLineData;
  const allTicks = Object.keys(allKlineData);

  const onFilterChange = (value: string | Interval, type: keyof FilterType) => {
    const newFilter = {
      ...filter,
      [type]: value,
    };
    setFilter(newFilter);
  };

  const getListForAll = async () => {
    let all: {
      symbol: string;
      currentPrice: number;
      dayPriceChange: number;
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
        const dayKlineData = allKlineData[symbol] || {};
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
          dayPriceChange: getPriceChange(dayKlineData.openPrice, currentPrice),
          highestSoFar,
          changeFromHighest: getPriceChange(highestSoFar, currentPrice),
        });
      });
    });

    return all;
  };

  const getUpListPriceChange = async () => {
    const allChangeList = await getListForAll();
    allChangeList.sort((a, b) => b.dayPriceChange - a.dayPriceChange);
    const first30 = allChangeList.slice(0, 30).map((tick) => ({
      detail: `${tick.symbol} - ($${tick.currentPrice}) // ${(
        tick.dayPriceChange * 100
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
        >
          Up List
        </Button>
      </Box>
    </Box>
  );
}
