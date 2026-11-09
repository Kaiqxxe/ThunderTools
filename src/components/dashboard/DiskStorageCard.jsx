import React from 'react';
import { HardDrive, Info } from 'lucide-react';

export function DiskStorageCard({
  driveLetter = 'C:',
  usedPercentage = 35,
  totalGB = 512,
  readWriteSpeedMBs = 12,
  variant = 'gauge' // 'gauge' | 'linear'
}) {
  return (
    <div className="tt-metric-card">
      <div className="tt-card-top">
        <div className="tt-card-title-group">
          <HardDrive size={16} className="tt-card-title-icon" />
          <span>Disco ({driveLetter})</span>
        </div>
        <Info size={14} className="tt-card-info-icon" title={`Armazenamento e leitura/escrita do drive ${driveLetter}`} />
      </div>

      {variant === 'gauge' ? (
        /* Modo Gauge / Velocímetro em Arco */
        <div className="tt-gauge-wrapper">
          <svg width="120" height="68" viewBox="0 0 120 68">
            <defs>
              <linearGradient id="diskArcGradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#6366f1" />
                <stop offset="100%" stopColor="#818cf8" />
              </linearGradient>
            </defs>

            {/* Background Arc */}
            <path
              d="M 15,62 A 45,45 0 0,1 105,62"
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="9"
              strokeLinecap="round"
            />

            {/* Value Arc */}
            <path
              d="M 15,62 A 45,45 0 0,1 105,62"
              fill="none"
              stroke="url(#diskArcGradient)"
              strokeWidth="9"
              strokeDasharray="142"
              strokeDashoffset={142 - (142 * usedPercentage) / 100}
              strokeLinecap="round"
              style={{
                transition: 'stroke-dashoffset 0.6s ease',
                filter: 'drop-shadow(0 0 6px rgba(99, 102, 241, 0.6))'
              }}
            />

            {/* Pointer Needle */}
            <line
              x1="60"
              y1="62"
              x2={60 + 35 * Math.cos(Math.PI - (Math.PI * usedPercentage) / 100)}
              y2={62 - 35 * Math.sin((Math.PI * usedPercentage) / 100)}
              stroke="#cbd5e1"
              strokeWidth="2.5"
              strokeLinecap="round"
              style={{ filter: 'drop-shadow(0 0 2px rgba(255,255,255,0.8))' }}
            />
            <circle cx="60" cy="62" r="4" fill="#818cf8" />
          </svg>
        </div>
      ) : (
        /* Modo Barra Linear de Armazenamento */
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '68px' }}>
          <div className="tt-linear-disk-bar">
            <div
              className="tt-linear-disk-fill"
              style={{ width: `${Math.min(100, Math.max(0, usedPercentage))}%` }}
            />
          </div>
        </div>
      )}

      <div className="tt-card-footer-stats">
        <span>{usedPercentage}% de <strong>{totalGB}GB</strong></span>
        <span>L/E: <strong>{readWriteSpeedMBs} MB/s</strong></span>
      </div>
    </div>
  );
}
