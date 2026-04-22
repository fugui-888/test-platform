import type { MEXCKLINE } from '../../types/mexcKline';

export type TradeLinePoint = { time: number; value: number };

export type TopMonitorZPair = {
  streakDir: 'up' | 'down' | null;
  streakCount: number | null;
  streakPct: number | null;
  streak10mDir: 'up' | 'down' | null;
  streak10mCount: number | null;
  streak10mPct: number | null;
  tradeCount15m: number | null;
  maTouch5mPct: number | null;
  maTouch5mBars: number | null;
  maTouch10mPct: number | null;
  maTouch10mBars: number | null;
};

export function parseHourBars(
  rows: unknown[][],
): { ts: number; open: number }[] {
  return rows
    .map((row) => {
      if (!Array.isArray(row)) return null;
      const ts = Number(row[0]);
      const open = parseFloat(String(row[1]));
      if (!Number.isFinite(ts) || !Number.isFinite(open) || open <= 0)
        return null;
      return { ts, open };
    })
    .filter((x): x is { ts: number; open: number } => x != null)
    .sort((a, b) => a.ts - b.ts);
}

export function rowsToKline(rows: unknown[][]): MEXCKLINE {
  return {
    time: rows.map((r) => Math.floor(Number(r[0]) / 1000)),
    open: rows.map((r) => parseFloat(String(r[1]))),
    high: rows.map((r) => parseFloat(String(r[2]))),
    low: rows.map((r) => parseFloat(String(r[3]))),
    close: rows.map((r) => parseFloat(String(r[4]))),
    vol: rows.map((r) => parseFloat(String(r[5]))),
  };
}

export function rowsToTradeLine(rows: unknown[][]): TradeLinePoint[] {
  return rows
    .map((row) => {
      if (!Array.isArray(row)) return null;
      const ts = Number(row[0]);
      const trades = Number(row[8]);
      if (!Number.isFinite(ts) || !Number.isFinite(trades)) return null;
      return { time: Math.floor(ts / 1000), value: trades };
    })
    .filter((x): x is TradeLinePoint => x != null)
    .sort((a, b) => a.time - b.time);
}

export function aggregate5mRowsTo10mTradeLine(
  rows: unknown[][],
): TradeLinePoint[] {
  const countByBucket = new Map<number, number>();
  for (const row of rows) {
    if (!Array.isArray(row)) continue;
    const ts = Number(row[0]);
    const trades = Number(row[8]);
    if (!Number.isFinite(ts) || !Number.isFinite(trades)) continue;
    const bucket = Math.floor(ts / 600000) * 600000;
    countByBucket.set(bucket, (countByBucket.get(bucket) ?? 0) + trades);
  }
  return Array.from(countByBucket.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([bucketMs, value]) => ({ time: Math.floor(bucketMs / 1000), value }));
}

export function aggregate5mRowsTo10mKline(rows: unknown[][]): MEXCKLINE {
  type Bucket = {
    ts: number;
    open: number;
    high: number;
    low: number;
    close: number;
    vol: number;
    lastTs: number;
  };
  const map = new Map<number, Bucket>();
  for (const row of rows) {
    if (!Array.isArray(row)) continue;
    const ts = Number(row[0]);
    const open = parseFloat(String(row[1]));
    const high = parseFloat(String(row[2]));
    const low = parseFloat(String(row[3]));
    const close = parseFloat(String(row[4]));
    const vol = parseFloat(String(row[5]));
    if (
      !Number.isFinite(ts) ||
      !Number.isFinite(open) ||
      !Number.isFinite(high) ||
      !Number.isFinite(low) ||
      !Number.isFinite(close)
    )
      continue;
    const bucketTs = Math.floor(ts / 600000) * 600000;
    const prev = map.get(bucketTs);
    if (!prev) {
      map.set(bucketTs, {
        ts: bucketTs,
        open,
        high,
        low,
        close,
        vol: Number.isFinite(vol) ? vol : 0,
        lastTs: ts,
      });
      continue;
    }
    if (ts < prev.lastTs) continue;
    prev.high = Math.max(prev.high, high);
    prev.low = Math.min(prev.low, low);
    prev.close = close;
    prev.vol += Number.isFinite(vol) ? vol : 0;
    prev.lastTs = ts;
  }

  const buckets = Array.from(map.values()).sort((a, b) => a.ts - b.ts);
  return {
    time: buckets.map((b) => Math.floor(b.ts / 1000)),
    open: buckets.map((b) => b.open),
    high: buckets.map((b) => b.high),
    low: buckets.map((b) => b.low),
    close: buckets.map((b) => b.close),
    vol: buckets.map((b) => b.vol),
  };
}

