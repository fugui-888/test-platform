import React, { useState, useEffect } from 'react';
import Chart from 'react-apexcharts';
import moment from 'moment';

const defaultOptions: any = {
  chart: {
    toolbar: {
      show: false,
    },
  },
  title: {
    text: '',
  },
  xaxis: {
    type: 'datetime',
    labels: {
      formatter: (v: string) => moment(v).local().format('HH:mm'),
      rotate: 0,
    },
    tickAmount: 15,
    axisTicks: {
      show: false,
    },
  },
  yaxis: [
    {
      // Y 轴 1: 价格（Price）
      tooltip: {
        enabled: false,
      },
      labels: {
        show: false,
      },
    },
    {
      // Y 轴 2: 成交量（Volume）
      opposite: true,
      labels: {
        show: false, // 隐藏右侧 Y 轴数字
      },
    },
  ],
  plotOptions: {
    candlestick: {
      colors: {
        upward: '#55b07c',
        downward: '#df4f55',
      },
      wick: {
        useFillColor: true, // 确保影线颜色和蜡烛颜色一致
      },
    },
  },
  colors: ['#EBE5C2'], // 自定义柱状图颜色
  stroke: {
    width: [1, 0], // 第一个系列（K线图）保留默认的影线宽度，第二个系列（柱状图）禁用边框
  },
  dataLabels: {
    enabled: false,
  },
  legend: {
    show: false, // 隐藏图例
  },
};

interface KlineChartProps {
  klineData: string[][];
}

export default function KlineChart(props: KlineChartProps) {
  const { klineData = [] } = props;
  const [chartData, setChartData] = useState<any[]>([]);
  const [volumeData, setVolumeData] = useState<any[]>([]);
  const [priceRange, setPriceRange] = useState<{ min: number; max: number }>({
    min: 0,
    max: 0,
  });

  useEffect(() => {
    const updatedChartData = klineData.map((k) => ({
      x: new Date(k[0]),
      y: [Number(k[1]), Number(k[2]), Number(k[3]), Number(k[4])],
    }));
    setChartData(updatedChartData);

    const updatedVolumeData = klineData.map((k) => ({
      x: new Date(k[0]),
      y: Number(k[5]), // k[5] 表示成交量
    }));
    setVolumeData(updatedVolumeData);

    const prices = klineData.flatMap((k) => [
      Number(k[1]), // 开盘价
      Number(k[2]), // 最高价
      Number(k[3]), // 最低价
      Number(k[4]), // 收盘价
    ]);

    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    setPriceRange({ min: minPrice, max: maxPrice });
  }, [klineData]); // 当 klineData 变化时，更新图表数据

  return (
    <Chart
      type="candlestick"
      height={300}
      options={{
        ...defaultOptions,
        yaxis: [
          {
            ...defaultOptions.yaxis[0],
            min: priceRange.min, // 设置价格的最小值
            max: priceRange.max, // 设置价格的最大值
            labels: {
              show: false, // 隐藏右侧 Y 轴数字
            },
          },
          {
            ...defaultOptions.yaxis[1],
            labels: {
              show: false, // 隐藏右侧 Y 轴数字
            },
          },
        ],
      }}
      series={[
        {
          name: 'Kline',
          type: 'candlestick',
          data: chartData,
        },
        {
          name: 'Volume',
          type: 'bar',
          data: volumeData,
        },
      ]}
    />
  );
}
