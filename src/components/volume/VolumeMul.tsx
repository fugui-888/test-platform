import { useState } from 'react';
import { Box, Button, CircularProgress, Select, MenuItem } from '@mui/material';
import getAllPrice from '../../utils/fetch/getAllPrice';
import getKLineData from '../../utils/fetch/getKLineData';
import { isUp } from '../../utils/calculator';
import { VolumePageData } from './VolumePage';

/** k线数据概览例子
 * [
    1499040000000,      // k[0] - k线开盘时间
    "0.01634790",       // k[1] - 开盘价
    "0.80000000",       // k[2] - 最高价
    "0.01575800",       // k[3] - 最低价
    "0.01577100",       // k[4] - 收盘价(当前K线未结束的即为最新价)
    "148976.11427815",  // k[5] - 成交量
    1499644799999,      // k[6] - k线收盘时间
    "2434.19055334",    // k[7] - 成交额
    308,                // k[8] - 成交笔数
    "1756.87402397",    // k[9] - 主动买入成交量
    "28.46694368",      // k[10] - 主动买入成交额
    "17928899.62484339" // k[11] - 请忽略该参数
  ]
*/

export interface VolumeList {
  symbol: string;
  price: string;
  highVolumeMultiper: number;
  highVolumePosition: number;
  highVolumeUp: boolean;
  klines: string[][];
}

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
}

const defaultFilter: FilterType = {
  interval: '1m',
};

interface VolumeCalProps {
  onButtonClick: (data: { list: VolumePageData[]; title: string }) => void;
}

export default function VolumeCal(props: VolumeCalProps) {
  const { onButtonClick } = props;
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [filter, setFilter] = useState<FilterType>(defaultFilter);

  const onFilterChange = (value: Interval, type: keyof FilterType) => {
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
        getKLineData({
          symbol: item.symbol,
          interval: filter.interval,
          limit: '150',
        }),
      ),
    ).then((values) => {
      values.forEach((value) => {
        if (value.symbol.slice(-4) === 'USDT' && value.klines.length === 150) {
          all.push(value);
        }
      });
    });

    return all;
  };

  const getVolumeMulData = async () => {
    const allList = await getListForAll();
    const list: VolumeList[] = [];

    allList.forEach((item) => {
      const klines = item.klines || [];
      const latest = klines[klines.length - 1];
      let position = -1;
      let maxVolumeMultiplier = -Infinity;

      for (let i = 20; i < klines.length; i++) {
        const previousTwenty = klines.slice(i - 20, i);
        const average =
          previousTwenty.reduce((sum, k) => sum + Number(k[5]), 0) / 20;
        const multiplier = Number(klines[i][5]) / average;
        if (multiplier > maxVolumeMultiplier) {
          maxVolumeMultiplier = multiplier;
          position = i;
        }
      }
      list.push({
        symbol: item.symbol,
        price: latest[4],
        highVolumeMultiper: maxVolumeMultiplier,
        highVolumePosition: position,
        highVolumeUp: klines[position] ? isUp(klines[position]) : true,
        klines,
      });
    });

    return list;
  };

  const getHighVolumeUpMul = async () => {
    setIsLoading(true);

    const allList = await getVolumeMulData();

    const upList = allList
      .filter((l) => l.highVolumeUp)
      .sort((a, b) => b.highVolumeMultiper - a.highVolumeMultiper)
      .slice(0, 150)
      .sort((a, b) => b.highVolumePosition - a.highVolumePosition);

    onButtonClick({
      list: upList,
      title: 'High Vol Mul Up List',
    });
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
          onChange={(event) =>
            onFilterChange(event.target.value as Interval, 'interval')
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
        <Button
          onClick={getHighVolumeUpMul}
          variant="outlined"
          sx={{ marginRight: '5px' }}
        >
          Get Up Mul!
        </Button>
        {isLoading && <CircularProgress color="secondary" size={20} />}
      </Box>
    </Box>
  );
}
