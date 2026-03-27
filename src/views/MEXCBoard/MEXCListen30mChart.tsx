import React, { useEffect, useMemo, useRef, useState } from 'react';
import { init, dispose, ActionType, LineType } from 'klinecharts';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

export type ListenCandle30 = {
  ts: number;
  open: number;
  high: number;
  low: number;
  close: number;
  vol: number;
  startIndex: number;
  endIndex: number;
};

type Props = {
  candles30: ListenCandle30[];
  height?: number;
};

const MEXCListen30mChart: React.FC<Props> = ({ candles30, height = 550 }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<ReturnType<typeof init> | null>(null);
  const [overlayTick, setOverlayTick] = useState(0);

  const maStd = useMemo(() => {
    const MA_N = 30;
    const n = candles30?.length ?? 0;
    const ma30: number[] = new Array(n).fill(NaN);
    const sigma: number[] = new Array(n).fill(NaN);
    if (!n) return { ma30, sigma };
    const closes = candles30.map((c) => c.close);
    const mean = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
    const popStd = (arr: number[], m: number) => {
      const v = arr.reduce((s, x) => s + (x - m) ** 2, 0) / arr.length;
      return Math.sqrt(v);
    };
    for (let i = 0; i < n; i++) {
      if (i < MA_N - 1) continue;
      const window = closes.slice(i - (MA_N - 1), i + 1);
      const m = mean(window);
      ma30[i] = m;
      sigma[i] = popStd(window, m);
    }
    return { ma30, sigma };
  }, [candles30]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const chart = init(el);
    if (!chart) return;
    const defaultBarSpace = 4.8;
    const defaultRightOffset = 15;
    const volPaneHeight = Math.min(
      100,
      Math.max(56, Math.round(height * 0.24)),
    );
    chartRef.current = chart;
    (chart as any).setPrecision?.({ price: 0, volume: 0 });
    (chart as any).setPriceVolumePrecision?.(0, 0);
    chart.setBarSpace(defaultBarSpace);
    chart.setOffsetRightDistance(defaultRightOffset);
    chart.setStyles({
      candle: {
        tooltip: { showRule: 'none' },
        priceMark: {
          last: {
            text: { show: false },
          },
        },
      },
      indicator: { tooltip: { showRule: 'none' } },
      yAxis: {
        size: 32,
        tickText: { size: 10, marginStart: 0, marginEnd: 2 },
        tickLine: { show: false },
      },
      crosshair: {
        horizontal: { text: { show: false } },
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
              size: 3.2,
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
    chart.createIndicator('VOL', false, { height: volPaneHeight });
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
  }, [candles30.length, height]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !candles30.length) return;
    chart.applyNewData(
      candles30.map((c) => ({
        timestamp: c.ts * 1000,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.vol,
      })),
    );
    setOverlayTick((n) => n + 1);
  }, [candles30]);

  const latestIdx = candles30.length - 1;
  const bar = latestIdx >= 0 ? candles30[latestIdx] : null;
  const ma = latestIdx >= 0 ? maStd.ma30[latestIdx] : NaN;
  const sigma = latestIdx >= 0 ? maStd.sigma[latestIdx] : NaN;
  const diff = bar && Number.isFinite(ma) ? bar.close - ma : NaN;
  const bodyPct =
    bar && bar.open !== 0 ? ((bar.close - bar.open) / bar.open) * 100 : NaN;
  const absZ =
    bar && Number.isFinite(diff) && Number.isFinite(sigma) && sigma > 0
      ? Math.abs(diff / sigma)
      : NaN;

  return (
    <Box sx={{ position: 'relative', width: '100%' }}>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{
          display: 'block',
          mb: 0.5,
          pl: '52px',
          minHeight: 22,
          lineHeight: '22px',
          fontSize: '0.9rem',
        }}
      >
        Diff%:{' '}
        {Number.isFinite(bodyPct)
          ? `${bodyPct > 0 ? '+' : ''}${bodyPct.toFixed(3)}`
          : '—'}
        % · |z|:{' '}
        <Box
          component="span"
          sx={
            Number.isFinite(absZ) && absZ > 2.3
              ? { color: 'error.main', fontWeight: 700 }
              : { color: 'text.secondary', fontWeight: 400 }
          }
        >
          {Number.isFinite(absZ) ? absZ.toFixed(3) : '—'}
        </Box>
      </Typography>
      <Box ref={containerRef} sx={{ width: '100%', height }} />
    </Box>
  );
};

export default MEXCListen30mChart;
