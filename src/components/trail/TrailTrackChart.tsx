import React, { useEffect, useMemo, useRef, useState } from 'react';
import { init, dispose, LineType, ActionType } from 'klinecharts';
import Box from '@mui/material/Box';

export type TrackCandle = {
  ts: number;
  open: number;
  high: number;
  low: number;
  close: number;
  vol: number;
};

type Props = {
  candles: TrackCandle[];
  height?: number;
};

const FIXED_Z_THRESHOLD = 2.3;

function hexPoints(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let k = 0; k < 6; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / 3;
    pts.push(`${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`);
  }
  return pts.join(' ');
}

const TrailTrackChart: React.FC<Props> = ({ candles, height = 420 }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<ReturnType<typeof init> | null>(null);
  const [overlayTick, setOverlayTick] = useState(0);

  const maStd = useMemo(() => {
    const MA_N = 30;
    const n = candles.length;
    const ma30 = new Array(n).fill(NaN);
    const sigma = new Array(n).fill(NaN);
    if (!n) return { ma30, sigma };
    const closes = candles.map((c) => c.close);
    const mean = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
    const popStd = (arr: number[], m: number) => {
      const v = arr.reduce((s, x) => s + (x - m) ** 2, 0) / arr.length;
      return Math.sqrt(v);
    };
    for (let i = MA_N - 1; i < n; i++) {
      const window = closes.slice(i - (MA_N - 1), i + 1);
      const m = mean(window);
      ma30[i] = m;
      sigma[i] = popStd(window, m);
    }
    return { ma30, sigma };
  }, [candles]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const chart = init(el);
    if (!chart) return;
    chartRef.current = chart;
    const defaultBarSpace = 4.8;
    const defaultRightOffset = 15;
    chart.setBarSpace(defaultBarSpace);
    chart.setOffsetRightDistance(defaultRightOffset);
    chart.setStyles({
      yAxis: {
        size: 32,
        tickText: { size: 10, marginStart: 0, marginEnd: 2 },
        tickLine: { show: false },
      },
    } as any);
    chart.createIndicator(
      {
        name: 'MA',
        calcParams: [30],
        styles: {
          lines: [
            {
              style: LineType.Solid,
              size: 3.4,
              color: '#0D47A1',
              smooth: false,
              dashedValue: [2, 2],
            },
          ],
        },
      },
      false,
      { id: 'candle_pane' },
    );
    chart.createIndicator('VOL', false, { height: 100 });
    const onViewChange = () => setOverlayTick((n) => n + 1);
    chart.subscribeAction(ActionType.OnVisibleRangeChange, onViewChange);
    chart.subscribeAction(ActionType.OnZoom, onViewChange);
    chart.subscribeAction(ActionType.OnScroll, onViewChange);
    return () => {
      chart.unsubscribeAction(ActionType.OnVisibleRangeChange, onViewChange);
      chart.unsubscribeAction(ActionType.OnZoom, onViewChange);
      chart.unsubscribeAction(ActionType.OnScroll, onViewChange);
      dispose(el);
      chartRef.current = null;
    };
  }, [candles.length]);

  useEffect(() => {
    if (!chartRef.current || candles.length === 0) return;
    chartRef.current.applyNewData(
      candles.map((c) => ({
        timestamp: c.ts * 1000,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.vol,
      })),
    );
    setOverlayTick((n) => n + 1);
  }, [candles]);

  const zHexagons = useMemo(() => {
    const chart = chartRef.current;
    if (!chart) return [];
    const out: Array<{ cx: number; cy: number }> = [];
    const gapAbove = 22;
    const gapBelow = 10;
    const r = 5;
    for (let i = 0; i < candles.length; i++) {
      const m = maStd.ma30[i];
      const s = maStd.sigma[i];
      if (!Number.isFinite(m) || !Number.isFinite(s) || s <= 0) continue;
      const z = Math.abs((candles[i].close - m) / s);
      if (z <= FIXED_Z_THRESHOLD) continue;
      const c = candles[i];
      if (c.close > m) {
        const pHigh = chart.convertToPixel(
          { dataIndex: i, value: c.high },
          { paneId: 'candle_pane', absolute: true },
        ) as any;
        if (!pHigh || !Number.isFinite(pHigh.x) || !Number.isFinite(pHigh.y))
          continue;
        out.push({ cx: pHigh.x, cy: pHigh.y - gapAbove - r });
      } else {
        const pLow = chart.convertToPixel(
          { dataIndex: i, value: c.low },
          { paneId: 'candle_pane', absolute: true },
        ) as any;
        if (!pLow || !Number.isFinite(pLow.x) || !Number.isFinite(pLow.y))
          continue;
        out.push({ cx: pLow.x, cy: pLow.y + gapBelow + r });
      }
    }
    return out;
  }, [candles, maStd, overlayTick]);

  return (
    <Box sx={{ position: 'relative', width: '100%' }}>
      <Box ref={containerRef} sx={{ width: '100%', height }} />
      {zHexagons.length > 0 && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            zIndex: 11,
          }}
        >
          <svg width="100%" height="100%">
            {zHexagons.map((o, i) => (
              <polygon
                key={`trail-z-${i}`}
                points={hexPoints(o.cx, o.cy, 5)}
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
  );
};

export default TrailTrackChart;
