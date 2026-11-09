
import { showRamInfoModal, updateLiveRamModalStats } from './ramInfoModal.js';

let currentToastFn = null;
let currentAddToHistoryFn = null;

export const METRIC_INFO_DETAILS = {
  diagnostico: {
    title: 'Diagnóstico do Sistema & Integridade',
    icon: 'activity',
    description: 'Analisa continuamente a saúde geral do Windows via logs de eventos nativos do sistema (wevtutil), filas do relatório de erros do Windows (WER), status dos serviços essenciais (Spooler, Windows Update) e telemetria de hardware para prevenir falhas e instabilidades.',
    normalText: 'Sem erros críticos recentes. Serviços vitais operando e telemetria em níveis saudáveis.',
    warningText: 'Alertas acumulados, alto uso temporário de recursos ou arquivos residuais volumosos.',
    criticalText: 'Falhas frequentes de sistema, serviços vitais parados ou recursos no limite.',
    tips: 'Clique no botão "Corrigir Agora" para purgar filas corrompidas e restabelecer serviços essenciais, ou use as abas Desempenho e Limpeza para manutenção avançada.'
  },
  cpu: {
    title: 'Processador (CPU)',
    icon: 'cpu',
    description: 'Monitora a taxa de ocupação total dos núcleos e threads do processador em tempo real, acompanhando a frequência de clock atual (GHz) e o volume de processos ativos do sistema operacional.',
    normalText: '0% a 50%: Uso equilibrado com ampla folga de processamento para qualquer tarefa.',
    warningText: '50% a 80%: Demanda moderada a alta (jogos, renderização ou múltiplos apps abertos).',
    criticalText: '80% a 100%: Sobrecarga crítica. O sistema pode apresentar engasgos e lentidão na resposta.',
    tips: 'Acesse a aba Desempenho para desativar serviços secundários e telemetrias, ou a aba Inicialização para desativar aplicativos que iniciam com o Windows.'
  },
  ram: {
    title: 'Memória RAM',
    icon: 'memory-stick',
    description: 'Mede o consumo da memória volátil de alta velocidade (RAM), detalhando a quantidade utilizada em gigabytes, o espaço livre disponível e a memória reservada em cache para carregamento ágil de aplicativos.',
    normalText: 'Abaixo de 70%: Folga ideal para abrir novos programas sem recorrer à memória virtual.',
    warningText: '70% a 85%: Carga elevada por navegadores com muitas abas ou softwares pesados.',
    criticalText: 'Acima de 85%: Risco iminente de travamento por paginação lenta no disco rígido.',
    tips: 'Feche abas ociosas do navegador. Na aba Limpeza, utilize a ferramenta Limpar Cache de Memória RAM para liberar blocos retidos imediatamente.'
  },
  temp: {
    title: 'Temperatura da CPU',
    icon: 'thermometer',
    description: 'Monitora em tempo real a temperatura térmica dos núcleos do processador (em °C), permitindo verificar a eficiência da dissipação de calor do cooler e pasta térmica.',
    normalText: '30°C a 65°C: Faixa ideal e saudável em repouso ou tarefas cotidianas.',
    warningText: '65°C a 80°C: Normal sob carga pesada, jogos ou renderizações prolongadas.',
    criticalText: 'Acima de 85°C: Risco térmico! O processador reduz clock (throttling) para não queimar.',
    tips: 'Verifique se há poeira no cooler e saídas de ar. Avalie a troca da pasta térmica se a temperatura permanecer acima de 80°C mesmo com o computador ocioso.'
  },
  disk: {
    title: 'Armazenamento (Disco C:)',
    icon: 'hard-drive',
    description: 'Acompanha a capacidade total e o espaço ocupado na partição principal do sistema operacional onde ficam instalados o Windows, drivers e os arquivos de paginação virtual.',
    normalText: 'Abaixo de 75%: Capacidade confortável para atualizações e arquivos temporários.',
    warningText: '75% a 90%: Atenção. O Windows começa a ter dificuldade com pontos de restauração.',
    criticalText: 'Acima de 90%: Crítico! Alto risco de congelamento geral e corrupção de inicialização.',
    tips: 'Vá até a aba Limpeza para remover arquivos temporários, relatórios antigos e caches do Windows Update, liberando gigabytes instantaneamente.'
  },
  net: {
    title: 'Tráfego de Rede & Conexão',
    icon: 'globe',
    description: 'Mede as taxas de transferência de download e upload em Megabits por segundo (Mbps) em todas as interfaces ativas de rede cabeada (Ethernet) e sem fio (Wi-Fi).',
    normalText: '0 a 5 Mbps em repouso: Tráfego saudável de sincronizações leves em segundo plano.',
    warningText: 'Tráfego constante: Downloads pesados em andamento, vídeos em 4K ou streaming ativo.',
    criticalText: 'Taxas altas sem atividade do usuário: Possível presença de malware, torrents ocultos ou telemetria invasiva.',
    tips: 'Na aba Rede, execute o comando de Flush DNS e redefinição de TCP/IP se a navegação estiver lenta mesmo com velocidade contratada normal.'
  },
  speed: {
    title: 'Velocidade de Transferência do Disco (C:)',
    icon: 'gauge',
    description: 'Velocímetro dinâmico em tempo real da velocidade combinada de leitura e gravação do armazenamento primário (SSD/HDD), medido em Megabytes por segundo (MB/s).',
    normalText: '0 a 50 MB/s: Operação rotineira com leituras rápidas e pontuais de arquivos.',
    warningText: '50 a 250 MB/s: Transferência rápida durante abertura de softwares pesados ou cópia de arquivos.',
    criticalText: 'Disco em 100% de atividade constante: Gargalo de I/O por serviços como SysMain em disco rígido mecânico.',
    tips: 'Se você usa SSD, acione a ferramenta Otimizar SSD (TRIM) na aba Disco. Se for HD convencional, utilize a Desfragmentação de Disco.'
  }
};

