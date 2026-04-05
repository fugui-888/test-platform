import React, {
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

const STORAGE_KEY = 'binance-usdt-watchlist-v1';

export interface BinanceUsdtWatchlistContextValue {
  selectedSymbols: string[];
  setSelectedSymbols: (symbols: string[]) => void;
  toggleSymbol: (symbol: string) => void;
  removeSymbol: (symbol: string) => void;
}

const initial: BinanceUsdtWatchlistContextValue = {
  selectedSymbols: [],
  setSelectedSymbols: () => {},
  toggleSymbol: () => {},
  removeSymbol: () => {},
};

export const BinanceUsdtWatchlistContext =
  React.createContext<BinanceUsdtWatchlistContextValue>(initial);

export const useBinanceUsdtWatchlist = () =>
  React.useContext(BinanceUsdtWatchlistContext);

export const BinanceUsdtWatchlistProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [selectedSymbols, setSelectedSymbolsState] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed)
        ? parsed.filter((x): x is string => typeof x === 'string')
        : [];
    } catch {
      return [];
    }
  });

  const setSelectedSymbols = useCallback((symbols: string[]) => {
    const next = Array.from(new Set(symbols)).sort();
    setSelectedSymbolsState(next);
  }, []);

  const toggleSymbol = useCallback((symbol: string) => {
    setSelectedSymbolsState((prev) => {
      const set = new Set(prev);
      if (set.has(symbol)) set.delete(symbol);
      else set.add(symbol);
      return Array.from(set).sort();
    });
  }, []);

  const removeSymbol = useCallback((symbol: string) => {
    setSelectedSymbolsState((prev) => prev.filter((s) => s !== symbol));
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedSymbols));
    } catch {
      /* ignore quota */
    }
  }, [selectedSymbols]);

  const value = useMemo(
    () => ({
      selectedSymbols,
      setSelectedSymbols,
      toggleSymbol,
      removeSymbol,
    }),
    [selectedSymbols, setSelectedSymbols, toggleSymbol, removeSymbol],
  );

  return (
    <BinanceUsdtWatchlistContext.Provider value={value}>
      {children}
    </BinanceUsdtWatchlistContext.Provider>
  );
};
