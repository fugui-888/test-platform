import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import SettingsIcon from '@mui/icons-material/Settings';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  TextField,
  Typography,
} from '@mui/material';
import getKLineData from '../utils/fetch/getKLineData';
import { parseBinanceKlinesToCandles5m } from '../utils/fetch/binanceKlinesToCandles';
import MEXCListen5mChart, {
  type ListenCandle5m,
} from '../views/MEXCBoard/MEXCListen5mChart';
import MEXCListen30mChart, {
  type ListenCandle30,
} from '../views/MEXCBoard/MEXCListen30mChart';
import MEXCListen10mChart, {
  type ListenCandle10,
} from '../views/MEXCBoard/MEXCListen10mChart';

type Candle = {
  ts: number;
  open: number;
  high: number;
  low: number;
  close: number;
  vol: number;
};

async function fetchBTC5min() {
  const { klines } = await getKLineData({
    symbol: 'BTCUSDT',
    interval: '5m',
    limit: '1500',
  });
  return { data: { klines } };
}

function parseBtc5mResponse(raw: any): Candle[] {
  return parseBinanceKlinesToCandles5m(raw?.data?.klines ?? []);
}

function buildAnchored30mFromLast5m(candles5: ListenCandle5m[]): {
  candles30: ListenCandle30[];
  selected30Index: number | null;
} {
  const n = candles5.length;
  if (n < 6) return { candles30: [], selected30Index: null };
  const clicked5Index = n - 1;
  const mod = clicked5Index % 6;
  let end = mod;
  while (end < 5) end += 6;
  const candles30: ListenCandle30[] = [];
  let selected30Index: number | null = null;

  for (; end < n; end += 6) {
    const start = end - 5;
    const slice = candles5.slice(start, end + 1);
    if (slice.length !== 6) break;
    const open = slice[0].open;
    const close = slice[5].close;
    let high = slice[0].high;
    let low = slice[0].low;
    for (let i = 1; i < 6; i++) {
      high = Math.max(high, slice[i].high);
      low = Math.min(low, slice[i].low);
    }
    const vol = slice.reduce((s, c) => s + c.vol, 0);
    const idx30 = candles30.length;
    candles30.push({
      ts: slice[5].ts,
      open,
      high,
      low,
      close,
      vol,
      startIndex: start,
      endIndex: end,
    });
    if (end === clicked5Index) selected30Index = idx30;
  }
  return { candles30, selected30Index };
}

function buildAnchored10mFromLast5m(candles5: ListenCandle5m[]): {
  candles10: ListenCandle10[];
  selected10Index: number | null;
} {
  const n = candles5.length;
  if (n < 2) return { candles10: [], selected10Index: null };
  const clicked5Index = n - 1;
  const mod = clicked5Index % 2;
  let end = mod;
  while (end < 1) end += 2;
  const candles10: ListenCandle10[] = [];
  let selected10Index: number | null = null;

  for (; end < n; end += 2) {
    const start = end - 1;
    const slice = candles5.slice(start, end + 1);
    if (slice.length !== 2) break;
    const open = slice[0].open;
    const close = slice[1].close;
    let high = slice[0].high;
    let low = slice[0].low;
    for (let i = 1; i < 2; i++) {
      high = Math.max(high, slice[i].high);
      low = Math.min(low, slice[i].low);
    }
    const vol = slice.reduce((s, c) => s + c.vol, 0);
    const idx10 = candles10.length;
    candles10.push({
      ts: slice[1].ts,
      open,
      high,
      low,
      close,
      vol,
      startIndex: start,
      endIndex: end,
    });
    if (end === clicked5Index) selected10Index = idx10;
  }
  return { candles10, selected10Index };
}

function last30mAsSixth5m(candles5: Candle[]): Candle | null {
  if (candles5.length < 6) return null;
  const chunk = candles5.slice(-6);
  const open = chunk[0].open;
  const close = chunk[5].close;
  let high = chunk[0].high;
  let low = chunk[0].low;
  for (let i = 1; i < 6; i++) {
    high = Math.max(high, chunk[i].high);
    low = Math.min(low, chunk[i].low);
  }
  return {
    ts: chunk[5].ts,
    open,
    high,
    low,
    close,
    vol: chunk.reduce((s, c) => s + c.vol, 0),
  };
}

function secondsUntilNextFiveMin(d: Date): number {
  const next = new Date(d);
  next.setMilliseconds(0);
  next.setSeconds(0);
  const mod = next.getMinutes() % 5;
  const addMinutes = mod === 0 ? 5 : 5 - mod;
  next.setMinutes(next.getMinutes() + addMinutes);
  return Math.max(0, Math.floor((next.getTime() - d.getTime()) / 1000));
}