export function showHomeMetricInfoModal(type) {
  if (type === 'ram') {
    showRamInfoModal({
      toast: currentToastFn || window.toast,
      addToHistory: currentAddToHistoryFn || window.addToHistory
    });
    return;
  }

  let info = METRIC_INFO_DETAILS[type] ? { ...METRIC_INFO_DETAILS[type] } : null;
  if (!info) return;

  // Personalização contextual para o diagnóstico real do sistema
  if (type === 'disk') {
    const activeDisk = (lastReceivedDisks || []).find(d => d.mount === selectedDiskMount) || { mount: selectedDiskMount || 'C:', totalGB: 110, freeGB: 0.5, usage: 99, label: 'Windows' };
    info.title = `Armazenamento (${activeDisk.mount}${activeDisk.label ? ` - ${activeDisk.label}` : ''})`;
    const totLabel = activeDisk.totalGB >= 1000 ? `${(activeDisk.totalGB / 1024).toFixed(1)} TB` : `${activeDisk.totalGB} GB`;
    info.description = `Mede a capacidade e taxa de ocupação da partição ${activeDisk.mount}. Capacidade total: ${totLabel}, espaço livre atual: ${activeDisk.freeGB} GB (${activeDisk.usage}% ocupado).`;
    if (activeDisk.usage >= 90) {
      info.tips = `A unidade ${activeDisk.mount} está criticamente ocupada (${activeDisk.freeGB} GB livres). Utilize a aba Limpeza do ThunderTools ou a ferramenta nativa de Limpeza de Disco para desocupar espaço.`;
    }
  }

  if (type === 'diagnostico' && lastDiagnosticData) {
    const freeGB = lastDiagnosticData.freeGB ? parseFloat(lastDiagnosticData.freeGB).toFixed(1) : '10.0';
    if (lastDiagnosticData.issueType === 'both') {
      info.title = 'Diagnóstico IA: Armazenamento & Logs do Sistema';
      info.description = `A IA identificou tanto redução de espaço na partição C: (${freeGB} GB livres) quanto alertas nos logs de eventos do Windows (System / Application / CBS).`;
      info.tips = `Clique em "Corrigir Agora" para abrir o painel de Reparo Preventivo IA, que limpa caches/arquivos do Windows, restaura serviços, limpa logs corrompidos e permite rodar SFC /scannow e DISM /RestoreHealth com 1 clique.`;
    } else if (lastDiagnosticData.issueType === 'disk-space' || lastDiagnosticData.isDiskCritical || lastDiagnosticData.isDiskWarning || parseFloat(freeGB) < 15) {
      info.title = 'Diagnóstico IA: Espaço em Disco Reduzido';
      info.description = `A partição C: do sistema possui ${freeGB} GB livres. Quando o disco fica abaixo de 15 GB, o Windows pode sofrer degradação de desempenho, falhas com memória virtual (pagefile.sys) e interrupção de atualizações.`;
      info.warningText = 'Disco abaixo de 15 GB livres. O Windows pode limitar pontos de restauração e tarefas de manutenção.';
      info.criticalText = 'Disco abaixo de 5 GB livres. Risco iminente de corrupção, travamentos ou falhas de boot.';
      info.tips = `Solução Específica para Disco: Clique em "Corrigir Agora" para acionar a Limpeza de Disco e eliminação de arquivos do Windows (Lixeira, %TEMP%, SoftwareDistribution e relatórios WER), ou compactar a pasta WinSxS.`;
    } else if (lastDiagnosticData.issueType === 'system-events') {
      info.title = 'Diagnóstico IA: Alertas de Logs & Risco de Corrupção';
      info.description = lastDiagnosticData.aiSummary || 'Foram identificados registros de erro ou indícios de corrupção nos logs System, Application ou CBS nas últimas 48 horas.';
      info.tips = 'Solução Preventiva IA: Clique em "Corrigir Agora" para restaurar o Spooler e Windows Update, renovar DNS/Winsock, purgar logs corrompidos e executar comandos preventivos (SFC /scannow e DISM /RestoreHealth).';
    }
  }

  const existing = document.getElementById('tt-metric-info-modal-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'tt-metric-info-modal-overlay';
  overlay.className = 'modal-overlay';

  overlay.innerHTML = `
    <div class="modal tt-metric-modal" role="dialog" aria-modal="true">
      <div class="tt-metric-modal-header">
        <div class="tt-metric-modal-title">
          <i data-lucide="${info.icon}" style="width:22px;height:22px"></i>
          <span>${info.title}</span>
        </div>
        <button type="button" class="tt-metric-modal-close" id="btn-close-metric-modal" title="Fechar">
          <i data-lucide="x" style="width:16px;height:16px"></i>
        </button>
      </div>

      <!-- Seção O que Monitora -->
      <div class="tt-metric-section">
        <div class="tt-metric-sec-title">
          <i data-lucide="help-circle" style="width:15px;height:15px"></i>
          <span>O que esta função monitora</span>
        </div>
        <div class="tt-metric-sec-box">
          ${info.description}
        </div>
      </div>

      <!-- Seção Como Interpretar os Valores -->
      <div class="tt-metric-section">
        <div class="tt-metric-sec-title">
          <i data-lucide="bar-chart-2" style="width:15px;height:15px"></i>
          <span>Como interpretar os níveis de status</span>
        </div>
        <div class="tt-metric-status-grid">
          <div class="tt-metric-status-col normal">
            <span class="tt-metric-status-badge">
              <i data-lucide="check-circle" style="width:13px;height:13px"></i>
              Normal
            </span>
            <span class="tt-metric-status-text">${info.normalText}</span>
          </div>
          <div class="tt-metric-status-col warning">
            <span class="tt-metric-status-badge">
              <i data-lucide="alert-triangle" style="width:13px;height:13px"></i>
              Atenção
            </span>
            <span class="tt-metric-status-text">${info.warningText}</span>
          </div>
          <div class="tt-metric-status-col critical">
            <span class="tt-metric-status-badge">
              <i data-lucide="alert-octagon" style="width:13px;height:13px"></i>
              Crítico
            </span>
            <span class="tt-metric-status-text">${info.criticalText}</span>
          </div>
        </div>
      </div>

      <!-- Seção Dica do Técnico -->
      <div class="tt-metric-section">
        <div class="tt-metric-sec-title">
          <i data-lucide="lightbulb" style="width:15px;height:15px;color:#fbbf24"></i>
          <span>Dica do Técnico & Otimização ThunderTools</span>
        </div>
        <div class="tt-metric-tips-box">
          <i data-lucide="wrench" style="width:18px;height:18px;flex-shrink:0;margin-top:2px;color:#818cf8"></i>
          <div>${info.tips}</div>
        </div>
      </div>

      <div class="modal-buttons" style="margin-top: 8px; justify-content: flex-end;">
        <button type="button" class="modal-btn primary" id="btn-ok-metric-modal" style="min-width: 110px;">
          Entendido
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  if (window.lucide) window.lucide.createIcons();

  const closeModal = () => {
    overlay.remove();
    document.removeEventListener('keydown', onKeyDown);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') closeModal();
  };

  document.addEventListener('keydown', onKeyDown);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });

  const closeBtn = document.getElementById('btn-close-metric-modal');
  if (closeBtn) closeBtn.onclick = closeModal;

  const okBtn = document.getElementById('btn-ok-metric-modal');
  if (okBtn) okBtn.onclick = closeModal;
}

/**
 * Controller do Dashboard em Tempo Real para ThunderTools (Vanilla / Electron IPC)
 * Gerencia os gráficos em canvas e atualização de métricas 100% REAIS de hardware.
 */

let cpuHistory = [];
let selectedDiskMount = (() => {
  try { return localStorage.getItem('thundertools_selected_disk') || 'C:'; } catch (_) { return 'C:'; }
})();
let lastReceivedDisks = [];
let netHistory = [];
let isDashboardInitialized = false;
let lastDiagnosticData = null;
let completedAiCommands = new Set();

export function initDashboardController(options = {}) {
  if (options && options.toast) currentToastFn = options.toast;
  if (options && options.addToHistory) currentAddToHistoryFn = options.addToHistory;
  if (isDashboardInitialized) return;
  isDashboardInitialized = true;

  const cpuCanvas = document.getElementById('cpu-chart-canvas');
  const netCanvas = document.getElementById('net-chart-canvas');
  const btnExportPdf = document.getElementById('btn-export-pdf');
  const btnRefreshDiag = document.getElementById('btn-refresh-diag');
  const btnFixIssues = document.getElementById('btn-fix-issues');
  const dashDiskSelect = document.getElementById('dash-disk-select');
  if (dashDiskSelect) {
    dashDiskSelect.addEventListener('change', () => {
      selectedDiskMount = dashDiskSelect.value;
      try { localStorage.setItem('thundertools_selected_disk', selectedDiskMount); } catch (_) {}
      renderActiveDiskMetric();
    });
  }

  // Inicializa gráficos vazios ou com base real
  drawWaveChart(cpuCanvas, cpuHistory.length ? cpuHistory : [0, 0, 0, 0, 0], '#818cf8', 'rgba(129, 140, 248, 0.35)', 100);
  drawWaveChart(netCanvas, netHistory.length ? netHistory : [0, 0, 0, 0, 0], '#38bdf8', 'rgba(56, 189, 248, 0.35)', 1.0);

  function showReportFormatModal(onSelect) {
    const existing = document.getElementById('report-format-modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'report-format-modal-overlay';
    overlay.className = 'modal-overlay';

    overlay.innerHTML = `
      <div class="modal details-modal" role="dialog" aria-modal="true" style="width: min(720px, 94vw); max-width: 720px; padding: 20px 24px;">
        <button class="modal-close-icon-btn" id="rf-close-x" title="Fechar (Esc)">
          <i data-lucide="x" style="width:16px;height:16px"></i>
        </button>

        <div class="details-modal-header" style="margin-bottom: 14px;">
          <div class="details-header-lead">
            <div class="details-header-icon-box" style="background: linear-gradient(135deg, rgba(99, 102, 241, 0.22) 0%, rgba(56, 189, 248, 0.18) 100%); border-color: rgba(99, 102, 241, 0.4); color: #818cf8;">
              <i data-lucide="file-down" style="width:22px;height:22px"></i>
            </div>
            <div class="details-header-text">
              <div class="details-modal-title">
                <span>Exportar Relatório do Sistema (PDF)</span>
                <span class="details-count-pill">Thunder Sistemas</span>
              </div>
              <div class="details-modal-desc">Selecione o formato de relatório que melhor atende à sua necessidade:</div>
            </div>
          </div>
        </div>

        <div id="rf-selection-view">
          <div id="rf-status-banner" style="display: none; margin-bottom: 14px; padding: 11px 14px; border-radius: 10px; font-size: 12.5px; line-height: 1.45; align-items: center; gap: 10px;"></div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px; margin-bottom: 18px;">
            <!-- Card 1: Relatório Técnico -->
            <div class="ping-stat-card" style="padding: 18px; display: flex; flex-direction: column; justify-content: space-between; border: 1px solid rgba(99, 102, 241, 0.3); background: linear-gradient(135deg, rgba(20, 27, 45, 0.75) 0%, rgba(13, 18, 32, 0.65) 100%); border-radius: 12px;">
              <div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                  <span class="details-count-pill" style="color: #818cf8; background: rgba(99, 102, 241, 0.15); border: 1px solid rgba(99, 102, 241, 0.35); font-size: 10.5px; font-weight: 700;">Para Técnicos & TI</span>
                  <i data-lucide="file-code" style="width:18px;height:18px;color:#818cf8;"></i>
                </div>
                <div style="font-size: 16px; font-weight: 700; color: #f8fafc; margin-bottom: 6px;">Relatório Técnico Completo</div>
                <div style="font-size: 12px; color: #94a3b8; line-height: 1.5; margin-bottom: 18px;">
                  Documento aprofundado separado em 6 categorias com especificações de hardware, slots RAM, partições, rede e diagnóstico IA dos logs do Windows.
                </div>
              </div>
              <button type="button" class="modal-btn primary" id="btn-select-tech" style="width: 100%; padding: 10px 16px; font-size: 13px;">
                <i data-lucide="download" style="width:15px;height:15px"></i> Gerar Relatório Técnico
              </button>
            </div>

            <!-- Card 2: Relatório Simplificado -->
            <div class="ping-stat-card" style="padding: 18px; display: flex; flex-direction: column; justify-content: space-between; border: 1px solid rgba(56, 189, 248, 0.3); background: linear-gradient(135deg, rgba(15, 23, 42, 0.75) 0%, rgba(10, 15, 30, 0.65) 100%); border-radius: 12px;">
              <div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                  <span class="details-count-pill" style="color: #38bdf8; background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.35); font-size: 10.5px; font-weight: 700;">Para o Cliente / Executivo</span>
                  <i data-lucide="file-check" style="width:18px;height:18px;color:#38bdf8;"></i>
                </div>
                <div style="font-size: 16px; font-weight: 700; color: #f8fafc; margin-bottom: 6px;">Relatório Simplificado</div>
                <div style="font-size: 12px; color: #94a3b8; line-height: 1.5; margin-bottom: 18px;">
                  Visual limpo em linguagem acessível sem jargões. Apresenta o selo de saúde do computador, capacidade de armazenamento e parecer técnico.
                </div>
              </div>
              <button type="button" class="modal-btn primary" id="btn-select-simple" style="width: 100%; padding: 10px 16px; font-size: 13px; background: linear-gradient(135deg, #0284c7, #2563eb); box-shadow: 0 4px 12px rgba(2, 132, 199, 0.35);">
                <i data-lucide="download" style="width:15px;height:15px"></i> Gerar Relatório Simplificado
              </button>
            </div>
          </div>

          <div class="details-modal-footer" style="margin-top: 12px; justify-content: flex-end;">
            <button type="button" class="modal-btn secondary" id="rf-close-btn" style="padding: 8px 22px; font-size: 12px;">
              <i data-lucide="x" style="width:14px;height:14px"></i> Fechar
            </button>
          </div>
        </div>

        <!-- Tela de Confirmação de Sucesso no próprio Modal -->
        <div id="rf-success-view" style="display: none; padding: 8px 4px 4px 4px;">
          <div style="background: linear-gradient(135deg, rgba(16, 185, 129, 0.14) 0%, rgba(15, 23, 42, 0.85) 100%); border: 1px solid rgba(16, 185, 129, 0.4); border-radius: 14px; padding: 20px; margin-bottom: 16px;">
            <div style="display: flex; align-items: center; gap: 14px; margin-bottom: 12px;">
              <div style="width: 44px; height: 44px; border-radius: 12px; background: rgba(16, 185, 129, 0.2); border: 1px solid rgba(16, 185, 129, 0.45); display: flex; align-items: center; justify-content: center; color: #34d399; flex-shrink: 0;">
                <i data-lucide="check-circle-2" style="width:24px;height:24px"></i>
              </div>
              <div>
                <div id="rf-success-title" style="font-size: 16px; font-weight: 800; color: #ecfdf5; margin-bottom: 2px;">Relatório PDF Gerado com Sucesso!</div>
                <div style="font-size: 12px; color: #a7f3d0;">O diagnóstico foi estruturado por categorias e salvo no seu computador.</div>
              </div>
            </div>
            <div style="background: rgba(2, 6, 23, 0.65); border: 1px solid rgba(148, 163, 184, 0.2); border-radius: 8px; padding: 10px 12px; font-family: 'Consolas', monospace; font-size: 11.5px; color: #e2e8f0; word-break: break-all;">
              <span style="color: #94a3b8; font-family: inherit; font-weight: 700;">Local salvo:</span> <span id="rf-saved-path"></span>
            </div>
          </div>

          <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px;">
            <div style="display: flex; flex-wrap: wrap; gap: 8px;">
              <button type="button" class="modal-btn primary" id="rf-btn-open-pdf" style="padding: 9px 16px; font-size: 12.5px; background: linear-gradient(135deg, #059669, #10b981);">
                <i data-lucide="external-link" style="width:15px;height:15px"></i> Abrir PDF Agora
              </button>
              <button type="button" class="modal-btn secondary" id="rf-btn-open-folder" style="padding: 9px 14px; font-size: 12.5px;">
                <i data-lucide="folder-open" style="width:15px;height:15px"></i> Mostrar na Pasta
              </button>
              <button type="button" class="modal-btn secondary" id="rf-btn-another" style="padding: 9px 14px; font-size: 12.5px;">
                <i data-lucide="repeat" style="width:14px;height:14px"></i> Gerar Outro Formato
              </button>
            </div>
            <button type="button" class="modal-btn secondary" id="rf-btn-done" style="padding: 9px 20px; font-size: 12.5px;">
              Concluir
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    if (window.lucide) window.lucide.createIcons({ root: overlay });

    let isGenerating = false;
    let lastSavedPath = '';

    function close() {
      if (isGenerating) return;
      overlay.remove();
      document.removeEventListener('keydown', onKeyDown);
    }

    function onKeyDown(e) {
      if (e.key === 'Escape' && !isGenerating) close();
    }

    document.addEventListener('keydown', onKeyDown);
    overlay.querySelector('#rf-close-x').addEventListener('click', close);
    overlay.querySelector('#rf-close-btn').addEventListener('click', close);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay && !isGenerating) close();
    });

    const btnTech = overlay.querySelector('#btn-select-tech');
    const btnSimple = overlay.querySelector('#btn-select-simple');
    const statusBanner = overlay.querySelector('#rf-status-banner');
    const selectionView = overlay.querySelector('#rf-selection-view');
    const successView = overlay.querySelector('#rf-success-view');
    const successTitle = overlay.querySelector('#rf-success-title');
    const savedPathEl = overlay.querySelector('#rf-saved-path');

    const techOriginalHtml = btnTech.innerHTML;
    const simpleOriginalHtml = btnSimple.innerHTML;

    function setBanner(type, htmlText) {
      if (!statusBanner) return;
      statusBanner.style.display = 'flex';
      if (type === 'loading') {
        statusBanner.style.background = 'rgba(79, 70, 229, 0.16)';
        statusBanner.style.border = '1px solid rgba(129, 140, 248, 0.4)';
        statusBanner.style.color = '#e0e7ff';
      } else if (type === 'warning') {
        statusBanner.style.background = 'rgba(245, 158, 11, 0.14)';
        statusBanner.style.border = '1px solid rgba(251, 191, 36, 0.4)';
        statusBanner.style.color = '#fde68a';
      } else if (type === 'error') {
        statusBanner.style.background = 'rgba(239, 68, 68, 0.16)';
        statusBanner.style.border = '1px solid rgba(248, 113, 113, 0.45)';
        statusBanner.style.color = '#fecaca';
      }
      statusBanner.innerHTML = htmlText;
    }

    function restoreButtons() {
      isGenerating = false;
      btnTech.disabled = false;
      btnSimple.disabled = false;
      btnTech.innerHTML = techOriginalHtml;
      btnSimple.innerHTML = simpleOriginalHtml;
      if (window.lucide) window.lucide.createIcons({ root: overlay });
    }

    // Verifica se o processo principal (main.js) ainda está na versão antiga em memória (apenas Ctrl+R foi usado)
    if (window.api?.openFilePath) {
      window.api.openFilePath('').catch((err) => {
        if (err && /No handler registered/i.test(err.message || '')) {
          setBanner(
            'warning',
            `
              <div style="display:flex; align-items:center; justify-content:space-between; width:100%; gap:12px; flex-wrap:wrap;">
                <span>⚡ <strong>Atenção:</strong> O aplicativo foi recarregado apenas com <code>Ctrl+R</code> e o motor antigo (lento) ainda está na memória do Windows. Reinicie o ThunderTools para ativar a geração instantânea (&lt; 1s) e o novo visual dos PDFs:</span>
                <button type="button" id="rf-btn-restart-app" class="modal-btn primary" style="padding:7px 14px; font-size:12px; background:#d97706; white-space:nowrap;">
                  Reiniciar ThunderTools Agora
                </button>
              </div>
            `
          );
          const btnRestart = overlay.querySelector('#rf-btn-restart-app');
          if (btnRestart) {
            btnRestart.addEventListener('click', async () => {
              btnRestart.disabled = true;
              btnRestart.textContent = 'Reiniciando...';
              if (window.api?.runCommand) {
                window.api.runCommand('powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Milliseconds 700; Start-Process cmd.exe -ArgumentList \'/c npm start\' -WorkingDirectory \'c:\\Users\\Administrador\\ThunderTools\' -WindowStyle Hidden"');
              }
              setTimeout(() => {
                if (window.api?.closeWindow) window.api.closeWindow();
              }, 300);
            });
          }
        }
      });
    }

    async function handleGenerate(reportType, clickedBtn) {
      if (isGenerating) return;
      isGenerating = true;
      btnTech.disabled = true;
      btnSimple.disabled = true;
      clickedBtn.innerHTML = '<div class="tt-spinner"></div> Gerando PDF...';
      setBanner(
        'loading',
        '<div class="tt-spinner" style="flex-shrink:0;"></div><span>Escolha o local para salvar na janela do Windows e aguarde alguns segundos enquanto o relatório em PDF é montado...</span>'
      );

      try {
        const res = await onSelect(reportType);
        if (res && res.success) {
          isGenerating = false;
          lastSavedPath = res.filePath || '';
          const typeLabel = reportType === 'simplified' ? 'Relatório Simplificado (Cliente)' : 'Dossiê Técnico Completo (TI)';
          if (successTitle) successTitle.textContent = `${typeLabel} Gerado com Sucesso!`;
          if (savedPathEl) savedPathEl.textContent = lastSavedPath || 'Documento salvo com sucesso.';
          if (selectionView) selectionView.style.display = 'none';
          if (successView) successView.style.display = 'block';
          if (window.lucide) window.lucide.createIcons({ root: overlay });
        } else if (res && res.cancelled) {
          restoreButtons();
          setBanner(
            'warning',
            '<span>⚠️ <strong>Exportação cancelada:</strong> Nenhum arquivo foi salvo. Selecione um dos formatos abaixo quando quiser gerar o PDF.</span>'
          );
        } else {
          restoreButtons();
          const errDetail = res && res.error ? res.error : 'Não foi possível concluir a geração do arquivo PDF.';
          setBanner(
            'error',
            `<span>❌ <strong>Falha ao gerar o relatório PDF:</strong> ${errDetail}</span>`
          );
        }
      } catch (err) {
        restoreButtons();
        setBanner(
          'error',
          `<span>❌ <strong>Erro inesperado ao gerar PDF:</strong> ${err.message || 'Falha de comunicação.'}</span>`
        );
      }
    }

    btnTech.addEventListener('click', () => handleGenerate('technical', btnTech));
    btnSimple.addEventListener('click', () => handleGenerate('simplified', btnSimple));

    const btnOpenPdf = overlay.querySelector('#rf-btn-open-pdf');
    if (btnOpenPdf) {
      btnOpenPdf.addEventListener('click', async () => {
        if (!lastSavedPath) return;
        try {
          if (window.api?.openFilePath) {
            const r = await window.api.openFilePath(lastSavedPath);
            if (r && r.success) return;
          }
        } catch (_) {}
        if (window.api?.runCommand) {
          await window.api.runCommand(`start "" "${lastSavedPath}"`);
        }
      });
    }

    const btnOpenFolder = overlay.querySelector('#rf-btn-open-folder');
    if (btnOpenFolder) {
      btnOpenFolder.addEventListener('click', async () => {
        if (!lastSavedPath) return;
        try {
          if (window.api?.showItemInFolder) {
            const r = await window.api.showItemInFolder(lastSavedPath);
            if (r && r.success) return;
          }
        } catch (_) {}
        if (window.api?.runCommand) {
          await window.api.runCommand(`explorer.exe /select,"${lastSavedPath}"`);
        }
      });
    }

    const btnAnother = overlay.querySelector('#rf-btn-another');
    if (btnAnother) {
      btnAnother.addEventListener('click', () => {
        if (statusBanner) statusBanner.style.display = 'none';
        restoreButtons();
        if (successView) successView.style.display = 'none';
        if (selectionView) selectionView.style.display = 'block';
      });
    }

    const btnDone = overlay.querySelector('#rf-btn-done');
    if (btnDone) {
      btnDone.addEventListener('click', close);
    }
  }

  // Botão Exportar PDF com escolha de formato (Técnico ou Simplificado)
  if (btnExportPdf) {
    btnExportPdf.addEventListener('click', () => {
      showReportFormatModal(async (reportType) => {
        btnExportPdf.disabled = true;
        const originalHtml = btnExportPdf.innerHTML;
        btnExportPdf.innerHTML = `
          <div class="tt-spinner"></div>
          <span>Gerando Relatório...</span>
        `;

        try {
          if (window.api?.exportSystemReportPDF) {
            const res = await window.api.exportSystemReportPDF(reportType);
            if (res && res.success) {
              const typeName = reportType === 'simplified' ? 'Simplificado' : 'Técnico';
              if (typeof window.toast === 'function') {
                window.toast('success', 'Relatório PDF Exportado', `O Relatório ${typeName} foi gerado e salvo com sucesso!`);
              }
              btnExportPdf.innerHTML = `
                <i data-lucide="check" style="width:16px;height:16px;color:#86efac"></i>
                <span>Relatório Salvo!</span>
              `;
            } else {
              if (res && !res.cancelled && typeof window.toast === 'function') {
                window.toast('error', 'Erro ao Gerar PDF', res.error || 'Não foi possível exportar o relatório.');
              }
              btnExportPdf.innerHTML = originalHtml;
            }
            return res;
          }
          return { success: false, error: 'API de exportação indisponível.' };
        } catch (err) {
          console.error('Erro na exportação de PDF:', err);
          if (typeof window.toast === 'function') {
            window.toast('error', 'Erro ao Gerar PDF', err.message || 'Falha ao exportar relatório.');
          }
          btnExportPdf.innerHTML = originalHtml;
          return { success: false, error: err.message };
        } finally {
          if (window.lucide) window.lucide.createIcons();
          setTimeout(() => {
            btnExportPdf.disabled = false;
            btnExportPdf.innerHTML = originalHtml;
            if (window.lucide) window.lucide.createIcons();
          }, 3000);
        }
      });
    });
  }

  // Diagnóstico do Sistema com Auditoria Robusta e Prazos Periódicos
  const runDiagnosticsCheck = async (options = {}) => {
    try {
      if (window.api?.getSystemDiagnostics) {
        const diag = await window.api.getSystemDiagnostics(options);
        lastDiagnosticData = diag;
        updateDiagnosticBanner(diag);
      }
    } catch (err) {
      console.warn('Erro ao obter diagnóstico:', err);
    }
  };

  if (btnRefreshDiag) {
    btnRefreshDiag.addEventListener('click', async () => {
      if (btnRefreshDiag.disabled) return;
      btnRefreshDiag.disabled = true;
      const originalHtml = `
        <i data-lucide="refresh-cw" style="width:14px;height:14px"></i>
        <span>Verificar Novamente</span>
      `;
      btnRefreshDiag.innerHTML = `
        <span class="tt-spinner" style="width:12px;height:12px;border-width:2px;display:inline-block;"></span>
        <span>Verificando...</span>
      `;
      try {
        await runDiagnosticsCheck({ force: true });
        if (typeof window.toast === 'function') {
          window.toast('info', 'Auditoria Concluída', 'Métricas de integridade e serviços verificadas com sucesso.');
        }
      } finally {
        setTimeout(() => {
          btnRefreshDiag.disabled = false;
          btnRefreshDiag.innerHTML = originalHtml;
          if (window.lucide) window.lucide.createIcons();
        }, 400);
      }
    });
  }

  // Seletor de Periodicidade da Verificação Automática (4h, 24h, 7d)
  const diagScheduleSelect = document.getElementById('diag-schedule-select');
  if (diagScheduleSelect) {
    diagScheduleSelect.addEventListener('change', async () => {
      const hours = parseInt(diagScheduleSelect.value, 10) || 24;
      try {
        if (window.api?.setDiagnosticSchedule) {
          const res = await window.api.setDiagnosticSchedule(hours);
          if (res && res.nextCheckFormatted) {
            const nextEl = document.getElementById('diag-next-check');
            if (nextEl) nextEl.textContent = res.nextCheckFormatted;
          }
          if (typeof window.toast === 'function') {
            const label = hours === 4 ? 'A cada 4 Horas' : (hours === 168 ? 'Semanalmente (A cada 7 dias)' : 'Diariamente (A cada 24 Horas)');
            window.toast('success', 'Periodicidade Atualizada', `Verificação automática configurada para: ${label}.`);
          }
        }
      } catch (err) {
        console.warn('Erro ao atualizar agendamento:', err);
      }
    });
  }

  // Agendador Periódico Automático em Segundo Plano
  let periodicDiagnosticTimer = setInterval(async () => {
    try {
      if (window.api?.getDiagnosticSchedule) {
        const sched = await window.api.getDiagnosticSchedule();
        if (sched && sched.nextScheduledCheck && Date.now() >= sched.nextScheduledCheck) {
          console.log('[ThunderTools] Prazo periódico atingido. Executando auditoria programada...');
          await runDiagnosticsCheck();
        }
      }
    } catch (_) {}
  }, 60000);

  async function showRepairPlanModal(diag) {
    const existing = document.getElementById('repair-modal-overlay');
    if (existing) existing.remove();
    const existingDock = document.getElementById('repair-floating-dock');
    if (existingDock) existingDock.remove();

    let currentDiag = diag || lastDiagnosticData;
    if (!currentDiag && window.api?.getSystemDiagnostics) {
      try {
        currentDiag = await window.api.getSystemDiagnostics();
        lastDiagnosticData = currentDiag;
      } catch (_) {}
    }
    currentDiag = currentDiag || {};

    const freeGB = currentDiag.freeGB !== undefined ? parseFloat(currentDiag.freeGB).toFixed(1) : '10.0';
    const freeGBNum = parseFloat(freeGB);

    const isAlreadyOptimized = currentDiag.status === 'normal' || !!currentDiag.hasSolvedIssues;
    let issueType = currentDiag.issueType;

    if (isAlreadyOptimized) {
      issueType = 'normal';
    } else if (!issueType || issueType === 'normal') {
      const hasEvents = (currentDiag.pendingIssues && currentDiag.pendingIssues.length > 0) || (currentDiag.aiCorruptions && currentDiag.aiCorruptions.length > 0);
      const hasLowDisk = currentDiag.isDiskCritical || currentDiag.isDiskWarning || freeGBNum < 15;
      if (hasLowDisk && hasEvents) {
        issueType = 'both';
      } else if (hasLowDisk) {
        issueType = 'disk-space';
      } else if (hasEvents) {
        issueType = 'system-events';
      } else {
        issueType = 'both';
      }
    }

    const aiSummary = currentDiag.aiSummary || 'Analisamos os logs do Windows (System, Application e CBS) e o estado das partições para prevenir que falhas silenciosas corrompam o sistema.';
    const aiCorruptions = Array.isArray(currentDiag.aiCorruptions) ? currentDiag.aiCorruptions : [];
    const aiRecommendedCommands = Array.isArray(currentDiag.aiRecommendedCommands) && currentDiag.aiRecommendedCommands.length > 0
      ? currentDiag.aiRecommendedCommands
      : [
          {
            id: 'rec-sfc',
            title: 'Reparar Arquivos do Sistema (SFC /scannow)',
            cmd: 'sfc /scannow',
            badge: 'Essencial',
            icon: 'shield-check',
            color: '#10b981',
            reason: 'Verifica todos os arquivos protegidos do Windows e substitui automaticamente DLLs corrompidas.'
          },
          {
            id: 'rec-dism-restore',
            title: 'Restaurar Imagem do Windows (DISM /RestoreHealth)',
            cmd: 'DISM /Online /Cleanup-Image /RestoreHealth',
            badge: 'Reparo Profundo',
            icon: 'wrench',
            color: '#818cf8',
            reason: 'Restaura a integridade da loja de componentes (WinSxS) usando a base oficial da Microsoft.'
          }
        ];

    const overlay = document.createElement('div');
    overlay.id = 'repair-modal-overlay';
    overlay.className = 'modal-overlay';

    let modalTitle = isAlreadyOptimized
      ? 'Diagnóstico Inteligente & Integridade (Otimizado)'
      : 'Diagnóstico Inteligente & Reparo Preventivo';
    let pillText = isAlreadyOptimized
      ? '✔ Sistema Otimizado'
      : `Disco C: (${freeGB} GB Livres)`;
    let pillColor = isAlreadyOptimized ? '#34d399' : '#f59e0b';
    let pillBg = isAlreadyOptimized ? 'rgba(16, 185, 129, 0.16)' : 'rgba(245, 158, 11, 0.15)';
    let pillBorder = isAlreadyOptimized ? 'rgba(16, 185, 129, 0.4)' : 'rgba(245, 158, 11, 0.35)';
    let issueSummary = isAlreadyOptimized
      ? 'Todas as correções recomendadas foram concluídas e verificadas com sucesso. O sistema está protegido contra instabilidades e erros.'
      : `Veja abaixo o que foi encontrado no seu computador, execute a limpeza automática em 1 clique ou rode os comandos preventivos do Windows.`;

    let tasks = [];

    if (issueType === 'disk-space') {
      modalTitle = 'Limpeza de Disco e Proteção do Windows';
      pillText = `Pouco Espaço (${freeGB} GB Livres)`;
      issueSummary = `A unidade C: está com apenas ${freeGB} GB disponíveis. Libere espaço automaticamente abaixo para evitar travamentos e falhas de atualização.`;
      tasks = [
        {
          id: 'task-softwaredist',
          icon: 'download',
          iconColor: '#818cf8',
          title: 'Limpar Cache de Atualizações (Windows Update)',
          desc: 'Remove instaladores antigos acumulados na pasta SoftwareDistribution\\Download.'
        },
        {
          id: 'task-recycle',
          icon: 'trash',
          iconColor: '#38bdf8',
          title: 'Esvaziar Lixeira do Windows',
          desc: 'Remove definitivamente os arquivos descartados na lixeira de todas as unidades.'
        },
        {
          id: 'task-temp',
          icon: 'folder-minus',
          iconColor: '#a855f7',
          title: 'Limpar Pastas Temporárias (%TEMP% e Windows\\Temp)',
          desc: 'Exclui com segurança arquivos temporários de programas e do sistema.'
        },
        {
          id: 'task-browser-cache',
          icon: 'globe',
          iconColor: '#38bdf8',
          title: 'Limpar Cache de Navegadores (Chrome e Edge)',
          desc: 'Libera espaço ocupado por arquivos temporários de páginas da internet.'
        },
        {
          id: 'task-wer',
          icon: 'shield-alert',
          iconColor: '#f59e0b',
          title: 'Remover Relatórios de Erros e Despejos (WER / Dumps)',
          desc: 'Apaga logs antigos de falhas e despejos de memória que ocupam espaço.'
        },
        {
          id: 'task-audit',
          icon: 'hard-drive',
          iconColor: '#10b981',
          title: 'Conferir Espaço Total Recuperado no Disco C:',
          desc: 'Calcula quantos megabytes foram liberados após a limpeza.'
        }
      ];
    } else if (issueType === 'system-events') {
      pillText = 'Alertas de Logs & Serviços';
      modalTitle = 'Restauração de Serviços e Prevenção de Corrupção';
      pillColor = '#38bdf8';
      pillBg = 'rgba(56, 189, 248, 0.15)';
      pillBorder = 'rgba(56, 189, 248, 0.35)';
      issueSummary = 'Identificamos falhas recentes nos logs do Windows. Restaure os serviços essenciais abaixo e utilize os comandos recomendados para blindar o sistema.';
      tasks = [
        {
          id: 'task-dns',
          icon: 'globe',
          iconColor: '#38bdf8',
          title: 'Renovar Cache DNS e Rede (Winsock)',
          desc: 'Limpa o cache DNS (ipconfig /flushdns) e redefine conexões de rede (winsock reset).'
        },
        {
          id: 'task-spooler',
          icon: 'printer',
          iconColor: '#818cf8',
          title: 'Reiniciar Serviço de Impressão (Spooler)',
          desc: 'Restaura o Spooler de impressão e ativa sua inicialização automática.'
        },
        {
          id: 'task-wuauserv',
          icon: 'refresh-cw',
          iconColor: '#a855f7',
          title: 'Destravar Serviços do Windows Update e BITS',
          desc: 'Reinicia os serviços de atualização do Windows para corrigir filas travadas.'
        },
        {
          id: 'task-logs',
          icon: 'shield-check',
          iconColor: '#10b981',
          title: 'Limpar Filas de Erro do Visualizador de Eventos',
          desc: 'Zera alertas antigos acumulados nos logs System, Application e WER.'
        }
      ];
    } else {
      modalTitle = isAlreadyOptimized
        ? 'Diagnóstico do Sistema & Integridade (100% Otimizado)'
        : 'Diagnóstico Inteligente & Reparo Completo';
      pillText = isAlreadyOptimized ? '✔ Sistema Otimizado' : 'Manutenção Completa + IA';
      pillColor = isAlreadyOptimized ? '#34d399' : '#c084fc';
      pillBg = isAlreadyOptimized ? 'rgba(16, 185, 129, 0.16)' : 'rgba(168, 85, 247, 0.16)';
      pillBorder = isAlreadyOptimized ? 'rgba(16, 185, 129, 0.4)' : 'rgba(168, 85, 247, 0.4)';
      issueSummary = isAlreadyOptimized
        ? 'Todas as correções recomendadas foram concluídas e verificadas. O Windows opera com máxima estabilidade e sem alertas ativos.'
        : 'Confira abaixo o diagnóstico de estabilidade do Windows, aplique a limpeza automática e execute os comandos preventivos contra corrupção.';
      tasks = [
        {
          id: 'task-softwaredist',
          icon: 'download',
          iconColor: '#818cf8',
          title: 'Limpar Cache do Windows Update (SoftwareDistribution)',
          desc: 'Pausa o serviço de update e remove pacotes de atualização antigos.'
        },
        {
          id: 'task-recycle',
          icon: 'trash',
          iconColor: '#38bdf8',
          title: 'Esvaziar Lixeira, Temporários (%TEMP%) e Relatórios WER',
          desc: 'Remove arquivos descartados, pastas temporárias e despejos de erro do Windows.'
        },
        {
          id: 'task-dns',
          icon: 'globe',
          iconColor: '#a855f7',
          title: 'Renovar Cache DNS e Catálogo de Rede (Winsock)',
          desc: 'Executa ipconfig /flushdns e netsh winsock reset para corrigir a conectividade.'
        },
        {
          id: 'task-spooler',
          icon: 'printer',
          iconColor: '#38bdf8',
          title: 'Restaurar Serviços Essenciais (Spooler, Update e BITS)',
          desc: 'Reinicia e normaliza os serviços vitais do sistema operacional.'
        },
        {
          id: 'task-logs',
          icon: 'shield-check',
          iconColor: '#f59e0b',
          title: 'Limpar Filas de Erro do Visualizador de Eventos',
          desc: 'Higieniza registros antigos nos logs System e Application (wevtutil cl).'
        },
        {
          id: 'task-audit',
          icon: 'hard-drive',
          iconColor: '#10b981',
          title: 'Conferir Espaço Recuperado e Saúde do Sistema',
          desc: 'Verifica o espaço liberado no disco C: e atualiza o status do diagnóstico.'
        }
      ];
    }

    let isRunning = false;
    let isMinimized = false;
    let floatingDock = null;
    let currentPercent = 0;
    let currentTaskName = 'Aguardando Início';
    let cleanupProgressListener = null;

    overlay.innerHTML = `
      <div class="modal details-modal" role="dialog" aria-modal="true" style="width: min(800px, 95vw); max-width: 800px; max-height: 90vh; padding: 22px 26px; position: relative; display: flex; flex-direction: column; overflow: hidden;">
        <!-- Header Controls: Minimizar e Fechar -->
        <div class="modal-header-actions">
          <button class="modal-control-btn minimize-btn" id="rp-minimize-btn" title="Minimizar (Continuar usando o app em segundo plano)">
            <i data-lucide="minus" style="width:16px;height:16px"></i>
          </button>
          <button class="modal-control-btn close-btn" id="rp-close-x" title="Fechar (Esc)">
            <i data-lucide="x" style="width:16px;height:16px"></i>
          </button>
        </div>

        <!-- Cabeçalho Fixo -->
        <div class="details-modal-header" style="margin-bottom: 14px; padding-right: 84px; padding-bottom: 14px; border-bottom: 1px solid rgba(255, 255, 255, 0.07); flex-shrink: 0;">
          <div class="details-header-lead">
            <div class="details-header-icon-box" style="background: linear-gradient(135deg, rgba(99, 102, 241, 0.25) 0%, rgba(168, 85, 247, 0.22) 100%); border-color: rgba(139, 92, 246, 0.45); color: #c084fc;">
              <i data-lucide="sparkles" style="width:22px;height:22px"></i>
            </div>
            <div class="details-header-text">
              <div class="details-modal-title" style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                <span style="font-size: 17px; font-weight: 800; color: #f8fafc;">${modalTitle}</span>
                <span class="details-count-pill" style="color: ${pillColor}; background: ${pillBg}; border: 1px solid ${pillBorder}; font-size: 10.5px; font-weight: 700; padding: 3px 10px; border-radius: 999px;">${pillText}</span>
              </div>
              <div class="details-modal-desc" style="font-size: 12.5px; color: #94a3b8; margin-top: 4px; line-height: 1.45;">${issueSummary}</div>
            </div>
          </div>
        </div>

        <!-- Corpo Rolável do Modal (com padding superior e inferior limpo para nunca cortar cards) -->
        <div style="flex: 1; overflow-y: auto; padding: 2px 6px 6px 2px; display: flex; flex-direction: column; gap: 16px;">

          <!-- SEÇÃO 1: O QUE A IA DETECTOU NOS LOGS DO SISTEMA -->
          <div style="background: linear-gradient(145deg, rgba(30, 27, 75, 0.45) 0%, rgba(15, 23, 42, 0.8) 100%); border: 1px solid rgba(139, 92, 246, 0.32); border-radius: 14px; padding: 16px 18px;">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin-bottom: 8px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="background: rgba(168, 85, 247, 0.2); border: 1px solid rgba(168, 85, 247, 0.45); color: #d8b4fe; font-size: 10.5px; font-weight: 800; padding: 2px 8px; border-radius: 6px; letter-spacing: 0.4px;">ETAPA 1 • DIAGNÓSTICO IA</span>
                <span style="font-size: 13.5px; font-weight: 700; color: #f8fafc;">O que encontramos nos logs do seu Windows</span>
              </div>
              <span style="font-size: 11px; font-weight: 600; color: #a5b4fc; display: inline-flex; align-items: center; gap: 5px;">
                <i data-lucide="bot" style="width:13px;height:13px;color:#c084fc;"></i>
                ${aiCorruptions.length > 0 ? `${aiCorruptions.length} ${aiCorruptions.length === 1 ? 'alerta identificado' : 'alertas identificados'}` : 'Sistema verificado'}
              </span>
            </div>

            <div style="font-size: 12px; color: #cbd5e1; line-height: 1.5; margin-bottom: ${aiCorruptions.length > 0 ? '12px' : '0'};">
              ${aiSummary}
            </div>

            ${aiCorruptions.length > 0 && !isAlreadyOptimized ? `
              <div style="display: flex; flex-direction: column; gap: 10px;">
                ${aiCorruptions.map(c => {
                  const isCrit = c.severity === 'critical';
                  const accentColor = isCrit ? '#ef4444' : '#f59e0b';
                  const badgeBg = isCrit ? 'rgba(239, 68, 68, 0.14)' : 'rgba(245, 158, 11, 0.14)';
                  const badgeBorder = isCrit ? 'rgba(239, 68, 68, 0.35)' : 'rgba(245, 158, 11, 0.35)';
                  const badgeText = isCrit ? 'Risco Crítico' : 'Atenção Preventiva';
                  return `
                    <div style="background: rgba(9, 13, 24, 0.65); border: 1px solid rgba(255, 255, 255, 0.08); border-left: 3.5px solid ${accentColor}; border-radius: 10px; padding: 12px 14px; display: flex; flex-direction: column; gap: 6px;">
                      <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap;">
                        <div style="display: flex; align-items: center; gap: 7px; min-width: 0;">
                          <i data-lucide="${c.icon || (isCrit ? 'alert-octagon' : 'alert-triangle')}" style="width: 15px; height: 15px; color: ${accentColor}; flex-shrink: 0;"></i>
                          <span style="font-size: 12.5px; font-weight: 700; color: #f8fafc;">${c.title}</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
                          <span style="font-size: 10px; font-weight: 700; color: #94a3b8; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.08); padding: 2px 8px; border-radius: 999px;">${c.category}</span>
                          <span style="font-size: 10px; font-weight: 700; color: ${accentColor}; background: ${badgeBg}; border: 1px solid ${badgeBorder}; padding: 2px 8px; border-radius: 999px;">${badgeText}</span>
                        </div>
                      </div>
                      <div style="font-size: 11.5px; color: #cbd5e1; line-height: 1.45;">
                        ${c.diagnosis}
                      </div>
                      <div style="background: rgba(56, 189, 248, 0.08); border: 1px solid rgba(56, 189, 248, 0.2); border-radius: 7px; padding: 6px 10px; font-size: 11.5px; color: #bae6fd; display: flex; align-items: center; gap: 7px;">
                        <i data-lucide="shield-check" style="width: 14px; height: 14px; color: #38bdf8; flex-shrink: 0;"></i>
                        <span><strong>Como resolver:</strong> ${c.prevention}</span>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            ` : `
              <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.32); border-radius: 10px; padding: 12px 14px; display: flex; align-items: center; gap: 12px;">
                <div style="width: 32px; height: 32px; border-radius: 8px; background: rgba(16, 185, 129, 0.2); border: 1px solid rgba(16, 185, 129, 0.4); display: flex; align-items: center; justify-content: center; color: #34d399; flex-shrink: 0;">
                  <i data-lucide="shield-check" style="width: 18px; height: 18px;"></i>
                </div>
                <div style="flex: 1; font-size: 12px; color: #e2e8f0; line-height: 1.45;">
                  <span style="font-weight: 700; color: #34d399;">Nenhum alerta ativo no momento:</span> Alertas identificados em auditorias anteriores já foram solucionados e os serviços vitais estão auditados em execução contínua.
                  <div style="font-size: 11px; color: #94a3b8; margin-top: 3px;">
                    Próxima verificação preventiva recomendada: <strong style="color: #38bdf8;">${currentDiag.nextCheckFormatted || 'Em 24 horas'}</strong>.
                  </div>
                </div>
              </div>
            `}
          </div>

          <!-- SEÇÃO 2: COMANDOS DE REPARO PROFUNDO DO WINDOWS (SFC / DISM / CHKDSK) -->
          <div style="background: rgba(15, 23, 42, 0.65); border: 1px solid rgba(56, 189, 248, 0.28); border-radius: 14px; padding: 15px 18px;">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin-bottom: 6px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="background: rgba(56, 189, 248, 0.16); border: 1px solid rgba(56, 189, 248, 0.38); color: #7dd3fc; font-size: 10.5px; font-weight: 800; padding: 2px 8px; border-radius: 6px; letter-spacing: 0.4px;">ETAPA 2 • BLINDAGEM DO SISTEMA</span>
                <span style="font-size: 13.5px; font-weight: 700; color: #f8fafc;">Ferramentas Oficiais para Evitar Corrupção do Windows</span>
              </div>
              <span style="font-size: 11px; color: #94a3b8;">Opcionais • Clique para rodar</span>
            </div>
            <div style="font-size: 11.5px; color: #94a3b8; margin-bottom: 12px; line-height: 1.45;">
              Estes comandos oficiais da Microsoft verificam e substituem arquivos corrompidos do Windows antes que causem tela azul ou falha de inicialização:
            </div>

            <div style="display: flex; direction: row; flex-direction: column; gap: 8px;">
              ${aiRecommendedCommands.map(rec => {
                const isCompleted = completedAiCommands.has((rec.cmd || '').trim().toLowerCase());
                return `
                <div style="background: rgba(9, 13, 24, 0.6); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 10px; padding: 10px 14px; display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap;">
                  <div style="display: flex; align-items: center; gap: 12px; flex: 1; min-width: 220px;">
                    <div style="width: 34px; height: 34px; border-radius: 9px; background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.07); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                      <i data-lucide="${rec.icon || 'shield-check'}" style="width: 16px; height: 16px; color: ${isCompleted ? '#10b981' : (rec.color || '#38bdf8')};"></i>
                    </div>
                    <div style="flex: 1; min-width: 0;">
                      <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                        <span style="font-size: 12.5px; font-weight: 700; color: #f8fafc;">${rec.title}</span>
                        <span style="font-size: 10px; font-weight: 700; color: ${isCompleted ? '#10b981' : (rec.color || '#38bdf8')}; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.08); padding: 1.5px 8px; border-radius: 999px;">${isCompleted ? '✔ Executado' : (rec.badge || 'Recomendado')}</span>
                      </div>
                      <div style="font-size: 11.5px; color: #94a3b8; line-height: 1.4; margin-top: 3px;">${rec.reason}</div>
                    </div>
                  </div>
                  ${isCompleted ? `
                    <button type="button" class="modal-btn secondary" disabled style="padding: 7px 14px; font-size: 11.5px; border-color: rgba(16, 185, 129, 0.4); background: rgba(16, 185, 129, 0.1); color: #10b981 !important; flex-shrink: 0; cursor: default;">
                      <span style="color:#10b981;font-weight:700;">✔ Concluído</span>
                    </button>
                  ` : `
                    <button type="button" class="modal-btn secondary btn-run-ai-cmd" data-ai-cmd="${rec.cmd.replace(/"/g, '&quot;')}" data-ai-title="${rec.title.replace(/"/g, '&quot;')}" style="padding: 7px 14px; font-size: 11.5px; border-color: rgba(56, 189, 248, 0.4); background: rgba(56, 189, 248, 0.1); color: #7dd3fc !important; flex-shrink: 0;">
                      <i data-lucide="terminal" style="width:13px;height:13px"></i> Executar Comando
                    </button>
                  `}
                </div>
              `;
              }).join('')}
            </div>
          </div>

          <!-- SEÇÃO 3: LIMPEZA E RESTAURAÇÃO AUTOMÁTICA (1 CLIQUE) -->
          <div style="background: rgba(15, 23, 42, 0.65); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: 14px; padding: 15px 18px;">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin-bottom: 10px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="background: rgba(16, 185, 129, 0.16); border: 1px solid rgba(16, 185, 129, 0.38); color: #6ee7b7; font-size: 10.5px; font-weight: 800; padding: 2px 8px; border-radius: 6px; letter-spacing: 0.4px;">ETAPA 3 • CORREÇÃO AUTOMÁTICA</span>
                <span style="font-size: 13.5px; font-weight: 700; color: #f8fafc;">Plano de Limpeza e Restauração de Serviços</span>
              </div>
              <span style="font-size: 11px; color: #94a3b8;">${isAlreadyOptimized ? 'Rotinas já verificadas' : 'Executado pelo botão azul abaixo'}</span>
            </div>

            <!-- Barra de Progresso Global da Limpeza e Restauração Automática -->
            <div class="rp-progress-container" id="rp-progress-box" style="margin-bottom: 12px;">
              <div class="rp-progress-header">
                <span id="rp-progress-label" style="font-size: 12px; font-weight: 600; color: #cbd5e1; display: flex; align-items: center; gap: 6px;">
                  <i data-lucide="${isAlreadyOptimized ? 'check-circle' : 'check-square'}" style="width:14px;height:14px;color:#10b981;"></i>
                  <span>${isAlreadyOptimized ? `Todas as ${tasks.length} tarefas automáticas verificadas e operando normalmente` : `${tasks.length} tarefas automáticas prontas para iniciar`}</span>
                </span>
                <span id="rp-progress-percent" style="font-size: 13px; font-weight: 700; color: ${isAlreadyOptimized ? '#10b981' : '#38bdf8'};">${isAlreadyOptimized ? '100%' : '0%'}</span>
              </div>
              <div class="rp-progress-track">
                <div id="rp-progress-fill" class="rp-progress-bar-fill" style="width: ${isAlreadyOptimized ? '100%' : '0%'};"></div>
              </div>
            </div>

            <!-- Lista de Tarefas Automáticas -->
            <div id="rp-tasks-list" style="display: flex; flex-direction: column; gap: 7px;">
              ${tasks.map(t => {
                const isTaskDone = isAlreadyOptimized;
                return `
                <div class="rp-task-item" id="${t.id}" style="background: rgba(9, 13, 24, 0.55); border: 1px solid ${isTaskDone ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255, 255, 255, 0.07)'}; border-radius: 10px; padding: 10px 14px; display: flex; align-items: center; justify-content: space-between; gap: 12px; transition: all 0.2s ease;">
                  <div style="display: flex; align-items: center; gap: 11px; flex: 1; min-width: 0;">
                    <div style="width: 32px; height: 32px; border-radius: 8px; background: rgba(255, 255, 255, 0.04); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                      <i data-lucide="${t.icon}" style="width: 15px; height: 15px; color: ${t.iconColor};"></i>
                    </div>
                    <div style="flex: 1; min-width: 0;">
                      <div style="font-size: 12px; font-weight: 700; color: #f8fafc;" class="task-title">${t.title}</div>
                      <div style="font-size: 11px; color: #94a3b8; line-height: 1.38;" class="task-desc">${t.desc}</div>
                      <div class="rp-task-progress-mini">
                        <div class="rp-task-progress-mini-fill"></div>
                      </div>
                    </div>
                  </div>
                  <div class="task-badge" style="font-size: 11px; font-weight: 700; color: ${isTaskDone ? '#10b981' : '#64748b'}; background: ${isTaskDone ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255, 255, 255, 0.04)'}; padding: 4px 10px; border-radius: 6px; white-space: nowrap; flex-shrink: 0;">
                    ${isTaskDone ? '✔ Concluído' : 'Pendente'}
                  </div>
                </div>
              `;
              }).join('')}
            </div>
          </div>

          <!-- Banner de Conclusão -->
          <div id="rp-result-banner" style="display: none; border-radius: 12px; padding: 14px 16px;">
            <div id="rp-result-title" style="font-size: 13.5px; font-weight: 700; margin-bottom: 4px; display: flex; align-items: center; gap: 8px;"></div>
            <div id="rp-result-sub" style="font-size: 12px; line-height: 1.45;"></div>
          </div>

        </div>

        <!-- Rodapé Fixo -->
        <div class="details-modal-footer" id="rp-modal-footer" style="margin-top: 14px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.08); justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; flex-shrink: 0;">
          <div id="rp-left-actions" style="display: flex; gap: 8px; flex-wrap: wrap;">
            ${(issueType === 'disk-space' || issueType === 'both') ? `
              <button type="button" class="modal-btn secondary" id="rp-native-cleanmgr" style="padding: 7px 12px; font-size: 11.5px;">
                <i data-lucide="hard-drive" style="width:13px;height:13px"></i> Limpeza do Windows (cleanmgr)
              </button>
              <button type="button" class="modal-btn secondary" id="rp-native-storagesense" style="padding: 7px 12px; font-size: 11.5px;">
                <i data-lucide="settings" style="width:13px;height:13px"></i> Sensor de Armazenamento
              </button>
            ` : ''}
          </div>
          <div style="display: flex; gap: 8px;">
            <button type="button" class="modal-btn secondary" id="rp-cancel-btn" style="padding: 8px 18px; font-size: 12px;">
              Fechar
            </button>
            <button type="button" class="modal-btn primary" id="rp-start-btn" style="padding: 8px 22px; font-size: 12.5px;">
              <i data-lucide="${isAlreadyOptimized ? 'refresh-cw' : 'play'}" style="width:14px;height:14px"></i> ${isAlreadyOptimized ? 'Reexecutar Limpeza & Auditoria' : 'Aplicar Correções Automáticas'}
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    if (window.lucide) window.lucide.createIcons({ root: overlay });

    // Handler para os botões de Comandos Preventivos Recomendados pela IA (SFC / DISM / CHKDSK)
    overlay.querySelectorAll('.btn-run-ai-cmd').forEach((cmdBtn) => {
      cmdBtn.addEventListener('click', async () => {
        const targetCmd = cmdBtn.getAttribute('data-ai-cmd');
        const targetTitle = cmdBtn.getAttribute('data-ai-title') || targetCmd;
        if (!targetCmd) return;

        // Procura se já existe um botão de ferramenta correspondente na UI para aproveitar a janela de progresso nativa do ThunderTools
        const existingToolBtn = Array.from(document.querySelectorAll('.tool-btn')).find(
          b => (b.dataset.cmd || '').trim().toLowerCase() === targetCmd.trim().toLowerCase()
        );

        if (existingToolBtn) {
          // Oculta o modal temporariamente SEM criar o floatingDock (#repair-floating-dock)
          // Isso elimina a duplicação de janelas minimizadas no canto inferior da tela
          overlay.style.display = 'none';

          cmdBtn.disabled = true;
          const origHtml = cmdBtn.innerHTML;
          cmdBtn.innerHTML = `<span class="tt-spinner" style="width:11px;height:11px;display:inline-block;"></span> Executando...`;

          let restored = false;
          const restoreModalAndStatus = (success, wasCancelled) => {
            if (restored) return;
            restored = true;
            if (finishListener) window.removeEventListener('tt:command-completed', finishListener);
            if (pollTimer) clearInterval(pollTimer);

            if (overlay && overlay.parentNode) {
              overlay.style.display = 'flex';
              if (window.lucide) window.lucide.createIcons({ root: overlay });
            }

            if (success) {
              completedAiCommands.add(targetCmd.toLowerCase().trim());
              if (window.api?.recordCompletedAiCommand) {
                window.api.recordCompletedAiCommand(targetCmd);
              }
              cmdBtn.innerHTML = `<span style="color:#10b981;font-weight:700;">✔ Concluído</span>`;
              cmdBtn.disabled = true;
              if (typeof window.toast === 'function') {
                window.toast(`${targetTitle} concluído com sucesso!`, 'success');
              }
            } else if (wasCancelled) {
              cmdBtn.disabled = false;
              cmdBtn.innerHTML = origHtml;
            } else {
              cmdBtn.disabled = false;
              cmdBtn.innerHTML = origHtml;
            }
          };

          const finishListener = (e) => {
            if (e.detail && (e.detail.cmd || '').trim().toLowerCase() === targetCmd.trim().toLowerCase()) {
              restoreModalAndStatus(!!e.detail.success, !!e.detail.cancelled);
            }
          };
          window.addEventListener('tt:command-completed', finishListener);

          // Fallback de segurança: caso o evento não seja capturado, verifica quando o botão nativo terminar
          const pollTimer = setInterval(() => {
            if (!existingToolBtn.disabled && existingToolBtn.style.pointerEvents !== 'none') {
              setTimeout(() => {
                restoreModalAndStatus(true, false);
              }, 400);
            }
          }, 800);

          existingToolBtn.click();
          return;
        }

        // Caso seja um comando exclusivo da IA (ex: chkdsk C: /scan ou DISM /ScanHealth), executa diretamente com feedback visual no próprio botão
        cmdBtn.disabled = true;
        const origHtml = cmdBtn.innerHTML;
        cmdBtn.innerHTML = `<span class="tt-spinner" style="width:11px;height:11px;display:inline-block;"></span> Executando...`;
        try {
          const trackingId = `ai-cmd-${Date.now()}`;
          const res = window.api?.runTrackedCommand
            ? await window.api.runTrackedCommand(targetCmd, trackingId)
            : await window.api?.runCommand(targetCmd);
          if (res && res.success) {
            completedAiCommands.add(targetCmd.toLowerCase().trim());
            if (window.api?.recordCompletedAiCommand) {
              window.api.recordCompletedAiCommand(targetCmd);
            }
            cmdBtn.innerHTML = `<span style="color:#10b981;font-weight:700;">✔ Concluído</span>`;
            if (typeof window.toast === 'function') {
              window.toast(`${targetTitle} executado com sucesso!`, 'success');
            }
          } else {
            cmdBtn.disabled = false;
            cmdBtn.innerHTML = origHtml;
            if (typeof window.toast === 'function') {
              window.toast(`Aviso ao executar ${targetTitle}. Verifique permissões de Administrador.`, 'warning');
            }
          }
        } catch (err) {
          cmdBtn.disabled = false;
          cmdBtn.innerHTML = origHtml;
        }
      });
    });

    const btnCleanmgr = overlay.querySelector('#rp-native-cleanmgr');
    if (btnCleanmgr) {
      btnCleanmgr.addEventListener('click', () => {
        if (window.api?.openCleanmgr) {
          window.api.openCleanmgr();
          if (typeof window.toast === 'function') {
            window.toast('Iniciando Limpeza de Disco nativa do Windows (cleanmgr)...', 'info');
          }
        }
      });
    }

    const btnStorageSense = overlay.querySelector('#rp-native-storagesense');
    if (btnStorageSense) {
      btnStorageSense.addEventListener('click', () => {
        if (window.api?.openStorageSense) {
          window.api.openStorageSense();
          if (typeof window.toast === 'function') {
            window.toast('Abrindo Sensor de Armazenamento do Windows...', 'info');
          }
        }
      });
    }

    function minimizeModal() {
      if (isMinimized) return;
      isMinimized = true;
      overlay.style.display = 'none';

      // Se houver uma janela de serviço nativa ativa (.service-progress-window),
      // não cria o floatingDock simultâneo para não poluir ou sobrepor a interface
      if (document.querySelector('.service-progress-window')) {
        return;
      }

      if (!floatingDock) {
        floatingDock = document.createElement('div');
        floatingDock.id = 'repair-floating-dock';
        floatingDock.className = 'repair-floating-dock';
        floatingDock.title = 'Clique para restaurar a janela de correções';

        floatingDock.innerHTML = `
          <div class="dock-pulse-icon">
            <i data-lucide="wrench" style="width: 18px; height: 18px;"></i>
          </div>
          <div class="dock-content">
            <div class="dock-title-row">
              <span class="dock-title">Reparo Preventivo IA</span>
              <span class="dock-percent" id="dock-percent-text">${currentPercent}%</span>
            </div>
            <div class="dock-desc" id="dock-desc-text">${currentTaskName}</div>
            <div class="dock-progress-track">
              <div class="dock-progress-fill" id="dock-progress-fill" style="width: ${currentPercent}%;"></div>
            </div>
          </div>
          <button type="button" class="dock-restore-btn" id="dock-restore-btn">
            <i data-lucide="maximize-2" style="width: 13px; height: 13px;"></i> Restaurar
          </button>
        `;

        document.body.appendChild(floatingDock);
        if (window.lucide) window.lucide.createIcons({ root: floatingDock });

        floatingDock.addEventListener('click', () => {
          restoreModal();
        });
      }
    }

    function restoreModal() {
      if (!isMinimized) return;
      isMinimized = false;
      if (floatingDock) {
        floatingDock.remove();
        floatingDock = null;
      }
      overlay.style.display = 'flex';
      if (window.lucide) window.lucide.createIcons({ root: overlay });
    }

    function close() {
      if (isRunning) {
        minimizeModal();
        if (typeof window.toast === 'function') {
          window.toast('As correções continuam em execução em segundo plano!', 'info');
        }
        return;
      }
      if (cleanupProgressListener) {
        cleanupProgressListener();
        cleanupProgressListener = null;
      }
      if (floatingDock) {
        floatingDock.remove();
        floatingDock = null;
      }
      overlay.remove();
      document.removeEventListener('keydown', onKeyDown);
    }

    function onKeyDown(e) {
      if (e.key === 'Escape') close();
    }

    document.addEventListener('keydown', onKeyDown);
    overlay.querySelector('#rp-close-x').addEventListener('click', close);
    overlay.querySelector('#rp-cancel-btn').addEventListener('click', close);
    overlay.querySelector('#rp-minimize-btn').addEventListener('click', minimizeModal);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        if (isRunning) minimizeModal();
        else close();
      }
    });

    const startBtn = overlay.querySelector('#rp-start-btn');
    const cancelBtn = overlay.querySelector('#rp-cancel-btn');
    const progressFill = overlay.querySelector('#rp-progress-fill');
    const progressLabel = overlay.querySelector('#rp-progress-label');
    const progressPercent = overlay.querySelector('#rp-progress-percent');
    const resultBanner = overlay.querySelector('#rp-result-banner');
    const resultTitle = overlay.querySelector('#rp-result-title');
    const resultSub = overlay.querySelector('#rp-result-sub');
    const footer = overlay.querySelector('#rp-modal-footer');

    // Listener para o fluxo de progresso em tempo real
    if (window.api?.onRepairProgress) {
      cleanupProgressListener = window.api.onRepairProgress((data) => {
        if (!data) return;
        currentPercent = Math.min(100, Math.max(0, data.percent || 0));
        currentTaskName = data.details || data.taskTitle || 'Executando tarefas...';

        // Atualiza a barra de status do modal
        if (progressFill) progressFill.style.width = `${currentPercent}%`;
        if (progressPercent) progressPercent.textContent = `${currentPercent}%`;
        if (progressLabel) {
          progressLabel.innerHTML = `
            <span class="tt-spinner" style="width:11px;height:11px;display:inline-block;"></span>
            <span>${currentTaskName}</span>
          `;
        }

        // Atualiza o widget minimizado se ativo
        if (floatingDock) {
          const dPercent = floatingDock.querySelector('#dock-percent-text');
          const dDesc = floatingDock.querySelector('#dock-desc-text');
          const dFill = floatingDock.querySelector('#dock-progress-fill');
          if (dPercent) dPercent.textContent = `${currentPercent}%`;
          if (dDesc) dDesc.textContent = currentTaskName;
          if (dFill) dFill.style.width = `${currentPercent}%`;
        }

        // Atualiza o item de tarefa correspondente
        if (data.taskId) {
          const taskEl = overlay.querySelector(`#${data.taskId}`);
          if (taskEl) {
            const badge = taskEl.querySelector('.task-badge');
            const miniProg = taskEl.querySelector('.rp-task-progress-mini');
            const descEl = taskEl.querySelector('.task-desc');

            if (data.status === 'running') {
              if (miniProg) miniProg.style.display = 'block';
              taskEl.style.borderColor = 'rgba(56, 189, 248, 0.4)';
              if (badge) {
                badge.innerHTML = '<span class="tt-spinner" style="width:10px;height:10px;display:inline-block;"></span> Em andamento';
                badge.style.color = '#38bdf8';
                badge.style.background = 'rgba(56, 189, 248, 0.12)';
              }
            } else if (data.status === 'completed') {
              if (miniProg) miniProg.style.display = 'none';
              taskEl.style.borderColor = 'rgba(16, 185, 129, 0.35)';
              if (badge) {
                badge.innerHTML = '<span style="color:#10b981;font-weight:700;">✔ Concluído</span>';
                badge.style.background = 'rgba(16, 185, 129, 0.12)';
              }
              if (data.details && descEl) {
                descEl.textContent = data.details;
              }
            }
          }
        }
      });
    }

    startBtn.addEventListener('click', async () => {
      isRunning = true;
      startBtn.disabled = true;
      cancelBtn.style.display = 'none';
      startBtn.innerHTML = `
        <span class="tt-spinner" style="width:12px;height:12px;border-width:2px;display:inline-block;"></span>
        <span>Executando Reparo...</span>
      `;

      // Inicializa as tarefas como "Na fila"
      tasks.forEach((t) => {
        const itemEl = overlay.querySelector(`#${t.id}`);
        if (!itemEl) return;
        const bEl = itemEl.querySelector('.task-badge');
        if (bEl) bEl.textContent = 'Na fila';
      });

      try {
        let repairResult = null;
        if (window.api?.repairSystemIssues) {
          repairResult = await window.api.repairSystemIssues(issueType);
        } else if (window.api?.runTrackedCommand) {
          await window.api.runTrackedCommand('ipconfig /flushdns', 'system-repair');
          repairResult = { success: true, freedMB: 0, isDiskStillLow: false };
        }

        const res = (repairResult && typeof repairResult === 'object') ? repairResult : { success: true };
        const freedMB = res.freedMB || 0;
        const freeGBNow = res.freeGBNow !== undefined ? res.freeGBNow.toFixed(1) : freeGB;
        const isDiskStillLow = !!res.isDiskStillLow;
        isRunning = false;

        // Atualiza progresso para 100%
        if (progressFill) progressFill.style.width = '100%';
        if (progressPercent) progressPercent.textContent = '100%';
        if (progressLabel) {
          progressLabel.innerHTML = `
            <span style="color:#10b981;font-weight:700;">✔ Todas as tarefas automáticas concluídas</span>
          `;
        }

        // Marca todas as tarefas como concluídas
        tasks.forEach(t => {
          const itemEl = overlay.querySelector(`#${t.id}`);
          if (!itemEl) return;
          const bEl = itemEl.querySelector('.task-badge');
          const miniProg = itemEl.querySelector('.rp-task-progress-mini');
          if (miniProg) miniProg.style.display = 'none';
          if (bEl) {
            bEl.innerHTML = '<span style="color:#10b981; font-weight:700;">✔ Concluído</span>';
            bEl.style.background = 'rgba(16, 185, 129, 0.12)';
          }
          itemEl.style.borderColor = 'rgba(16, 185, 129, 0.3)';
        });

        // Atualiza o dock flutuante se minimizado
        if (floatingDock) {
          floatingDock.classList.add('completed');
          const dTitle = floatingDock.querySelector('.dock-title');
          const dDesc = floatingDock.querySelector('#dock-desc-text');
          const dPercent = floatingDock.querySelector('#dock-percent-text');
          const dFill = floatingDock.querySelector('#dock-progress-fill');
          if (dTitle) dTitle.textContent = '✔ Reparo Concluído!';
          if (dPercent) dPercent.textContent = '100%';
          if (dFill) dFill.style.width = '100%';
          if (dDesc) dDesc.textContent = `${freedMB > 0 ? `${freedMB} MB liberados. ` : ''}Clique para ver o laudo.`;
        }

        // Exibe banner de resultado
        resultBanner.style.display = 'block';
        if (isDiskStillLow) {
          resultBanner.style.background = 'rgba(245, 158, 11, 0.1)';
          resultBanner.style.border = '1px solid rgba(245, 158, 11, 0.35)';
          resultTitle.style.color = '#f59e0b';
          resultTitle.innerHTML = '<i data-lucide="alert-triangle" style="width:18px;height:18px"></i> Limpeza Concluída • Atenção ao Espaço Livre';
          resultSub.style.color = '#cbd5e1';
          resultSub.innerHTML = `As correções eliminaram arquivos temporários, lixeira e caches <strong>(${freedMB} MB liberados)</strong>. O disco C: possui atualmente <strong>${freeGBNow} GB livres</strong>. Você também pode rodar os comandos <strong>SFC / DISM</strong> acima para garantir a integridade dos arquivos do sistema.`;

          footer.innerHTML = `
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <button type="button" class="modal-btn secondary" id="rp-footer-cleanmgr" style="padding: 7px 12px; font-size: 11.5px;">
                <i data-lucide="hard-drive" style="width:13px;height:13px"></i> Limpeza de Disco (cleanmgr)
              </button>
            </div>
            <div style="display: flex; gap: 8px;">
              <button type="button" class="modal-btn secondary" id="rp-finish-btn" style="padding: 8px 18px; font-size: 12px;">Fechar</button>
              <button type="button" class="modal-btn primary" id="rp-disco-btn" style="padding: 8px 20px; font-size: 12px;">
                <i data-lucide="hard-drive" style="width:14px;height:14px"></i> Abrir Aba Disco
              </button>
            </div>
          `;

          const footerCleanmgr = footer.querySelector('#rp-footer-cleanmgr');
          if (footerCleanmgr) {
            footerCleanmgr.addEventListener('click', () => {
              if (window.api?.openCleanmgr) window.api.openCleanmgr();
            });
          }

          const discoBtn = footer.querySelector('#rp-disco-btn');
          if (discoBtn) {
            discoBtn.addEventListener('click', () => {
              close();
              const discoTab = document.querySelector('.sidebar .tab-btn[data-tab="disco"]');
              if (discoTab) discoTab.click();
            });
          }
          footer.querySelector('#rp-finish-btn').addEventListener('click', close);

          // Atualiza banner na Home sem sobrescrever de forma conflitante o listener principal
          const warningDiag = {
            status: 'attention',
            message: `Pouco Espaço no Disco C: (${freeGBNow} GB Livres)`,
            subtext: `${freedMB > 0 ? `${freedMB} MB liberados. ` : ''}A partição C: ainda requer espaço adicional ou execução dos comandos preventivos recomendados.`,
            lastCheck: 'Agora mesmo',
            nextCheckFormatted: res.nextCheckFormatted,
            checkIntervalHours: res.checkIntervalHours,
            freeGB: Number(freeGBNow) || 0
          };
          lastDiagnosticData = warningDiag;
          updateDiagnosticBanner(warningDiag);
        } else {
          resultBanner.style.background = 'rgba(16, 185, 129, 0.1)';
          resultBanner.style.border = '1px solid rgba(16, 185, 129, 0.35)';
          resultTitle.style.color = '#34d399';
          resultTitle.innerHTML = '<i data-lucide="check-circle" style="width:18px;height:18px"></i> Reparo Automático Concluído com Sucesso!';
          resultSub.style.color = '#cbd5e1';
          resultSub.innerHTML = `Todas as rotinas automáticas foram aplicadas com sucesso. ${freedMB > 0 ? `${freedMB} MB liberados. ` : ''}O espaço livre atual é de ${freeGBNow} GB. Caso deseje blindagem estrutural profunda, acione o <strong>SFC /scannow</strong> ou <strong>DISM /RestoreHealth</strong> na lista acima.`;

          footer.innerHTML = `
            <div></div>
            <button type="button" class="modal-btn primary" id="rp-finish-btn" style="padding: 8px 22px; font-size: 12px;">
              <i data-lucide="check" style="width:14px;height:14px"></i> Concluir
            </button>
          `;
          footer.querySelector('#rp-finish-btn').addEventListener('click', close);

          const normalDiag = {
            status: 'normal',
            message: 'Sistema Operando Normalmente',
            subtext: `Reparo preventivo concluído com sucesso! ${freedMB > 0 ? `${freedMB} MB liberados. ` : ''}Logs, caches e serviços vitais restaurados.`,
            lastCheck: 'Agora mesmo',
            nextCheckFormatted: res.nextCheckFormatted,
            checkIntervalHours: res.checkIntervalHours,
            hasSolvedIssues: true,
            freeGB: Number(freeGBNow) || 0
          };
          lastDiagnosticData = normalDiag;
          updateDiagnosticBanner(normalDiag);

          const homeFixBtn = document.getElementById('btn-fix-issues');
          if (homeFixBtn) {
            homeFixBtn.style.display = 'none';
          }
        }

        if (window.lucide) window.lucide.createIcons({ root: overlay });
        if (typeof window.toast === 'function') {
          window.toast('Reparo preventivo do sistema aplicado com sucesso!', 'success');
        }
      } catch (err) {
        console.error('Erro na execução das correções:', err);
        isRunning = false;
        startBtn.disabled = false;
        startBtn.innerHTML = 'Tentar Novamente';
        cancelBtn.style.display = 'inline-flex';
        if (typeof window.toast === 'function') {
          window.toast(`Erro ao aplicar correções: ${err.message}`, 'error');
        }
      }
    });
  }

  if (btnFixIssues) {
    btnFixIssues.addEventListener('click', async () => {
      await showRepairPlanModal(lastDiagnosticData);
    });
  }

  // Configuração dos botões de informação na aba Início (Event Delegation)
  const tabInicio = document.getElementById('tab-inicio');
  if (tabInicio) {
    tabInicio.addEventListener('click', (e) => {
      const infoBtn = e.target.closest('.tt-card-info-btn, .tt-card-info-icon');
      if (infoBtn) {
        e.preventDefault();
        e.stopPropagation();
        const type = infoBtn.getAttribute('data-info');
        if (type) {
          showHomeMetricInfoModal(type);
        }
      }
    });
  }

  runDiagnosticsCheck();
}

