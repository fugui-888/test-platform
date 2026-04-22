import { FAPI_BASE, fetchJsonWith429Backoff } from './futuresKlineFetch';

export async function fetchUsdtPerpSymbolsMeta(): Promise<{
  symbols: string[];
  alphaSymbols: Set<string>;
}> {
  const r = await fetchJsonWith429Backoff(`${FAPI_BASE}/fapi/v1/exchangeInfo`);
  const data = await r.json();
  if (!r.ok) throw new Error(data?.msg || 'exchangeInfo failed');
  if (!Array.isArray(data?.symbols))
    return { symbols: [], alphaSymbols: new Set<string>() };
  const symbols: string[] = [];
  const alphaSymbols = new Set<string>();
  data.symbols.forEach(
    (s: {
      status?: string;
      contractType?: string;
      quoteAsset?: string;
      symbol?: string;
      underlyingType?: string;
      underlyingSubType?: string[];
    }) => {
      if (
        !(
          s?.status === 'TRADING' &&
          s?.contractType === 'PERPETUAL' &&
          s?.quoteAsset === 'USDT' &&
          typeof s?.symbol === 'string'
        )
      )
        return;
      symbols.push(s.symbol);
      const underType = String(s?.underlyingType ?? '').toUpperCase();
      const underSubs = Array.isArray(s?.underlyingSubType)
        ? s.underlyingSubType.map((x) => String(x).toUpperCase())
        : [];
      const isAlpha =
        underType.includes('ALPHA') ||
        underSubs.some((x) => x.includes('ALPHA'));
      if (isAlpha) alphaSymbols.add(s.symbol);
    },
  );
  return { symbols, alphaSymbols };
}
