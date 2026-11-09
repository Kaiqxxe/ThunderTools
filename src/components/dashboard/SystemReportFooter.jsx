import React from 'react';
import { ExportPDFButton } from './ExportPDFButton';
import { ShieldCheck, HardDrive, RefreshCw } from 'lucide-react';

export function SystemReportFooter({ onExportPDF, onQuickClean, onRestartSpooler }) {
  return (
    <footer className="tt-report-footer">
      <div className="tt-footer-info">
        <div className="tt-footer-badge">
          <ShieldCheck size={14} />
          <span>Monitoramento de Hardware Ativo</span>
        </div>

        <span style={{ color: '#64748b' }}>•</span>

        <span style={{ fontSize: '12px', color: '#94a3b8' }}>
          ThunderTools v1.1.1 (Windows Enterprise 64-bit)
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {onQuickClean && (
          <button
            type="button"
            className="tt-header-icon-btn"
            style={{
              border: '1px solid var(--border-subtle)',
              padding: '8px 14px',
              fontSize: '12px',
              gap: '6px',
              color: '#cbd5e1'
            }}
            onClick={onQuickClean}
            title="Limpeza rápida de arquivos temporários"
          >
            <HardDrive size={14} />
            Limpar Temporários
          </button>
        )}

        {onRestartSpooler && (
          <button
            type="button"
            className="tt-header-icon-btn"
            style={{
              border: '1px solid var(--border-subtle)',
              padding: '8px 14px',
              fontSize: '12px',
              gap: '6px',
              color: '#cbd5e1'
            }}
            onClick={onRestartSpooler}
            title="Reiniciar Spooler de Impressão"
          >
            <RefreshCw size={14} />
            Reiniciar Spooler
          </button>
        )}

        <ExportPDFButton onExport={onExportPDF} />
      </div>
    </footer>
  );
}