export function updateDashboardMetrics(data) {
  if (!data) return;

  try {
    updateLiveRamModalStats(data);
  } catch (_) {}

  // 1. CPU Real com Cor Dinâmica quando próximo de 100%
  if (data.cpu !== undefined) {
    cpuHistory.push(data.cpu);
    if (cpuHistory.length > 15) cpuHistory.shift();

    const cpuCanvas = document.getElementById('cpu-chart-canvas');
    let strokeColor = '#818cf8';
    let fillColor = 'rgba(129, 140, 248, 0.35)';

    if (data.cpu >= 90) {
      strokeColor = '#ef4444';
      fillColor = 'rgba(239, 68, 68, 0.38)';
    } else if (data.cpu >= 75) {
      strokeColor = '#f59e0b';
      fillColor = 'rgba(245, 158, 11, 0.35)';
    }

    drawWaveChart(cpuCanvas, cpuHistory, strokeColor, fillColor, 100);
  }
  if (data.cpuFreq !== undefined) {
    const el = document.getElementById('dash-cpu-freq');
    if (el) el.textContent = `${data.cpuFreq} GHz`;
  }
  if (data.processesCount !== undefined) {
    const el = document.getElementById('dash-proc-count');
    if (el) el.textContent = `${data.processesCount}`;
  }

  // 2. RAM Real com Cor Dinâmica quando próximo de 100%
  if (data.ram !== undefined) {
    const pctEl = document.getElementById('dash-ram-pct');
    if (pctEl) pctEl.textContent = `${data.ram}%`;

    const circle = document.getElementById('dash-ram-circle');
    const statusEl = document.getElementById('dash-ram-status');

    if (circle) {
      const circ = 226.19;
      const offset = circ - (data.ram / 100) * circ;
      circle.style.strokeDashoffset = offset;

      if (data.ram >= 90) {
        circle.setAttribute('stroke', 'url(#ramRingGradientCritical)');
        circle.style.filter = 'drop-shadow(0 0 6px rgba(239, 68, 68, 0.7))';
        if (pctEl) pctEl.style.color = '#ef4444';
        if (statusEl) { statusEl.textContent = 'Crítico'; statusEl.style.color = '#ef4444'; }
      } else if (data.ram >= 75) {
        circle.setAttribute('stroke', 'url(#ramRingGradientWarning)');
        circle.style.filter = 'drop-shadow(0 0 6px rgba(245, 158, 11, 0.6))';
        if (pctEl) pctEl.style.color = '#f59e0b';
        if (statusEl) { statusEl.textContent = 'Atenção'; statusEl.style.color = '#f59e0b'; }
      } else {
        circle.setAttribute('stroke', 'url(#ramRingGradient2)');
        circle.style.filter = 'drop-shadow(0 0 5px rgba(99, 102, 241, 0.5))';
        if (pctEl) pctEl.style.color = '#f1f5f9';
        if (statusEl) { statusEl.textContent = 'Otimizado'; statusEl.style.color = '#22c55e'; }
      }
    }
  }
  if (data.ramTotalGB !== undefined) {
    const totalEl = document.getElementById('dash-ram-total');
    if (totalEl) totalEl.textContent = `de ${data.ramTotalGB}GB`;
  }
  if (data.ramFreeGB !== undefined) {
    const el = document.getElementById('dash-ram-avail');
    if (el) el.textContent = `${data.ramFreeGB} GB`;
  }
  if (data.ramCacheGB !== undefined) {
    const el = document.getElementById('dash-ram-cache');
    if (el) el.textContent = `${data.ramCacheGB} GB`;
  }
  if (data.ramUsedGB !== undefined) {
    const el = document.getElementById('dash-ram-used');
    if (el) el.textContent = `${data.ramUsedGB} GB`;
  }

  // 3. Temperatura Térmica (CPU) com Cor Dinâmica
  if (data.temp !== undefined && data.temp !== null) {
    const tempArc = document.getElementById('dash-temp-gauge-arc');
    const tempPivot = document.getElementById('dash-temp-gauge-pivot');
    const tempValEl = document.getElementById('dash-temp-val');
    const tempStatusEl = document.getElementById('dash-temp-status');

    if (tempValEl) tempValEl.textContent = `${data.temp}°C`;

    if (tempArc) {
      const totalArc = 142;
      const tPct = Math.min(100, Math.max(0, (data.temp / 100) * 100));
      const offset = totalArc - (tPct / 100) * totalArc;
      tempArc.style.strokeDashoffset = offset;

      let tColor = '#22c55e';
      let tStatus = 'Normal';

      if (data.temp >= 80) {
        tColor = '#ef4444';
        tStatus = 'Elevada';
      } else if (data.temp >= 68) {
        tColor = '#f59e0b';
        tStatus = 'Atenção';
      }

      tempArc.style.stroke = tColor;
      tempArc.style.filter = `drop-shadow(0 0 6px ${tColor}aa)`;
      if (tempPivot) tempPivot.style.fill = tColor;
      if (tempValEl) tempValEl.style.color = tColor;
      if (tempStatusEl) {
        tempStatusEl.textContent = tStatus;
        tempStatusEl.style.color = tColor;
      }
    }
  }

  // 4. Armazenamento com Seleção de Disco (Múltiplas Unidades: C:, D:, E:, etc.)
  if (Array.isArray(data.disks) && data.disks.length > 0) {
    lastReceivedDisks = data.disks;
    syncDiskSelectDropdown(data.disks);
    renderActiveDiskMetric();
  } else if (data.diskUsage !== undefined) {
    renderDiskMetricValues(data.diskUsage, data.diskTotalGB);
  }

  // 5. Rede Real (Download, Upload, Picos em Tempo Real e Escala Dinâmica Inteligente)
  const rx = typeof data.netRx === 'number' ? data.netRx : (data.netRx ? parseFloat(data.netRx) : 0);
  const tx = typeof data.netTx === 'number' ? data.netTx : (data.netTx ? parseFloat(data.netTx) : 0);

  if (data.netRx !== undefined || data.netTx !== undefined) {
    // Registra Throughput Total (Download + Upload) para visualização precisa de picos em ambas as direções
    const throughput = +(rx + tx).toFixed(3);
    netHistory.push(throughput);
    if (netHistory.length > 20) netHistory.shift();

    const netCanvas = document.getElementById('net-chart-canvas');
    const netCeiling = getDynamicNetCeiling(netHistory);
    drawWaveChart(netCanvas, netHistory, '#38bdf8', 'rgba(56, 189, 248, 0.35)', netCeiling);

    const scaleTop = document.getElementById('dash-net-scale-top');
    const scaleMid = document.getElementById('dash-net-scale-mid');
    const scaleBottom = document.getElementById('dash-net-scale-bottom');
    if (scaleTop) scaleTop.textContent = formatNetworkSpeed(netCeiling);
    if (scaleMid) scaleMid.textContent = formatNetworkSpeed(netCeiling / 2);
    if (scaleBottom) scaleBottom.textContent = '0 Kbps';

    const downEl = document.getElementById('dash-net-down');
    if (downEl) downEl.textContent = formatNetworkSpeed(rx);

    const upEl = document.getElementById('dash-net-up');
    if (upEl) upEl.textContent = formatNetworkSpeed(tx);
  }

  if (data.netAdapter) {
    const pill = document.getElementById('dash-net-adapter-pill');
    if (pill) {
      pill.textContent = data.netAdapter;
      pill.title = `Adaptador Ativo: ${data.netAdapter}`;
    }
  }

  // 6. Velocidade do Disco (C:) com Velocímetro Animado Suave em Tempo Real
  const ioSpeed = (data.diskIO !== undefined && data.diskIO !== null) ? Number(data.diskIO) : 0;
  const valEl = document.getElementById('dash-disk-speed-val');
  const ioValEl = document.getElementById('dash-disk-io-val');
  const arc = document.getElementById('dash-disk-speed-arc');
  const needle = document.getElementById('dash-disk-speed-needle');
  const pivot = document.getElementById('dash-disk-speed-pivot');
  const speedStatusEl = document.getElementById('dash-disk-speed-status');

  if (valEl) valEl.textContent = ioSpeed.toFixed(1);
  if (ioValEl) ioValEl.textContent = `${ioSpeed.toFixed(1)} MB/s`;

  if (arc && needle) {
    const maxScale = ioSpeed > 100 ? Math.ceil(ioSpeed / 50) * 50 : 100;
    const pct = Math.min(100, Math.max(0, (ioSpeed / maxScale) * 100));
    const deg = -90 + (pct / 100) * 180;
    const totalArc = 172.8;
    const offset = totalArc - (pct / 100) * totalArc;

    arc.style.strokeDashoffset = offset;
    needle.style.transform = `rotate(${deg}deg)`;

    let speedColor = '#38bdf8';
    let sStatus = 'Normal';
    let sColor = '#22c55e';

    if (ioSpeed >= 80) {
      speedColor = '#ef4444';
      sStatus = 'Intensa';
      sColor = '#ef4444';
    } else if (ioSpeed >= 30) {
      speedColor = '#f59e0b';
      sStatus = 'Moderada';
      sColor = '#f59e0b';
    } else if (ioSpeed > 0.5) {
      speedColor = '#38bdf8';
      sStatus = 'Ativo';
      sColor = '#38bdf8';
    }

    arc.style.stroke = speedColor;
    arc.style.filter = `drop-shadow(0 0 6px ${speedColor}aa)`;
    needle.style.stroke = speedColor;
    if (pivot) pivot.style.fill = speedColor;
    if (valEl) valEl.style.color = speedColor;
    if (speedStatusEl) {
      speedStatusEl.textContent = sStatus;
      speedStatusEl.style.color = sColor;
    }
  }
}

