import React, { useState } from 'react';
import { Box, ButtonBase } from '@mui/material';

export type MonitorChartInterval = '1m' | '5m' | '10m' | '15m' | '30m' | '1d';

type Props = {
  value: MonitorChartInterval;
  onChange: (next: MonitorChartInterval) => void;
};

const INTERVAL_OPTIONS: MonitorChartInterval[] = [
  '1m',
  '5m',
  '10m',
  '15m',
  '30m',
  '1d',
];

const CoolIntervalGroup: React.FC<Props> = ({ value, onChange }) => {
  const [hovered, setHovered] = useState<MonitorChartInterval | null>(null);

  return (
    <Box
      sx={{
        display: 'inline-flex',
        gap: 1,
        p: 0.15,
        borderRadius: 0.75,
        background:
          'linear-gradient(180deg, rgba(248,250,252,0.92) 0%, rgba(241,245,249,0.86) 100%)',
        border: '1px solid rgba(30,41,59,0.14)',
        boxShadow: '0 8px 20px rgba(15,23,42,0.12)',
      }}
    >
      {INTERVAL_OPTIONS.map((opt) => {
        const active = opt === value;
        const hoveredNow = hovered === opt;
        return (
          <ButtonBase
            key={opt}
            onMouseEnter={() => setHovered(opt)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => onChange(opt)}
            sx={{
              position: 'relative',
              overflow: 'hidden',
              px: 1.35,
              py: 0.62,
              minWidth: 54,
              borderRadius: 0.65,
              border: '1px solid rgba(30,41,59,0.15)',
              background: active ? '#1e293b' : 'transparent',
              color: active ? '#fff' : 'rgba(30,41,59,0.70)',
              fontSize: '0.74rem',
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              transition:
                'color 400ms ease, background 400ms ease, transform 180ms ease',
              '&:hover': {
                transform: 'translateY(-1px)',
                color: active ? '#fff' : 'rgba(30,41,59,0.9)',
              },
            }}
          >
            <Box
              component="svg"
              viewBox="0 0 200 50"
              preserveAspectRatio="none"
              sx={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
              }}
            >
              <rect
                x="1"
                y="1"
                width="198"
                height="48"
                fill="none"
                stroke={active ? '#0f172a' : '#1e293b'}
                strokeWidth="1.5"
                strokeDasharray="492"
                strokeDashoffset={active || hoveredNow ? 0 : 492}
                style={{
                  transition:
                    'stroke-dashoffset 700ms cubic-bezier(0.65, 0, 0.35, 1)',
                }}
              />
            </Box>
            <Box component="span" sx={{ position: 'relative', zIndex: 1 }}>
              {opt}
            </Box>
          </ButtonBase>
        );
      })}
    </Box>
  );
};

export default CoolIntervalGroup;
