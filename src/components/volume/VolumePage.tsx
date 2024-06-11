import { useState } from 'react';
import { Box, Typography } from '@mui/material';
import moment from 'moment';
import VolumeCal from './VolumeMul';
import VolumePriceChart, { VolumeChartData } from './VolumePriceChart';

export interface VolumePageData {
  symbol: string;
  price: string;
  klines: string[][];
}

export default function VolumePage() {
  const [volumePageList, setVolumePageList] = useState<VolumePageData[]>([]);

  const onButtonClick = (data: { list: VolumePageData[]; title: string }) => {
    setVolumePageList(data.list);
  };

  return (
    <Box sx={{ marginTop: '5px' }}>
      <Box display="flex">
        <VolumeCal onButtonClick={onButtonClick} />
      </Box>
      <Box>
        {volumePageList.map((u) => {
          const { klines } = u;
          const chartData: VolumeChartData[] = klines.map((k) => ({
            isUp: Number(k[1]) < Number(k[4]),
            ts: moment(k[0]).local().format('hh:mm'),
            volume: Number(k[7]),
            price: Number(k[4]), // 收盘价
            buySellDiff: k[12] ? Number(k[12]) : null,
          }));
          const klineCount = klines.length;
          const first = klines[0];
          const latest = klines[klineCount - 1];
          const lineColor =
            Number(first[4]) < Number(latest[4]) ? '#557C55' : '#BE3144';
          return (
            <Box key={u.symbol}>
              <Typography>{`${u.symbol} - $${u.price}`}</Typography>
              <VolumePriceChart data={chartData} lineColor={lineColor} />
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
