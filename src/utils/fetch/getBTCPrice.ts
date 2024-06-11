import axios from 'axios';

export interface TickerPrice {
  symbol: string;
  price: string;
  time: number;
}

const getBTCPrice = async () => {
  const { data } = await axios.get(
    `https://fapi.binance.com/fapi/v1/ticker/price?symbol=BTCUSDT`,
  );

  return data as TickerPrice;
};

export default getBTCPrice;
