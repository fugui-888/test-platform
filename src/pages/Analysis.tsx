import { useState } from 'react';
import { Box, Tab, Tabs } from '@mui/material';
import DayPage from '../components/day/DayPage';
import PickPage from '../components/pick/PickPage';
import KAnalysisPage from '../components/kAnalysis/KAnalysisPage';
import TopListPage from '../components/toplist/TopListPage';

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

export default function Analysis() {
  const [value, setValue] = useState(0);

  const handleChange = (event: React.SyntheticEvent, newValue: number) => {
    setValue(newValue);
  };

  return (
    <Box sx={{ marginTop: '20px' }}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={value} onChange={handleChange}>
          <Tab label="Day" />
          <Tab label="K" />
          <Tab label="T" />
          <Tab label="Pick" />
        </Tabs>
      </Box>
      <Box>
        {value === 0 && <DayPage />}
        {value === 1 && <KAnalysisPage />}
        {value === 2 && <TopListPage />}
        {value === 3 && <PickPage />}
      </Box>
    </Box>
  );
}
