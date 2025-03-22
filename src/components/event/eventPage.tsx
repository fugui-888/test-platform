import { useState } from 'react';
import { Box, IconButton, CircularProgress, Divider } from '@mui/material';
import getKLineData from '../../utils/fetch/getKLineData';
import CachedIcon from '@mui/icons-material/Cached';
import BTC from './BTC';
import ETH from './ETH';
import CountDown from './CountDown';

export default function EventPage() {
  const [fiveMinData, setFiveMinData] = useState<string[][]>([]);
  const [ETHFiveMinData, setETHFiveMinData] = useState<string[][]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const onReload = async () => {
    setIsLoading(true);
    const res = await getKLineData({
      symbol: 'BTCUSDT',
      interval: '5m',
      limit: '140',
    });

    const reseth = await getKLineData({
      symbol: 'ETHUSDT',
      interval: '5m',
      limit: '140',
    });

    setFiveMinData(res.klines);
    setETHFiveMinData(reseth.klines);

    setIsLoading(false);
  };

  return (
    <Box>
      {/* Sticky Header */}
      <Box
        display="flex"
        alignItems="center"
        position="sticky"
        top={0}
        zIndex={1000}
        bgcolor="white"
        padding="8px"
        boxShadow="0px 2px 5px rgba(0, 0, 0, 0.1)"
      >
        <IconButton
          onClick={onReload}
          disabled={isLoading}
          sx={{ padding: '2px' }}
        >
          <CachedIcon sx={{ fontSize: '40px' }} />
        </IconButton>
        {isLoading && <CircularProgress color="secondary" size={20} />}
        <CountDown />
      </Box>

      {/* K线图 */}
      <BTC fiveMinData={fiveMinData} />
      <Divider sx={{ my: 2, backgroundColor: '#000', height: 2 }} />
      <ETH fiveMinData={ETHFiveMinData} />
    </Box>
  );
}
