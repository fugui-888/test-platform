import type { ZFilterTableRow } from './zFilterMetrics';

const LS_PREFIX = 'ZFILTER_SNAPSHOT_V1_';

export type ZFilterSnapshotV1 = {
  rows: ZFilterTableRow[];
  computedAtMs: number;
  interval: string;
};

function isFiniteNum(x: unknown): x is number {
  return typeof x === 'number' && Number.isFinite(x);
}

function parseRow(x: unknown): ZFilterTableRow | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  if (typeof o.symbol !== 'string' || !o.symbol) return null;
  if (
    !isFiniteNum(o.lastClose) ||
    !isFiniteNum(o.zMa30) ||
    !isFiniteNum(o.barsSinceUpCross) ||
    !isFiniteNum(o.consecUpCount) ||
    !isFiniteNum(o.consecUpPct) ||
    !isFiniteNum(o.pctSinceUpCross) ||
    !isFiniteNum(o.volLast2)
  ) {
    return null;
  }
  return {
    symbol: o.symbol,
    lastClose: o.lastClose,
    zMa30: o.zMa30,
    barsSinceUpCross: o.barsSinceUpCross,
    consecUpCount: o.consecUpCount,
    consecUpPct: o.consecUpPct,
    pctSinceUpCross: o.pctSinceUpCross,
    volLast2: o.volLast2,
  };
}

function lsKey(interval: string): string {
  return `${LS_PREFIX}${interval}`;
}

export function readZFilterSnapshotFromLS(interval: string): {
  rows: ZFilterTableRow[];
  computedAtMs: number | null;
} {
  try {
    const raw = localStorage.getItem(lsKey(interval));
    if (!raw) return { rows: [], computedAtMs: null };
    const p = JSON.parse(raw) as unknown;
    if (!p || typeof p !== 'object') return { rows: [], computedAtMs: null };
    const obj = p as ZFilterSnapshotV1;
    if (obj.interval !== interval || !Array.isArray(obj.rows)) {
      return { rows: [], computedAtMs: null };
    }
    const rows = obj.rows
      .map(parseRow)
      .filter((r): r is ZFilterTableRow => r != null);
    const computedAtMs =
      typeof obj.computedAtMs === 'number' && Number.isFinite(obj.computedAtMs)
        ? obj.computedAtMs
        : null;
    return { rows, computedAtMs };
  } catch {
    return { rows: [], computedAtMs: null };
  }
}

export function writeZFilterSnapshotToLS(
  interval: string,
  rows: ZFilterTableRow[],
  computedAtMs: number,
): void {
  const snap: ZFilterSnapshotV1 = { rows, computedAtMs, interval };
  try {
    localStorage.setItem(lsKey(interval), JSON.stringify(snap));
  } catch {
    /* quota */
  }
}
