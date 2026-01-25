import { useState } from 'react';
import { Box, Tab, Tabs } from '@mui/material';
import HighPage from '../components/highPoint/HighPage';
import LoadDataPage from '../components/loadData/LoadDataPage';
import PumpAnalysisPage from '../components/pump/PumpAnalysisPage';
import PullbackAnalysisPage from '../components/pump/PullbackAnalysisPage';

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
    <Box sx={{ marginTop: '10px' }}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={value} onChange={handleChange} variant="fullWidth">
          <Tab label="Data" sx={{ minHeight: '48px' }} />
          <Tab label="High" sx={{ minHeight: '48px' }} />
          <Tab label="Pump" sx={{ minHeight: '48px' }} />
          <Tab label="Pullback" sx={{ minHeight: '48px' }} />
        </Tabs>
      </Box>
      <Box sx={{ p: 0.5 }}>
        {value === 0 && <LoadDataPage />}
        {value === 1 && <HighPage />}
        {value === 2 && <PumpAnalysisPage />}
        {value === 3 && <PullbackAnalysisPage />}
      </Box>
    </Box>
  );
}
