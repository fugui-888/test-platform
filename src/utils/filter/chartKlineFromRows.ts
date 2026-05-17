import type { MEXCKLINE } from '../../types/mexcKline';
import {
  aggregate5mRowsTo10mKline,
  aggregate5mRowsTo10mTradeLine,
  rowsToKline,
  rowsToTradeLine,
  type TradeLinePoint,
} from '../binance/watchlistMonitorKline';

/** 与 CoolIntervalGroup 可选周期一致 */
export type ChartPipelineInterval = '1m' | '5m' | '10m' | '15m' | '30m' | '1d';

export type { TradeLinePoint };

export function buildKlineAndTradeLineFromFetchedRows(
  rows: unknown[][],
  chartInterval: ChartPipelineInterval,
): { kline: MEXCKLINE; tradeLine: TradeLinePoint[] } {
  if (chartInterval === '10m') {
    return {
      kline: aggregate5mRowsTo10mKline(rows),
      tradeLine: aggregate5mRowsTo10mTradeLine(rows),
    };
  }
  return {
    kline: rowsToKline(rows),
    tradeLine: rowsToTradeLine(rows),
  };
}

/** 图表为 10m 时底层拉 5m */
export function fetchIntervalForChart(
  chartInterval: ChartPipelineInterval,
): string {
  return chartInterval === '10m' ? '5m' : chartInterval;
}
