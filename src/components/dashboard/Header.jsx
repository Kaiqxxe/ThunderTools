import React from 'react';
import { Zap, Settings, Minus, Square, X } from 'lucide-react';
import { SystemQuickStats } from './SystemQuickStats';

export function Header({ cpuUsage, ramUsage, temp, onOpenSettings }) {
  const handleMinimize = () => {
    if (window.api?.minimizeWindow) window.api.minimizeWindow();
  };

  const handleMaximize = () => {
    if (window.api?.maximizeWindow) window.api.maximizeWindow();
  };

  const handleClose = () => {
    if (window.api?.closeWindow) window.api.closeWindow();
  };

  return (
    <header className="tt-header">
      {/* Brand / Logo */}
      <div className="tt-header-brand">
        <Zap size={22} className="tt-brand-logo" />
        <div>
          <div className="tt-brand-title">ThunderTools</div>
          <div className="tt-brand-subtitle">Ferramentas de Manutenção Windows</div>
        </div>
      </div>

      {/* Stats e Ações Rápidas */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <SystemQuickStats cpuUsage={cpuUsage} ramUsage={ramUsage} temp={temp} />

        <div className="tt-header-version">v1.1.1</div>

        <button
          type="button"
          className="tt-header-icon-btn"
          title="Configurações"
          onClick={onOpenSettings}
        >
          <Settings size={16} />
        </button>

        {/* Controles de Janela do Electron */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '6px' }}>
          <button type="button" className="tt-header-icon-btn" onClick={handleMinimize} title="Minimizar">
            <Minus size={14} />
          </button>
          <button type="button" className="tt-header-icon-btn" onClick={handleMaximize} title="Maximizar">
            <Square size={12} />
          </button>
          <button
            type="button"
            className="tt-header-icon-btn"
            style={{ color: '#ef4444' }}
            onClick={handleClose}
            title="Fechar"
          >
            <X size={15} />
          </button>
        </div>
      </div>
    </header>
  );
}