function updateDiagnosticBanner(diag) {
  if (!diag) return;
  const banner = document.getElementById('system-diagnostic-banner');
  const headline = document.getElementById('diag-headline');
  const subtext = document.getElementById('diag-subtext');
  const iconWrapper = document.getElementById('diag-status-icon');
  const btnFix = document.getElementById('btn-fix-issues');
  const lastCheck = document.getElementById('diag-last-check');
  const nextCheck = document.getElementById('diag-next-check');
  const scheduleSelect = document.getElementById('diag-schedule-select');
  const scorePill = document.getElementById('diag-score-pill');
  const scoreText = document.getElementById('diag-score-text');
  const storagePill = document.getElementById('diag-storage-pill');
  const storageText = document.getElementById('diag-storage-text');

  if (!banner || !headline) return;

  if (lastCheck) {
    lastCheck.textContent = diag.lastCheck || 'Agora mesmo';
  }

  if (nextCheck && diag.nextCheckFormatted) {
    nextCheck.textContent = diag.nextCheckFormatted;
  }

  if (scheduleSelect && diag.checkIntervalHours) {
    scheduleSelect.value = String(diag.checkIntervalHours);
  }

  const isAttention = diag.status === 'attention' && !diag.hasSolvedIssues;

  // Atualização dos Badges de Saúde e Armazenamento no topo
  if (scorePill && scoreText) {
    if (diag.healthScore !== undefined) {
      scorePill.style.display = 'inline-flex';
      scoreText.textContent = `Saúde: ${diag.healthScore}/100${diag.healthGrade ? ` (${diag.healthGrade})` : ''}`;
      scorePill.className = `tt-diag-pill score ${diag.healthScore < 50 ? 'critical' : (diag.healthScore < 80 ? 'warning' : 'success')}`;
    } else {
      scorePill.style.display = 'none';
    }
  }

  if (storagePill && storageText) {
    if (diag.freeGB !== undefined) {
      storagePill.style.display = 'inline-flex';
      const freeNum = Number(diag.freeGB) || 0;
      const reclaimStr = diag.reclaimLabel ? ` • ${diag.reclaimLabel}` : '';
      storageText.textContent = `${freeNum.toFixed(1)} GB Livres${reclaimStr}`;
    } else {
      storagePill.style.display = 'none';
    }
  }

  if (isAttention) {
    banner.classList.add('attention');
    headline.classList.add('attention');

    // Separa o título principal dos parênteses de métricas técnicas para não poluir o visual
    let rawTitle = diag.message || 'Pontos de Atenção Encontrados';
    const cleanHeadline = rawTitle.replace(/\s*\([^)]*\)\s*$/, '').trim();
    headline.textContent = cleanHeadline || 'Diagnóstico IA: Pontos de Atenção Detectados';

    // Limpa redundância de "Score de Saúde: ..." se já exibido de forma elegante no badge superior
    let rawSub = diag.subtext || 'Alertas detectados no sistema.';
    const cleanSub = rawSub.replace(/^Score de Sa[uú]de:[^.]+\.\s*/i, '').trim();
    if (subtext) subtext.textContent = cleanSub || rawSub;

    if (iconWrapper) {
      iconWrapper.className = 'tt-diag-icon-wrapper attention';
      iconWrapper.innerHTML = '<i data-lucide="alert-triangle" style="width:24px;height:24px"></i>';
    }
    if (btnFix && !btnFix.classList.contains('success')) {
      btnFix.style.display = 'inline-flex';
    }
  } else {
    banner.classList.remove('attention');
    headline.classList.remove('attention');
    headline.textContent = diag.message || 'Sistema Operando Normalmente & Otimizado';
    if (subtext) subtext.textContent = diag.subtext || 'Nenhuma lentidão detectada em segundo plano. Métricas do Windows estão dentro dos padrões ideais.';
    if (iconWrapper) {
      iconWrapper.className = 'tt-diag-icon-wrapper';
      iconWrapper.innerHTML = '<i data-lucide="shield-check" style="width:24px;height:24px;color:#10b981;"></i>';
    }
    if (btnFix && !btnFix.classList.contains('success')) {
      btnFix.style.display = 'none';
    }
  }

  if (window.lucide) window.lucide.createIcons({ root: banner });
}

