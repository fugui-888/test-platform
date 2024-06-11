import { Box, TextField, Button } from '@mui/material';
import getAllPrice from '../../utils/fetch/getAllPrice';
import getKLineData from '../../utils/fetch/getKLineData';
import { isUp, isDown } from '../../utils/calculator';
import { AnalysisType } from './DayPage';
import { CardData } from '../Card';

interface DayAnalysisProps {
  days: string;
  onDaysChange: (newDays: string) => void;
  onButtonClick: (
    filteredSymbols: CardData[],
    analysisType: AnalysisType,
  ) => void;
}

// filter data by day kline
export default function DayAnalysis(props: DayAnalysisProps) {
  const { days, onDaysChange, onButtonClick } = props;
  const getData = getKLineData;

  const getListForPriceChange = async () => {
    const allTicks = await getAllPrice();

    let allChange: { symbol: string; change: number; price: string }[] = [];
    await Promise.all(
      allTicks.map((item) =>
        getData({ symbol: item.symbol, limit: days, interval: '1d' }),
      ),
    ).then((values) => {
      values.forEach((value) => {
        const klines = value.klines || [];
        const length = klines.length;
        const latest = klines[length - 1];
        const last = klines[0];

        const open = Number(last[1]);
        const close = Number(latest[4]);

        const change = (close - open) / open;
        allChange.push({ symbol: value.symbol, change, price: latest[4] });
      });
    });

    return allChange;
  };

  const getListForHighIncrease = async () => {
    const allChangeList = await getListForPriceChange();
    allChangeList.sort((a, b) => b.change - a.change);
    const first20 = allChangeList.slice(0, 20).map((tick) => ({
      detail: `${tick.symbol} - ($${tick.price}) // ${(
        tick.change * 100
      ).toFixed(4)}%`,
      symbol: tick.symbol,
    }));
    onButtonClick(first20, 'highIncrease');
  };

  const getListForHighDecrease = async () => {
    const allChangeList = await getListForPriceChange();
    allChangeList.sort((a, b) => a.change - b.change);
    const first20 = allChangeList.slice(0, 20).map((tick) => ({
      detail: `${tick.symbol} - ($${tick.price}) // ${(
        tick.change * 100
      ).toFixed(4)}%`,
      symbol: tick.symbol,
    }));
    onButtonClick(first20, 'highDecrease');
  };

  const getListForContinueUp = async () => {
    const allTicks = await getAllPrice();

    let continueUp: { symbol: string; change: number; price: string }[] = [];
    await Promise.all(
      allTicks.map((item) =>
        getData({ symbol: item.symbol, limit: days, interval: '1d' }),
      ),
    ).then((values) => {
      values.forEach((value) => {
        const klines = value.klines || [];
        const length = klines.length;
        const latest = klines[length - 1];
        const last = klines[0];

        const open = Number(last[1]);
        const close = Number(latest[4]);

        const change = (close - open) / open;

        if (klines.length === Number(days) && klines.every((k) => isUp(k))) {
          continueUp.push({ symbol: value.symbol, change, price: latest[4] });
        }
      });
    });
    continueUp.sort((a, b) => b.change - a.change);

    const formattedContinueUp = continueUp.map((tick) => ({
      detail: `${tick.symbol} - ($${tick.price}) // ${(
        tick.change * 100
      ).toFixed(4)}%`,
      symbol: tick.symbol,
    }));
    onButtonClick(formattedContinueUp, 'continueUp');
  };

  const getListForContinueDown = async () => {
    const allTicks = await getAllPrice();

    let continueDown: { symbol: string; change: number; price: string }[] = [];
    await Promise.all(
      allTicks.map((item) =>
        getData({ symbol: item.symbol, limit: days, interval: '1d' }),
      ),
    ).then((values) => {
      values.forEach((value) => {
        const klines = value.klines || [];
        const length = klines.length;
        const latest = klines[length - 1];
        const last = klines[0];

        const open = Number(last[1]);
        const close = Number(latest[4]);

        const change = (close - open) / open;

        if (klines.length === Number(days) && klines.every((k) => isDown(k))) {
          continueDown.push({ symbol: value.symbol, change, price: latest[4] });
        }
      });
    });

    continueDown.sort((a, b) => a.change - b.change);
    const formattedContinueDown = continueDown.map((tick) => ({
      detail: `${tick.symbol} - ($${tick.price}) // ${(
        tick.change * 100
      ).toFixed(4)}%`,
      symbol: tick.symbol,
    }));
    onButtonClick(formattedContinueDown, 'continueDown');
  };

  return (
    <Box>
      <TextField
        label="Select Last N Days"
        size="small"
        variant="outlined"
        value={days}
        onChange={(e) => onDaysChange(e.target.value)}
      />
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          marginTop: '5px',
        }}
      >
        <Button
          onClick={getListForHighIncrease}
          variant="outlined"
          sx={{ marginRight: '5px' }}
          disabled={!days || !Number(days)}
        >
          涨幅
        </Button>
        <Button
          onClick={getListForHighDecrease}
          variant="outlined"
          sx={{ marginRight: '5px' }}
          disabled={!days || !Number(days)}
        >
          跌幅
        </Button>
        <Button
          onClick={getListForContinueUp}
          variant="outlined"
          sx={{ marginRight: '5px' }}
          disabled={!days || !Number(days)}
        >
          连阳
        </Button>
        <Button
          onClick={getListForContinueDown}
          variant="outlined"
          sx={{ marginRight: '5px' }}
          disabled={!days || !Number(days)}
        >
          连阴
        </Button>
      </Box>
    </Box>
  );
}
