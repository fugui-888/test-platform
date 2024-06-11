import { useState } from 'react';
import {
  Box,
  Select,
  MenuItem,
  IconButton,
  Button,
  CircularProgress,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import getAllPrice from '../../utils/fetch/getAllPrice';
import getKLineData from '../../utils/fetch/getKLineData';
import { isUp, isDown } from '../../utils/calculator';

import Card, { CardData } from '../Card';

type Trend = 'up' | 'down' | '--';

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

interface PickProps {
  value: Trend;
  onSelectChange: (v: Trend) => void;
  withAddButton: boolean;
  onAdd: () => void;
}

const isMatchingTrend = (l: string[], trend: Trend) => {
  if (trend === '--') {
    return true;
  }
  // eslint-disable-next-line no-mixed-operators
  if ((isUp(l) && trend === 'up') || (isDown(l) && trend === 'down')) {
    return true;
  }

  return false;
};

const Pick = (props: PickProps) => {
  const { value, onSelectChange, withAddButton, onAdd } = props;

  return (
    <Box>
      <Select
        size="small"
        value={value}
        label="Trend"
        onChange={(event) => onSelectChange(event.target.value as Trend)}
        sx={{ marginRight: '5px' }}
      >
        <MenuItem value="up">Up</MenuItem>
        <MenuItem value="down">Down</MenuItem>
        <MenuItem value="--">--</MenuItem>
      </Select>
      {withAddButton && (
        <IconButton onClick={onAdd}>
          <AddIcon />
        </IconButton>
      )}
    </Box>
  );
};

export default function PickPage() {
  const [picks, setPicks] = useState<Trend[]>(['up', 'up', 'up', 'up', 'up']);
  const [interval, setInterval] = useState<Interval>('1m');
  const [list, setList] = useState<CardData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const getData = getKLineData;

  const onPickChange = (value: Trend, index: number) => {
    const newPicks = [...picks];
    newPicks[index] = value;

    setPicks(newPicks);
  };

  const onAddClick = () => {
    const newPicks = [...picks, 'up'] as Trend[];

    setPicks(newPicks);
  };

  const getListForAll = async () => {
    const allTicks = await getAllPrice();

    let all: {
      symbol: string;
      generalPriceChange: number;
      price: string;
    }[] = [];
    await Promise.all(
      allTicks.map((item) =>
        getData({
          symbol: item.symbol,
          interval: interval,
          limit: `${picks.length}`,
        }),
      ),
    ).then((values) => {
      values.forEach((value) => {
        if (value.symbol.slice(-4) === 'USDT') {
          const klines = value.klines || [];
          const length = klines.length;
          const latest = klines[length - 1];
          const last = klines[0];

          const open = Number(last[1]);
          const close = Number(latest[4]);

          const generalPriceChange = (close - open) / open;

          if (
            length === picks.length &&
            klines.every((l, index) => isMatchingTrend(l, picks[index]))
          ) {
            all.push({
              symbol: value.symbol,
              generalPriceChange,
              price: latest[4],
            });
          }
        }
      });
    });

    return all;
  };

  const getList = async () => {
    setIsLoading(true);
    const allChangeList = await getListForAll();

    allChangeList.sort((a, b) => b.generalPriceChange - a.generalPriceChange);

    const formatted = allChangeList.map((tick) => ({
      detail: `${tick.symbol} - ($${tick.price}) - (price change: ${(
        tick.generalPriceChange * 100
      ).toFixed(4)}%)`,
      symbol: tick.symbol,
    }));
    setList(formatted);
    setIsLoading(false);
  };

  const reset = () => {
    setList([]);
    setPicks(['up']);
  };

  return (
    <Box sx={{ marginTop: '20px' }}>
      <Box sx={{ marginBottom: '5px' }}>
        {picks.map((pick, index) => {
          return (
            <Pick
              key={`freePick-${index + 1}`}
              value={pick}
              onSelectChange={(value) => onPickChange(value, index)}
              withAddButton={index === picks.length - 1}
              onAdd={onAddClick}
            />
          );
        })}
      </Box>
      <Box sx={{ marginBottom: '5px', display: 'flex', alignItems: 'center' }}>
        <Select
          id="interval-select"
          size="small"
          value={interval}
          label="Interval"
          onChange={(event) => setInterval(event.target.value as Interval)}
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
        <Button
          onClick={getList}
          variant="outlined"
          disabled={picks.length < 2}
          sx={{ marginRight: '5px' }}
        >
          Get!
        </Button>
        <Button onClick={reset} variant="outlined" sx={{ marginRight: '5px' }}>
          Reset
        </Button>
        {isLoading && <CircularProgress color="secondary" size={20} />}
      </Box>

      <Box sx={{ marginTop: '20px' }}>
        <Card title="" bgColor="#018383" data={list} />
      </Box>
    </Box>
  );
}
