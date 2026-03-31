import { useState } from 'react';
import { Box, Tab, Tabs } from '@mui/material';
import TrailLoadDataTab from '../components/trail/TrailLoadDataTab';
import TrailZFilterTab from '../components/trail/TrailZFilterTab';

export default function Trail() {
  const [value, setValue] = useState(0);

  return (
    <Box sx={{ marginTop: '10px' }}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs
          value={value}
          onChange={(_, newValue) => setValue(newValue)}
          variant="fullWidth"
        >
          <Tab label="Data" sx={{ minHeight: '48px' }} />
          <Tab label="Z" sx={{ minHeight: '48px' }} />
        </Tabs>
      </Box>
      <Box sx={{ p: 0.5 }}>
        {value === 0 && <TrailLoadDataTab />}
        {value === 1 && <TrailZFilterTab />}
      </Box>
    </Box>
  );
}
