import React from 'react';
import { MemoryStick, Info } from 'lucide-react';

export function RAMDonutCard({
  percentage = 45,
  totalGB = 16,
  availableGB = 8.8,
  cacheGB = 2.1
}) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="tt-metric-card">
      <div className="tt-card-top">
        <div className="tt-card-title-group">
          <MemoryStick size={16} className="tt-card-title-icon" />
          <span>Memória RAM</span>
        </div>
        <Info size={14} className="tt-card-info-icon" title="Consumo de memória RAM física e em cache" />
      </div>

      <div className="tt-donut-wrapper">
        {/* Gráfico Donut em SVG */}
        <div className="tt-donut-circle">
          <svg width="90" height="90" viewBox="0 0 90 90">
            {/* Background ring */}
            <circle
              cx="45"
              cy="45"
              r={radius}
              fill="transparent"
              stroke="rgba(255, 255, 255, 0.07)"
              strokeWidth="9"
            />
            {/* Active glowing ring */}
            <circle
              cx="45"
              cy="45"
              r={radius}
              fill="transparent"
              stroke="url(#ramRingGradient)"
              strokeWidth="9"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              transform="rotate(-90 45 45)"
              style={{
                transition: 'stroke-dashoffset 0.6s ease',
                filter: 'drop-shadow(0 0 5px rgba(99, 102, 241, 0.5))'
              }}
            />
            <defs>
              <linearGradient id="ramRingGradient" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#6366f1" />
                <stop offset="100%" stopColor="#818cf8" />
              </linearGradient>
            </defs>
          </svg>

          <div className="tt-donut-center-text">
            <span className="tt-donut-pct">{percentage}%</span>
            <span className="tt-donut-sub">de {totalGB}GB</span>
          </div>
        </div>

        {/* Badges laterais */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11.5px' }}>
          <div>
            <span style={{ color: '#64748b' }}>Disponível: </span>
            <strong style={{ color: '#f1f5f9' }}>{availableGB} GB</strong>
          </div>
          <div>
            <span style={{ color: '#64748b' }}>Em cache: </span>
            <strong style={{ color: '#f1f5f9' }}>{cacheGB} GB</strong>
          </div>
        </div>
      </div>

      <div className="tt-card-footer-stats">
        <span>Status: <strong style={{ color: '#22c55e' }}>Otimizado</strong></span>
        <span>Uso: <strong>{((totalGB * percentage) / 100).toFixed(1)} GB</strong></span>
      </div>
    </div>
  );
}
