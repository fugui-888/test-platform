import React, { useEffect, useRef, useMemo } from 'react';
import { init, dispose } from 'klinecharts';

export interface KlineData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface Props {
  symbol: string;
  klines: string[][];
  selectedDate?: number; // 单位是秒的时间戳
}

const KlineWithVolAndMA: React.FC<Props> = ({
  symbol,
  klines,
  selectedDate,
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chart = useRef<any>(null);

  // 将 string[][] 转换为 KlineData[]
  const klineData: KlineData[] = useMemo(() => {
    if (!klines || klines.length === 0) return [];

    return klines.map((item) => ({
      time: Number(item[0]), // 毫秒时间戳
      open: parseFloat(item[1]),
      high: parseFloat(item[2]),
      low: parseFloat(item[3]),
      close: parseFloat(item[4]),
      volume: parseFloat(item[5]),
    }));
  }, [klines]);

  // 初始化图表
  useEffect(() => {
    if (chartRef.current) {
      chart.current = init(chartRef.current);

      if (chart.current) {
        chart.current.createIndicator('VOL', false, { height: 300 });
        chart.current.createIndicator('MA', false, {
          id: 'candle_pane',
          height: 150,
        });
      }
    }

    return () => {
      if (chartRef.current) dispose(chartRef.current);
    };
  }, []);

  // 加载数据和 overlay
  useEffect(() => {
    if (!chart.current || klineData.length === 0) return;

    chart.current.applyNewData(
      klineData.map((item) => ({
        timestamp: item.time,
        open: item.open,
        high: item.high,
        low: item.low,
        close: item.close,
        volume: item.volume,
      })),
    );

    chart.current.removeOverlay({ id: 'selected-date-line' });

    if (selectedDate) {
      const timestamp = selectedDate * 1000; // 秒转毫秒

      chart.current.createOverlay({
        name: 'straightLine',
        id: 'selected-date-line',
        points: [
          { timestamp, value: 0 },
          { timestamp, value: 999999 },
        ],
        style: {
          stroke: '#ff0000',
          lineWidth: 1,
          lineType: 'dashed',
        },
      });
    }
  }, [klineData, selectedDate]);

  return (
    <div
      ref={chartRef}
      style={{
        width: '100%',
        height: '600px',
      }}
    />
  );
};

export default KlineWithVolAndMA;
