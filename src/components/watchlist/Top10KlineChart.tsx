import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CandlestickSeries,
  ColorType,
  createChart,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
} from 'lightweight-charts';
import type {
  IChartApi,
  ISeriesApi,
  LogicalRange,
  MouseEventHandler,
  MouseEventParams,
  Time,
} from 'lightweight-charts';
import { Box, Typography } from '@mui/material';
import type { MEXCKLINE } from '../../types/mexcKline';

type Props = {
  klines: MEXCKLINE | null;
  chartHeight?: number;
  zThreshold?: number;
  tradeCountLine?: Array<{ time: number; value: number }>;
  /** 仅随「选币」变化；不要把周期写进来，否则切换 interval 会重建图并丢掉缩放 */
  seriesKey?: string;
  /** 周期切换时用于重置十字光标等；不参与是否重建图表 */
  intervalKey?: string;
};

const DEFAULT_Z_THRESHOLD = 2.3;
const HEX_R = 5;

function hexPoints(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let k = 0; k < 6; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / 3;
    pts.push(`${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`);
  }
  return pts.join(' ');
}

const sydneyAxisTimeFmt = new Intl.DateTimeFormat('en-AU', {
  timeZone: 'Australia/Sydney',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const sydneyHoverTimeFmt = new Intl.DateTimeFormat('en-AU', {
  timeZone: 'Australia/Sydney',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

function formatTimeToSydney(time: Time, mode: 'axis' | 'hover'): string {
  if (typeof time === 'number') {
    const d = new Date(time * 1000);
    return mode === 'axis'
      ? sydneyAxisTimeFmt.format(d)
      : sydneyHoverTimeFmt.format(d);
  }
  if (
    time &&
    typeof time === 'object' &&
    'year' in time &&
    'month' in time &&
    'day' in time
  ) {
    const d = new Date(
      Date.UTC(Number(time.year), Number(time.month) - 1, Number(time.day)),
    );
    return mode === 'axis'
      ? sydneyAxisTimeFmt.format(d)
      : sydneyHoverTimeFmt.format(d);
  }
  return '';
}

function guessPriceFormat(closes: number[]): {
  precision: number;
  minMove: number;
} {
  const finite = closes.filter((c) => Number.isFinite(c) && c > 0);
  if (finite.length === 0) return { precision: 8, minMove: 1e-8 };
  const minP = Math.min(...finite);
  if (minP >= 1) return { precision: 4, minMove: 0.0001 };
  if (minP >= 0.01) return { precision: 6, minMove: 1e-6 };
  return { precision: 8, minMove: 1e-8 };
}

function buildCandles(k: MEXCKLINE): Array<{
  time: Time;
  open: number;
  high: number;
  low: number;
  close: number;
  color?: string;
  borderColor?: string;
  wickColor?: string;
}> {
  const n = k?.time?.length ?? 0;
  const out: Array<{
    time: Time;
    open: number;
    high: number;
    low: number;
    close: number;
  }> = [];
  for (let i = 0; i < n; i++) {
    out.push({
      time: k.time[i] as Time,
      open: k.open[i],
      high: k.high[i],
      low: k.low[i],
      close: k.close[i],
    });
  }
  return out;
}

function buildMaData(
  k: MEXCKLINE,
  period: number,
): { time: Time; value: number }[] {
  const n = k.time.length;
  if (n < period) return [];
  const closes = k.close;
  const out: { time: Time; value: number }[] = [];
  for (let i = period - 1; i < n; i++) {
    let s = 0;
    for (let j = i - (period - 1); j <= i; j++) s += closes[j];
    out.push({ time: k.time[i] as Time, value: s / period });
  }
  return out;
}

function buildMaArray(k: MEXCKLINE, period: number): number[] {
  const n = k.time.length;
  const out = new Array<number>(n).fill(Number.NaN);
  if (n < period) return out;
  for (let i = period - 1; i < n; i++) {
    let s = 0;
    for (let j = i - (period - 1); j <= i; j++) s += k.close[j];
    out[i] = s / period;
  }
  return out;
}

function buildZData(k: MEXCKLINE, period: number): Map<number, number> {
  const out = new Map<number, number>();
  const closes = k.close;
  if (closes.length < period) return out;
  for (let i = period - 1; i < closes.length; i++) {
    let s = 0;
    for (let j = i - (period - 1); j <= i; j++) s += closes[j];
    const ma = s / period;
    let varSum = 0;
    for (let j = i - (period - 1); j <= i; j++) varSum += (closes[j] - ma) ** 2;
    const sigma = Math.sqrt(varSum / period);
    if (sigma > 1e-12) out.set(k.time[i], (closes[i] - ma) / sigma);
  }
  return out;
}

function buildRisePctData(k: MEXCKLINE): Map<number, number> {
  const out = new Map<number, number>();
  for (let i = 1; i < k.close.length; i++) {
    const base = k.close[i - 1];
    if (base > 1e-12) out.set(k.time[i], ((k.close[i] - base) / base) * 100);
  }
  return out;
}

function calcRisePctBar(nowPrice: number, basePrice: number): number | null {
  if (
    !(basePrice > 1e-12) ||
    !Number.isFinite(nowPrice) ||
    !Number.isFinite(basePrice)
  )
    return null;
  return ((nowPrice - basePrice) / basePrice) * 100;
}

/** 以 idx 为末根，向前数连续同色 K（绿：收≥开，红：收<开），总涨幅为末收相对首根开盘 */
function streakEndingAtIndex(
  open: number[],
  close: number[],
  idx: number,
): {
  kind: 'green' | 'red';
  count: number;
  pct: number;
} | null {
  if (idx < 0 || idx >= close.length || idx >= open.length) return null;
  const isUp = close[idx] >= open[idx];
  let firstIdx = idx;
  for (let i = idx - 1; i >= 0; i--) {
    const sameDir = isUp ? close[i] >= open[i] : close[i] < open[i];
    if (!sameDir) break;
    firstIdx = i;
  }
  const pct = calcRisePctBar(close[idx], open[firstIdx]);
  if (pct == null) return null;
  return { kind: isUp ? 'green' : 'red', count: idx - firstIdx + 1, pct };
}

function sanitizeKlines(k: MEXCKLINE): MEXCKLINE | null {
  const n = Math.min(
    k.time.length,
    k.open.length,
    k.high.length,
    k.low.length,
    k.close.length,
    k.vol.length,
  );
  if (n <= 0) return null;

  const byTime = new Map<
    number,
    { open: number; high: number; low: number; close: number; vol: number }
  >();
  for (let i = 0; i < n; i++) {
    const time = Number(k.time[i]);
    const open = Number(k.open[i]);
    const high = Number(k.high[i]);
    const low = Number(k.low[i]);
    const close = Number(k.close[i]);
    const vol = Number(k.vol[i]);
    if (!Number.isFinite(time) || time <= 0) continue;
    if (
      !Number.isFinite(open) ||
      !Number.isFinite(high) ||
      !Number.isFinite(low) ||
      !Number.isFinite(close)
    )
      continue;
    const fixedHigh = Math.max(high, open, close);
    const fixedLow = Math.min(low, open, close);
    byTime.set(time, {
      open,
      high: fixedHigh,
      low: fixedLow,
      close,
      vol: Number.isFinite(vol) ? vol : 0,
    });
  }

  const times = Array.from(byTime.keys()).sort((a, b) => a - b);
  if (times.length === 0) return null;
  return {
    time: times,
    open: times.map((t) => byTime.get(t)?.open ?? 0),
    high: times.map((t) => byTime.get(t)?.high ?? 0),
    low: times.map((t) => byTime.get(t)?.low ?? 0),
    close: times.map((t) => byTime.get(t)?.close ?? 0),
    vol: times.map((t) => byTime.get(t)?.vol ?? 0),
  };
}

/** 轮询 setData 后把逻辑可见区间钳到当前根数，尽量保留右侧留白（to 可略大于 lastIndex） */
function clampVisibleLogicalRange(
  range: LogicalRange | null,
  barCount: number,
  maxRightGap = 64,
): LogicalRange | null {
  if (!range || barCount <= 0) return null;
  const last = barCount - 1;
  if (last < 0) return null;
  let from = Number(range.from);
  let to = Number(range.to);
  if (!Number.isFinite(from) || !Number.isFinite(to) || !(to > from))
    return null;
  const minSpan = Math.min(12, Math.max(4, last));
  const maxTo = last + maxRightGap;
  if (to > maxTo) {
    const shift = to - maxTo;
    from -= shift;
    to = maxTo;
  }
  if (from > last - 1) from = Math.max(0, last - minSpan);
  if (to < from + minSpan) to = Math.min(maxTo, from + minSpan);
  if (to <= from) return null;
  return { from, to } as LogicalRange;
}

const Top10KlineChart: React.FC<Props> = ({
  klines,
  chartHeight = 420,
  zThreshold = DEFAULT_Z_THRESHOLD,
  tradeCountLine = [],
  seriesKey = '',
  intervalKey,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const ma30Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const tradeCountRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const resizeHandlerRef = useRef<(() => void) | null>(null);
  const crosshairHandlerRef = useRef<MouseEventHandler<Time> | null>(null);
  const zMapRef = useRef<Map<number, number>>(new Map());
  const risePctMapRef = useRef<Map<number, number>>(new Map());
  const structuralKeyRef = useRef<string | null>(null);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [overlayTick, setOverlayTick] = useState(0);

  const safeKlines = useMemo(
    () => (klines ? sanitizeKlines(klines) : null),
    [klines],
  );
  const safeTradeCountLine = useMemo(() => {
    if (!safeKlines || safeKlines.time.length === 0) return [];

    const byTime = new Map<number, number>();
    for (const x of tradeCountLine) {
      const t = Number(x?.time);
      const v = Number(x?.value);
      if (!Number.isFinite(t) || !Number.isFinite(v)) continue;
      byTime.set(Math.floor(t), v);
    }

    // 与主K线时间轴严格对齐，缺失点补 0，避免 lightweight-charts 线系列出现空值节点
    const aligned = safeKlines.time.map((t) => {
      const sec = Math.floor(Number(t));
      const v = byTime.get(sec);
      return {
        time: sec as Time,
        value: Number.isFinite(v) ? (v as number) : 0,
      };
    });

    const out: Array<{ time: Time; value: number }> = [];
    let prev = -Infinity;
    for (const p of aligned) {
      const t = Number(p.time);
      if (!Number.isFinite(t) || t <= prev) continue;
      if (!Number.isFinite(p.value)) continue;
      out.push(p);
      prev = t;
    }
    return out;
  }, [tradeCountLine, safeKlines]);
  const rawCandleData = useMemo(
    () => (safeKlines ? buildCandles(safeKlines) : []),
    [safeKlines],
  );
  const timeIndexMap = useMemo(() => {
    const m = new Map<number, number>();
    if (!safeKlines) return m;
    for (let i = 0; i < safeKlines.time.length; i++)
      m.set(safeKlines.time[i], i);
    return m;
  }, [safeKlines]);
  const ma30Array = useMemo(
    () => (safeKlines ? buildMaArray(safeKlines, 30) : []),
    [safeKlines],
  );
  const ma30Data = useMemo(() => {
    const raw = safeKlines ? buildMaData(safeKlines, 30) : [];
    const out: Array<{ time: Time; value: number }> = [];
    let prev = -Infinity;
    for (const p of raw) {
      const t = Number(p.time);
      const v = Number(p.value);
      if (!Number.isFinite(t) || !Number.isFinite(v)) continue;
      if (t <= prev) continue;
      out.push({ time: t as Time, value: v });
      prev = t;
    }
    return out;
  }, [safeKlines]);
  const zMap = useMemo(
    () => (safeKlines ? buildZData(safeKlines, 30) : new Map<number, number>()),
    [safeKlines],
  );
  const risePctMap = useMemo(
    () =>
      safeKlines ? buildRisePctData(safeKlines) : new Map<number, number>(),
    [safeKlines],
  );
  const touchFlags = useMemo(() => {
    if (!safeKlines) return [] as boolean[];
    return safeKlines.time.map((_, i) => {
      const ma = ma30Array[i];
      if (!Number.isFinite(ma)) return false;
      return safeKlines.low[i] <= ma && safeKlines.high[i] >= ma;
    });
  }, [safeKlines, ma30Array]);

  useEffect(() => {
    zMapRef.current = zMap;
    risePctMapRef.current = risePctMap;
  }, [zMap, risePctMap]);

  useEffect(() => {
    setHoverTime(null);
  }, [seriesKey, intervalKey]);

  const activeIdx = useMemo(() => {
    if (!safeKlines || safeKlines.time.length === 0) return -1;
    if (hoverTime != null)
      return timeIndexMap.get(hoverTime) ?? safeKlines.time.length - 1;
    return safeKlines.time.length - 1;
  }, [hoverTime, safeKlines, timeIndexMap]);

  const streakHover = useMemo(() => {
    if (!safeKlines || activeIdx < 0) return null;
    return streakEndingAtIndex(safeKlines.open, safeKlines.close, activeIdx);
  }, [safeKlines, activeIdx]);

  const lastTouchIdx = useMemo(() => {
    if (!safeKlines || activeIdx < 0) return null;
    for (let i = activeIdx; i >= 0; i--) {
      if (touchFlags[i]) return i;
    }
    return null;
  }, [activeIdx, safeKlines, touchFlags]);

  const candleData = rawCandleData;

  const teardownChart = () => {
    if (resizeHandlerRef.current) {
      window.removeEventListener('resize', resizeHandlerRef.current);
      resizeHandlerRef.current = null;
    }
    if (chartRef.current && crosshairHandlerRef.current) {
      chartRef.current.unsubscribeCrosshairMove(crosshairHandlerRef.current);
      crosshairHandlerRef.current = null;
    }
    chartRef.current?.remove();
    chartRef.current = null;
    candleRef.current = null;
    volumeRef.current = null;
    ma30Ref.current = null;
    tradeCountRef.current = null;
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const structuralKey = `${chartHeight}|${seriesKey}`;
    const structuralChanged = structuralKeyRef.current !== structuralKey;
    if (structuralChanged) {
      teardownChart();
      structuralKeyRef.current = structuralKey;
    }

    if (!safeKlines || candleData.length === 0) {
      return;
    }

    let savedViewport: {
      visibleTime: { from: Time; to: Time } | null;
      visibleLogical: LogicalRange | null;
      scrollPosition: number;
    } | null = null;
    if (!structuralChanged && chartRef.current) {
      const ts = chartRef.current.timeScale();
      savedViewport = {
        visibleTime: ts.getVisibleRange(),
        visibleLogical: ts.getVisibleLogicalRange(),
        scrollPosition: ts.scrollPosition(),
      };
    }

    const buildChart = () => {
      const { precision, minMove } = guessPriceFormat(
        candleData.map((d) => d.close),
      );
      const priceFmt = { type: 'price' as const, precision, minMove };
      const chart = createChart(el, {
        layout: {
          background: { type: ColorType.Solid, color: '#ffffff' },
          textColor: '#333',
        },
        localization: {
          locale: 'en-AU',
          timeFormatter: (time: Time) => formatTimeToSydney(time, 'hover'),
        },
        grid: {
          vertLines: { color: '#f0f0f0' },
          horzLines: { color: '#f0f0f0' },
        },
        crosshair: { mode: CrosshairMode.Normal },
        timeScale: {
          timeVisible: true,
          secondsVisible: false,
          tickMarkFormatter: (time: Time) => formatTimeToSydney(time, 'axis'),
          /** 默认 true：全量 setData 时若最后一根在视区内会自动平移视窗，导致用户缩放/拖动被「弹回」 */
          shiftVisibleRangeOnNewBar: false,
        },
        rightPriceScale: {
          scaleMargins: { top: 0.06, bottom: 0.28 },
        },
        width: el.clientWidth,
        height: chartHeight,
      });

      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: '#26a69a',
        downColor: '#ef5350',
        wickUpColor: '#26a69a',
        wickDownColor: '#ef5350',
        borderVisible: false,
        priceFormat: priceFmt,
      });

      const ma30Series = chart.addSeries(LineSeries, {
        color: '#1565c0',
        lineWidth: 4,
        lineStyle: LineStyle.Solid,
        priceLineVisible: false,
        lastValueVisible: true,
        priceFormat: priceFmt,
      });
      const tradeCountSeries = chart.addSeries(HistogramSeries, {
        color: 'rgba(126, 87, 194, 0.28)',
        priceScaleId: 'trades',
        priceLineVisible: false,
        lastValueVisible: false,
      });
      const volumeSeries = chart.addSeries(HistogramSeries, {
        priceScaleId: 'volume',
        priceFormat: { type: 'volume' },
        priceLineVisible: false,
        lastValueVisible: false,
      });
      chart.priceScale('trades').applyOptions({
        visible: false,
        scaleMargins: { top: 0.06, bottom: 0.28 },
      });
      chart.priceScale('volume').applyOptions({
        visible: true,
        scaleMargins: { top: 0.8, bottom: 0 },
      });

      chartRef.current = chart;
      candleRef.current = candleSeries;
      volumeRef.current = volumeSeries;
      ma30Ref.current = ma30Series;
      tradeCountRef.current = tradeCountSeries;

      const onResize = () => {
        const box = containerRef.current;
        if (box && chartRef.current) {
          chartRef.current.applyOptions({ width: box.clientWidth });
          setOverlayTick((x) => x + 1);
        }
      };
      resizeHandlerRef.current = onResize;
      window.addEventListener('resize', onResize);

      const onCrosshairMove: MouseEventHandler<Time> = (
        param: MouseEventParams<Time>,
      ) => {
        const t = typeof param?.time === 'number' ? param.time : NaN;
        setHoverTime(Number.isFinite(t) ? t : null);
        setOverlayTick((x) => x + 1);
      };
      crosshairHandlerRef.current = onCrosshairMove;
      chart.subscribeCrosshairMove(onCrosshairMove);
    };

    if (!chartRef.current) {
      buildChart();
    }

    const chart = chartRef.current;
    if (
      !chart ||
      !candleRef.current ||
      !volumeRef.current ||
      !ma30Ref.current ||
      !tradeCountRef.current
    ) {
      return;
    }

    candleRef.current.setData(candleData);
    volumeRef.current.setData(
      safeKlines.time.map((t, i) => ({
        time: t as Time,
        value: safeKlines.vol[i] ?? 0,
        color:
          safeKlines.close[i] >= safeKlines.open[i]
            ? 'rgba(38,166,154,0.45)'
            : 'rgba(239,83,80,0.45)',
      })),
    );
    ma30Ref.current.setData(ma30Data);
    tradeCountRef.current.setData(
      safeTradeCountLine.map((p) => ({
        time: p.time,
        value: p.value,
        color: 'rgba(126, 87, 194, 0.28)',
      })),
    );

    const n = candleData.length;
    const applyDefaultRange = () => {
      const barsToShow = Math.min(120, n);
      chart.timeScale().setVisibleLogicalRange({
        from: Math.max(0, n - barsToShow),
        to: n,
      });
    };

    const restoreUserViewport = () => {
      if (!chartRef.current || !savedViewport) return;
      const ts = chartRef.current.timeScale();
      const nBars = candleData.length;
      // 优先逻辑区间：轮询后时间戳可能微调，用时间恢复容易失败并「弹回」默认视窗
      try {
        const logical = clampVisibleLogicalRange(
          savedViewport.visibleLogical,
          nBars,
        );
        if (logical) {
          ts.setVisibleLogicalRange(logical);
          return;
        }
      } catch {
        /* fall through */
      }
      try {
        if (savedViewport.visibleTime) {
          ts.setVisibleRange(savedViewport.visibleTime);
          return;
        }
      } catch {
        /* 时间轴在数据替换后可能短暂不可用 */
      }
      if (Number.isFinite(savedViewport.scrollPosition)) {
        try {
          ts.scrollToPosition(savedViewport.scrollPosition, false);
          return;
        } catch {
          /* fall through */
        }
      }
      applyDefaultRange();
    };

    if (structuralChanged) {
      applyDefaultRange();
    } else if (savedViewport) {
      restoreUserViewport();
      requestAnimationFrame(() => {
        restoreUserViewport();
        requestAnimationFrame(() => restoreUserViewport());
      });
    } else {
      applyDefaultRange();
    }

    setOverlayTick((x) => x + 1);
  }, [
    safeKlines,
    candleData,
    ma30Data,
    safeTradeCountLine,
    chartHeight,
    seriesKey,
  ]);

  const zHexOverlays = useMemo(() => {
    const chart = chartRef.current;
    const candle = candleRef.current;
    if (!chart || !candle || !safeKlines || safeKlines.time.length === 0)
      return [];
    const out: Array<{ x: number; y: number }> = [];
    const gapAbove = 12;
    for (let i = 0; i < safeKlines.time.length; i++) {
      const t = safeKlines.time[i];
      const z = zMapRef.current.get(t);
      if (!(z != null && z > zThreshold)) continue;
      const x = chart.timeScale().timeToCoordinate(t as Time);
      const yHigh = candle.priceToCoordinate(safeKlines.high[i]);
      if (!Number.isFinite(x) || !Number.isFinite(yHigh)) continue;
      out.push({ x: x as number, y: (yHigh as number) - gapAbove - HEX_R });
    }
    return out;
    // overlayTick：十字光标/缩放后重算六角标位置
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeKlines, overlayTick, zThreshold]);

  useEffect(() => () => teardownChart(), []);

  if (!safeKlines || candleData.length === 0) {
    return (
      <Box sx={{ py: 6, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          暂无 K 线数据
        </Typography>
      </Box>
    );
  }

  const latestTime = safeKlines.time[safeKlines.time.length - 1];
  const metricTime = hoverTime ?? latestTime;
  const zVal = zMapRef.current.get(metricTime);
  const risePct = risePctMapRef.current.get(metricTime);
  const barsSinceTouch =
    lastTouchIdx == null || activeIdx < 0 ? null : activeIdx - lastTouchIdx;
  const riseSinceTouchPct =
    lastTouchIdx == null ||
    activeIdx < 0 ||
    lastTouchIdx >= safeKlines.close.length ||
    activeIdx >= safeKlines.close.length
      ? null
      : (() => {
          const base = safeKlines.close[lastTouchIdx];
          if (!(base > 1e-12)) return null;
          return ((safeKlines.close[activeIdx] - base) / base) * 100;
        })();
  return (
    <Box sx={{ width: '100%', position: 'relative' }}>
      <Typography
        variant="body2"
        sx={{ mb: 0.5, color: '#1565c0', fontWeight: 700 }}
      >
        z(MA30): {zVal == null ? '—' : zVal.toFixed(3)} · 当前涨幅:{' '}
        {risePct == null ? '—' : `${risePct.toFixed(2)}%`} ·{' '}
        <Typography component="span" sx={{ color: '#6a1b9a', fontWeight: 800 }}>
          距上次触碰: {barsSinceTouch == null ? '—' : `${barsSinceTouch} 根`} ·
          触碰后总涨幅:{' '}
          {riseSinceTouchPct == null ? '—' : `${riseSinceTouchPct.toFixed(2)}%`}
        </Typography>
        {streakHover != null && (
          <>
            {' · '}
            <Typography
              component="span"
              sx={{ color: '#bf360c', fontWeight: 800 }}
            >
              {streakHover.kind === 'green' ? '连绿' : '连红'}{' '}
              {streakHover.pct.toFixed(2)}%（{streakHover.count}根）
            </Typography>
          </>
        )}
      </Typography>
      <Box sx={{ position: 'relative', width: '100%', height: chartHeight }}>
        <Box ref={containerRef} sx={{ width: '100%', height: chartHeight }} />
        {zHexOverlays.length > 0 && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              zIndex: 3,
            }}
          >
            <svg width="100%" height="100%">
              {zHexOverlays.map((o, i) => (
                <polygon
                  key={`zhex-${i}`}
                  points={hexPoints(o.x, o.y, HEX_R)}
                  fill="#1E88E5"
                  stroke="#0D47A1"
                  strokeWidth={1}
                  opacity={0.92}
                />
              ))}
            </svg>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default Top10KlineChart;
