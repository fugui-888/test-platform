import axios from 'axios';

export type OkexKlineInterval = '5m' | '15m' | '30m' | '1H' | '4H' | '1Dutc';

export const getOKEXKLineData = async ({
  symbol,
  instId,
  interval = '5m',
  limit = 300,
}: {
  symbol: string;
  instId: string;
  interval?: OkexKlineInterval;
  limit?: number;
}) => {
  const { data } = await axios.get(
    `https://www.okx.com/api/v5/market/candles?instId=${instId}&bar=${interval}&limit=${limit}`,
  );
  const rows: any[][] = Array.isArray(data?.data) ? data.data : [];

  // OKX 返回新->旧，这里转成旧->新，并转成和现有 db 一致的 kline 二维数组结构
  const klines = rows
    .map((r) => [
      String(r?.[0] ?? ''), // ts ms
      String(r?.[1] ?? ''), // open
      String(r?.[2] ?? ''), // high
      String(r?.[3] ?? ''), // low
      String(r?.[4] ?? ''), // close
      String(r?.[5] ?? '0'), // volume
    ])
    .filter((k) => k[0] !== '' && k[1] !== '' && k[4] !== '')
    .reverse();

  return { symbol, instId, klines };
};
