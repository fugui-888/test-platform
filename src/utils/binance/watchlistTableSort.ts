import type { TopMonitorZPair } from './watchlistMonitorKline';

export type TopTableSortKey = 'tradeCount15m' | 'streak5m' | 'streak10m';
export type TopTableSortState = {
  key: TopTableSortKey;
  dir: 'asc' | 'desc';
} | null;

export type TopDisplayRow = {
  symbol: string;
  price: number;
  dayChangePct: number | null;
  dayRank: number | null;
};

export function applyTopDisplaySort(
  rows: TopDisplayRow[],
  topTableSort: TopTableSortState,
  topMonitorZMap: Record<string, TopMonitorZPair>,
  forcedTopSymbols: string[],
): TopDisplayRow[] {
  const copy = [...rows];
  const forcedOrder = (a: TopDisplayRow, b: TopDisplayRow) =>
    forcedTopSymbols.indexOf(a.symbol) - forcedTopSymbols.indexOf(b.symbol);
  if (!topTableSort) {
    copy.sort((a, b) => {
      const ar = a.dayRank;
      const br = b.dayRank;
      if (ar != null && br != null) return ar - br;
      if (ar != null) return -1;
      if (br != null) return 1;
      return forcedOrder(a, b);
    });
    return copy;
  }
  const getSortValue = (row: TopDisplayRow): number | null => {
    const zPair = topMonitorZMap[row.symbol];
    if (!zPair) return null;
    if (topTableSort.key === 'tradeCount15m') return zPair.tradeCount15m;
    if (topTableSort.key === 'streak5m') return zPair.streakPct;
    return zPair.streak10mPct;
  };
  copy.sort((a, b) => {
    const av = getSortValue(a);
    const bv = getSortValue(b);
    const aValid = av != null && Number.isFinite(av);
    const bValid = bv != null && Number.isFinite(bv);
    if (!aValid && !bValid) {
      const ar = a.dayRank;
      const br = b.dayRank;
      if (ar != null && br != null) return ar - br;
      if (ar != null) return -1;
      if (br != null) return 1;
      return forcedOrder(a, b);
    }
    if (!aValid) return 1;
    if (!bValid) return -1;
    const diff = (av as number) - (bv as number);
    if (diff === 0) {
      const ar = a.dayRank;
      const br = b.dayRank;
      if (ar != null && br != null) return ar - br;
      if (ar != null) return -1;
      if (br != null) return 1;
      return forcedOrder(a, b);
    }
    return topTableSort.dir === 'asc' ? diff : -diff;
  });
  return copy;
}
