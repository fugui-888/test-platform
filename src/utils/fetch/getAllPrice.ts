import axios from 'axios';

export interface TickerPrice {
  symbol: string;
  price: string;
  time: number;
}

const getAllPrice = async () => {
  const { data } = await axios.get(
    `https://fapi.binance.com/fapi/v1/ticker/price`,
  );

  return (data as TickerPrice[]).filter((d) => d.symbol.slice(-4) === 'USDT');
};

export default getAllPrice;