function formatNetworkSpeed(mbps) {
  const val = Number(mbps) || 0;
  if (val <= 0.001) return '0 Kbps';
  if (val < 0.95) {
    const kbps = Math.round(val * 1024);
    return `${kbps} Kbps`;
  }
  if (val >= 100) {
    return `${Math.round(val)} Mbps`;
  }
  return `${val.toFixed(1)} Mbps`;
}

function getDynamicNetCeiling(dataPoints) {
  const peak = Math.max(0, ...(dataPoints || []));
  if (peak <= 0.25) return 0.5;   // até 250 Kbps -> teto 500 Kbps
  if (peak <= 0.8) return 1.0;    // até 800 Kbps -> teto 1.0 Mbps
  if (peak <= 1.8) return 2.5;    // até 1.8 Mbps -> teto 2.5 Mbps
  if (peak <= 4.0) return 5.0;    // até 4.0 Mbps -> teto 5.0 Mbps
  if (peak <= 8.5) return 10.0;   // até 8.5 Mbps -> teto 10.0 Mbps
  if (peak <= 20.0) return 25.0;  // até 20 Mbps  -> teto 25.0 Mbps
  if (peak <= 45.0) return 50.0;  // até 45 Mbps  -> teto 50.0 Mbps
  if (peak <= 85.0) return 100.0; // até 85 Mbps  -> teto 100.0 Mbps
  if (peak <= 250.0) return 300.0;// até 250 Mbps -> teto 300.0 Mbps
  if (peak <= 500.0) return 600.0;// até 500 Mbps -> teto 600.0 Mbps
  return Math.ceil(peak / 100) * 100;
}

