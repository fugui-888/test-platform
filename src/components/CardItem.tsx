import { useEffect, useState } from 'react';
import { Box, Typography, IconButton } from '@mui/material';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import StarIcon from '@mui/icons-material/Star';
import styled from 'styled-components';
import getSavedSymbolsFromStorage from '../utils/getSavedSymbols';
import { useDataContext } from '../context/DataContext';

const HighlightBox = styled(Box)`
  border: 1px solid white;
  border-radius: 10px;
  padding: 2px 10px;
  margin: 4px;
`;

export interface CardData {
  detail: string;
  symbol: string;
  highlightColor?: string;
  textColor?: string;
  appendix?: React.ReactNode;
}

interface CardItemProps {
  data: CardData;
  onItemClick?: (symbol: string) => void;
  bigMode?: boolean;
  noActionButtons?: boolean;
}

export default function CardItem(props: CardItemProps) {
  const { data, onItemClick, bigMode, noActionButtons = false } = props;
  const savedInStorage = getSavedSymbolsFromStorage();
  const [savedSymbols, setSavedSymbols] = useState<string[]>(savedInStorage);
  const { notWatchList, setNotWatchList } = useDataContext();

  const onNotWatchClick = (symbol: string) => {
    setNotWatchList([...notWatchList, symbol]);
  };

  const onStarClick = (saved: boolean, symbol: string) => {
    if (saved) {
      const newStoreNames = savedSymbols.filter((s) => s !== symbol);
      setSavedSymbols(newStoreNames);
    } else {
      const newStoreNames = [...savedSymbols, symbol];
      setSavedSymbols(newStoreNames);
    }
  };

  useEffect(() => {
    localStorage.setItem(
      'savedSymbols',
      JSON.stringify(savedSymbols.join(',')),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedSymbols.length]);

  return (
    <div onClick={onItemClick ? () => onItemClick(data.symbol) : undefined}>
      {bigMode ? (
        <HighlightBox
          sx={{
            backgroundColor: data.highlightColor || 'white',
          }}
        >
          <Typography fontSize={'100px'}>{data.symbol.slice(0, -4)}</Typography>
        </HighlightBox>
      ) : (
        <HighlightBox
          sx={{
            // display: 'flex',
            // justifyContent: 'space-between',
            // alignItems: 'center',
            backgroundColor: data.highlightColor || 'white',
          }}
        >
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              width: '100%',
            }}
          >
            <Typography
              fontSize={'14px'}
              marginRight="5px"
              color={data.textColor || undefined}
            >
              {data.detail}
            </Typography>
            {data.appendix}
            {!noActionButtons && (
              <Box display="flex">
                <IconButton
                  onClick={() => onNotWatchClick(data.symbol)}
                  sx={{ padding: '2px' }}
                >
                  <VisibilityOffIcon sx={{ fontSize: '16px' }} />
                </IconButton>
                <IconButton
                  onClick={() =>
                    onStarClick(savedSymbols.includes(data.symbol), data.symbol)
                  }
                  sx={{ padding: '2px' }}
                >
                  {savedSymbols.includes(data.symbol) ? (
                    <StarIcon sx={{ color: '#FBA1B7', fontSize: '16px' }} />
                  ) : (
                    <StarBorderIcon sx={{ fontSize: '16px' }} />
                  )}
                </IconButton>
              </Box>
            )}
          </Box>
        </HighlightBox>
      )}
    </div>
  );
}
