import { Box } from '@mui/material';
import {
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Rectangle,
  ReferenceLine,
  ResponsiveContainer,
  Line,
  ComposedChart,
} from 'recharts';

export interface VolumeChartData {
  isUp: boolean;
  ts: string;
  volume: number;
  price: number;
  buySellDiff: number | null;
}

export interface VolumePriceChartProps {
  data: VolumeChartData[];
  lineColor: string;
}

export function CustomBar(props: any) {
  const { payload } = props;

  return (
    <Rectangle
      {...props}
      fill={payload.isUp ? '#89B9AD' : '#FA7070'}
      stroke={payload.isUp ? '#89B9AD' : '#FA7070'}
    />
  );
}

export function BuySellCustomBar(props: any) {
  const { payload } = props;

  return (
    <Rectangle
      {...props}
      fill={payload.buySellDiff > 0 ? '#79AC78' : '#E95793'}
      stroke={payload.buySellDiff > 0 ? '#79AC78' : '#E95793'}
    />
  );
}

export default function VolumePriceChart(props: VolumePriceChartProps) {
  const { data, lineColor } = props;

  return (
    <Box sx={{ marginTop: '20px', width: '100%' }}>
      <ResponsiveContainer width="100%" height={180}>
        <ComposedChart
          data={data}
          margin={{ top: 0, right: 20, left: 20, bottom: 10 }}
        >
          <YAxis
            yAxisId={1}
            tickLine={false}
            axisLine={false}
            dataKey="volume"
            fontSize={12}
            hide
          />
          <YAxis
            yAxisId={2}
            tickLine={false}
            axisLine={false}
            domain={['dataMin', 'dataMax']}
            dataKey="price"
            orientation="right"
            fontSize={12}
            hide
          />
          <XAxis dataKey="ts" tickLine={false} fontSize={12} />
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <ReferenceLine y={0} yAxisId={1} stroke="#666" />
          <Bar
            dataKey="volume"
            yAxisId={1}
            strokeWidth={0.5}
            shape={CustomBar}
          />
          <Line
            type="linear"
            yAxisId={2}
            dataKey="price"
            dot={false}
            strokeWidth={2}
            stroke={lineColor}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </Box>
  );
}
