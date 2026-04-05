import React, { useEffect, useState } from 'react';
import SettingsIcon from '@mui/icons-material/Settings';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import {
  Box,
  Button,
  ButtonGroup,
  Card,
  CardContent,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  IconButton,
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
  TextField,
  Typography,
} from '@mui/material';
import { useBinanceUsdtWatchlist } from '../../context/BinanceUsdtWatchlistContext';
import { getAllKlineDataByInterval, KlineRecord } from '../../utils/db';
import KlineWithVolAndMA from '../highPoint/KlineWithVolAndMA';

interface ResultRow {
  symbol: string;
  zScore: number;
  close: number;
  timestamp: number;
}

const INTERVALS = ['5m', '15m', '30m', '1h', '4h', '1d'];
const DEFAULT_Z_THRESHOLD = 2.3;

const PullbackAnalysisPage: React.FC = () => {
  const { selectedSymbols, toggleSymbol } = useBinanceUsdtWatchlist();
  const [interval, setInterval] = useState<string>('5m');
  const [results, setResults] = useState<ResultRow[]>([]);
  const [selectedRow, setSelectedRow] = useState<ResultRow | null>(null);
  const [allKlineData, setAllKlineData] = useState<KlineRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [totalAvailable, setTotalAvailable] = useState<number>(0);
  const [zThreshold, setZThreshold] = useState<number>(DEFAULT_Z_THRESHOLD);
  const [zDialogOpen, setZDialogOpen] = useState(false);
  const [zDraft, setZDraft] = useState(String(DEFAULT_Z_THRESHOLD));

  useEffect(() => {
    const checkDataAvailability = async () => {
      try {
        const storedData = await getAllKlineDataByInterval(interval);
        setTotalAvailable(storedData.length);
      } catch (error) {
        console.error('检查数据可用性失败:', error);
        setTotalAvailable(0);
      }
    };
    checkDataAvailability();
  }, [interval]);

  const calcLatestPositiveZ = (
    klines: string[][],
  ): { zScore: number; close: number; timestamp: number } | null => {
    if (!klines || klines.length < 30) return null;
    const n = klines.length;
    const closes = klines.map((k) => parseFloat(k[4]));
    const latestClose = closes[n - 1];
    const window = closes.slice(n - 30, n);
    const mean = window.reduce((s, v) => s + v, 0) / window.length;
    const variance =
      window.reduce((s, v) => s + (v - mean) ** 2, 0) / window.length;
    const sigma = Math.sqrt(variance);
    if (!Number.isFinite(sigma) || sigma <= 0) return null;
    const z = (latestClose - mean) / sigma;
    if (!(z > 0)) return null;
    return {
      zScore: z,
      close: latestClose,
      timestamp: Number(klines[n - 1][0]) / 1000,
    };
  };

  const handleSearch = async () => {
    setIsLoading(true);
    try {
      const storedData = await getAllKlineDataByInterval(interval);
      const scored: Array<{ row: ResultRow; record: KlineRecord }> = [];

      storedData.forEach((record) => {
        const out = calcLatestPositiveZ(record.klines);
        if (!out) return;
        scored.push({
          row: {
            symbol: record.symbol,
            zScore: out.zScore,
            close: out.close,
            timestamp: out.timestamp,
          },
          record,
        });
      });

      scored.sort((a, b) => b.row.zScore - a.row.zScore);
      const top = scored.slice(0, 15);
      setResults(top.map((x) => x.row));
      setAllKlineData(top.map((x) => x.record));
      setSelectedRow(top.length > 0 ? top[0].row : null);
    } catch (error) {
      console.error('Z filter 分析失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNavigate = (direction: 'up' | 'down') => {
    if (!selectedRow) return;
    const currentIndex = results.findIndex(
      (row) => row.symbol === selectedRow.symbol,
    );
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex >= 0 && newIndex < results.length) {
      setSelectedRow(results[newIndex]);
    }
  };

  const openZDialog = () => {
    setZDraft(String(zThreshold));
    setZDialogOpen(true);
  };

  const confirmZ = () => {
    const next = parseFloat(zDraft);
    if (Number.isFinite(next) && next > 0) {
      setZThreshold(next);
    } else {
      setZThreshold(DEFAULT_Z_THRESHOLD);
    }
    setZDialogOpen(false);
  };

  const canNavigateUp =
    !!selectedRow &&
    results.findIndex((r) => r.symbol === selectedRow.symbol) > 0;
  const canNavigateDown =
    !!selectedRow &&
    results.findIndex((r) => r.symbol === selectedRow.symbol) <
      results.length - 1;

  return (
    <Box sx={{ p: 1 }}>
      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ p: 2 }}>
          <Grid container spacing={1} alignItems="center">
            <Grid item xs={12}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <FormControl size="small" sx={{ minWidth: 100 }}>
                    <InputLabel>间隔</InputLabel>
                    <Select
                      value={interval}
                      label="间隔"
                      onChange={(e) => setInterval(e.target.value)}
                    >
                      {INTERVALS.map((int) => (
                        <MenuItem key={int} value={int}>
                          {int}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <Button
                    variant="contained"
                    onClick={handleSearch}
                    disabled={isLoading || totalAvailable === 0}
                    size="small"
                  >
                    Z Filter
                  </Button>
                </Box>
                <IconButton size="small" onClick={openZDialog} color="primary">
                  <SettingsIcon fontSize="small" />
                </IconButton>
              </Box>
            </Grid>
            <Grid item xs={12} sm="auto">
              <Typography
                variant="caption"
                sx={{
                  color: totalAvailable > 0 ? 'success.main' : 'error.main',
                  display: 'block',
                }}
              >
                {totalAvailable > 0
                  ? `本地已缓存: ${totalAvailable} 个币种`
                  : '请先加载数据'}
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Dialog
        open={zDialogOpen}
        onClose={() => setZDialogOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Z threshold</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <TextField
            label="|z| threshold (positive only)"
            type="number"
            value={zDraft}
            onChange={(e) => setZDraft(e.target.value)}
            inputProps={{ step: 0.01, min: 0.01 }}
            fullWidth
            size="small"
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setZDialogOpen(false)}>cancel</Button>
          <Button variant="contained" onClick={confirmZ}>
            confirm
          </Button>
        </DialogActions>
      </Dialog>

      <Box sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="subtitle2">
          Z 排名 (top 15, z &gt; 0) · 当前阈值: {zThreshold.toFixed(2)}
        </Typography>
      </Box>

      <Paper sx={{ mb: 2 }}>
        <TableContainer sx={{ maxHeight: 320 }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox" sx={{ width: 40 }} />
                <TableCell>币名</TableCell>
                <TableCell align="right">z(MA30)</TableCell>
                <TableCell align="right">close</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {results.map((row) => (
                <TableRow
                  key={row.symbol}
                  hover
                  selected={selectedRow?.symbol === row.symbol}
                  onClick={() => setSelectedRow(row)}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell
                    padding="checkbox"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Checkbox
                      size="small"
                      checked={selectedSymbols.includes(row.symbol)}
                      onChange={() => toggleSymbol(row.symbol)}
                      inputProps={{ 'aria-label': `watchlist ${row.symbol}` }}
                    />
                  </TableCell>
                  <TableCell>{row.symbol.replace('USDT', '')}</TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      fontWeight: row.zScore > zThreshold ? 700 : 400,
                      color: row.zScore > zThreshold ? 'error.main' : 'inherit',
                    }}
                  >
                    {row.zScore.toFixed(3)}
                  </TableCell>
                  <TableCell align="right">{row.close.toFixed(4)}</TableCell>
                </TableRow>
              ))}
              {results.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} align="center">
                    暂无符合条件数据
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {selectedRow && (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="h6">{selectedRow.symbol}</Typography>
            <ButtonGroup size="small">
              <Button
                onClick={() => handleNavigate('up')}
                disabled={!canNavigateUp}
              >
                <KeyboardArrowUpIcon />
              </Button>
              <Button
                onClick={() => handleNavigate('down')}
                disabled={!canNavigateDown}
              >
                <KeyboardArrowDownIcon />
              </Button>
            </ButtonGroup>
          </Box>
          <Paper sx={{ p: 1 }}>
            <KlineWithVolAndMA
              symbol={selectedRow.symbol}
              klines={
                allKlineData.find((k) => k.symbol === selectedRow.symbol)
                  ?.klines || []
              }
              selectedDate={selectedRow.timestamp}
              zThreshold={zThreshold}
            />
          </Paper>
        </Box>
      )}
    </Box>
  );
};

export default PullbackAnalysisPage;
