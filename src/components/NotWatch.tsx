import * as React from 'react';
import {
  Box,
  Accordion,
  Typography,
  AccordionSummary,
  AccordionDetails,
  IconButton,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ReplyIcon from '@mui/icons-material/Reply';
import { useDataContext } from '../context/DataContext';

export default function NotWatch() {
  const { notWatchList, setNotWatchList } = useDataContext();

  const onWatchClick = (symbol: string) => {
    const newlist = notWatchList.filter((l) => l !== symbol);
    setNotWatchList(newlist);
  };

  return (
    <Accordion>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Box display="flex" justifyContent="space-between" width="100%">
          <Box>
            <Typography>Not Watch</Typography>
          </Box>
          <Box
            sx={{
              height: '30px',
              width: '30px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              borderRadius: '15px',
              backgroundColor: '#088395',
              color: 'white',
            }}
          >
            <Typography>{notWatchList.length}</Typography>
          </Box>
        </Box>
      </AccordionSummary>
      <AccordionDetails>
        <Box display="flex">
          {notWatchList.map((l) => {
            return (
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  width: '140px',
                  borderRadius: '20px',
                  marginLeft: '4px',
                  padding: '0 8px',
                  backgroundColor: '#088395',
                  color: 'white',
                }}
              >
                <Typography>{l}</Typography>
                <IconButton onClick={() => onWatchClick(l)}>
                  <ReplyIcon sx={{ color: 'white' }} />
                </IconButton>
              </Box>
            );
          })}
        </Box>
      </AccordionDetails>
    </Accordion>
  );
}
