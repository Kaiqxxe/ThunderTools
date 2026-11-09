import React from 'react';
import { Cpu, MemoryStick, Thermometer } from 'lucide-react';

/**
 * Top Header Bar: SystemQuickStats consumindo IPC do Electron em tempo real.
 * Renderiza pill-badges com medidores e barras visuais.
 */
export function SystemQuickStats({ cpuUsage = 0, ramUsage = 0, temp = null }) {
  const getFillColorClass = (val) => {
    if (val > 85) return 'high';
    if (val > 60) return 'medium';
    return 'low';
  };

  return (
    <div className="tt-header-stats-group">
      {/* Pill CPU */}
      <div className="tt-pill-badge" title="Uso da CPU">
        <Cpu size={14} className="tt-card-title-icon" />
        <span className="tt-pill-label">CPU</span>
        <span className="tt-pill-val">{cpuUsage}%</span>
        <div className="tt-pill-bar">
          <div
            className={`tt-pill-bar-fill ${getFillColorClass(cpuUsage)}`}
            style={{ width: `${Math.min(100, Math.max(0, cpuUsage))}%` }}
          />
        </div>
      </div>

      {/* Pill RAM */}
      <div className="tt-pill-badge" title="Uso da Memória RAM">
        <MemoryStick size={14} className="tt-card-title-icon" />
        <span className="tt-pill-label">RAM</span>
        <span className="tt-pill-val">{ramUsage}%</span>
        <div className="tt-pill-bar">
          <div
            className={`tt-pill-bar-fill ${getFillColorClass(ramUsage)}`}
            style={{ width: `${Math.min(100, Math.max(0, ramUsage))}%` }}
          />
        </div>
      </div>

      {/* Pill Temperatura */}
      <div className="tt-pill-badge" title="Temperatura da CPU">
        <Thermometer size={14} style={{ color: temp && temp > 75 ? '#ef4444' : '#38bdf8' }} />
        <span className="tt-pill-label">TEMP</span>
        <span className="tt-pill-val">{temp !== null && temp !== undefined ? `${temp}°C` : '—'}</span>
      </div>
    </div>
  );
}
