import { useState } from 'react';
import { Box, Tab, Tabs } from '@mui/material';
import EventPage from '../components/event/eventPage';
import KAnalysisPage from '../components/kAnalysis/KAnalysisPage';
import AllK from '../components/all/AllK';
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
          <Tab label="K" />
          <Tab label="ALL" />
          <Tab label="T" />
          <Tab label="EVENT!" />
        </Tabs>
      </Box>
      <Box>
        {value === 0 && <KAnalysisPage />}
        {value === 1 && <AllK />}
        {value === 2 && <TopListPage />}
        {value === 3 && <EventPage />}
      </Box>
    </Box>
  );
}
