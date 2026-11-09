import React from 'react';
import { Share2, Info, Layers } from 'lucide-react';

export function TopProcessesCard({
  processes = [
    { name: 'Processor.exe', id: 323, metric: '323 MB' },
    { name: 'System.exe', id: 196, metric: '196 MB' },
    { name: 'Windows.exe', id: 153, metric: '153 MB' }
  ]
}) {
  return (
    <div className="tt-metric-card">
      <div className="tt-card-top">
        <div className="tt-card-title-group">
          <Share2 size={16} className="tt-card-title-icon" />
          <span>Processos em Destaque</span>
        </div>
        <Info size={14} className="tt-card-info-icon" title="Processos com maior consumo de recursos no Windows" />
      </div>

      <div className="tt-process-list">
        {processes.map((proc, index) => (
          <div key={`${proc.name}-${index}`} className="tt-process-item">
            <div className="tt-process-name-group">
              <span className="tt-process-icon">
                <Layers size={11} />
              </span>
              <span style={{ color: '#f1f5f9', fontWeight: 500 }}>{proc.name}</span>
            </div>
            <span className="tt-process-val">{proc.id || proc.metric}</span>
          </div>
        ))}
      </div>

      <div className="tt-card-footer-stats">
        <span>Monitoramento: <strong style={{ color: '#22c55e' }}>Ativo</strong></span>
        <span>Prioridade: <strong>Alta</strong></span>
      </div>
    </div>
  );
}
