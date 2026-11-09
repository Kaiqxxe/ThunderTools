import React from 'react';
import { Globe, Info } from 'lucide-react';

export function NetworkMonitorCard({
  downloadMbps = 12.5,
  uploadMbps = 2.1,
  history = [1.2, 2.5, 1.8, 4.0, 3.2, 8.5, 12.5, 6.2, 4.1, 5.0, 3.8, 2.6]
}) {
  const width = 280;
  const height = 75;
  const maxVal = Math.max(15, ...history);

  const points = history.map((val, idx) => {
    const x = (idx / (history.length - 1)) * width;
    const y = height - (val / maxVal) * (height - 10) - 5;
    return `${x},${y}`;
  });

  const pathD = `M ${points.join(' L ')}`;
  const areaD = `${pathD} L ${width},${height} L 0,${height} Z`;

  return (
    <div className="tt-metric-card">
      <div className="tt-card-top">
        <div className="tt-card-title-group">
          <Globe size={16} className="tt-card-title-icon" />
          <span>Rede</span>
        </div>
        <Info size={14} className="tt-card-info-icon" title="Tráfego de rede ativo em tempo real" />
      </div>

      <div className="tt-chart-canvas-container">
        {/* Marcadores de escala */}
        <div style={{ position: 'absolute', left: 0, top: 0, fontSize: '9px', color: '#64748b' }}>12.5 Mbps</div>
        <div style={{ position: 'absolute', left: 0, top: '40%', fontSize: '9px', color: '#64748b' }}>2.6 Mbps</div>
        <div style={{ position: 'absolute', left: 0, bottom: 0, fontSize: '9px', color: '#64748b' }}>0%</div>

        <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ paddingLeft: '32px' }}>
          <defs>
            <linearGradient id="netGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line x1="0" y1="10" x2={width} y2="10" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
          <line x1="0" y1="40" x2={width} y2="40" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
          <line x1="0" y1={height - 2} x2={width} y2={height - 2} stroke="rgba(255,255,255,0.08)" />

          {/* Área preenchida */}
          <path d={areaD} fill="url(#netGradient)" />

          {/* Linha ciano / neon */}
          <path
            d={pathD}
            fill="none"
            stroke="#38bdf8"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ filter: 'drop-shadow(0 0 5px rgba(56, 189, 248, 0.7))' }}
          />
        </svg>
      </div>

      <div className="tt-card-footer-stats">
        <span>Download: <strong>{downloadMbps} Mbps</strong></span>
        <span>Upload: <strong>{uploadMbps} Mbps</strong></span>
      </div>
    </div>
  );
}
