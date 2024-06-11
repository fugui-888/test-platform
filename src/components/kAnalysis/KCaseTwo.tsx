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
import { isUp, isDown, getAmplitude } from '../../utils/calculator';
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
  amplitude: string;
}

interface KCaseTwoProps {
  onButtonClick: (filteredSymbols: CardData[]) => void;
}

const defaultFilter: FilterType = {
  interval: '1m',
  count: '12',
  amplitude: '1.2',
};

export default function KCaseTwo(props: KCaseTwoProps) {
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

  const getHighUpAmplitude = async () => {
    setIsLoading(true);
    const allChangeList = await getListForAll();

    const highUpAmplitudeList: {
      symbol: string;
      price: string;
      amp: number;
      position: number;
    }[] = [];

    allChangeList.forEach((item) => {
      const klines = item.klines || [];
      const length = klines.length;
      const latest = klines[length - 1];

      let maxAmplitude = 0;
      let maxLinePosition = 0;
      klines.forEach((k, index) => {
        const amp = getAmplitude(k);
        if (amp > maxAmplitude && isUp(k)) {
          maxAmplitude = amp;
          maxLinePosition = length - index;
        }
      });

      if (maxAmplitude > Number(filter.amplitude) / 100) {
        highUpAmplitudeList.push({
          symbol: item.symbol,
          price: latest[4],
          amp: maxAmplitude,
          position: maxLinePosition,
        });
      }
    });

    highUpAmplitudeList.sort((a, b) => b.amp - a.amp);

    const formatted = highUpAmplitudeList.map((tick) => ({
      detail: `${tick.symbol} - ($${tick.price}) - (amp: ${(
        tick.amp * 100
      ).toFixed(2)}%) - (Position: ${tick.position})`,
      symbol: tick.symbol,
    }));
    onButtonClick(formatted);
    setIsLoading(false);
  };

  const getHighDownAmplitude = async () => {
    setIsLoading(true);
    const allChangeList = await getListForAll();

    const highUpAmplitudeList: {
      symbol: string;
      price: string;
      amp: number;
      position: number;
    }[] = [];

    allChangeList.forEach((item) => {
      const klines = item.klines || [];
      const length = klines.length;
      const latest = klines[length - 1];

      let maxAmplitude = 0;
      let maxLinePosition = 0;
      klines.forEach((k, index) => {
        const amp = getAmplitude(k);
        if (amp > maxAmplitude && isDown(k)) {
          maxAmplitude = amp;
          maxLinePosition = length - index;
        }
      });

      if (maxAmplitude > Number(filter.amplitude) / 100) {
        highUpAmplitudeList.push({
          symbol: item.symbol,
          price: latest[4],
          amp: maxAmplitude,
          position: maxLinePosition,
        });
      }
    });

    highUpAmplitudeList.sort((a, b) => b.amp - a.amp);

    const formatted = highUpAmplitudeList.map((tick) => ({
      detail: `${tick.symbol} - ($${tick.price}) - (amp: ${(
        tick.amp * 100
      ).toFixed(2)}%) - (Position: ${tick.position})`,
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
        <TextField
          label="Amp"
          size="small"
          variant="outlined"
          value={filter.amplitude}
          onChange={(e) => onFilterChange(e.target.value, 'amplitude')}
          sx={{ width: '100px', marginRight: '5px' }}
        />
        %
      </Box>
      <Box sx={{ marginBottom: '10px', display: 'flex', alignItems: 'center' }}>
        <Button
          onClick={getHighUpAmplitude}
          variant="outlined"
          disabled={Number(filter.count) < 2}
          sx={{ marginRight: '5px' }}
        >
          ↑
        </Button>
        <Button
          onClick={getHighDownAmplitude}
          variant="outlined"
          disabled={Number(filter.count) < 2}
          sx={{ marginRight: '5px' }}
        >
          ↓
        </Button>
        {isLoading && <CircularProgress color="secondary" size={20} />}
      </Box>
    </Box>
  );
}
