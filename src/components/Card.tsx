import { Box, Typography } from '@mui/material';
import { useDataContext } from '../context/DataContext';
import CardItem from './CardItem';

export interface CardData {
  detail: string;
  symbol: string;
  highlightColor?: string;
  textColor?: string;
}

interface CardProps {
  bgColor: string;
  data: CardData[];
  title: string;
  onItemClick?: (symbol: string) => void;
  bigMode?: boolean;
  noActionButtons?: boolean;
  withLimitHeight?: boolean;
}

export default function Card(props: CardProps) {
  const {
    bgColor,
    data,
    title,
    onItemClick,
    bigMode,
    noActionButtons = false,
    withLimitHeight = false,
  } = props;
  const { notWatchList } = useDataContext();

  return (
    <Box sx={{ minWidth: '300px' }}>
      <Typography fontSize="14px">{title}</Typography>
      <Box
        sx={{
          bgcolor: bgColor,
          minHeight: '160px',
          borderRadius: '10px',
          padding: '5px',
          border: '1px solid #e3e3e3',
          maxHeight: withLimitHeight ? '160px' : 'unset',
          overflow: withLimitHeight ? 'auto' : 'unset',
        }}
      >
        {data
          .filter((d) => !notWatchList.find((l) => l === d.symbol))
          .map((d, index) => (
            <CardItem
              data={d}
              onItemClick={onItemClick}
              key={`${index} - ${d.symbol}`}
              bigMode={bigMode}
              noActionButtons={noActionButtons}
            />
          ))}
      </Box>
    </Box>
  );
}
