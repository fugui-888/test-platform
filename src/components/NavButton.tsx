import React from 'react';
import { useNavigate } from 'react-router-dom';
import ListIcon from '@mui/icons-material/List';
import {
  Box,
  IconButton,
  Popover,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
} from '@mui/material';
import { routes } from '../App';

export default function NavButton() {
  const history = useNavigate();
  const [anchorEl, setAnchorEl] = React.useState<HTMLButtonElement | null>(
    null,
  );

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const open = Boolean(anchorEl);
  const id = open ? 'nav-popover' : undefined;

  const onListItemClick = (routePath: string) => {
    history(routePath);
    handleClose();
  };

  return (
    <Box
      sx={{
        position: 'absolute',
        top: 0,
        right: 0,
      }}
    >
      <IconButton onClick={handleClick}>
        <ListIcon />
      </IconButton>
      <Popover
        id={id}
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <List>
          <ListItem disablePadding>
            <ListItemButton
              onClick={() => onListItemClick(routes.Analysis)}
              sx={{ padding: '5px 20px' }}
            >
              <ListItemText primary="Analysis" />
            </ListItemButton>
          </ListItem>
        </List>
      </Popover>
    </Box>
  );
}
