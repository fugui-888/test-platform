import axios from 'axios';

export interface CapitalFlow {
  bigVolumeNetInflow: number;
  buyMakerBigVolume: number;
  buyMakerMediumVolume: number;
  buyMakerSmallVolume: number;
  buyTakerBigVolume: number;
  buyTakerMediumVolume: number;
  buyTakerSmallVolume: number;
  capitalFlowPeriod: string;
  capitalFlowRuleId: number;
  createTimestamp: number;
  id: number;
  mediumVolumeNetInflow: number;
  smallVolumeNetInflow: number;
  symbol: string;
  totalBuyMakerFlow: number;
  totalBuyTakerFlow: number;
  totalNetInflow: number;
  updateTimestamp: number;
}

export type CapitalFlowInterval =
  | 'MINUTE_15'
  | 'MINUTE_30'
  | 'HOUR_1'
  | 'HOUR_2'
  | 'HOUR_4'
  | 'DAY_1';

const getCapitalFlow = async ({
  symbol,
  interval,
}: {
  symbol: string;
  interval: CapitalFlowInterval;
}) => {
  let formattedSymbol = symbol;
  if (symbol.substring(0, 4) === '1000') {
    formattedSymbol = symbol.substring(4);
  }
  const { data } = await axios.get(
    `https://www.binance.com/bapi/earn/v1/public/indicator/capital-flow/info?period=${interval}&symbol=${symbol}`,
  );

  return data?.data as CapitalFlow;
};

export default getCapitalFlow;