function parse5mOhlcFromRows(rows: unknown[][]): {
  high: number[];
  low: number[];
  close: number[];
} {
  const high: number[] = [];
  const low: number[] = [];
  const close: number[] = [];
  for (const row of rows) {
    if (!Array.isArray(row)) continue;
    const h = parseFloat(String(row[2]));
    const l = parseFloat(String(row[3]));
    const c = parseFloat(String(row[4]));
    if (!Number.isFinite(h) || !Number.isFinite(l) || !Number.isFinite(c))
      continue;
    high.push(h);
    low.push(l);
    close.push(c);
  }
  return { high, low, close };
}

function computeMa30LastTouchGainBars(ohlc: {
  high: number[];
  low: number[];
  close: number[];
}): {
  pct: number | null;
  bars: number | null;
} {
  const { high, low, close } = ohlc;
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

function computeStreakFromOpenClose(
  candles: Array<{ open: number; close: number }>,
): {
  dir: 'up' | 'down' | null;
  count: number | null;
  pct: number | null;
} {
  if (candles.length === 0) return { dir: null, count: null, pct: null };
  const last = candles[candles.length - 1];
  const isUp = last.close >= last.open;
  let firstIdx = candles.length - 1;
  for (let i = candles.length - 2; i >= 0; i--) {
    const c = candles[i];
    const sameDir = isUp ? c.close >= c.open : c.close < c.open;
    if (!sameDir) break;
    firstIdx = i;
  }
  const first = candles[firstIdx];
  const pct =
    first.open > 1e-12 ? ((last.close - first.open) / first.open) * 100 : null;
  return {
    dir: isUp ? 'up' : 'down',
    count: candles.length - firstIdx,
    pct,
  };
}

export function compute5mStreakFromRows(rows: unknown[][]): {
  dir: 'up' | 'down' | null;
  count: number | null;
  pct: number | null;
} {
  const candles = rows
    .map((row) => {
      if (!Array.isArray(row)) return null;
      const ts = Number(row[0]);
      const open = parseFloat(String(row[1]));
      const close = parseFloat(String(row[4]));
      if (
        !Number.isFinite(ts) ||
        !Number.isFinite(open) ||
        !Number.isFinite(close)
      )
        return null;
      return { ts, open, close };
    })
    .filter((x): x is { ts: number; open: number; close: number } => x != null)
    .sort((a, b) => a.ts - b.ts);
  return computeStreakFromOpenClose(
    candles.map((c) => ({ open: c.open, close: c.close })),
  );
}

export function compute10mStreakFromKline(kline: MEXCKLINE): {
  dir: 'up' | 'down' | null;
  count: number | null;
  pct: number | null;
} {
  const n = Math.min(kline.open.length, kline.close.length);
  if (n <= 0) return { dir: null, count: null, pct: null };
  const candles: Array<{ open: number; close: number }> = [];
  for (let i = 0; i < n; i++) {
    const open = Number(kline.open[i]);
    const close = Number(kline.close[i]);
    if (!Number.isFinite(open) || !Number.isFinite(close)) continue;
    candles.push({ open, close });
  }
  return computeStreakFromOpenClose(candles);
}

export function computeRecent15mTradeCountFrom5mRows(
  rows: unknown[][],
): number | null {
  const trades = rows
    .map((row) => {
      if (!Array.isArray(row)) return null;
      const ts = Number(row[0]);
      const count = Number(row[8]);
      if (!Number.isFinite(ts) || !Number.isFinite(count)) return null;
      return { ts, count };
    })
    .filter((x): x is { ts: number; count: number } => x != null)
    .sort((a, b) => a.ts - b.ts)
    .map((x) => x.count);
  if (trades.length === 0) return null;
  return trades.slice(-3).reduce((s, n) => s + n, 0);
}

export function buildTopMonitorZPairFrom5mRows(
  rows: unknown[][],
): TopMonitorZPair {
  const ohlc5m = parse5mOhlcFromRows(rows);
  const touch5m = computeMa30LastTouchGainBars(ohlc5m);
  const streak = compute5mStreakFromRows(rows);
  const kline10m = aggregate5mRowsTo10mKline(rows);
  const touch10m = computeMa30LastTouchGainBars({
    high: kline10m.high,
    low: kline10m.low,
    close: kline10m.close,
  });
  const streak10m = compute10mStreakFromKline(kline10m);
  const tradeCount15m = computeRecent15mTradeCountFrom5mRows(rows);
  return {
    streakDir: streak.dir,
    streakCount: streak.count,
    streakPct: streak.pct,
    streak10mDir: streak10m.dir,
    streak10mCount: streak10m.count,
    streak10mPct: streak10m.pct,
    tradeCount15m,
    maTouch5mPct: touch5m.pct,
    maTouch5mBars: touch5m.bars,
    maTouch10mPct: touch10m.pct,
    maTouch10mBars: touch10m.bars,
  };
}
