import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { getAllKlineDataByInterval } from '../../utils/db';
import {
  getOKEXKLineData,
  type OkexKlineInterval,
} from '../../utils/fetch/getOKEXKLineData';
import TrailTrackChart, { type TrackCandle } from './TrailTrackChart';

type Row = {
  symbol: string;
  z: number;
  close: number;
  mean: number;
  std: number;
  sample: number;
};

const INTERVALS: OkexKlineInterval[] = [
  '5m',
  '15m',
  '30m',
  '1H',
  '4H',
  '1Dutc',
];

function dbInterval(interval: OkexKlineInterval) {
  return `okex-${interval}`;
}

function calcZ(closes: number[]) {
  const n = closes.length;
  if (n < 30) return null;
  const mean = closes.reduce((s, v) => s + v, 0) / n;
  const variance = closes.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  const std = Math.sqrt(variance);
  if (!Number.isFinite(std) || std === 0) return null;
  const close = closes[n - 1];
  const z = (close - mean) / std;
  return { z, close, mean, std, sample: n };
}

const TrailZFilterTab: React.FC = () => {
  const [interval, setInterval] = useState<OkexKlineInterval>('5m');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState<string>('');
  const [tracking, setTracking] = useState(false);
  const [trackCandles, setTrackCandles] = useState<TrackCandle[]>([]);
  const [trackNote, setTrackNote] = useState<string>('');

  const load = async (iv: OkexKlineInterval) => {
    setLoading(true);
    try {
      const all = await getAllKlineDataByInterval(dbInterval(iv));
      const result: Row[] = all
        .map((record) => {
          const closes = record.klines
            .map((k) => parseFloat(k[4]))
            .filter((v) => Number.isFinite(v))
            .slice(-120);
          const zInfo = calcZ(closes);
          if (!zInfo) return null;
          return {
            symbol: record.symbol,
            ...zInfo,
          };
        })
        .filter((x): x is Row => x != null)
        .filter((x) => x.z > 0)
        .sort((a, b) => Math.abs(b.z) - Math.abs(a.z));
      setRows(result);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(interval);
    setTracking(false);
    setTrackCandles([]);
    setTrackNote('');
  }, [interval]);

  const toInstId = (symbol: string) => {
    const base = symbol.endsWith('USDT') ? symbol.replace('USDT', '') : symbol;
    return `${base}-USDT-SWAP`;
  };

  const fetchTrackData = async () => {
    if (!selectedSymbol) return;
    try {
      const res = await getOKEXKLineData({
        symbol: selectedSymbol,
        instId: toInstId(selectedSymbol),
        interval,
        limit: 320,
      });
      const candles = res.klines
        .map((k) => ({
          ts: Math.floor(Number(k[0]) / 1000),
          open: Number(k[1]),
          high: Number(k[2]),
          low: Number(k[3]),
          close: Number(k[4]),
          vol: Number(k[5]),
        }))
        .filter((c) => Number.isFinite(c.ts) && Number.isFinite(c.open));
      setTrackCandles(candles);
      setTrackNote(
        `最新: ${new Date().toLocaleTimeString()} · ${candles.length} 根`,
      );
    } catch (e: any) {
      setTrackNote(`追踪失败: ${e?.message || e}`);
    }
  };

  useEffect(() => {
    if (!tracking || !selectedSymbol) return;
    void fetchTrackData();
    const id = window.setInterval(() => {
      void fetchTrackData();
    }, 1000);
    return () => window.clearInterval(id);
  }, [tracking, selectedSymbol, interval]);

  return (
    <Box sx={{ p: 1 }}>
      <Paper sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>间隔</InputLabel>
            <Select
              value={interval}
              label="间隔"
              onChange={(e) => setInterval(e.target.value as OkexKlineInterval)}
            >
              {INTERVALS.map((int) => (
                <MenuItem key={int} value={int}>
                  {int}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {loading ? (
          <Typography variant="body2">加载中...</Typography>
        ) : (
          <TableContainer sx={{ maxHeight: 300 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Symbol</TableCell>
                  <TableCell align="right">Z</TableCell>
                  <TableCell align="right">Close</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.slice(0, 6).map((r) => (
                  <TableRow
                    key={r.symbol}
                    hover
                    selected={selectedSymbol === r.symbol}
                    onClick={() => setSelectedSymbol(r.symbol)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell>{r.symbol}</TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        color:
                          Math.abs(r.z) >= 2 ? 'error.main' : 'text.primary',
                        fontWeight: 600,
                      }}
                    >
                      {r.z.toFixed(3)}
                    </TableCell>
                    <TableCell align="right">{r.close.toFixed(6)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        <Box
          sx={{
            mt: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 1.2,
            flexWrap: 'wrap',
          }}
        >
          <Typography variant="body2">
            已选币种: {selectedSymbol || '未选择'}
          </Typography>
          <Button
            variant="contained"
            size="small"
            disabled={!selectedSymbol}
            onClick={() => setTracking((v) => !v)}
          >
            {tracking ? '停止追踪' : '开始追踪'}
          </Button>
          {trackNote && (
            <Typography variant="caption" color="text.secondary">
              {trackNote}
            </Typography>
          )}
        </Box>

        {trackCandles.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <TrailTrackChart candles={trackCandles} height={420} />
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default TrailZFilterTab;
