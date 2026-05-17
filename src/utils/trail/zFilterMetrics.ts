import { rowsToKline } from '../binance/watchlistMonitorKline';
import {
  computeMa30LastTouchGainFromKline,
  zScoreMa30AtIndex,
} from './ma30Metrics';

export const Z_FILTER_MIN_BARS_SINCE_MA30_TOUCH = 5;

export type KlineCandle = {
  o: number;
  h: number;
  l: number;
  c: number;
  vol: number;
  /** Binance klines[8] 成交笔数；无则与 vol 相同 */
  count: number;
};

export type ZFilterTableRow = {
  symbol: string;
  lastClose: number;
  zMa30: number;
  barsSinceUpCross: number;
  consecUpCount: number;
  consecUpPct: number;
  pctSinceUpCross: number;
  /** 最近两根：Binance 为成交笔数之和，OKEX 为成交量之和 */
  volLast2: number;
};

export type ZFilterSortKey =
  | 'symbol'
  | 'lastClose'
  | 'volLast2'
  | 'zMa30'
  | 'consecUpCount'
  | 'consecUpPct'
  | 'barsSinceUpCross'
  | 'pctSinceUpCross';

/** Binance / OKEX 本地 K 线（至少 6 列；Binance 第 9 列为成交笔数） */
export function parseStoredKlineRows(rows: string[][]): KlineCandle[] {
  const out: KlineCandle[] = [];
  for (const r of rows) {
    if (!Array.isArray(r) || r.length < 6) continue;
    const o = parseFloat(String(r[1]));
    const h = parseFloat(String(r[2]));
    const l = parseFloat(String(r[3]));
    const c = parseFloat(String(r[4]));
    const vol = parseFloat(String(r[5]));
    if (
      !Number.isFinite(o) ||
      !Number.isFinite(h) ||
      !Number.isFinite(l) ||
      !Number.isFinite(c) ||
      !Number.isFinite(vol)
    ) {
      continue;
    }
    let count = Math.max(0, vol);
    if (r.length >= 9) {
      const trades = Number(r[8]);
      if (Number.isFinite(trades)) count = Math.max(0, Math.round(trades));
    }
    out.push({ o, h, l, c, vol: Math.max(0, vol), count });
  }
  return out;
}

/** @deprecated 使用 parseStoredKlineRows */
export const parseOkexKlineRows = parseStoredKlineRows;

function ma30AtIndex(closes: number[], idx: number): number | null {
  if (idx < 29 || idx >= closes.length) return null;
  let s = 0;
  for (let j = idx - 29; j <= idx; j++) s += closes[j];
  return s / 30;
}

/**
 * 与 monitor-platform 全局 30m 监控同一套过滤与指标（本地 K 线）。
 */
export function computeZFilterFilteredRow(
  symbol: string,
  klines: string[][],
): ZFilterTableRow | null {
  const candles = parseStoredKlineRows(klines);
  const n = candles.length;
  if (n < 30) return null;
  const closes = candles.map((x) => x.c);
  const last = n - 1;
  const maLast = ma30AtIndex(closes, last);
  if (maLast == null || !Number.isFinite(maLast)) return null;
  if (closes[last] < maLast) return null;

  const kline = rowsToKline(klines);
  if (!kline || kline.close.length < 30) return null;
  const touch = computeMa30LastTouchGainFromKline(kline);
  if (touch.bars == null || touch.pct == null) return null;
  if (touch.bars < Z_FILTER_MIN_BARS_SINCE_MA30_TOUCH) return null;

  let consecUpCount = 0;
  let firstOpenInStreak = candles[last].o;
  for (let i = last; i >= 0; i--) {
    if (candles[i].c >= candles[i].o) {
      consecUpCount += 1;
      firstOpenInStreak = candles[i].o;
    } else break;
  }
  const consecUpPct =
    firstOpenInStreak > 1e-12
      ? ((closes[last] - firstOpenInStreak) / firstOpenInStreak) * 100
      : 0;

  const z = zScoreMa30AtIndex(closes, last);
  if (z == null || !Number.isFinite(z)) return null;

  const vLast = candles[last].count;
  const vPrev = last >= 1 ? candles[last - 1].count : 0;

  return {
    symbol,
    lastClose: closes[last],
    zMa30: z,
    barsSinceUpCross: touch.bars,
    consecUpCount,
    consecUpPct,
    pctSinceUpCross: touch.pct,
    volLast2:
      (Number.isFinite(vLast) ? vLast : 0) +
      (Number.isFinite(vPrev) ? vPrev : 0),
  };
}

export function sortZFilterRows(
  rows: ZFilterTableRow[],
  key: ZFilterSortKey,
  order: 'asc' | 'desc',
): ZFilterTableRow[] {
  const copy = [...rows];
  const m = order === 'asc' ? 1 : -1;
  copy.sort((a, b) => {
    if (key === 'symbol') {
      const c = a.symbol.localeCompare(b.symbol);
      return c * m;
    }
    const va = a[key] as number;
    const vb = b[key] as number;
    const d = va - vb;
    if (d !== 0) return d * m;
    return a.symbol.localeCompare(b.symbol) * (order === 'asc' ? 1 : -1);
  });
  return copy;
}

export function formatRelativeZhPast(
  pastMs: number,
  nowMs: number = Date.now(),
): string {
  const sec = Math.floor((nowMs - pastMs) / 1000);
  if (sec < 45) return '刚刚';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}分钟前`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h < 48) {
    if (m === 0) return `${h}小时前`;
    return `${h}小时${m}分钟前`;
  }
  const d = Math.floor(h / 24);
  const rh = h % 24;
  if (rh === 0) return `${d}天前`;
  return `${d}天${rh}小时前`;
}
