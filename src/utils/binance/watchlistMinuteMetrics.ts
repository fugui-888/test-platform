export type MinuteCandle = {
  minuteTs: number;
  open: number;
  high: number;
  low: number;
  close: number;
  vol: number;
};

export type SymbolMetric = {
  zScore: number | null;
  barsSinceCross: number | null;
  gainSinceCrossPct: number | null;
  rise1mPct: number | null;
  rise5mPct: number | null;
  rise10mPct: number | null;
  rise30mPct: number | null;
};

export function calcRisePct(nowPrice: number, basePrice: number): number {
  if (!(basePrice > 1e-12)) return 0;
  return ((nowPrice - basePrice) / basePrice) * 100;
}

export function computeMetric(candles: MinuteCandle[]): SymbolMetric {
  const n = candles.length;
  if (n === 0) {
    return {
      zScore: null,
      barsSinceCross: null,
      gainSinceCrossPct: null,
      rise1mPct: null,
      rise5mPct: null,
      rise10mPct: null,
      rise30mPct: null,
    };
  }

  const closes = candles.map((c) => c.close);
  const rise1mPct = n >= 2 ? calcRisePct(closes[n - 1], closes[n - 2]) : null;
  const rise5mPct =
    n < 1
      ? null
      : n >= 6
      ? calcRisePct(closes[n - 1], closes[n - 6])
      : calcRisePct(closes[n - 1], closes[0]);
  const rise10mPct =
    n < 1
      ? null
      : n >= 11
      ? calcRisePct(closes[n - 1], closes[n - 11])
      : calcRisePct(closes[n - 1], closes[0]);
  const rise30mPct =
    n < 1
      ? null
      : n >= 31
      ? calcRisePct(closes[n - 1], closes[n - 31])
      : calcRisePct(closes[n - 1], closes[0]);

  let zScore: number | null = null;
  if (n >= 30) {
    const w = closes.slice(-30);
    const ma = w.reduce((a, b) => a + b, 0) / w.length;
    const variance = w.reduce((s, x) => s + (x - ma) ** 2, 0) / w.length;
    const sigma = Math.sqrt(variance);
    if (sigma > 1e-12) zScore = (closes[n - 1] - ma) / sigma;
  }

  const ma30Series = new Array<number>(n).fill(Number.NaN);
  for (let i = 29; i < n; i++) {
    let s = 0;
    for (let j = i - 29; j <= i; j++) s += closes[j];
    ma30Series[i] = s / 30;
  }

  let lastCrossIdx: number | null = null;
  for (let i = 30; i < n; i++) {
    const prevDiff = closes[i - 1] - ma30Series[i - 1];
    const currDiff = closes[i] - ma30Series[i];
    if (!Number.isFinite(prevDiff) || !Number.isFinite(currDiff)) continue;
    const crossedUp = prevDiff <= 0 && currDiff > 0;
    const crossedDown = prevDiff >= 0 && currDiff < 0;
    if (crossedUp || crossedDown) lastCrossIdx = i;
  }

  const barsSinceCross = lastCrossIdx == null ? null : n - 1 - lastCrossIdx;
  const gainSinceCrossPct =
    lastCrossIdx == null
      ? null
      : calcRisePct(closes[n - 1], closes[lastCrossIdx]);

  return {
    zScore,
    barsSinceCross,
    gainSinceCrossPct,
    rise1mPct,
    rise5mPct,
    rise10mPct,
    rise30mPct,
  };
}
