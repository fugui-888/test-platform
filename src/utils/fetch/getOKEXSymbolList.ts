import axios from 'axios';

export interface OkexList {
  symbol: string;
  instId: string;
}

export const getOKEXSymbolList = async (): Promise<OkexList[]> => {
  const { data } = await axios.get(
    'https://www.okx.com/api/v5/market/tickers?instType=SWAP',
  );
  return (data?.data || []).map((d: any) => ({
    symbol: `${String(d?.instId || '').split('-')[0]}USDT`,
    instId: String(d?.instId || ''),
  }));
};
