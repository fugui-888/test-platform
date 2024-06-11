import axios from 'axios';
import { Box, Button } from '@mui/material';
import { AnalysisType } from './DayPage';
import { CardData } from '../Card';

interface FundingRateData {
  symbol: string; // 交易对
  markPrice: string; // 标记价格
  indexPrice: string; // 指数价格
  estimatedSettlePrice: string; // 预估结算价,仅在交割开始前最后一小时有意义
  lastFundingRate: string; // 最近更新的资金费率
  nextFundingTime: number; // 下次资金费时间
  interestRate: string; // 标的资产基础利率
  time: number;
}

const fetchFundingRate = async () => {
  const { data } = await axios.get(
    `https://fapi.binance.com/fapi/v1/premiumIndex`,
  );

  return data as FundingRateData[];
};

interface FundingRateProps {
  onButtonClick: (
    filteredSymbols: CardData[],
    analysisType: AnalysisType,
  ) => void;
}

// filter data by 资金费率
export default function FundingRate(props: FundingRateProps) {
  const { onButtonClick } = props;

  const getAllList = async () => {
    const allTicks = await fetchFundingRate();

    return allTicks;
  };

  const getListForFundingRatePositive = async () => {
    const allTicks = await getAllList();
    allTicks.sort(
      (a, b) => Number(b.lastFundingRate) - Number(a.lastFundingRate),
    );

    const filteredSymbols = allTicks.slice(0, 20).map((tick) => ({
      detail: `${tick.symbol} - (${(Number(tick.lastFundingRate) * 100).toFixed(
        3,
      )}%) - (标记价格: $${tick.markPrice})`,
      symbol: tick.symbol,
    }));
    onButtonClick(filteredSymbols, 'fundingRatePositive');
  };

  const getListForFundingRateNegative = async () => {
    const allTicks = await getAllList();
    allTicks.sort(
      (a, b) => Number(a.lastFundingRate) - Number(b.lastFundingRate),
    );

    const filteredSymbols = allTicks.slice(0, 20).map((tick) => ({
      detail: `${tick.symbol} - (${(Number(tick.lastFundingRate) * 100).toFixed(
        3,
      )}%) - (标记价格: $${tick.markPrice})`,
      symbol: tick.symbol,
    }));
    onButtonClick(filteredSymbols, 'fundingRateNegative');
  };

  return (
    <Box sx={{ display: 'flex', marginTop: '20px' }}>
      <Button
        onClick={getListForFundingRatePositive}
        variant="outlined"
        sx={{ marginRight: '5px' }}
      >
        资金费率 - 正
      </Button>
      <Button
        onClick={getListForFundingRateNegative}
        variant="outlined"
        sx={{ marginRight: '5px' }}
      >
        资金费率 - 负
      </Button>
    </Box>
  );
}
