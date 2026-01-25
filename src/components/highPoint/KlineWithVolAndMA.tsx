import React, { useEffect, useRef } from 'react';
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
}

const KlineWithVolAndMA: React.FC<Props> = ({
  symbol,
  klines,
  selectedDate,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

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
        lineWidth: 1,
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

    addMA(5, '#2962FF');
    addMA(10, '#FF6D00');
    addMA(20, '#D81B60');

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

    // 6. 查找最大成交量点并绘制水平线
    if (klines && klines.length > 0) {
      let maxVolIndex = 0;
      let maxVol = -1;

      klines.forEach((k, idx) => {
        const vol = Number(k[5]);
        if (vol > maxVol) {
          maxVol = vol;
          maxVolIndex = idx;
        }
      });

      const peakK = klines[maxVolIndex];
      const peakPrice = Number(peakK[4]); // 收盘价
      const peakQuoteVol = Number(peakK[7]); // USDT成交额

      // 格式化USDT成交额 (例如 1.2M, 500K)
      const formatQuoteVol = (v: number) => {
        if (v >= 1000000) return (v / 1000000).toFixed(2) + 'M';
        if (v >= 1000) return (v / 1000).toFixed(1) + 'K';
        return v.toFixed(0);
      };

      candleSeries.createPriceLine({
        price: peakPrice,
        color: 'rgba(239, 83, 80, 0.5)', // 红色半透明
        lineWidth: 2,
        lineStyle: 0, // 实线
        axisLabelVisible: true,
        title: `峰值成交: ${formatQuoteVol(peakQuoteVol)}`,
      });
    }

    // 自适应缩放并设置默认显示条数 (最近 120 条)
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

    const resize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', resize);

    return () => {
      window.removeEventListener('resize', resize);
      chart.remove();
    };
  }, [klines, selectedDate, symbol]);

  return <div ref={containerRef} style={{ width: '100%', height: 400 }} />;
};

export default KlineWithVolAndMA;
