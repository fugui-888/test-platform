import { useState } from 'react';
import { Box, Button, Tab, Tabs } from '@mui/material';
import getAllPrice from '../utils/fetch/getAllPrice';
import getKLineData from '../utils/fetch/getKLineData';
import VolumePage from '../components/volume/VolumePage';
import DayPage from '../components/day/DayPage';
import PickPage from '../components/pick/PickPage';
import KAnalysisPage from '../components/kAnalysis/KAnalysisPage';

export interface KlineData {
  symbol: string;
  openPrice: number;
  currentPrice: number;
  highPrice: number;
  lowPrice: number;
  priceChange: number;
}

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

const getPriceChange = (open: number, latest: number) => {
  const change = (latest - open) / open;
  return change;
};

export default function Analysis() {
  const [value, setValue] = useState(0);

  const handleChange = (event: React.SyntheticEvent, newValue: number) => {
    setValue(newValue);
  };

  const getListForAll = async () => {
    const allTicks = await getAllPrice();
    let all: Record<string, KlineData> = {};
    await Promise.all(
      allTicks.map((item) =>
        getKLineData({
          symbol: item.symbol,
          interval: '1d',
          limit: '1',
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
          const highPrice = Number(kline[2]);
          const lowPrice = Number(kline[3]);
          const currentPrice = Number(kline[4]);

          all[value.symbol] = {
            symbol: value.symbol,
            openPrice,
            currentPrice,
            highPrice,
            lowPrice,
            priceChange: getPriceChange(openPrice, currentPrice),
          };
        }
      });
    });

    return all;
  };

  // const onPrepare = async () => {
  //   const allKLine = await getListForAll();
  //   setAllKlineData(allKLine);
  // };

  return (
    <Box sx={{ marginTop: '20px' }}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={value} onChange={handleChange}>
          <Tab label="Day" />
          <Tab label="K" />
          <Tab label="Volume" />
          <Tab label="Pick" />
        </Tabs>
      </Box>
      <Box>
        {value === 0 && <DayPage />}
        {value === 1 && <KAnalysisPage />}
        {value === 2 && <VolumePage />}
        {value === 3 && <PickPage />}
      </Box>
    </Box>
  );
}
