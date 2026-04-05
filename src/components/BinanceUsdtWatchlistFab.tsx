import React, { useCallback, useEffect, useState } from 'react';
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck';
import CloseIcon from '@mui/icons-material/Close';
import {
  Autocomplete,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemText,
  TextField,
  Typography,
} from '@mui/material';
import { useBinanceUsdtWatchlist } from '../context/BinanceUsdtWatchlistContext';
import getAllPrice from '../utils/fetch/getAllPrice';

export default function BinanceUsdtWatchlistFab() {
  const { selectedSymbols, setSelectedSymbols, removeSymbol } =
    useBinanceUsdtWatchlist();
  const [open, setOpen] = useState(false);
  const [allUsdt, setAllUsdt] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const loadSymbols = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const ticks = await getAllPrice();
      const list = ticks
        .map((t) => t.symbol)
        .filter((sym) => !sym.startsWith('USDC'))
        .sort();
      setAllUsdt(list);
    } catch {
      setFetchError('无法加载交易对列表，请稍后重试');
      setAllUsdt([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open || allUsdt.length > 0) return;
    void loadSymbols();
  }, [open, allUsdt.length, loadSymbols]);

  return (
    <>
      <IconButton
        color="primary"
        onClick={() => setOpen(true)}
        sx={{
          position: 'fixed',
          left: 16,
          bottom: 16,
          zIndex: (t) => t.zIndex.drawer + 2,
          boxShadow: 3,
          bgcolor: 'background.paper',
          border: 1,
          borderColor: 'divider',
          '&:hover': { bgcolor: 'action.hover' },
        }}
        size="large"
        aria-label="open watchlist picker"
      >
        <PlaylistAddCheckIcon />
      </IconButton>

      <Drawer
        anchor="bottom"
        open={open}
        onClose={() => setOpen(false)}
        PaperProps={{
          sx: {
            height: '66.67vh',
            maxHeight: '90vh',
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          },
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 2,
            py: 1,
            borderBottom: 1,
            borderColor: 'divider',
            flexShrink: 0,
          }}
        >
          <Typography variant="subtitle1" fontWeight={600}>
            USDT 自选
          </Typography>
          <IconButton
            aria-label="close"
            onClick={() => setOpen(false)}
            edge="end"
          >
            <CloseIcon />
          </IconButton>
        </Box>

        <Box sx={{ px: 2, pt: 1.5, flexShrink: 0 }}>
          {fetchError && (
            <Box
              sx={{
                mb: 1,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                flexWrap: 'wrap',
              }}
            >
              <Typography color="error" variant="body2">
                {fetchError}
              </Typography>
              <Button
                size="small"
                variant="outlined"
                onClick={() => void loadSymbols()}
              >
                重试
              </Button>
            </Box>
          )}
          {loading ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 2 }}>
              <CircularProgress size={22} />
              <Typography variant="body2" color="text.secondary">
                加载 Binance 交易对…
              </Typography>
            </Box>
          ) : (
            <Autocomplete
              multiple
              options={allUsdt}
              value={selectedSymbols}
              onChange={(_, v) => setSelectedSymbols(v)}
              disableCloseOnSelect
              renderTags={() => null}
              renderOption={(props, option, { selected }) => (
                <li {...props} key={option}>
                  <Checkbox style={{ marginRight: 8 }} checked={selected} />
                  {option}
                </li>
              )}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="交易对"
                  placeholder="搜索"
                  size="small"
                />
              )}
              ListboxProps={{ style: { maxHeight: 220 } }}
            />
          )}
        </Box>

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 2,
            pt: 1,
            pb: 0.5,
            gap: 1,
          }}
        >
          <Typography variant="caption" color="text.secondary">
            已选 {selectedSymbols.length} 个
          </Typography>
          <Button
            size="small"
            color="error"
            variant="text"
            disabled={selectedSymbols.length === 0}
            onClick={() => setSelectedSymbols([])}
          >
            一键清除
          </Button>
        </Box>
        <Box
          sx={{
            mx: 2,
            mb: 2,
            flexShrink: 0,
            height: 210,
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            overflow: 'auto',
            bgcolor: 'action.hover',
          }}
        >
          <List dense disablePadding sx={{ py: 0.5 }}>
            {selectedSymbols.map((sym) => (
              <ListItem
                key={sym}
                secondaryAction={
                  <IconButton
                    edge="end"
                    aria-label={`remove ${sym}`}
                    onClick={() => removeSymbol(sym)}
                    size="small"
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                }
              >
                <ListItemText primary={sym} />
              </ListItem>
            ))}
          </List>
        </Box>
      </Drawer>
    </>
  );
}
