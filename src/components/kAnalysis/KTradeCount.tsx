import { useState } from 'react';
import { Box, TextField, Button, Select, MenuItem } from '@mui/material';
import getAllPrice from '../../utils/fetch/getAllPrice';
import getKLineData from '../../utils/fetch/getKLineData';
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

const defaultFilter: FilterType = {
  interval: '1m',
  count: '10',
};

interface KTradeCountProps {
  onButtonClick: (filteredSymbols: CardData[]) => void;
}

export default function KTradeCount(props: KTradeCountProps) {
  const { onButtonClick } = props;
  const [filter, setFilter] = useState<FilterType>(defaultFilter);

  const onFilterChange = (value: string | Interval, type: keyof FilterType) => {
    const newFilter = {
      ...filter,
      [type]: value,
    };
    setFilter(newFilter);
  };

  const getListForTradesCount = async () => {
    const allTicks = await getAllPrice();
    let tradesCount: {
      symbol: string;
      change: number;
      price: string;
      trades: number;
    }[] = [];
    const validTicks = allTicks.filter((t) => t.symbol.slice(-4) === 'USDT');

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
        const last = klines[0];

        const open = Number(last[1]);
        const close = Number(latest[4]);

        const change = (close - open) / open;

        const totalTradesCount = klines.reduce((acc, item) => {
          acc += Number(item[8]);

          return acc;
        }, 0);

        tradesCount.push({
          symbol: value.symbol,
          change,
          price: latest[4],
          trades: totalTradesCount,
        });
      });
    });

    tradesCount.sort((a, b) => b.trades - a.trades);

    const tradesCountList = tradesCount.map((tick) => ({
      detail: `${tick.symbol} - ($${tick.price}) // ${(
        tick.change * 100
      ).toFixed(4)}% // trades: ${tick.trades}`,
      symbol: tick.symbol,
    }));

    onButtonClick(tradesCountList);
  };

  return (
    <Box>
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
      />
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          marginTop: '5px',
        }}
      >
        <Button
          onClick={getListForTradesCount}
          variant="contained"
          sx={{ marginRight: '5px' }}
          disabled={!filter.count || !Number(filter.count)}
          style={{
            backgroundColor: '#436850',
          }}
        >
          Trades Count
        </Button>
      </Box>
    </Box>
  );
}
