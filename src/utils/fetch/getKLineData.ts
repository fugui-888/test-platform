import axios from 'axios';

const getKLineData = async ({
  symbol,
  interval,
  limit,
}: {
  symbol: string;
  interval: string;
  limit: string;
}) => {
  const { data } = await axios.get(
    `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`,
  );

  return { klines: data as string[][], symbol };
};

export default getKLineData;