function drawWaveChart(canvas, dataPoints, strokeColor, fillColor, customMax = null) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const max = (customMax !== null && customMax > 0) ? customMax : Math.max(10, ...dataPoints);
  const step = w / Math.max(1, (dataPoints.length - 1));

  // Linhas guia do grid
  const isLight = document.body && document.body.getAttribute('data-theme') === 'light';
  ctx.strokeStyle = isLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);

  ctx.beginPath();
  ctx.moveTo(35, h * 0.2);
  ctx.lineTo(w, h * 0.2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(35, h * 0.6);
  ctx.lineTo(w, h * 0.6);
  ctx.stroke();
  ctx.setLineDash([]);

  // Desenho da onda com gradiente preenchido
  ctx.beginPath();
  dataPoints.forEach((val, i) => {
    const x = i * step;
    const clampedVal = Math.min(Math.max(0, val), max);
    const y = h - (clampedVal / max) * (h - 14) - 4;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });

  // Linha stroke com glow
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 2.2;
  ctx.shadowColor = strokeColor;
  ctx.shadowBlur = 8;
  ctx.stroke();

  // Fecha para área preenchida
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.shadowBlur = 0;

  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, fillColor);
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fill();
}

function syncDiskSelectDropdown(disks) {
  const select = document.getElementById('dash-disk-select');
  if (!select) return;

  const currentKey = disks.map(d => `${d.mount}-${d.label}`).join('|');
  if (select.dataset.disksKey === currentKey) return;
  select.dataset.disksKey = currentKey;

  const prevValue = selectedDiskMount;
  select.innerHTML = '';
  let foundPrev = false;

  for (const d of disks) {
    const opt = document.createElement('option');
    opt.value = d.mount;
    const labelText = d.label ? `${d.mount} (${d.label})` : d.mount;
    opt.textContent = labelText;
    if (d.mount === prevValue) {
      opt.selected = true;
      foundPrev = true;
    }
    select.appendChild(opt);
  }

  if (!foundPrev && disks.length > 0) {
    const defaultC = disks.find(d => d.mount === 'C:') || disks[0];
    selectedDiskMount = defaultC.mount;
    select.value = selectedDiskMount;
  }
}

