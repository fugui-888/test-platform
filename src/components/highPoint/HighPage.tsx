import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Grid,
  TextField,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  ButtonGroup,
  CircularProgress,
} from '@mui/material';
import { DateTime } from 'luxon';
import getAllPrice from '../../utils/fetch/getAllPrice';
import getKLineData from '../../utils/fetch/getKLineData';
import KlineWithVolAndMA from './KlineWithVolAndMA';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';

interface KlineData {
  symbol: string;
  klines: string[][];
}

interface Filter {
  count: number;
  minRatio: number;
}

interface ResultRow {
  symbol: string;
  ratio: number;
  open: number;
  close: number;
  minLow: number;
  minLowDate: number;
}

interface SymbolList {
  symbol: string;
  sortCountPriceChange: number;
  klines: string[][];
}

const HighPointPage: React.FC = () => {
  const [filter, setFilter] = useState<Filter>({
    count: 100,
    minRatio: 2.5,
  });
  const [results, setResults] = useState<ResultRow[]>([]);
  const [selectedRow, setSelectedRow] = useState<ResultRow | null>(null);
  const [allKlineData, setAllKlineData] = useState<KlineData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleFilterChange = (field: keyof Filter, value: any) => {
    setFilter((prev) => ({ ...prev, [field]: value }));
  };

  const getListForAll = async (): Promise<SymbolList[]> => {
    const allTicks = await getAllPrice();
    let all: SymbolList[] = [];
    const chunkSize = 400;

    for (let i = 0; i < allTicks.length; i += chunkSize) {
      const chunk = allTicks.slice(i, i + chunkSize);

      await Promise.all(
        chunk.map((item) =>
          getKLineData({
            symbol: item.symbol,
            interval: '1d',
            limit: '888',
          }),
        ),
      ).then((values) => {
        values.forEach((value, idx) => {
          const klines = value.klines || [];
          const length = klines.length;
          if (length === 0) return;

          const endIdx = length - 1;
          const startIdx = Math.max(0, endIdx - filter.count + 1);
          const slice = klines.slice(startIdx, endIdx + 1);

          const lows = slice.map((k) => parseFloat(k[3]));
          if (lows.length === 0) return;

          const minLow = Math.min(...lows);
          const minLowIdx = lows.findIndex((v) => v === minLow);
          const minLowDate = Number(klines[startIdx + minLowIdx][0]);

          const close = parseFloat(klines[endIdx][4]);
          const ratio = close / minLow;

          if (ratio >= filter.minRatio) {
            all.push({
              symbol: chunk[idx].symbol,
              sortCountPriceChange: ratio,
              klines,
            });
          }
        });
      });

      if (i + chunkSize < allTicks.length) {
        console.log(
          `已处理批次 ${i / chunkSize + 1}，等待1分钟后继续处理下一批...`,
        );
        await new Promise((resolve) => setTimeout(resolve, 60000));
      }
    }

    all.sort((a, b) => b.sortCountPriceChange - a.sortCountPriceChange);
    return all;
  };

  const handleSearch = async () => {
    setIsLoading(true);
    try {
      const symbolList = await getListForAll();
      const newResults: ResultRow[] = symbolList.map(
        ({ symbol, sortCountPriceChange, klines }) => {
          const endIdx = klines.length - 1;
          const close = parseFloat(klines[endIdx][4]);
          const open = parseFloat(klines[endIdx][1]);
          const lows = klines.slice(-filter.count).map((k) => parseFloat(k[3]));
          const minLow = Math.min(...lows);
          const minLowIdx = lows.findIndex((v) => v === minLow);
          const minLowDate =
            Number(klines[klines.length - filter.count + minLowIdx]?.[0]) /
            1000;

          return {
            symbol,
            ratio: sortCountPriceChange,
            open,
            close,
            minLow,
            minLowDate,
          };
        },
      );

      setResults(newResults);
      setAllKlineData(
        symbolList.map(({ symbol, klines }) => ({ symbol, klines })),
      );
      setSelectedRow(null);
    } catch (error) {
      console.error('搜索过程中发生错误:', error);
      // 这里可以添加一些用户友好的错误提示
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

  const canNavigateUp =
    selectedRow &&
    results.findIndex((row) => row.symbol === selectedRow.symbol) > 0;
  const canNavigateDown =
    selectedRow &&
    results.findIndex((row) => row.symbol === selectedRow.symbol) <
      results.length - 1;

  return (
    <Box sx={{ p: 3, backgroundColor: 'transparent' }}>
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item>
              <TextField
                label="count"
                type="number"
                size="small"
                value={filter.count}
                onChange={(e) =>
                  handleFilterChange('count', Number(e.target.value))
                }
                sx={{ width: 90 }}
              />
            </Grid>
            <Grid item>
              <TextField
                label="最小倍数"
                type="number"
                size="small"
                value={filter.minRatio}
                onChange={(e) =>
                  handleFilterChange('minRatio', Number(e.target.value))
                }
                sx={{ width: 110 }}
              />
            </Grid>
            <Grid item>
              <Button variant="contained" onClick={handleSearch}>
                搜索
              </Button>
              {isLoading && <CircularProgress size={20} />}
            </Grid>
          </Grid>
        </CardContent>
      </Card>
      <Box sx={{ mb: 2 }}>
        <Typography variant="body1" component="div">
          共筛选出 {results.length} 条数据
        </Typography>
        <Paper sx={{ borderRadius: 2, overflow: 'hidden' }}>
          <TableContainer sx={{ maxHeight: 400, overflow: 'auto' }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell>币名</TableCell>
                  <TableCell>倍数</TableCell>
                  <TableCell>Open</TableCell>
                  <TableCell>Close</TableCell>
                  <TableCell>最小值</TableCell>
                  <TableCell>最小值日期</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {results.map((row) => {
                  const daysToMin = Math.floor(
                    (Date.now() / 1000 - row.minLowDate) / 86400,
                  );

                  const klineData = allKlineData.find(
                    (item) => item.symbol === row.symbol,
                  )?.klines;
                  let continuousUpDays = 0;
                  if (klineData) {
                    for (let i = klineData.length - 1; i > 0; i--) {
                      const close = parseFloat(klineData[i][4]);
                      const prevClose = parseFloat(klineData[i - 1][4]);
                      if (close > prevClose) {
                        continuousUpDays++;
                      } else {
                        break;
                      }
                    }
                  }

                  return (
                    <TableRow
                      key={row.symbol}
                      hover
                      selected={selectedRow?.symbol === row.symbol}
                      onClick={() => setSelectedRow(row)}
                      style={{ cursor: 'pointer' }}
                    >
                      <TableCell>{row.symbol}</TableCell>
                      <TableCell>{row.ratio.toFixed(2)}</TableCell>
                      <TableCell>{row.open}</TableCell>
                      <TableCell>{row.close}</TableCell>
                      <TableCell>{row.minLow}</TableCell>
                      <TableCell>
                        {DateTime.fromSeconds(row.minLowDate).toFormat(
                          'yyyy-LL-dd',
                        )}
                      </TableCell>
                      {/* <TableCell>{daysToMin}</TableCell>
                      <TableCell>{continuousUpDays}</TableCell> */}
                    </TableRow>
                  );
                })}
                {results.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} align="center">
                      <Typography color="text.secondary">暂无数据</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Box>
      {selectedRow && (
        <Box sx={{ mt: 3 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              mb: 1,
            }}
          >
            <Typography variant="h6">
              {selectedRow.symbol.replace('_USDT', '')} K线图 (
              {selectedRow.ratio.toFixed(2)}倍)
            </Typography>
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
          <Paper sx={{ p: 2, borderRadius: 2 }}>
            <KlineWithVolAndMA
              symbol={selectedRow.symbol}
              klines={
                allKlineData.find((item) => item.symbol === selectedRow.symbol)
                  ?.klines || []
              }
              selectedDate={selectedRow.minLowDate}
            />
          </Paper>
        </Box>
      )}
    </Box>
  );
};

export default HighPointPage;