function formatMinSec(totalSec: number): string {
  const sec = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m${s}s`;
}

const DEFAULT_Z_THRESHOLD = 2.3;

function parseZInput(raw: string, fallback: number): number {
  const n = parseFloat(raw.trim());
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const BinanceFutureEventSubscription: React.FC = () => {
  const [listening, setListening] = useState(false);
  const [lastFetchAt, setLastFetchAt] = useState<Date | null>(null);
  const [nowTick, setNowTick] = useState<Date>(new Date());
  const [latestCandles, setLatestCandles] = useState<ListenCandle5m[]>([]);
  const [use10m, setUse10m] = useState(true);
  const [zThreshold5m, setZThreshold5m] = useState(DEFAULT_Z_THRESHOLD);
  const [zThreshold10m, setZThreshold10m] = useState(DEFAULT_Z_THRESHOLD);
  const [zThreshold30m, setZThreshold30m] = useState(DEFAULT_Z_THRESHOLD);
  const [zDialogOpen, setZDialogOpen] = useState(false);
  const [draftZ5m, setDraftZ5m] = useState(String(DEFAULT_Z_THRESHOLD));
  const [draftZ10m, setDraftZ10m] = useState(String(DEFAULT_Z_THRESHOLD));
  const [draftZ30m, setDraftZ30m] = useState(String(DEFAULT_Z_THRESHOLD));

  const anchored30 = useMemo(
    () => buildAnchored30mFromLast5m(latestCandles),
    [latestCandles],
  );
  const anchored10 = useMemo(
    () => buildAnchored10mFromLast5m(latestCandles),
    [latestCandles],
  );

  const lastQuerySecondRef = useRef<string>('');

  const runListenFetch = useCallback(async () => {
    try {
      setLastFetchAt(new Date());
      const raw = await fetchBTC5min();
      const candles5 = parseBtc5mResponse(raw);
      if (candles5.length < 6) {
        return;
      }
      setLatestCandles(candles5);
      const bars30 = buildAnchored30mFromLast5m(candles5).candles30;
      const bar30 = last30mAsSixth5m(candles5);
      if (!bar30 || bars30.length < 2) {
        return;
      }
    } catch (e: any) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNowTick(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!listening) return;
    void runListenFetch();
    const id = window.setInterval(() => {
      const now = new Date();
      if (now.getSeconds() % 5 !== 0) return;
      const secSlot = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}-${now.getMinutes()}-${now.getSeconds()}`;
      if (lastQuerySecondRef.current === secSlot) return;
      lastQuerySecondRef.current = secSlot;
      void runListenFetch();
    }, 1000);
    return () => window.clearInterval(id);
  }, [listening, runListenFetch]);

  useEffect(() => {
    if (!listening) {
      lastQuerySecondRef.current = '';
    }
  }, [listening]);

  const secToNext5m = secondsUntilNextFiveMin(nowTick);
  const inNotifyWindow = secToNext5m < 30;

  const openZDialog = () => {
    setDraftZ5m(String(zThreshold5m));
    setDraftZ10m(String(zThreshold10m));
    setDraftZ30m(String(zThreshold30m));
    setZDialogOpen(true);
  };

  const handleZDialogConfirm = () => {
    setZThreshold5m(parseZInput(draftZ5m, DEFAULT_Z_THRESHOLD));
    setZThreshold10m(parseZInput(draftZ10m, DEFAULT_Z_THRESHOLD));
    setZThreshold30m(parseZInput(draftZ30m, DEFAULT_Z_THRESHOLD));
    setZDialogOpen(false);
  };

  const handleZDialogCancel = () => {
    setZDialogOpen(false);
  };

  return (
    <Box>
      <Card sx={{ mt: 4, mb: 2 }}>
        <CardContent>
          <Grid container spacing={1} alignItems="center">
            <Grid item xs={5}>
              <Button
                fullWidth
                variant="contained"
                color={listening ? 'error' : 'primary'}
                onClick={() => setListening((v) => !v)}
              >
                {listening ? 'stop' : 'start(5s)'}
              </Button>
            </Grid>
            <Grid item xs={5}>
              <Button
                fullWidth
                variant="outlined"
                onClick={() => void runListenFetch()}
              >
                refresh
              </Button>
            </Grid>
            <Grid
              item
              xs={2}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <IconButton
                color="primary"
                aria-label="z threshold settings"
                onClick={openZDialog}
                size="small"
              >
                <SettingsIcon />
              </IconButton>
            </Grid>
          </Grid>

          <Dialog
            open={zDialogOpen}
            onClose={handleZDialogCancel}
            fullWidth
            maxWidth="xs"
          >
            <DialogTitle>|z| threshold</DialogTitle>
            <DialogContent
              sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}
            >
              <TextField
                label="5m K-line |z|"
                value={draftZ5m}
                onChange={(e) => setDraftZ5m(e.target.value)}
                type="number"
                inputProps={{ step: 0.01, min: 0.01 }}
                size="small"
                fullWidth
                sx={{ mt: 2 }}
              />
              <TextField
                label="10m K-line |z|"
                value={draftZ10m}
                onChange={(e) => setDraftZ10m(e.target.value)}
                type="number"
                inputProps={{ step: 0.01, min: 0.01 }}
                size="small"
                fullWidth
              />
              <TextField
                label="30m K-line |z|"
                value={draftZ30m}
                onChange={(e) => setDraftZ30m(e.target.value)}
                type="number"
                inputProps={{ step: 0.01, min: 0.01 }}
                size="small"
                fullWidth
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={handleZDialogCancel}>cancel</Button>
              <Button variant="contained" onClick={handleZDialogConfirm}>
                confirm
              </Button>
            </DialogActions>
          </Dialog>

          <Box
            sx={{
              mt: 1.5,
              display: 'flex',
              gap: 1.25,
              flexWrap: 'wrap',
              alignItems: 'stretch',
            }}
          >
            <Box
              sx={{
                p: 1,
                borderRadius: 1.5,
                width: '100%',
                boxSizing: 'border-box',
                border: '2px solid',
                borderColor: inNotifyWindow ? 'error.main' : 'divider',
                ...(inNotifyWindow && {
                  animation: 'notifyWindowPulse 0.9s ease-in-out infinite',
                  '@keyframes notifyWindowPulse': {
                    '0%, 100%': {
                      borderColor: 'error.main',
                      boxShadow: '0 0 0 0 rgba(211, 47, 47, 0.55)',
                    },
                    '50%': {
                      borderColor: 'error.dark',
                      boxShadow:
                        '0 0 0 4px rgba(211, 47, 47, 0.35), 0 0 18px 2px rgba(211, 47, 47, 0.25)',
                    },
                  },
                }),
              }}
            >
              <Box>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 1,
                    minHeight: 28,
                    lineHeight: 1.25,
                  }}
                >
                  <Box component="span">
                    now: {nowTick.toLocaleTimeString()} · last:{' '}
                    {lastFetchAt ? lastFetchAt.toLocaleTimeString() : '—'}
                  </Box>
                  <Box
                    component="span"
                    sx={{
                      textAlign: 'right',
                      whiteSpace: 'nowrap',
                      fontWeight: 700,
                      fontVariantNumeric: 'tabular-nums',
                      color: inNotifyWindow ? 'error.main' : 'text.secondary',
                    }}
                  >
                    to 5m: {formatMinSec(secToNext5m)}
                  </Box>
                </Typography>
              </Box>
            </Box>
          </Box>

          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <Box sx={{ position: 'relative' }}>
                <Box
                  sx={{
                    position: 'absolute',
                    top: '-3px',
                    left: 8,
                    zIndex: 20,
                    px: 0.75,
                    py: 0.2,
                    borderRadius: 1,
                    bgcolor: 'rgba(0,0,0,0.56)',
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{ color: '#fff', fontWeight: 700, lineHeight: 2 }}
                  >
                    5m
                  </Typography>
                </Box>
                {latestCandles.length > 0 ? (
                  <MEXCListen5mChart
                    candles5={latestCandles}
                    height={300}
                    zAbsThreshold={zThreshold5m}
                  />
                ) : (
                  <Alert severity="info">no data</Alert>
                )}
              </Box>
            </Grid>
            <Grid item xs={12}>
              <Box sx={{ position: 'relative' }}>
                <Box
                  sx={{
                    position: 'absolute',
                    top: '-3px',
                    left: 8,
                    zIndex: 20,
                    px: 0.75,
                    py: 0.2,
                    borderRadius: 1,
                    bgcolor: 'rgba(0,0,0,0.56)',
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{ color: '#fff', fontWeight: 700, lineHeight: 2 }}
                  >
                    {use10m ? '10m' : '30m'}
                  </Typography>
                </Box>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => setUse10m((v) => !v)}
                  sx={{
                    position: 'absolute',
                    top: 2,
                    right: 2,
                    zIndex: 20,
                    minWidth: 74,
                    px: 1,
                    py: 0.15,
                    fontSize: '0.72rem',
                    lineHeight: 1.2,
                  }}
                >
                  {use10m ? 'show 30m' : 'show 10m'}
                </Button>
                {use10m ? (
                  anchored10.candles10.length > 0 &&
                  anchored10.selected10Index != null ? (
                    <MEXCListen10mChart
                      candles10={anchored10.candles10}
                      height={300}
                      zAbsThreshold={zThreshold10m}
                    />
                  ) : (
                    <Alert severity="info">no data</Alert>
                  )
                ) : anchored30.candles30.length > 0 &&
                  anchored30.selected30Index != null ? (
                  <MEXCListen30mChart
                    candles30={anchored30.candles30}
                    height={300}
                    zAbsThreshold={zThreshold30m}
                  />
                ) : (
                  <Alert severity="info">no data</Alert>
                )}
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
};

export default BinanceFutureEventSubscription;
