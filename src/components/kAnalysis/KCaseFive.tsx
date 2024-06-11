import { useState } from 'react';
import {
  Box,
  Button,
  Select,
  MenuItem,
  TextField,
  Typography,
  Grid,
} from '@mui/material';
import getAllPrice from '../../utils/fetch/getAllPrice';
import getKLineData from '../../utils/fetch/getKLineData';
import { CardData } from '../Card';

export const ignoredSymbols = [
  'IDEXUSDT',
  'USDCUSDT',
  'STRAXUSDT',
  'SNTUSDT',
  'STPTUSDT',
  'CTKUSDT',
  'DGBUSDT',
  'CVXUSDT',
  'GLMRUSDT',
  'RADUSDT',
  'MDTUSDT',
  'SLPUSDT',
];

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
  interval: Interval; // k线时间间隔
  count: string;
  maximumAllowedCount: string;
}

interface KCaseFiveProps {
  onButtonClick: (filteredSymbols: CardData[]) => void;
}

const defaultFilter: FilterType = {
  interval: '3m',
  count: '30',
  maximumAllowedCount: '3',
};

export default function KCaseFive(props: KCaseFiveProps) {
  const { onButtonClick } = props;
  const [filter, setFilter] = useState<FilterType>(defaultFilter);

  const onFilterChange = (value: string | Interval, type: keyof FilterType) => {
    const newFilter = {
      ...filter,
      [type]: value,
    };
    setFilter(newFilter);
  };

  const getListForPotential = async () => {
    const allTicks = await getAllPrice();
    const validTicks = allTicks.filter(
      (t) =>
        t.symbol.slice(-4) === 'USDT' && !ignoredSymbols.includes(t.symbol),
    );

    let allPotentialUp: {
      symbol: string;
      priceChangeFromUp: number;
      currentPrice: string;
      highestPosition: number;
      positonDiff: number;
    }[] = [];
    let allPotentialDown: {
      symbol: string;
      priceChangeFromDown: number;
      currentPrice: string;
      lowestPosition: number;
      positonDiff: number;
    }[] = [];

    await Promise.all(
      validTicks.map((item) =>
        getKLineData({
          symbol: item.symbol,
          limit: filter.count,
          interval: filter.interval,
        }),
      ),
    ).then((values) => {
      values.forEach((value) => {
        const klines = value.klines || [];
        const length = klines.length;
        const latest = klines[length - 1];

        const close = Number(latest[4]);

        let lowest = 0;
        let highest = 0;
        let lowestPosition = 0;
        let highestPosition = 0;

        klines.forEach((l, index) => {
          const low = Number(l[3]);
          const high = Number(l[2]);

          if (lowest === 0) {
            lowest = low;
            lowestPosition = index;
          } else if (low < lowest) {
            lowest = low;
            lowestPosition = index;
          }

          if (highest === 0) {
            highest = high;
            highestPosition = index;
          } else if (high > highest) {
            highest = high;
            highestPosition = index;
          }
        });

        const priceChangeFromUp = (close - lowest) / lowest;

        const priceChangeFromDown = (close - highest) / highest;

        if (
          priceChangeFromUp > 0 &&
          lowestPosition < highestPosition &&
          length - 1 - highestPosition <= Number(filter.maximumAllowedCount)
        ) {
          allPotentialUp.push({
            symbol: value.symbol,
            priceChangeFromUp,
            currentPrice: latest[4],
            highestPosition: length - 1 - highestPosition, //最高点与当先k差了几个线
            positonDiff: highestPosition - lowestPosition,
          });
        }

        if (
          priceChangeFromDown < 0 &&
          lowestPosition > highestPosition &&
          length - 1 - lowestPosition <= Number(filter.maximumAllowedCount)
        ) {
          allPotentialDown.push({
            symbol: value.symbol,
            priceChangeFromDown,
            currentPrice: latest[4],
            lowestPosition: length - 1 - lowestPosition, //最低点与当前k差了几个线
            positonDiff: lowestPosition - highestPosition,
          });
        }
      });
    });

    return { allPotentialUp, allPotentialDown };
  };

  const getPotentialUpDown = async () => {
    const { allPotentialDown, allPotentialUp } = await getListForPotential();
    allPotentialUp.sort((a, b) => a.priceChangeFromUp - b.priceChangeFromUp);
    const updata = allPotentialUp.map((tick) => ({
      detail: `${tick.symbol} - ($${tick.currentPrice}) // ${(
        tick.priceChangeFromUp * 100
      ).toFixed(2)}%`,
      symbol: tick.symbol,
      highlightColor: '#E1F0DA',
      appendix: (
        <Box display="flex">
          <Typography>{`[dif: ${tick.positonDiff}]`}</Typography>
        </Box>
      ),
    }));

    allPotentialDown.sort(
      (a, b) => b.priceChangeFromDown - a.priceChangeFromDown,
    );
    const downData = allPotentialDown.map((tick) => ({
      detail: `${tick.symbol} - ($${tick.currentPrice}) // ${(
        tick.priceChangeFromDown * 100
      ).toFixed(2)}%`,
      symbol: tick.symbol,
      highlightColor: '#FFD0D0',
      appendix: (
        <Box display="flex">
          <Typography>{`[dif: ${tick.positonDiff}]`}</Typography>
        </Box>
      ),
    }));

    onButtonClick([...updata, ...downData]);
  };

  return (
    <Box display="flex" alignItems="center" sx={{ marginTop: '20px' }}>
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
        onChange={(event) => onFilterChange(event.target.value, 'count')}
        sx={{ marginRight: '5px', width: '80px' }}
      />
      <TextField
        label="Max Allowed Count"
        size="small"
        variant="outlined"
        value={filter.maximumAllowedCount}
        onChange={(event) =>
          onFilterChange(event.target.value, 'maximumAllowedCount')
        }
        sx={{ marginRight: '5px', width: '70px' }}
      />
      <Button
        onClick={getPotentialUpDown}
        variant="outlined"
        sx={{ marginLeft: '5px' }}
        disabled={
          !filter.count || !Number(filter.count) || !filter.maximumAllowedCount
        }
      >
        Go!
      </Button>
    </Box>
  );
}
