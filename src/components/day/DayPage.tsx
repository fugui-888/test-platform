import { useState } from 'react';
import { Box } from '@mui/material';
import FundingRate from './FundingRate';
import DayAnalysis from './DayAnalysis';

import Card, { CardData } from '../Card';

export type AnalysisType =
  | 'highIncrease'
  | 'highDecrease'
  | 'continueUp'
  | 'continueDown'
  | 'fundingRatePositive'
  | 'fundingRateNegative';

const getTitle = (type: AnalysisType, days?: string) => {
  const titles = {
    highIncrease: `High increase in ${days} days symbols`,
    highDecrease: `High decrease in ${days} days symbols`,
    continueUp: `Continue up in ${days} days symbols`,
    continueDown: `Continue down in ${days} days symbols`,
    fundingRatePositive: 'Positive Funding Rate',
    fundingRateNegative: 'Nagetive Funding Rate',
  };

  return titles[type];
};

export default function DayPage() {
  const [days, setDays] = useState<string>('3');
  const [type, setType] = useState<AnalysisType>();
  const [filteredSymbols, setFilteredSymbols] = useState<CardData[]>([]);

  const onAnalysisButtonClick = (
    filteredSymbols: CardData[],
    analysisType: AnalysisType,
  ) => {
    setType(analysisType);
    setFilteredSymbols(filteredSymbols);
  };

  return (
    <Box sx={{ marginTop: '20px' }}>
      <DayAnalysis
        days={days}
        onDaysChange={setDays}
        onButtonClick={onAnalysisButtonClick}
      />
      <FundingRate onButtonClick={onAnalysisButtonClick} />
      {type && (
        <Box sx={{ marginTop: '20px' }}>
          <Card
            title={getTitle(type, days)}
            bgColor="#90C8AC"
            data={filteredSymbols}
          />
        </Box>
      )}
    </Box>
  );
}
