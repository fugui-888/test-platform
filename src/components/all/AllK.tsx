import { useState } from 'react';
import {
  Box,
  TextField,
  Button,
  Select,
  MenuItem,
  Typography,
  IconButton,
} from '@mui/material';
import ArrowCircleUpIcon from '@mui/icons-material/ArrowCircleUp';
import ArrowCircleDownIcon from '@mui/icons-material/ArrowCircleDown';
import getAllPrice from '../../utils/fetch/getAllPrice';
import getKLineData from '../../utils/fetch/getKLineData';
import { CardData } from '../Card';
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
  interval: Interval;
  sortCount: string;
  kCount: string;
}

const defaultFilter: FilterType = {
  interval: '1d',
  sortCount: '3',
  kCount: '70',
};

interface SymbolList {
  symbol: string;
  sortCountPriceChange: number;
  klines: string[][];
}

export default function AllK() {
  const [filter, setFilter] = useState<FilterType>(defaultFilter);
  const getData = getKLineData;

  const [allK, setAllK] = useState<SymbolList[]>([]);

  const onFilterChange = (value: string | Interval, type: keyof FilterType) => {
    const newFilter = {
      ...filter,
      [type]: value,
    };
    setFilter(newFilter);
  };

  const getListForAll = async () => {
    const allTicks = await getAllPrice();
    let all: SymbolList[] = [];
    await Promise.all(
      allTicks.map((item) =>
        getData({
          symbol: item.symbol,
          interval: filter.interval,
          limit: filter.kCount,
        }),
      ),
    ).then((values) => {
      values.forEach((value) => {
        const klines = value.klines || [];
        const length = klines.length;
        const latest = klines[length - 1];
        const last = klines[0];

        if (length > 0) {
          const sortCount = Math.min(Number(filter.sortCount), length);

          const startKline = klines[length - sortCount]; // 最早的 K 线
          const latestKline = klines[length - 1]; // 最新的 K 线

          const open = Number(startKline[1]); // 开盘价
          const close = Number(latestKline[4]); // 收盘价

          // 计算价格变化百分比
          const priceChange = ((close - open) / open) * 100;

          all.push({
            symbol: value.symbol,
            klines: value.klines,
            sortCountPriceChange: priceChange,
          });
        }
      });
    });

    return all;
  };

  const sortAllByIncrease = async () => {
    const allChangeList = await getListForAll();
    allChangeList.sort(
      (a, b) => b.sortCountPriceChange - a.sortCountPriceChange,
    );
    setAllK(allChangeList);
  };

  return (
    <Box sx={{ marginTop: '16px' }}>
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <Select
          id="interval-select"
          size="small"
          value={filter.interval}
          label="Interval"
          onChange={(event) => onFilterChange(event.target.value, 'interval')}
          sx={{ marginRight: '1px' }}
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
          label="KCount"
          size="small"
          variant="outlined"
          value={filter.kCount}
          onChange={(e) => onFilterChange(e.target.value, 'kCount')}
          sx={{ width: '70px', marginRight: '1px' }}
        />
        <TextField
          label="SortCount"
          size="small"
          variant="outlined"
          value={filter.sortCount}
          onChange={(e) => onFilterChange(e.target.value, 'sortCount')}
          sx={{ width: '70px', marginRight: '1px' }}
        />

        <Button
          onClick={sortAllByIncrease}
          variant="outlined"
          sx={{ marginRight: '1px' }}
        >
          go
        </Button>
      </Box>

      <Box
        sx={{
          background: 'white',
          padding: '4px 0px',
          borderRadius: '8px',
          marginTop: '16px',
          height: '500px',
          maxHeight: '500px',
          overflowY: 'auto',
        }}
      >
        {allK.map((item) => (
          <Box>
            <Typography sx={{ marginBottom: '-16px' }}>
              {item.symbol}
            </Typography>
            {item.klines.length > 0 && <KlineWithVol klineData={item.klines} />}
          </Box>
        ))}
      </Box>
    </Box>
  );
}
