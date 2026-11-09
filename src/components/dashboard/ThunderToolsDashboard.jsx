import React, { useState } from 'react';
import './dashboard.css';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { SystemDiagnosticBanner } from './SystemDiagnosticBanner';
import { MetricsGrid } from './MetricsGrid';
import { SystemReportFooter } from './SystemReportFooter';
import { useSystemMetrics } from './useSystemMetrics';

export function ThunderToolsDashboard() {
  const [activeTab, setActiveTab] = useState('inicio');
  const metrics = useSystemMetrics();

  // Ações de correção e manutenção integradas às rotas do app
  const handleFixIssues = async () => {
    if (window.api?.runTrackedCommand) {
      await window.api.runTrackedCommand('net stop spooler; net start spooler', 'restart-spooler');
    } else {
      console.log('Disparando correção rápida de serviços/logs...');
    }
  };

  const handleQuickClean = async () => {
    if (window.api?.runTrackedCommand) {
      await window.api.runTrackedCommand('Remove-Item -Path "$env:TEMP\\*" -Recurse -Force -ErrorAction SilentlyContinue', 'clean-temp');
    }
  };

  const handleRestartSpooler = async () => {
    if (window.api?.runTrackedCommand) {
      await window.api.runTrackedCommand('net stop spooler; net start spooler', 'restart-spooler');
    }
  };

  return (
    <div className="tt-app-layout">
      {/* 1. Sidebar Fixa à Esquerda */}
      <Sidebar activeTab={activeTab} onSelectTab={setActiveTab} />

      {/* Conteúdo à Direita */}
      <div className="tt-content-wrapper">
        {/* Header Fixo com QuickStats em Tempo Real */}
        <Header
          cpuUsage={metrics.cpu.usage}
          ramUsage={metrics.ram.percentage}
          temp={metrics.temp}
          onOpenSettings={() => setActiveTab('sistema')}
        />

        {/* Container Principal com Scroll */}
        <main className="tt-main-scrollable">
          {activeTab === 'inicio' ? (
            <>
              {/* 2. Seção Superior: Banner de Diagnóstico do Sistema */}
              <SystemDiagnosticBanner
                status={metrics.diagnostic.status}
                message={metrics.diagnostic.message}
                subtext={metrics.diagnostic.subtext}
                lastCheck={metrics.diagnostic.lastCheck}
                pendingIssues={metrics.diagnostic.pendingIssues}
                onFixIssues={handleFixIssues}
                onRefreshScan={() => console.log('Reescanear logs do sistema')}
              />

              {/* 3. Grid de Dashboards Interativos */}
              <MetricsGrid metrics={metrics} />

              {/* 4. Rodapé Técnico com Botão de Exportação PDF */}
              <SystemReportFooter
                onQuickClean={handleQuickClean}
                onRestartSpooler={handleRestartSpooler}
              />
            </>
          ) : (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94a3b8' }}>
              <h3>Seção {activeTab.toUpperCase()} selecionada</h3>
              <p style={{ fontSize: '13px', marginTop: '8px' }}>
                Conteúdo de ferramentas e manutenção integrado do ThunderTools.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default ThunderToolsDashboard;
