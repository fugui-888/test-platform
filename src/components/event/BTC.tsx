import { useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import KlineWithVol from './KLineWithVol';
import { DateTime } from 'luxon';

interface BTCProps {
  fiveMinData: string[][];
}

export default function BTC(props: BTCProps) {
  const { fiveMinData } = props;

  const tenMinK = useMemo(() => {
    if (!fiveMinData || fiveMinData.length < 2) return [];

    const tenMinCandles: string[][] = [];
    let startIndex = fiveMinData.length - 1;

    const lastCandleTimestamp = Number(fiveMinData[fiveMinData.length - 1][0]);
    const lastCandleTime = DateTime.fromMillis(lastCandleTimestamp);

    if (lastCandleTime.minute % 10 === 0) {
      tenMinCandles.push(fiveMinData[fiveMinData.length - 1]);
      startIndex = fiveMinData.length - 2;
    }

    for (let i = startIndex; i >= 1; i -= 2) {
      const candle1 = fiveMinData[i];
      const candle2 = fiveMinData[i - 1];

      if (!candle1 || !candle2) break;

      const openTime = candle2[0];
      const open = candle2[1];
      const high = Math.max(Number(candle1[2]), Number(candle2[2])).toString();
      const low = Math.min(Number(candle1[3]), Number(candle2[3])).toString();
      const close = candle1[4];
      const volume = (Number(candle1[5]) + Number(candle2[5])).toString();

      tenMinCandles.unshift([openTime, open, high, low, close, volume]);
    }

    return tenMinCandles;
  }, [fiveMinData]);

  const tenMinKWayTwo = useMemo(() => {
    if (!fiveMinData || fiveMinData.length < 2) return [];

    const tenMinCandles: string[][] = [];
    let startIndex = fiveMinData.length - 1;

    const lastCandleTimestamp = Number(fiveMinData[fiveMinData.length - 1][0]);
    const lastCandleTime = DateTime.fromMillis(lastCandleTimestamp);

    if (lastCandleTime.minute % 10 !== 0) {
      tenMinCandles.push(fiveMinData[fiveMinData.length - 1]);
      startIndex = fiveMinData.length - 2;
    }

    for (let i = startIndex; i >= 1; i -= 2) {
      const candle1 = fiveMinData[i];
      const candle2 = fiveMinData[i - 1];

      if (!candle1 || !candle2) break;

      const openTime = candle2[0];
      const open = candle2[1];
      const high = Math.max(Number(candle1[2]), Number(candle2[2])).toString();
      const low = Math.min(Number(candle1[3]), Number(candle2[3])).toString();
      const close = candle1[4];
      const volume = (Number(candle1[5]) + Number(candle2[5])).toString();

      tenMinCandles.unshift([openTime, open, high, low, close, volume]);
    }

    return tenMinCandles;
  }, [fiveMinData]);

  return (
    <Box>
      <Box position={'relative'}>
        {tenMinK.length > 0 && (
          <>
            <Box position={'absolute'} top={36} left={0}>
              <Typography>10 BTC</Typography>
            </Box>
            <KlineWithVol klineData={tenMinK} />
          </>
        )}
      </Box>

      <Box position={'relative'} marginTop={'-20px'}>
        {tenMinKWayTwo.length > 0 && (
          <>
            <Box position={'absolute'} top={36} left={0}>
              <Typography>5 BTC</Typography>
            </Box>
            <KlineWithVol klineData={tenMinKWayTwo} />
          </>
        )}
      </Box>

      <Box position={'relative'} marginTop={'-20px'}>
        {fiveMinData.length > 0 && (
          <>
            <Box position={'absolute'} top={36} left={0}>
              <Typography>5 MIn Line ETH</Typography>
            </Box>
            <KlineWithVol
              klineData={fiveMinData.slice(Math.floor(fiveMinData.length / 2))}
            />
          </>
        )}
      </Box>
    </Box>
  );
}
