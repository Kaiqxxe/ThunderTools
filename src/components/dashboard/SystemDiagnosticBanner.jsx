import React from 'react';
import { CheckCircle2, AlertTriangle, Wrench, RefreshCw } from 'lucide-react';

export function SystemDiagnosticBanner({
  status = 'normal',
  message = 'Sistema Operando Normalmente',
  subtext = 'Nenhuma lentidão detectada em segundo plano. Métricas do Windows estão dentro dos padrões ideais.',
  lastCheck = 'Agora mesmo',
  pendingIssues = [],
  onFixIssues,
  onRefreshScan
}) {
  const isAttention = status === 'attention' || (pendingIssues && pendingIssues.length > 0);

  return (
    <section className={`tt-diagnostic-banner ${isAttention ? 'attention' : ''}`}>
      <div className="tt-diag-left">
        {/* Ícone de Estado com Glow */}
        <div className={`tt-diag-icon-wrapper ${isAttention ? 'attention' : ''}`}>
          {isAttention ? (
            <AlertTriangle size={26} />
          ) : (
            <CheckCircle2 size={26} />
          )}
        </div>

        {/* Informações Principais */}
        <div className="tt-diag-title-group">
          <h2>Diagnóstico do Sistema</h2>
          <div className={`tt-diag-headline ${isAttention ? 'attention' : ''}`}>
            {isAttention ? 'Pontos de Atenção Encontrados' : message}
          </div>
        </div>

        {/* Detalhes e Status de Logs do Windows */}
        <div className="tt-diag-details">
          <span>
            {isAttention
              ? `${pendingIssues.length} evento(s) ou falha(s) de serviço detectados no Windows Event Log.`
              : subtext}
          </span>
          <span className="tt-diag-subtext">
            Última verificação: {lastCheck}
          </span>
        </div>
      </div>

      {/* Gatilho de Ação: Botão Corrigir Agora */}
      <div>
        {isAttention ? (
          <button
            type="button"
            className="tt-fix-btn"
            onClick={onFixIssues}
            title="Executar correção automatizada"
          >
            <Wrench size={15} />
            Corrigir Agora
          </button>
        ) : (
          <button
            type="button"
            className="tt-header-icon-btn"
            style={{ border: '1px solid var(--border-subtle)', padding: '8px 12px', fontSize: '11px', gap: '6px' }}
            onClick={onRefreshScan}
            title="Verificar novamente"
          >
            <RefreshCw size={13} />
            Verificar Novamente
          </button>
        )}
      </div>
    </section>
  );
}
