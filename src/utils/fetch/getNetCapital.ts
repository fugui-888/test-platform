import axios from 'axios';

export interface NetCapitalInList {
  symbol: string;
  startTime: number | string;
  endTime: number | string;
  netCapitalInflowVolume: number | null;
}

export interface NetCapital {
  totalInFlow: number;
  netCapitalInList: NetCapitalInList[];
}

const getNetCapital = async ({
  symbol,
  count,
}: {
  symbol: string;
  count: string;
}) => {
  let formattedSymbol = symbol;
  if (symbol.substring(0, 4) === '1000') {
    formattedSymbol = symbol.substring(4);
  }
  const { data } = await axios.get(
    `https://www.binance.com/bapi/earn/v1/public/indicator/capital-flow/volumeTypeNetCapitalIn?groupCount=${count}&groupSize=24&period=HOUR_1&symbol=${formattedSymbol}&volumeType=BIG`,
  );

  return { symbol, data: data?.data as NetCapital };
};

export default getNetCapital;
