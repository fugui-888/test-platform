import axios from 'axios';

export interface Ticker24HPrice {
  symbol: string;
  priceChangePercent: string;
  lastPrice: string;
  volume: string; //24小时成交量
  count: number; //成交笔数
}

const getAll24Hours = async () => {
  const { data } = await axios.get(
    `https://fapi.binance.com/fapi/v1/ticker/24hr`,
  );

  return (data as Ticker24HPrice[]).sort((a, b) => b.count - a.count);
};

export default getAll24Hours;
