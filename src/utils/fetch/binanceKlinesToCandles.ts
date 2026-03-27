export type Candle5m = {
  ts: number;
  open: number;
  high: number;
  low: number;
  close: number;
  vol: number;
};

export function parseBinanceKlinesToCandles5m(klines: string[][]): Candle5m[] {
  return klines
    .map((k) => ({
      ts: Math.floor(Number(k[0]) / 1000),
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      vol: parseFloat(k[5]),
    }))
    .filter((c) => Number.isFinite(c.ts) && Number.isFinite(c.open))
    .sort((a, b) => a.ts - b.ts);
}