function renderActiveDiskMetric() {
  if (!lastReceivedDisks || lastReceivedDisks.length === 0) return;
  const activeDisk = lastReceivedDisks.find(d => d.mount === selectedDiskMount) || lastReceivedDisks.find(d => d.mount === 'C:') || lastReceivedDisks[0];
  if (!activeDisk) return;

  renderDiskMetricValues(activeDisk.usage, activeDisk.totalGB, activeDisk.freeGB);
}

function renderDiskMetricValues(usage, totalGB, freeGB) {
  const lpct = document.getElementById('dash-disk-linear-pct');
  if (lpct) lpct.textContent = `${usage}`;

  const lfill = document.getElementById('dash-disk-linear-fill');
  const diskStatus = document.getElementById('dash-disk-linear-status');

  if (lfill) {
    lfill.style.width = `${usage}%`;

    if (usage >= 90) {
      lfill.style.background = 'linear-gradient(90deg, #dc2626 0%, #ef4444 100%)';
      lfill.style.boxShadow = '0 0 12px rgba(239, 68, 68, 0.7)';
      if (lpct) lpct.style.color = '#ef4444';
      if (diskStatus) { diskStatus.textContent = 'Crítico'; diskStatus.style.color = '#ef4444'; }
    } else if (usage >= 75) {
      lfill.style.background = 'linear-gradient(90deg, #d97706 0%, #f59e0b 100%)';
      lfill.style.boxShadow = '0 0 10px rgba(245, 158, 11, 0.5)';
      if (lpct) lpct.style.color = '#f59e0b';
      if (diskStatus) { diskStatus.textContent = 'Pouco Espaço'; diskStatus.style.color = '#f59e0b'; }
    } else {
      lfill.style.background = 'linear-gradient(90deg, #4f46e5 0%, #818cf8 100%)';
      lfill.style.boxShadow = 'none';
      if (lpct) lpct.style.color = '#f1f5f9';
      if (diskStatus) { diskStatus.textContent = 'Normal'; diskStatus.style.color = '#22c55e'; }
    }
  }

  if (totalGB !== undefined) {
    const t2 = document.getElementById('dash-disk-linear-total');
    if (t2) {
      const displayTotal = totalGB >= 1000 ? `${(totalGB / 1024).toFixed(1)}TB` : `${totalGB}GB`;
      t2.textContent = displayTotal;
      if (freeGB !== undefined) {
        t2.title = `Espaço livre: ${freeGB} GB`;
      }
    }
  }
}
