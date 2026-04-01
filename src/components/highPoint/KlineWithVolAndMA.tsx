import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  createChart,
  ColorType,
  CrosshairMode,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
} from 'lightweight-charts';

interface Props {
  symbol: string;
  klines: string[][];
  selectedDate?: number; // 秒级时间戳
  zThreshold?: number;
}

const KlineWithVolAndMA: React.FC<Props> = ({
  symbol,
  klines,
  selectedDate,
  zThreshold = 2.3,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hexPoints, setHexPoints] = useState<Array<{ x: number; y: number }>>(
    [],
  );

  const Z_THRESHOLD = zThreshold;

  const buildHex = (cx: number, cy: number, r: number) => {
    const pts: string[] = [];
    for (let k = 0; k < 6; k++) {
      const a = -Math.PI / 2 + (k * Math.PI) / 3;
      pts.push(`${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`);
    }
    return pts.join(' ');
  };

  useEffect(() => {
    if (!containerRef.current || !klines || klines.length === 0) return;

    // 1. 创建图表 (高度缩减到 400)
    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#ffffff' },
        textColor: '#333',
      },
      grid: {
        vertLines: { color: '#f0f0f0' },
        horzLines: { color: '#f0f0f0' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
      width: containerRef.current.clientWidth,
      height: 400,
    });

    // 2. 蜡烛图
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#26a69a',
      downColor: '#ef5350',
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
      borderVisible: false,
    });

    const candleData = klines
      .map((k) => ({
        time: (Number(k[0]) / 1000) as any,
        open: Number(k[1]),
        high: Number(k[2]),
        low: Number(k[3]),
        close: Number(k[4]),
      }))
      .sort((a, b) => a.time - b.time);

    candleSeries.setData(candleData);

    // 3. 均线 (MA)
    const addMA = (period: number, color: string) => {
      const line = chart.addSeries(LineSeries, {
        color,
        lineWidth: 3,
        priceLineVisible: false,
        lastValueVisible: false,
      });

      const maData = candleData
        .map((d, i) => {
          if (i < period - 1) return null;
          const slice = candleData.slice(i - period + 1, i + 1);
          const avg = slice.reduce((sum, cur) => sum + cur.close, 0) / period;
          return { time: d.time, value: avg };
        })
        .filter(Boolean) as any;

      line.setData(maData);
    };

    addMA(30, '#0D47A1');

    // MA30 与 sigma，用于计算 z 值和六边形标记
    const MA_N = 30;
    const ma30: number[] = new Array(candleData.length).fill(NaN);
    const sigma: number[] = new Array(candleData.length).fill(NaN);
    for (let i = MA_N - 1; i < candleData.length; i++) {
      const window = candleData
        .slice(i - (MA_N - 1), i + 1)
        .map((d) => d.close);
      const mean = window.reduce((s, v) => s + v, 0) / window.length;
      const variance =
        window.reduce((s, v) => s + (v - mean) ** 2, 0) / window.length;
      ma30[i] = mean;
      sigma[i] = Math.sqrt(variance);
    }

    // 4. 成交量
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: '',
    });

    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });

    const volumeData = klines
      .map((k) => ({
        time: (Number(k[0]) / 1000) as any,
        value: Number(k[5]),
        color:
          Number(k[4]) >= Number(k[1])
            ? 'rgba(38,166,154,0.5)'
            : 'rgba(239,83,80,0.5)',
      }))
      .sort((a, b) => a.time - b.time);

    volumeSeries.setData(volumeData);

    // 5. 起爆点 Marker & 价格水平线
    if (selectedDate) {
      const series = candleSeries as any;
      const markers = [
        {
          time: selectedDate as any,
          position: 'aboveBar',
          color: '#f68410',
          shape: 'arrowDown',
          text: '起爆点',
        },
      ];

      // 注入 Marker
      if (typeof series.setMarkers === 'function') {
        series.setMarkers(markers);
      } else {
        series.applyOptions({ markers });
      }

      // 绘制水平标注线 (起爆价)
      const targetBar = candleData.find((d) => d.time === selectedDate);
      if (targetBar) {
        candleSeries.createPriceLine({
          price: targetBar.close,
          color: '#9C27B0', // 改为紫色
          lineWidth: 1,
          lineStyle: 2, // 虚线
          axisLabelVisible: false,
          title: '',
        });
      }
    }

    // 自适应缩放并设置默认显示条数 (最近 80 条)
    if (candleData.length > 0) {
      const barsToShow = 80;
      const totalBars = candleData.length;
      chart.timeScale().setVisibleLogicalRange({
        from: totalBars - barsToShow,
        to: totalBars,
      });
    } else {
      chart.timeScale().fitContent();
    }

    const syncHexOverlay = () => {
      const out: Array<{ x: number; y: number }> = [];
      for (let i = 0; i < candleData.length; i++) {
        const m = ma30[i];
        const s = sigma[i];
        if (!Number.isFinite(m) || !Number.isFinite(s) || s <= 0) continue;
        const c = candleData[i];
        const z = (c.close - m) / s;
        if (!(z > Z_THRESHOLD)) continue;
        const x = chart.timeScale().timeToCoordinate(c.time as any);
        const y = candleSeries.priceToCoordinate(c.high);
        if (!Number.isFinite(x as number) || !Number.isFinite(y as number))
          continue;
        out.push({ x: x as number, y: (y as number) - 12 });
      }
      setHexPoints(out);
    };

    const resize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
        syncHexOverlay();
      }
    };

    syncHexOverlay();
    chart.timeScale().subscribeVisibleTimeRangeChange(syncHexOverlay);
    window.addEventListener('resize', resize);

    return () => {
      chart.timeScale().unsubscribeVisibleTimeRangeChange(syncHexOverlay);
      window.removeEventListener('resize', resize);
      chart.remove();
      setHexPoints([]);
    };
  }, [klines, selectedDate, symbol, zThreshold]);

  return (
    <div style={{ position: 'relative', width: '100%', height: 400 }}>
      <div ref={containerRef} style={{ width: '100%', height: 400 }} />
      {hexPoints.length > 0 && (
        <svg
          width="100%"
          height="100%"
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            pointerEvents: 'none',
            zIndex: 30,
          }}
        >
          {hexPoints.map((p, i) => (
            <polygon
              key={`z-hex-${i}`}
              points={buildHex(p.x, p.y, 5)}
              fill="#1E88E5"
              stroke="#0D47A1"
              strokeWidth={1}
              opacity={0.92}
            />
          ))}
        </svg>
      )}
    </div>
  );
};

export default KlineWithVolAndMA;
