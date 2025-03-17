import { useState, useEffect } from 'react';
import { DateTime } from 'luxon';
import { Box, Typography } from '@mui/material';

function CountdownTimer() {
  const [countdown, setCountdown] = useState({
    nextTen: '00:00',
    nextFive: '00:00',
  });

  useEffect(() => {
    const updateCountdown = () => {
      const now = DateTime.local();
      const minute = now.minute;

      // 计算下一个 10 的整数分钟 (10, 20, 30, ...)
      let nextTenMinute = Math.ceil((minute + 1) / 10) * 10;
      let nextTenTime = now.set({ second: 0 });

      if (nextTenMinute >= 60) {
        nextTenTime = nextTenTime.plus({ hours: 1 }).set({ minute: 0 });
      } else {
        nextTenTime = nextTenTime.set({ minute: nextTenMinute });
      }

      const nextTenDiff = Math.floor(nextTenTime.diff(now, 'seconds').seconds);

      // 计算下一个 5 结尾的分钟 (05, 15, 25, ...)
      let nextFiveMinute = Math.ceil((minute + 1) / 5) * 5;
      let nextFiveTime = now.set({ second: 0 });

      if (nextFiveMinute >= 60) {
        nextFiveTime = nextFiveTime.plus({ hours: 1 }).set({ minute: 5 });
      } else {
        nextFiveTime = nextFiveTime.set({ minute: nextFiveMinute });
      }

      // 关键点：避免 nextFive 和 nextTen 相同
      if (nextFiveTime.equals(nextTenTime)) {
        nextFiveTime = nextFiveTime.plus({ minutes: 5 });
      }

      const nextFiveDiff = Math.floor(
        nextFiveTime.diff(now, 'seconds').seconds,
      );

      // 格式化 MM:SS
      const formatTime = (seconds: number) => {
        const mm = Math.floor(seconds / 60)
          .toString()
          .padStart(2, '0');
        const ss = (seconds % 60).toString().padStart(2, '0');
        return `${mm}:${ss}`;
      };

      setCountdown({
        nextTen: formatTime(nextTenDiff),
        nextFive: formatTime(nextFiveDiff),
      });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Box display={'flex'}>
      <Typography fontWeight={600} marginRight="8px" fontSize="16px">
        next 10 - {countdown.nextTen}
      </Typography>
      <Typography fontWeight={600} fontSize="16px">
        next 5 - {countdown.nextFive}
      </Typography>
    </Box>
  );
}

export default CountdownTimer;
