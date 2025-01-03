import { useState } from 'react';
import {
  Box,
  TextField,
  Button,
  Select,
  MenuItem,
  Typography,
} from '@mui/material';
import getAllPrice from '../../utils/fetch/getAllPrice';
import getKLineData from '../../utils/fetch/getKLineData';
import { CardData } from '../Card';
import KlineWithVol from './KlineWithVol';

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
  kInterval: Interval;
  kCount: string;
}

const defaultFilter: FilterType = {
  interval: '1d',
  count: '3',
  kInterval: '1d',
  kCount: '70',
};

interface SymbolList {
  symbol: string;
  generalPriceChange: number;
  totalTrades: number;
  price: string;
  continueUpCount?: number;
}

export default function KFilter() {
  const [filter, setFilter] = useState<FilterType>(defaultFilter);
  const getData = getKLineData;
  const [cardData, setCardData] = useState<CardData[]>([]);
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
    let all: SymbolList[] = [];
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
        const klines = value.klines || [];
        const length = klines.length;
        const latest = klines[length - 1];
        const last = klines[0];

        const open = Number(last[1]);
        const close = Number(latest[4]);

        const generalPriceChange = (close - open) / open;

        const totalTrades = klines.reduce((acc, k) => {
          const trade = Number(k[8]);
          acc += trade;
          return acc;
        }, 0);

        all.push({
          symbol: value.symbol,
          generalPriceChange,
          totalTrades,
          price: latest[4],
        });
      });
    });

    return all;
  };

  const getListForContinueUp = async () => {
    const allTicks = await getAllPrice();
    let all: SymbolList[] = [];
    await Promise.all(
      allTicks.map((item) =>
        getData({
          symbol: item.symbol,
          interval: filter.interval,
          limit: '99',
        }),
      ),
    ).then((values) => {
      values.forEach((value) => {
        const klines = value.klines || [];
        const length = klines.length;
        if (length === 0) return; // 如果没有K线数据，跳过

        const latest = klines[length - 1];

        let continueUpCount = 0;
        let startPrice = 0; // 连续上涨期间的起始价格
        let endPrice = 0; // 连续上涨期间的结束价格

        // 从最后一根 K 线开始，计算连续上涨的数量
        for (let i = length - 1; i >= 0; i--) {
          const current = klines[i];
          const openPrice = Number(current[1]);
          const closePrice = Number(current[4]);

          if (closePrice > openPrice) {
            continueUpCount++;
            endPrice = endPrice || closePrice; // 第一次上涨时记录结束价
            startPrice = openPrice; // 更新起始价格
          } else {
            break; // 遇到非上涨K线，停止计数
          }
        }

        // 如果没有连续上涨，跳过该交易对
        if (continueUpCount === 0) return;

        // 计算连续上涨期间的涨幅
        const continuousPriceChange = (endPrice - startPrice) / startPrice;

        all.push({
          symbol: value.symbol,
          generalPriceChange: continuousPriceChange, // 连续上涨期间的涨幅
          totalTrades: 0,
          price: latest[4], // 最新价
          continueUpCount, // 连续上涨K线数量
        });
      });
    });

    return all;
  };

  const sortByIncrease = async () => {
    const allChangeList = await getListForAll();
    allChangeList.sort((a, b) => b.generalPriceChange - a.generalPriceChange);
    const alllll = allChangeList.map((tick) => ({
      detail: `${tick.symbol} - ($${tick.price}) // ${(
        tick.generalPriceChange * 100
      ).toFixed(4)}%`,
      symbol: tick.symbol,
    }));
    setCardData(alllll);
  };

  const sortByTrades = async () => {
    const allChangeList = await getListForAll();
    allChangeList.sort((a, b) => b.totalTrades - a.totalTrades);
    const alllll = allChangeList.map((tick) => ({
      detail: `${tick.symbol} - ($${tick.price}) - (trades: ${
        tick.totalTrades
      }) // ${(tick.generalPriceChange * 100).toFixed(4)}%`,
      symbol: tick.symbol,
    }));
    setCardData(alllll);
  };

  const sortByContinueUp = async () => {
    const allChangeList = await getListForContinueUp();
    allChangeList.sort((a, b) => b.continueUpCount! - a.continueUpCount!);

    const formattedContinueUp = allChangeList.map((tick) => ({
      detail: `(up${tick.continueUpCount}) - ${tick.symbol} - ($${
        tick.price
      }) // ${(tick.generalPriceChange * 100).toFixed(2)}%`,
      symbol: tick.symbol,
    }));
    setCardData(formattedContinueUp);
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
          sx={{ width: '70px', marginRight: '5px' }}
        />

        <Button
          onClick={sortByIncrease}
          variant="outlined"
          disabled={Number(filter.count) < 2}
          sx={{ marginRight: '5px' }}
        >
          涨幅
        </Button>

        <Button
          onClick={sortByTrades}
          variant="outlined"
          disabled={Number(filter.count) < 2}
          sx={{ marginRight: '5px' }}
        >
          trades
        </Button>

        <Button
          onClick={sortByContinueUp}
          variant="outlined"
          sx={{ marginRight: '5px' }}
        >
          连涨
        </Button>
      </Box>
      <Box marginTop="16px">
        <Box>
          <Box
            sx={{
              background: '#43766C',
              padding: '8px',
              paddingBottom: '2px',
              borderRadius: '8px',
              height: '400px',
              maxHeight: '400px',
              overflow: 'auto',
            }}
          >
            {cardData.map((item, index) => {
              return (
                <Box
                  key={item.symbol}
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
                      <Typography>{`${item.detail}`}</Typography>
                    </Box>
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>
      </Box>
      <Box
        sx={{
          background: 'white',
          padding: '4px 8px',
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
