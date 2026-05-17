import type { MEXCKLINE } from '../../types/mexcKline';

/** 索引 idx 处：用 [idx-29..idx] 共 30 根收盘的 μ、σ，返回 (close[idx]-μ)/σ */
export function zScoreMa30AtIndex(
  closes: number[],
  idx: number,
): number | null {
  if (idx < 29 || idx >= closes.length) return null;
  const w = closes.slice(idx - 29, idx + 1);
  if (w.length !== 30) return null;
  const ma = w.reduce((a, b) => a + b, 0) / 30;
  let varSum = 0;
  for (let j = 0; j < 30; j++) varSum += (w[j] - ma) ** 2;
  const sigma = Math.sqrt(varSum / 30);
  if (!(sigma > 1e-12)) return null;
  return (closes[idx] - ma) / sigma;
}

/** 最后一根收盘相对当根 MA30 的有符号 z */
export function zScoreMa30LastCloseFromKline(k: MEXCKLINE): number | null {
  const n = k.close.length;
  if (n < 30) return null;
  return zScoreMa30AtIndex(k.close, n - 1);
}

/**
 * 最近一根 K 起回溯最后一次 K 线与 MA30 相交（low≤MA≤high），
 * 从该根收盘至今涨幅与相隔根数。
 */
export function computeMa30LastTouchGainFromKline(k: MEXCKLINE): {
  pct: number | null;
  bars: number | null;
} {
  const { high, low, close } = k;
  const n = Math.min(high.length, low.length, close.length);
  if (n < 30) return { pct: null, bars: null };
  const ma: number[] = new Array(n).fill(Number.NaN);
  for (let i = 29; i < n; i++) {
    let s = 0;
    for (let j = i - 29; j <= i; j++) s += close[j];
    ma[i] = s / 30;
  }
  let lastTouchIdx: number | null = null;
  for (let i = 29; i < n; i++) {
    const m = ma[i];
    if (!Number.isFinite(m)) continue;
    if (low[i] <= m && high[i] >= m) lastTouchIdx = i;
  }
  if (lastTouchIdx == null) return { pct: null, bars: null };
  const last = n - 1;
  const base = close[lastTouchIdx];
  if (!(base > 1e-12)) return { pct: null, bars: null };
  return {
    pct: ((close[last] - base) / base) * 100,
    bars: last - lastTouchIdx,
  };
}
