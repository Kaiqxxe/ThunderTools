import React from 'react';
import { Cpu, Info } from 'lucide-react';

export function CPUGraphCard({
  usage = 12,
  freq = 3.2,
  activeProcesses = 142,
  history = [10, 12, 11, 14, 20, 15, 12, 10, 16, 12]
}) {
  // Gera coordenadas SVG para a linha suave e área com gradiente
  const width = 280;
  const height = 75;
  const maxVal = Math.max(30, ...history);
  
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
          <Cpu size={16} className="tt-card-title-icon" />
          <span>CPU</span>
        </div>
        <Info size={14} className="tt-card-info-icon" title="Carga de processamento em tempo real" />
      </div>

      {/* Gráfico em Linha com Grid de Referência */}
      <div className="tt-chart-canvas-container">
        {/* Marcadores de escala */}
        <div style={{ position: 'absolute', left: 0, top: 0, fontSize: '9px', color: '#64748b' }}>20%</div>
        <div style={{ position: 'absolute', left: 0, top: '40%', fontSize: '9px', color: '#64748b' }}>12%</div>
        <div style={{ position: 'absolute', left: 0, bottom: 0, fontSize: '9px', color: '#64748b' }}>0%</div>

        <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ paddingLeft: '22px' }}>
          <defs>
            <linearGradient id="cpuGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#818cf8" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#818cf8" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line x1="0" y1="10" x2={width} y2="10" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
          <line x1="0" y1="40" x2={width} y2="40" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
          <line x1="0" y1={height - 2} x2={width} y2={height - 2} stroke="rgba(255,255,255,0.08)" />

          {/* Área preenchida com gradiente */}
          <path d={areaD} fill="url(#cpuGradient)" />

          {/* Linha com Glow Neon */}
          <path
            d={pathD}
            fill="none"
            stroke="#818cf8"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ filter: 'drop-shadow(0 0 4px rgba(129, 140, 248, 0.7))' }}
          />
        </svg>
      </div>

      <div className="tt-card-footer-stats">
        <span>Frequência: <strong>{freq} GHz</strong></span>
        <span>Processos ativos: <strong>{activeProcesses}</strong></span>
      </div>
    </div>
  );
}
