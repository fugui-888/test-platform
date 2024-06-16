import axios from 'axios';

const getKLineDataByStartTime = async ({
  symbol,
  interval,
  limit,
  startTime,
}: {
  symbol: string;
  interval: string;
  limit: string;
  startTime: number;
}) => {
  const { data } = await axios.get(
    `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}&startTime=${startTime}`,
  );

  return { klines: data as string[][], symbol };
};

export default getKLineDataByStartTime;
