import { useState } from 'react';
import {
  Box,
  TextField,
  Button,
  Select,
  MenuItem,
  CircularProgress,
} from '@mui/material';
import getAllPrice from '../../utils/fetch/getAllPrice';
import getKLineData from '../../utils/fetch/getKLineData';
import { isUp, getPriceChange } from '../../utils/calculator';
import { CardData } from '../Card';

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
  interval: Interval;
  count: string;
}

interface KCaseThreeProps {
  onButtonClick: (filteredSymbols: CardData[]) => void;
}

const defaultFilter: FilterType = {
  interval: '1h',
  count: '10',
};

export default function KCaseThree(props: KCaseThreeProps) {
  const { onButtonClick } = props;
  const [filter, setFilter] = useState<FilterType>(defaultFilter);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const getData = getKLineData;

  const onFilterChange = (value: string | Interval, type: keyof FilterType) => {
    const newFilter = {
      ...filter,
      [type]: value,
    };
    setFilter(newFilter);
  };

  const getListForAll = async () => {
    const allTicks = await getAllPrice();

    let all: {
      symbol: string;
      klines: string[][];
    }[] = [];
    await Promise.all(
      allTicks.map((item) =>
        getData({
          symbol: item.symbol,
          interval: filter.interval,
          limit: filter.count,
        }),
      ),
    ).then((values) => {
      values.forEach((value) => {
        if (value.symbol.slice(-4) === 'USDT') {
          all.push(value);
        }
      });
    });

    return all;
  };

  const getHighContinueData = async () => {
    setIsLoading(true);
    const allChangeList = await getListForAll();

    const highContinueList: {
      symbol: string;
      price: string;
      priceChange: number;
      count: number;
    }[] = [];

    allChangeList.forEach((item) => {
      const klines = item.klines || [];
      const length = klines.length;
      const latest = klines[length - 1];
      klines.reverse();

      let contCount: string[][] = [];
      for (let i = 0; i < length; i++) {
        if (isUp(klines[i])) {
          contCount.push(klines[i]);
        } else {
          break;
        }
      }

      const open =
        contCount.length > 0
          ? Number(contCount[contCount.length - 1][1])
          : undefined;

      highContinueList.push({
        symbol: item.symbol,
        price: latest[4],
        priceChange: open ? getPriceChange(open, Number(latest[4])) : 0,
        count: contCount.length,
      });
    });

    highContinueList.sort((a, b) => b.priceChange - a.priceChange);

    const formatted = highContinueList.slice(0, 20).map((tick) => ({
      detail: `${tick.symbol} - ($${tick.price}) - (change: ${(
        tick.priceChange * 100
      ).toFixed(2)}%) - (Count: ${tick.count})`,
      symbol: tick.symbol,
    }));
    onButtonClick(formatted);
    setIsLoading(false);
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
          label="Count"
          size="small"
          variant="outlined"
          value={filter.count}
          onChange={(e) => onFilterChange(e.target.value, 'count')}
          sx={{ width: '100px', marginRight: '5px' }}
        />
      </Box>
      <Box sx={{ marginBottom: '10px', display: 'flex', alignItems: 'center' }}>
        <Button
          onClick={getHighContinueData}
          variant="outlined"
          disabled={Number(filter.count) < 2}
          sx={{ marginRight: '5px' }}
        >
          Go!
        </Button>
        {isLoading && <CircularProgress color="secondary" size={20} />}
      </Box>
    </Box>
  );
}
