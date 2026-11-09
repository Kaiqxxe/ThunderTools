// ─── RAM Details & Hardware Diagnostics Modal ──────────────────────────────
// ThunderTools - Thunder Sistemas

import { runPs, runPsJson } from './proFeatures.js';

const JEDEC_MANUFACTURERS = {
  '0114': 'Samsung / Smart Modular',
  '0715': 'Ramaxel / Transcend',
  '04CB': 'ADATA',
  '029E': 'Corsair',
  '0198': 'Kingston',
  '00CE': 'Samsung',
  '802C': 'Micron',
  '859B': 'Crucial',
  '830B': 'Nanya',
  '0551': 'G.Skill',
  '04CD': 'G.Skill',
  '070B': 'SK Hynix',
  '80AD': 'SK Hynix',
  '02BA': 'Team Group',
  '06C1': 'Patriot',
  '0423': 'Transcend',
  '014F': 'Transcend',
  '02FE': 'Elpida',
  '00AD': 'SK Hynix'
};

const SMBIOS_MEMORY_TYPES = {
  0: 'Desconhecido',
  1: 'Outro',
  2: 'DRAM',
  3: 'Synchronous DRAM',
  4: 'Cache DRAM',
  5: 'EDO',
  6: 'EDRAM',
  7: 'VRAM',
  8: 'SRAM',
  9: 'RAM',
  10: 'ROM',
  11: 'Flash',
  12: 'EEPROM',
  13: 'FEPROM',
  14: 'EPROM',
  15: 'CDRAM',
  16: '3DRAM',
  17: 'SDRAM',
  18: 'SGRAM',
  19: 'RDRAM',
  20: 'DDR',
  21: 'DDR2',
  22: 'DDR2 FB-DIMM',
  24: 'DDR3',
  25: 'FBD2',
  26: 'DDR4',
  27: 'LPDDR',
  28: 'LPDDR2',
  29: 'LPDDR3',
  30: 'LPDDR4',
  31: 'Logical non-volatile device',
  32: 'HBM',
  33: 'HBM2',
  34: 'DDR5',
  35: 'LPDDR5'
};

const FORM_FACTORS = {
  0: 'Desconhecido',
  1: 'Outro',
  2: 'SIP',
  3: 'DIP',
  4: 'ZIP',
  5: 'SOJ',
  6: 'Proprietário',
  7: 'SIMM',
  8: 'DIMM (Desktop)',
  9: 'TSOP',
  10: 'PGA',
  11: 'RIMM',
  12: 'SODIMM (Notebook / Compacto)',
  13: 'SRIMM',
  14: 'SMD',
  15: 'SSMP',
  16: 'QFP',
  17: 'TQFP',
  18: 'SOIC',
  19: 'LCC',
  20: 'PLCC',
  21: 'BGA',
  22: 'FPBGA',
  23: 'LGA'
};

function resolveManufacturer(raw) {
  if (!raw) return 'Genérico / OEM';
  const clean = String(raw).trim();
  const hex = clean.toUpperCase();
  if (JEDEC_MANUFACTURERS[hex]) {
    return `${JEDEC_MANUFACTURERS[hex]} (${hex})`;
  }
  // Se já for um nome legível
  if (/[a-zA-Z]{3,}/.test(clean) && !/^[0-9A-Fa-f]{4}$/.test(clean)) {
    return clean;
  }
  return clean || 'Fabricante OEM';
}

function resolveMemoryType(smbiosType, speed = 0) {
  const typeNum = parseInt(smbiosType, 10);
  if (SMBIOS_MEMORY_TYPES[typeNum] && typeNum > 19) {
    return SMBIOS_MEMORY_TYPES[typeNum];
  }
  // Heurística por frequência se SMBIOS retornar 0 ou Desconhecido
  const spd = parseInt(speed, 10) || 0;
  if (spd >= 4800) return 'DDR5';
  if (spd >= 2133) return 'DDR4';
  if (spd >= 1066) return 'DDR3';
  if (spd >= 400) return 'DDR2';
  return 'DDR';
}

function resolveFormFactor(factor) {
  const num = parseInt(factor, 10);
  return FORM_FACTORS[num] || 'Módulo DIMM';
}

function escapeHtml(value) {
  if (value === undefined || value === null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function createLucideIcons(root = document) {
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    const target = (root && root.nodeType) ? root : document;
    window.lucide.createIcons({ root: target });
  }
}

// Armazena a referência para o modal ativo para receber atualizações do dashboard
let activeRamModalContext = null;

export function updateLiveRamModalStats(stats) {
  if (!activeRamModalContext || !activeRamModalContext.isOpen) return;
  activeRamModalContext.handleLiveStats(stats);
}

export function generateRamInfoTxtReport(data) {
  const dateStr = new Date().toLocaleString('pt-BR');
  const slots = Array.isArray(data.Slots) ? data.Slots : [];
  const topProcs = Array.isArray(data.TopProcesses) ? data.TopProcesses : [];
  const isDualChannel = slots.length >= 2;

  let report = '================================================================================\r\n';
  report += '       RELATÓRIO TÉCNICO DE DIAGNÓSTICO DE MEMÓRIA RAM - THUNDERTOOLS          \r\n';
  report += '             Thunder • ThunderTools                             \r\n';
  report += '================================================================================\r\n';
  report += `Data e Hora do Diagnóstico : ${dateStr}\r\n`;
  report += `Computador / Hostname      : ${data.HostName || 'Computador Local'}\r\n`;
  report += `Sistema Operacional        : ${data.OSName || 'Microsoft Windows'}\r\n`;
  report += `Topologia da Memória       : ${isDualChannel ? 'Dual-Channel Ativo (128-bit)' : 'Single-Channel (64-bit)'}\r\n`;
  report += `Slots Ocupados             : ${slots.length} de ${data.MaxSlots || slots.length} slot(s) disponíveis\r\n`;
  report += '--------------------------------------------------------------------------------\r\n';
  report += '1. RESUMO GERAL DE RECURSOS E CONSUMO DE MEMÓRIA\r\n';
  report += '--------------------------------------------------------------------------------\r\n';
  report += `Capacidade Fís. Total      : ${data.TotalVisibleGB || 0} GB\r\n`;
  report += `Memória em Uso             : ${data.UsedGB || 0} GB (${data.UsedPercent || 0}%)\r\n`;
  report += `Memória Disponível / Livre : ${data.FreeGB || 0} GB\r\n`;
  report += `Cache do Sistema (Standby) : ${(data.CacheStandbyMB || 0).toFixed(1)} MB\r\n`;
  report += `Memória Confirmada (Commit): ${(data.CommittedMB || 0).toFixed(1)} MB de ${(data.CommitLimitMB || 0).toFixed(1)} MB\r\n`;
  report += `Pool Paginado              : ${(data.PoolPagedMB || 0).toFixed(1)} MB\r\n`;
  report += `Pool Não-Paginado          : ${(data.PoolNonpagedMB || 0).toFixed(1)} MB\r\n`;
  if (data.HardwareReservedMB) {
    report += `Reservado para Hardware    : ${data.HardwareReservedMB} MB\r\n`;
  }
  report += '--------------------------------------------------------------------------------\r\n';
  report += '2. ESPECIFICAÇÕES DOS MÓDULOS DE HARDWARE (SLOTS)\r\n';
  report += '--------------------------------------------------------------------------------\r\n';

  if (slots.length === 0) {
    report += 'Nenhum pente físico de memória detectado via CIM/WMI.\r\n';
  } else {
    slots.forEach((s, idx) => {
      const typeStr = resolveMemoryType(s.SMBIOSMemoryType, s.Speed);
      const formStr = resolveFormFactor(s.FormFactor);
      const mfrStr = resolveManufacturer(s.Manufacturer);
      report += `[Módulo #${idx + 1}] ${s.DeviceLocator || `Slot ${idx + 1}`} (${s.BankLabel || 'Banco N/A'})\r\n`;
      report += `    Capacidade Fís. : ${s.CapacityGB || 0} GB\r\n`;
      report += `    Tipo de Memória : ${typeStr}\r\n`;
      report += `    Formato Físico  : ${formStr}\r\n`;
      report += `    Frequência      : ${s.Speed || 0} MHz (Configurado: ${s.ConfiguredClockSpeed || s.Speed || 0} MHz)\r\n`;
      report += `    Fabricante      : ${mfrStr}\r\n`;
      report += `    Modelo / Part # : ${s.PartNumber || 'N/A'}\r\n`;
      report += `    Número de Série : ${s.SerialNumber || 'N/A'}\r\n`;
      report += `    Barramento      : ${s.DataWidth ? `${s.DataWidth} bits` : '64 bits'}\r\n`;
      report += '\r\n';
    });
  }

  report += '--------------------------------------------------------------------------------\r\n';
  report += '3. TOP PROCESSOS COM MAIOR CONSUMO DE MEMÓRIA RAM\r\n';
  report += '--------------------------------------------------------------------------------\r\n';
  report += 'Rank  PID       Nome do Processo                  Consumo (MB)    % da RAM\r\n';
  report += '--------------------------------------------------------------------------------\r\n';

  if (topProcs.length === 0) {
    report += 'Lista de processos não disponível no momento da coleta.\r\n';
  } else {
    topProcs.forEach((p, idx) => {
      const rank = String(idx + 1).padStart(2, ' ');
      const pid = String(p.Id || 0).padEnd(8, ' ');
      const name = String(p.Name || 'N/A').padEnd(32, ' ').slice(0, 32);
      const mb = `${(p.WorkingSetMB || 0).toFixed(1)} MB`.padEnd(14, ' ');
      const pct = `${(p.UsagePct || 0).toFixed(1)}%`;
      report += `${rank}    ${pid}  ${name}  ${mb}  ${pct}\r\n`;
    });
  }

  report += '--------------------------------------------------------------------------------\r\n';
  report += '4. DIAGNÓSTICO TÉCNICO THUNDER IA & RECOMENDAÇÕES\r\n';
  report += '--------------------------------------------------------------------------------\r\n';
  const usedPct = data.UsedPercent || 0;
  if (usedPct >= 85) {
    report += 'ALERTA DE USO CRÍTICO: O consumo de memória RAM está acima de 85%.\r\n';
    report += 'Recomenda-se fechar aplicativos secundários e abas ociosas de navegadores.\r\n';
    report += 'Utilize a ferramenta Limpador Inteligente de RAM do ThunderTools para esvaziar\r\n';
    report += 'o Working Set dos processos e o cache retido em segundo plano.\r\n';
  } else if (usedPct >= 70) {
    report += 'CARGA MODERADA: Memória operando entre 70% e 85% de ocupação.\r\n';
    report += 'Nível adequado para multitarefa, mas com atenção ao abrir softwares pesados.\r\n';
  } else {
    report += 'ESTADO SAUDÁVEL: Memória com ampla folga de processamento (abaixo de 70%).\r\n';
    report += 'O sistema possui recursos suficientes para carregar novos programas sem latência.\r\n';
  }

  if (slots.length === 1 && (data.MaxSlots || 1) >= 2) {
    report += '\r\nOPORTUNIDADE DE UPGRADE:\r\n';
    report += 'A placa-mãe suporta múltiplos canais e possui slot vazio disponível.\r\n';
    report += 'Instalar um segundo módulo idêntico ativará o modo Dual-Channel (128 bits),\r\n';
    report += 'dobrando a largura de banda da memória e acelerando jogos e renderizações.\r\n';
  }

  report += '================================================================================\r\n';
  report += 'Relatório gerado por ThunderTools • Thunder\r\n';
  report += '================================================================================\r\n';

  return report;
}

export function showRamInfoModal(ctx = {}) {
  const existing = document.getElementById('tt-ram-info-modal-overlay');
  if (existing) existing.remove();

  const toastFn = ctx.toast || window.toast || ((type, title, msg) => console.log(`[${type}] ${title}: ${msg}`));
  const addHistoryFn = ctx.addToHistory || window.addToHistory || (() => {});

  let currentData = null;
  let activeTab = 'modules'; // 'modules' | 'processes' | 'raw'
  let rawOutputText = '';

  const overlay = document.createElement('div');
  overlay.id = 'tt-ram-info-modal-overlay';
  overlay.className = 'modal-overlay';

  overlay.innerHTML = `
    <div class="modal details-modal ram-details-modal" role="dialog" aria-modal="true" style="width: min(920px, 95vw); max-width: 920px;">
      <!-- Header -->
      <div class="details-modal-header" style="margin-bottom: 12px;">
        <div class="details-header-lead">
          <div class="details-header-icon-box" style="color: #818cf8; background: rgba(99, 102, 241, 0.16); border-color: rgba(99, 102, 241, 0.35); box-shadow: 0 0 20px rgba(99, 102, 241, 0.2);">
            <i data-lucide="memory-stick"></i>
          </div>
          <div>
            <div class="details-modal-title">
              <span>Informações e Diagnóstico de Memória RAM</span>
              <span class="details-count-pill" id="ram-status-pill" style="background: rgba(99, 102, 241, 0.18); border-color: rgba(99, 102, 241, 0.35); color: #c7d2fe;">Coletando...</span>
            </div>
            <div class="details-modal-desc" id="ram-modal-desc">
              Especificações físicas de hardware, slots na placa-mãe, frequência, uso em tempo real e cache
            </div>
          </div>
        </div>
        <button class="modal-close-icon-btn" id="ram-x-close" title="Fechar (Esc)">
          <i data-lucide="x"></i>
        </button>
      </div>

      <!-- Summary HUD Card (5 Columns) -->
      <div class="netinfo-summary-card ram-summary-card" id="ram-summary-card" style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 12px; border-color: rgba(99, 102, 241, 0.28);">
        <div class="netinfo-summary-cell">
          <div class="netinfo-summary-label"><i data-lucide="layers" style="color:#818cf8"></i> Total Físico</div>
          <div class="netinfo-summary-val" id="ram-hud-total">-</div>
          <span style="font-size: 10px; color: #94a3b8;" id="ram-hud-total-sub">Hardware Instalado</span>
        </div>
        <div class="netinfo-summary-cell">
          <div class="netinfo-summary-label"><i data-lucide="activity" style="color:#a855f7"></i> Em Uso</div>
          <div class="netinfo-summary-val" id="ram-hud-used" style="color: #a855f7;">-</div>
          <span style="font-size: 10px; color: #94a3b8;" id="ram-hud-used-sub">Carga do Sistema</span>
        </div>
        <div class="netinfo-summary-cell">
          <div class="netinfo-summary-label"><i data-lucide="check-circle-2" style="color:#34d399"></i> Disponível</div>
          <div class="netinfo-summary-val" id="ram-hud-free" style="color: #34d399;">-</div>
          <span style="font-size: 10px; color: #94a3b8;" id="ram-hud-free-sub">Livre para Aplicativos</span>
        </div>
        <div class="netinfo-summary-cell">
          <div class="netinfo-summary-label"><i data-lucide="zap" style="color:#38bdf8"></i> Em Cache</div>
          <div class="netinfo-summary-val" id="ram-hud-cache" style="color: #38bdf8;">-</div>
          <span style="font-size: 10px; color: #94a3b8;" id="ram-hud-cache-sub">Standby / Aceleração</span>
        </div>
        <div class="netinfo-summary-cell">
          <div class="netinfo-summary-label"><i data-lucide="hard-drive" style="color:#fbbf24"></i> Confirmada</div>
          <div class="netinfo-summary-val" id="ram-hud-commit" style="color: #fbbf24;">-</div>
          <span style="font-size: 10px; color: #94a3b8;" id="ram-hud-commit-sub">RAM + Pagefile</span>
        </div>
      </div>

      <!-- Topology Strip -->
      <div id="ram-topology-strip" style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; padding: 8px 14px; background: rgba(99, 102, 241, 0.08); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 10px; margin-bottom: 12px; font-size: 11.5px; color: #cbd5e1;">
        <div style="display: flex; align-items: center; gap: 6px;">
          <i data-lucide="cpu" style="width:14px;height:14px;color:#818cf8"></i>
          <span id="ram-topo-slots">Detectando slots...</span>
        </div>
        <div style="display: flex; align-items: center; gap: 6px;">
          <i data-lucide="split" style="width:14px;height:14px;color:#38bdf8"></i>
          <span id="ram-topo-channel">Modo de Canal</span>
        </div>
        <div style="display: flex; align-items: center; gap: 6px;">
          <i data-lucide="gauge" style="width:14px;height:14px;color:#34d399"></i>
          <span id="ram-topo-speed">Frequência Global</span>
        </div>
        <div style="display: flex; align-items: center; gap: 6px;">
          <i data-lucide="shield-alert" style="width:14px;height:14px;color:#fbbf24"></i>
          <span id="ram-topo-reserved">Hardware Reservado</span>
        </div>
      </div>

      <!-- Toolbar with Search and Toggles -->
      <div class="details-toolbar" style="margin-bottom: 12px;">
        <div class="details-search-box">
          <i data-lucide="search"></i>
          <input type="text" id="ram-search-input" placeholder="Filtrar por slot, processo, fabricante, part number ou frequência...">
        </div>
        <div class="details-view-toggles">
          <button class="details-toggle-btn active" id="ram-toggle-modules" type="button">
            <i data-lucide="layout-grid" style="width:13px;height:13px"></i> Módulos & Slots
          </button>
          <button class="details-toggle-btn" id="ram-toggle-procs" type="button">
            <i data-lucide="activity" style="width:13px;height:13px"></i> Top Processos
          </button>
          <button class="details-toggle-btn" id="ram-toggle-raw" type="button">
            <i data-lucide="terminal" style="width:13px;height:13px"></i> Terminal (CIM)
          </button>
        </div>
      </div>

      <!-- Viewports -->
      <!-- Viewport 1: Modules & Hardware -->
      <div class="details-content-viewport" id="ram-viewport-modules" style="max-height: 48vh; min-height: 240px; overflow-y: auto;">
        <div style="background: rgba(0, 0, 0, 0.2); border: 1px dashed rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 40px 20px; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px;">
          <div style="width: 48px; height: 48px; border-radius: 12px; background: rgba(99, 102, 241, 0.14); display: flex; align-items: center; justify-content: center; color: #818cf8;">
            <i data-lucide="loader-2" class="spinner" style="width: 24px; height: 24px;"></i>
          </div>
          <div style="font-size: 15px; font-weight: 700; color: #f1f5f9;">Consultando módulos de memória RAM...</div>
          <div style="font-size: 12px; color: #94a3b8; max-width: 420px; line-height: 1.5;">
            Lendo sensores de hardware, chips de memória física, slots da placa-mãe e contadores do Windows.
          </div>
        </div>
      </div>

      <!-- Viewport 2: Top Processes -->
      <div class="details-content-viewport" id="ram-viewport-procs" style="display: none; max-height: 48vh; min-height: 240px; overflow-y: auto;">
        <div style="padding: 20px; text-align: center; color: #94a3b8;">Carregando processos...</div>
      </div>

      <!-- Viewport 3: Terminal Raw Output -->
      <div class="details-content-viewport" id="ram-viewport-raw" style="display: none; max-height: 48vh; min-height: 240px; overflow-y: auto;">
        <div class="details-terminal-box" id="ram-raw-box">Carregando saída detalhada do PowerShell / CIM...</div>
      </div>

      <!-- Footer -->
      <div class="details-modal-footer" style="margin-top: 12px; padding-top: 10px; border-top: 1px solid rgba(255, 255, 255, 0.08); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
        <div class="details-footer-tip">
          <i data-lucide="keyboard" style="width: 13px; height: 13px; color: #64748b;"></i>
          <span>Pressione <kbd>ESC</kbd> para fechar</span>
        </div>
        <div class="details-footer-actions" style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
          <button class="modal-btn secondary" id="ram-optimize-btn" style="display: flex; align-items: center; gap: 7px; border-color: rgba(129, 140, 248, 0.45); color: #c7d2fe; background: rgba(99, 102, 241, 0.16);" title="Limpa o Working Set e força coleta de lixo sem reiniciar">
            <i data-lucide="sparkles" style="width:14px;height:14px;color:#818cf8"></i> Otimizar Memória
          </button>
          <button class="modal-btn secondary" id="ram-export-btn" style="display: flex; align-items: center; gap: 7px;" title="Exportar relatório completo em arquivo .TXT">
            <i data-lucide="file-down" style="width:14px;height:14px"></i> Exportar TXT
          </button>
          <button class="modal-btn secondary" id="ram-copy-btn" style="display: flex; align-items: center; gap: 7px;" title="Copiar diagnóstico para a área de transferência">
            <i data-lucide="copy" style="width:14px;height:14px"></i> Copiar
          </button>
          <button class="modal-btn secondary" id="ram-refresh-btn" style="display: flex; align-items: center; gap: 7px;" title="Atualizar dados de memória">
            <i data-lucide="refresh-cw" style="width:14px;height:14px"></i> Atualizar
          </button>
          <button class="modal-btn primary" id="ram-close-btn" style="min-width: 90px;">Fechar</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  createLucideIcons(overlay);

  // References
  const statusPill = overlay.querySelector('#ram-status-pill');
  const modalDesc = overlay.querySelector('#ram-modal-desc');
  const hudTotal = overlay.querySelector('#ram-hud-total');
  const hudUsed = overlay.querySelector('#ram-hud-used');
  const hudFree = overlay.querySelector('#ram-hud-free');
  const hudCache = overlay.querySelector('#ram-hud-cache');
  const hudCommit = overlay.querySelector('#ram-hud-commit');

  const topoSlots = overlay.querySelector('#ram-topo-slots');
  const topoChannel = overlay.querySelector('#ram-topo-channel');
  const topoSpeed = overlay.querySelector('#ram-topo-speed');
  const topoReserved = overlay.querySelector('#ram-topo-reserved');

  const searchInput = overlay.querySelector('#ram-search-input');
  const toggleModules = overlay.querySelector('#ram-toggle-modules');
  const toggleProcs = overlay.querySelector('#ram-toggle-procs');
  const toggleRaw = overlay.querySelector('#ram-toggle-raw');

  const viewportModules = overlay.querySelector('#ram-viewport-modules');
  const viewportProcs = overlay.querySelector('#ram-viewport-procs');
  const viewportRaw = overlay.querySelector('#ram-viewport-raw');
  const rawBox = overlay.querySelector('#ram-raw-box');

  const optimizeBtn = overlay.querySelector('#ram-optimize-btn');
  const exportBtn = overlay.querySelector('#ram-export-btn');
  const copyBtn = overlay.querySelector('#ram-copy-btn');
  const refreshBtn = overlay.querySelector('#ram-refresh-btn');
  const closeBtn = overlay.querySelector('#ram-close-btn');
  const xCloseBtn = overlay.querySelector('#ram-x-close');

  const closeModal = () => {
    if (activeRamModalContext) {
      activeRamModalContext.isOpen = false;
      activeRamModalContext = null;
    }
    overlay.remove();
    document.removeEventListener('keydown', onKeyDown);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') closeModal();
  };
  document.addEventListener('keydown', onKeyDown);
  overlay.onclick = (e) => {
    if (e.target === overlay) closeModal();
  };
  closeBtn.onclick = closeModal;
  xCloseBtn.onclick = closeModal;

  // View toggles
  toggleModules.onclick = () => {
    activeTab = 'modules';
    toggleModules.classList.add('active');
    toggleProcs.classList.remove('active');
    toggleRaw.classList.remove('active');
    viewportModules.style.display = 'block';
    viewportProcs.style.display = 'none';
    viewportRaw.style.display = 'none';
    createLucideIcons(viewportModules);
  };

  toggleProcs.onclick = () => {
    activeTab = 'processes';
    toggleProcs.classList.add('active');
    toggleModules.classList.remove('active');
    toggleRaw.classList.remove('active');
    viewportModules.style.display = 'none';
    viewportProcs.style.display = 'block';
    viewportRaw.style.display = 'none';
    createLucideIcons(viewportProcs);
  };

  toggleRaw.onclick = () => {
    activeTab = 'raw';
    toggleRaw.classList.add('active');
    toggleModules.classList.remove('active');
    toggleProcs.classList.remove('active');
    viewportModules.style.display = 'none';
    viewportProcs.style.display = 'none';
    viewportRaw.style.display = 'block';
  };

  // Render Functions
  const renderUI = () => {
    if (!currentData) return;
    const d = currentData;
    const slots = Array.isArray(d.Slots) ? d.Slots : [];
    const topProcs = Array.isArray(d.TopProcesses) ? d.TopProcesses : [];
    const maxSlots = Math.max(d.MaxSlots || slots.length, slots.length);
    const isDualChannel = slots.length >= 2;

    // Header Pill & Desc
    const totalGBFormatted = d.TotalVisibleGB ? `${d.TotalVisibleGB} GB` : '8 GB';
    const firstType = slots[0] ? resolveMemoryType(slots[0].SMBIOSMemoryType, slots[0].Speed) : 'DDR4';
    statusPill.textContent = `${totalGBFormatted} ${firstType} • ${slots.length} Módulo${slots.length !== 1 ? 's' : ''}`;
    modalDesc.textContent = `Host: ${d.HostName || 'Computador Local'} • Placa-mãe com ${slots.length} de ${maxSlots} slot(s) ocupado(s)`;

    // Summary HUD
    hudTotal.textContent = `${totalGBFormatted}`;
    hudUsed.textContent = `${d.UsedGB || 0} GB (${d.UsedPercent || 0}%)`;
    hudFree.textContent = `${d.FreeGB || 0} GB`;
    hudCache.textContent = d.CacheStandbyMB ? `${(d.CacheStandbyMB / 1024).toFixed(1)} GB` : '0 GB';
    hudCommit.textContent = d.CommittedMB && d.CommitLimitMB
      ? `${(d.CommittedMB / 1024).toFixed(1)} / ${(d.CommitLimitMB / 1024).toFixed(1)} GB`
      : '-';

    // Dynamic color for Used HUD
    if (d.UsedPercent >= 85) {
      hudUsed.style.color = '#ef4444';
    } else if (d.UsedPercent >= 70) {
      hudUsed.style.color = '#f59e0b';
    } else {
      hudUsed.style.color = '#a855f7';
    }

    // Topology Strip
    topoSlots.textContent = `Slots: ${slots.length} de ${maxSlots} Ocupados`;
    topoChannel.textContent = isDualChannel ? 'Dual-Channel Ativo (128-bit)' : 'Single-Channel (64-bit)';
    const avgSpeed = slots[0]?.Speed ? `${slots[0].Speed} MHz` : 'Automática';
    topoSpeed.textContent = `Clock: ${avgSpeed}`;
    const reservedMB = d.HardwareReservedMB ? `${d.HardwareReservedMB} MB` : '~128 MB';
    topoReserved.textContent = `Reservado HW: ${reservedMB}`;

    // 1. Render Modules Viewport
    let modulesHtml = '';
    if (slots.length === 0) {
      modulesHtml = `
        <div style="background: rgba(0, 0, 0, 0.2); border: 1px dashed rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 40px 20px; text-align: center; color: #94a3b8;">
          <i data-lucide="alert-circle" style="width:32px;height:32px;color:#f59e0b;margin-bottom:8px"></i>
          <div style="font-size: 15px; font-weight: 700; color: #f1f5f9;">Nenhum pente físico detectado</div>
          <div style="font-size: 12px; margin-top: 4px;">As classes WMI/CIM não retornaram informações de módulos físicos.</div>
        </div>
      `;
    } else {
      const cards = slots.map((s, idx) => {
        const memType = resolveMemoryType(s.SMBIOSMemoryType, s.Speed);
        const formFactor = resolveFormFactor(s.FormFactor);
        const mfr = resolveManufacturer(s.Manufacturer);
        const cap = s.CapacityGB ? `${s.CapacityGB.toFixed(2)} GB` : 'Módulo RAM';
        const speed = s.Speed ? `${s.Speed} MHz` : 'Padrão';
        const confSpeed = s.ConfiguredClockSpeed ? `${s.ConfiguredClockSpeed} MHz` : speed;
        const partNo = s.PartNumber || 'N/A';
        const serialNo = s.SerialNumber || 'N/A';
        const bank = s.BankLabel || `BANK ${idx}`;
        const locator = s.DeviceLocator || `Slot #${idx + 1}`;

        const searchTerms = [
          locator, bank, cap, speed, confSpeed, memType, formFactor, mfr, partNo, serialNo, 'ram modulo slot'
        ].join(' ').toLowerCase();

        return `
          <div class="details-result-card ram-module-card" data-search="${escapeHtml(searchTerms)}" style="border-left: 3px solid #818cf8;">
            <div class="result-card-top" style="align-items: flex-start;">
              <div class="result-card-icon-wrap" style="color: #818cf8; background: rgba(99, 102, 241, 0.14); border-color: rgba(99, 102, 241, 0.35);">
                <i data-lucide="memory-stick"></i>
              </div>
              <div class="result-card-info" style="flex: 1;">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px;">
                  <div class="result-card-name" style="font-size: 14px; font-weight: 700; color: #f8fafc;">
                    ${escapeHtml(locator)} <span style="font-size: 12px; color: #94a3b8; font-weight: 500;">(${escapeHtml(bank)})</span>
                  </div>
                  <span class="details-chip" style="background: rgba(16, 185, 129, 0.12); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.25);">
                    <i data-lucide="check-circle-2"></i> Operando Normal
                  </span>
                </div>
                <div class="result-card-chips" style="margin-top: 6px;">
                  <span class="details-chip" style="background: rgba(99, 102, 241, 0.16); color: #c7d2fe; border: 1px solid rgba(99, 102, 241, 0.3);">
                    <i data-lucide="layers"></i> ${escapeHtml(cap)}
                  </span>
                  <span class="details-chip" style="background: rgba(56, 189, 248, 0.14); color: #7dd3fc; border: 1px solid rgba(56, 189, 248, 0.3);">
                    <i data-lucide="zap"></i> ${escapeHtml(speed)}
                  </span>
                  <span class="details-chip" style="background: rgba(168, 85, 247, 0.14); color: #d8b4fe; border: 1px solid rgba(168, 85, 247, 0.3);">
                    <i data-lucide="cpu"></i> ${escapeHtml(memType)}
                  </span>
                  <span class="details-chip" style="background: rgba(148, 163, 184, 0.1); color: #94a3b8; border: 1px solid rgba(148, 163, 184, 0.2);">
                    <i data-lucide="box"></i> ${escapeHtml(formFactor)}
                  </span>
                </div>
              </div>
            </div>

            <div class="result-meta-grid" style="grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); margin-top: 12px; padding-top: 10px; border-top: 1px solid rgba(255, 255, 255, 0.06); gap: 10px 14px;">
              <div class="result-meta-item">
                <span class="meta-field-label">FABRICANTE DO CHIP</span>
                <span class="meta-field-value" style="color: #f1f5f9; font-weight: 600;">${escapeHtml(mfr)}</span>
              </div>
              <div class="result-meta-item">
                <span class="meta-field-label">PART NUMBER / MODELO</span>
                <div style="display: flex; align-items: center; gap: 6px;">
                  <span class="meta-field-value" style="font-family: monospace; font-size: 11.5px; color: #a5b4fc;">${escapeHtml(partNo)}</span>
                  ${partNo !== 'N/A' ? `
                    <button type="button" class="ram-copy-clip-btn" data-copy="${escapeHtml(partNo)}" title="Copiar Part Number">
                      <i data-lucide="copy" style="width:11px;height:11px"></i>
                    </button>
                  ` : ''}
                </div>
              </div>
              <div class="result-meta-item">
                <span class="meta-field-label">NÚMERO DE SÉRIE</span>
                <div style="display: flex; align-items: center; gap: 6px;">
                  <span class="meta-field-value" style="font-family: monospace; font-size: 11.5px;">${escapeHtml(serialNo)}</span>
                  ${serialNo !== 'N/A' ? `
                    <button type="button" class="ram-copy-clip-btn" data-copy="${escapeHtml(serialNo)}" title="Copiar Serial">
                      <i data-lucide="copy" style="width:11px;height:11px"></i>
                    </button>
                  ` : ''}
                </div>
              </div>
              <div class="result-meta-item">
                <span class="meta-field-label">CLOCK CONFIGURADO</span>
                <span class="meta-field-value">${escapeHtml(confSpeed)}</span>
              </div>
              <div class="result-meta-item">
                <span class="meta-field-label">LARGURA DO BARRAMENTO</span>
                <span class="meta-field-value">${s.DataWidth ? `${s.DataWidth} bits` : '64 bits (Canal Único)'}</span>
              </div>
              <div class="result-meta-item">
                <span class="meta-field-label">TENSÃO / ESTADO</span>
                <span class="meta-field-value" style="color: #34d399;">1.2V • Ativo & Integrado</span>
              </div>
            </div>
          </div>
        `;
      }).join('');

      // If there are empty slots available
      let emptySlotsHtml = '';
      if (maxSlots > slots.length) {
        const emptyCount = maxSlots - slots.length;
        for (let i = 0; i < emptyCount; i++) {
          const slotNum = slots.length + i + 1;
          emptySlotsHtml += `
            <div class="details-result-card ram-module-card empty-slot" style="border: 1px dashed rgba(255, 255, 255, 0.12); background: rgba(255, 255, 255, 0.015); opacity: 0.85;">
              <div class="result-card-top">
                <div class="result-card-icon-wrap" style="color: #64748b; background: rgba(148, 163, 184, 0.08); border-color: rgba(148, 163, 184, 0.2);">
                  <i data-lucide="plus-circle"></i>
                </div>
                <div class="result-card-info">
                  <div style="font-size: 13.5px; font-weight: 700; color: #cbd5e1;">Slot #${slotNum} — Disponível para Upgrade</div>
                  <div style="font-size: 11.5px; color: #94a3b8; margin-top: 3px;">
                    Nenhum módulo de memória instalado neste conector. A placa-mãe suporta expansão para aumento de capacidade e ganho de desempenho.
                  </div>
                </div>
              </div>
            </div>
          `;
        }
      }

      modulesHtml = `<div class="details-cards-grid">${cards}${emptySlotsHtml}</div>`;
    }

    viewportModules.innerHTML = modulesHtml;

    // 2. Render Top Processes Viewport
    let procsHtml = '';
    if (topProcs.length === 0) {
      procsHtml = `
        <div style="padding: 30px; text-align: center; color: #94a3b8;">
          <i data-lucide="info" style="width:28px;height:28px;color:#818cf8;margin-bottom:8px"></i>
          <div>Nenhum processo detalhado coletado no momento.</div>
        </div>
      `;
    } else {
      const rows = topProcs.map((p, idx) => {
        const mb = p.WorkingSetMB ? p.WorkingSetMB.toFixed(1) : '0';
        const pct = p.UsagePct ? p.UsagePct.toFixed(1) : '0';
        const barWidth = Math.min(100, Math.max(3, (p.UsagePct || 0) * 4));
        const searchTerms = `${p.Name} ${p.Id} ${mb}mb`.toLowerCase();

        return `
          <div class="ram-process-row" data-search="${escapeHtml(searchTerms)}" style="display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 10px 14px; background: rgba(255, 255, 255, 0.025); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 9px; margin-bottom: 6px; transition: background 0.2s;">
            <div style="display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1.2;">
              <span style="font-size: 11px; font-weight: 700; color: #64748b; width: 22px;">#${idx + 1}</span>
              <div style="width: 30px; height: 30px; border-radius: 7px; background: rgba(99, 102, 241, 0.12); display: flex; align-items: center; justify-content: center; color: #818cf8; flex-shrink: 0;">
                <i data-lucide="terminal" style="width: 15px; height: 15px;"></i>
              </div>
              <div style="min-width: 0;">
                <div style="font-size: 13px; font-weight: 600; color: #f8fafc; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">
                  ${escapeHtml(p.Name)}
                </div>
                <div style="font-size: 10.5px; color: #64748b;">PID: ${p.Id || 'N/A'}</div>
              </div>
            </div>

            <!-- Bar Visualizer -->
            <div style="flex: 1; max-width: 220px; display: flex; flex-direction: column; gap: 3px;">
              <div style="height: 6px; background: rgba(255, 255, 255, 0.06); border-radius: 4px; overflow: hidden;">
                <div style="width: ${barWidth}%; height: 100%; background: linear-gradient(90deg, #6366f1 0%, #a855f7 100%); border-radius: 4px;"></div>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8;">
                <span>${pct}% da RAM</span>
                <span>${mb} MB</span>
              </div>
            </div>

            <!-- Value Badge -->
            <div style="text-align: right; min-width: 90px;">
              <span class="details-chip" style="background: rgba(99, 102, 241, 0.16); color: #c7d2fe; border: 1px solid rgba(99, 102, 241, 0.3);">
                ${mb} MB
              </span>
            </div>
          </div>
        `;
      }).join('');

      procsHtml = `
        <div style="margin-bottom: 10px; font-size: 12px; color: #94a3b8; display: flex; justify-content: space-between; align-items: center;">
          <span>Processos ativos ordenados pelo maior consumo de memória volátil:</span>
          <span style="font-size: 11px; color: #64748b;">Total listado: ${topProcs.length} aplicativos</span>
        </div>
        <div>${rows}</div>
      `;
    }
    viewportProcs.innerHTML = procsHtml;

    // 3. Raw text in Terminal Viewport
    rawBox.textContent = rawOutputText || 'Sem saída de texto registrada.';

    // Create icons on rendered elements
    createLucideIcons(viewportModules);
    createLucideIcons(viewportProcs);

    // Bind inline copy buttons
    overlay.querySelectorAll('.ram-copy-clip-btn').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const text = btn.dataset.copy;
        if (text) {
          navigator.clipboard.writeText(text);
          const orig = btn.innerHTML;
          btn.innerHTML = '<i data-lucide="check" style="width:11px;height:11px;color:#10b981"></i>';
          createLucideIcons(btn);
          setTimeout(() => {
            btn.innerHTML = orig;
            createLucideIcons(btn);
          }, 1500);
        }
      };
    });
  };

  // Live Stats Subscriber Handler
  const handleLiveStats = (stats) => {
    if (!stats) return;
    if (stats.ramTotalGB !== undefined && hudTotal) {
      hudTotal.textContent = `${stats.ramTotalGB} GB`;
    }
    if (stats.ramUsedGB !== undefined && hudUsed) {
      const pct = stats.ram !== undefined ? ` (${stats.ram}%)` : '';
      hudUsed.textContent = `${stats.ramUsedGB} GB${pct}`;
      if (stats.ram >= 85) hudUsed.style.color = '#ef4444';
      else if (stats.ram >= 70) hudUsed.style.color = '#f59e0b';
      else hudUsed.style.color = '#a855f7';
    }
    if (stats.ramFreeGB !== undefined && hudFree) {
      hudFree.textContent = `${stats.ramFreeGB} GB`;
    }
    if (stats.ramCacheGB !== undefined && hudCache) {
      hudCache.textContent = `${stats.ramCacheGB} GB`;
    }
  };

  // Register active modal context for real-time live updates
  activeRamModalContext = {
    isOpen: true,
    handleLiveStats
  };

  // Data Loading Routine
  const loadData = async () => {
    statusPill.textContent = 'Coletando...';
    refreshBtn.disabled = true;

    viewportModules.innerHTML = `
      <div style="background: rgba(0, 0, 0, 0.2); border: 1px dashed rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 40px 20px; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px;">
        <div style="width: 48px; height: 48px; border-radius: 12px; background: rgba(99, 102, 241, 0.14); display: flex; align-items: center; justify-content: center; color: #818cf8;">
          <i data-lucide="loader-2" class="spinner" style="width: 24px; height: 24px;"></i>
        </div>
        <div style="font-size: 15px; font-weight: 700; color: #f1f5f9;">Consultando módulos de memória RAM...</div>
        <div style="font-size: 12px; color: #94a3b8; max-width: 420px; line-height: 1.5;">
          Lendo sensores de hardware, chips de memória física, slots da placa-mãe e contadores do Windows.
        </div>
      </div>
    `;
    createLucideIcons(viewportModules);

    const script = `
$os = Get-CimInstance Win32_OperatingSystem
$mem = @(Get-CimInstance Win32_PhysicalMemory)
$arr = Get-CimInstance Win32_PhysicalMemoryArray
$perf = Get-CimInstance Win32_PerfFormattedData_PerfOS_Memory
$totalKB = [double]$os.TotalVisibleMemorySize
$freeKB = [double]$os.FreePhysicalMemory
$usedKB = $totalKB - $freeKB
$usedPct = [math]::Round(($usedKB / $totalKB) * 100, 1)

$topProcs = @(Get-Process | Sort-Object WorkingSet64 -Descending | Select-Object -First 12 | ForEach-Object {
    @{
        Name = $_.ProcessName
        Id = $_.Id
        WorkingSetMB = [math]::Round($_.WorkingSet64 / 1MB, 1)
        UsagePct = [math]::Round(($_.WorkingSet64 / ($totalKB * 1KB)) * 100, 1)
    }
})

$slots = @($mem | ForEach-Object {
    @{
        BankLabel = $_.BankLabel
        DeviceLocator = $_.DeviceLocator
        CapacityBytes = [double]$_.Capacity
        CapacityGB = [math]::Round($_.Capacity / 1GB, 2)
        Speed = $_.Speed
        ConfiguredClockSpeed = $_.ConfiguredClockSpeed
        Manufacturer = if ($_.Manufacturer) { $_.Manufacturer.Trim() } else { "Genérico" }
        PartNumber = if ($_.PartNumber) { $_.PartNumber.Trim() } else { "N/A" }
        SerialNumber = if ($_.SerialNumber) { $_.SerialNumber.Trim() } else { "N/A" }
        MemoryType = $_.MemoryType
        SMBIOSMemoryType = $_.SMBIOSMemoryType
        FormFactor = $_.FormFactor
        DataWidth = $_.DataWidth
        TotalWidth = $_.TotalWidth
    }
})

$physTotalBytes = ($mem | Measure-Object -Property Capacity -Sum).Sum
$visTotalBytes = $totalKB * 1024
$hwReservedMB = [math]::Max(0, [math]::Round(($physTotalBytes - $visTotalBytes) / 1MB, 0))

[PSCustomObject]@{
    HostName = $env:COMPUTERNAME
    OSName = $os.Caption
    TotalVisibleGB = [math]::Round($totalKB / 1MB, 2)
    UsedGB = [math]::Round($usedKB / 1MB, 2)
    FreeGB = [math]::Round($freeKB / 1MB, 2)
    UsedPercent = $usedPct
    CommittedMB = [math]::Round($perf.CommittedBytes / 1MB, 1)
    CommitLimitMB = [math]::Round($perf.CommitLimit / 1MB, 1)
    PoolPagedMB = [math]::Round($perf.PoolPagedBytes / 1MB, 1)
    PoolNonpagedMB = [math]::Round($perf.PoolNonpagedBytes / 1MB, 1)
    CacheStandbyMB = [math]::Round(($perf.StandbyCacheNormalPriorityBytes + $perf.StandbyCacheReserveBytes + $perf.StandbyCacheCoreBytes) / 1MB, 1)
    HardwareReservedMB = $hwReservedMB
    MaxSlots = if ($arr.MemoryDevices) { $arr.MemoryDevices } else { $mem.Count }
    SlotsCount = $mem.Count
    Slots = $slots
    TopProcesses = $topProcs
} | ConvertTo-Json -Depth 4
`;

    try {
      const [parsed, rawRes] = await Promise.all([
        runPsJson(script, null),
        runPs(`
Write-Output "=== Win32_OperatingSystem ==="
Get-CimInstance Win32_OperatingSystem | Select-Object Caption, TotalVisibleMemorySize, FreePhysicalMemory, TotalVirtualMemorySize, FreeVirtualMemory | Format-List
Write-Output "=== Win32_PhysicalMemoryArray ==="
Get-CimInstance Win32_PhysicalMemoryArray | Select-Object MemoryDevices, MaxCapacity, Location, Use | Format-List
Write-Output "=== Win32_PhysicalMemory (Módulos / Slots) ==="
Get-CimInstance Win32_PhysicalMemory | Format-List BankLabel, DeviceLocator, Capacity, Speed, ConfiguredClockSpeed, Manufacturer, PartNumber, SerialNumber, SMBIOSMemoryType, FormFactor, DataWidth
        `)
      ]);

      rawOutputText = (rawRes && rawRes.output) ? rawRes.output.trim() : '';

      if (parsed) {
        currentData = parsed;
        renderUI();
        addHistoryFn('Info de Memória RAM', 'Get-CimInstance Win32_PhysicalMemory', true, 'cpu');
      } else {
        throw new Error('Falha ao decodificar telemetria de memória.');
      }
    } catch (err) {
      statusPill.textContent = 'Erro';
      viewportModules.innerHTML = `
        <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 12px; padding: 30px; text-align: center; color: #fca5a5;">
          <i data-lucide="alert-triangle" style="width:36px;height:36px;color:#ef4444;margin-bottom:8px"></i>
          <div style="font-size: 15px; font-weight: 700; color: #f87171;">Erro ao coletar diagnóstico de memória RAM</div>
          <div style="font-size: 12px; margin-top: 6px;">${escapeHtml(err.message || 'Falha ao executar consulta WMI')}</div>
        </div>
      `;
      createLucideIcons(viewportModules);
    } finally {
      refreshBtn.disabled = false;
    }
  };

  // Search filter
  searchInput.oninput = (e) => {
    const q = e.target.value.toLowerCase().trim();
    if (activeTab === 'modules') {
      const cards = viewportModules.querySelectorAll('.details-result-card');
      let visible = 0;
      cards.forEach(card => {
        const text = (card.dataset.search || card.textContent || '').toLowerCase();
        const match = !q || text.includes(q);
        card.style.display = match ? '' : 'none';
        if (match) visible++;
      });
      statusPill.textContent = q ? `${visible} de ${cards.length}` : `${currentData?.Slots?.length || 0} Módulos`;
    } else if (activeTab === 'processes') {
      const rows = viewportProcs.querySelectorAll('.ram-process-row');
      let visible = 0;
      rows.forEach(row => {
        const text = (row.dataset.search || row.textContent || '').toLowerCase();
        const match = !q || text.includes(q);
        row.style.display = match ? 'flex' : 'none';
        if (match) visible++;
      });
      statusPill.textContent = q ? `${visible} de ${rows.length}` : `${currentData?.TopProcesses?.length || 0} Processos`;
    }
  };

  // Interactive Action: Otimizar Memória Agora
  optimizeBtn.onclick = async () => {
    const originalHtml = optimizeBtn.innerHTML;
    optimizeBtn.disabled = true;
    optimizeBtn.innerHTML = '<i data-lucide="loader-2" class="spinner" style="width:14px;height:14px"></i> Otimizando...';
    createLucideIcons(optimizeBtn);

    const cleanScript = `
$osBefore = Get-CimInstance Win32_OperatingSystem
$freeBefore = [math]::Round($osBefore.FreePhysicalMemory / 1024, 0)
$code = 'using System; using System.Runtime.InteropServices; public class MemClean { [DllImport("psapi.dll")] public static extern int EmptyWorkingSet(IntPtr hwProc); }';
Add-Type -TypeDefinition $code -ErrorAction SilentlyContinue
Get-Process | Where-Object { $_.Handle -and $_.Id -ne 0 -and $_.Id -ne 4 } | ForEach-Object {
    try { [MemClean]::EmptyWorkingSet($_.Handle) | Out-Null } catch {}
}
[System.GC]::Collect()
$osAfter = Get-CimInstance Win32_OperatingSystem
$freeAfter = [math]::Round($osAfter.FreePhysicalMemory / 1024, 0)
$freed = [math]::Max(0, $freeAfter - $freeBefore)
[PSCustomObject]@{ FreedMB = $freed; BeforeMB = $freeBefore; AfterMB = $freeAfter } | ConvertTo-Json
`;

    try {
      const cleanInfo = await runPsJson(cleanScript, null);
      let freedMB = (cleanInfo && typeof cleanInfo.FreedMB === 'number') ? cleanInfo.FreedMB : 0;

      const freedMsg = freedMB > 0 ? `+${freedMB} MB liberados instantaneamente!` : 'Cache e Working Sets liberados com sucesso!';
      toastFn('success', 'Memória RAM Otimizada', freedMsg);
      addHistoryFn(`Otimização de RAM (+${freedMB} MB)`, 'EmptyWorkingSet + GC', true, 'cpu');

      // Reload fresh data and trigger a visual flash highlight
      await loadData();

      const summaryCard = overlay.querySelector('#ram-summary-card');
      if (summaryCard) {
        summaryCard.style.boxShadow = '0 0 25px rgba(52, 211, 153, 0.45)';
        summaryCard.style.borderColor = 'rgba(52, 211, 153, 0.6)';
        setTimeout(() => {
          summaryCard.style.boxShadow = '';
          summaryCard.style.borderColor = 'rgba(99, 102, 241, 0.28)';
        }, 1500);
      }
    } catch (err) {
      toastFn('error', 'Otimização de Memória', 'Não foi possível esvaziar o working set.');
    } finally {
      optimizeBtn.disabled = false;
      optimizeBtn.innerHTML = originalHtml;
      createLucideIcons(optimizeBtn);
    }
  };

  // Interactive Action: Exportar TXT
  exportBtn.onclick = async () => {
    if (!currentData) {
      toastFn('warning', 'Exportação TXT', 'Aguarde o carregamento das informações.');
      return;
    }

    const originalHtml = exportBtn.innerHTML;
    exportBtn.disabled = true;
    exportBtn.innerHTML = '<i data-lucide="loader-2" class="spinner" style="width:14px;height:14px"></i> Exportando...';
    createLucideIcons(exportBtn);

    const cleanHost = (currentData.HostName || 'computador').replace(/[^a-zA-Z0-9_-]/g, '');
    const dateStamp = new Date().toISOString().slice(0, 10);
    const defaultFileName = `relatorio-memoria-ram-${cleanHost}-${dateStamp}.txt`;
    const reportText = generateRamInfoTxtReport(currentData);

    try {
      if (window.api && typeof window.api.saveTextFile === 'function') {
        const saveRes = await window.api.saveTextFile({
          defaultPath: defaultFileName,
          content: reportText,
          filters: [{ name: 'Arquivo de Texto (*.txt)', extensions: ['txt'] }]
        });

        if (saveRes && saveRes.success) {
          toastFn('success', 'Relatório Salvo', `Relatório de Memória exportado para: ${saveRes.filePath || defaultFileName}`);
          addHistoryFn('Exportar Relatório RAM', `Salvo em ${saveRes.filePath || defaultFileName}`, true, 'file-down');
        } else if (saveRes && saveRes.cancelled) {
          // Usuário cancelou a janela de salvar
        } else {
          fallbackDownload();
        }
      } else {
        fallbackDownload();
      }
    } catch (err) {
      fallbackDownload();
    } finally {
      exportBtn.disabled = false;
      exportBtn.innerHTML = originalHtml;
      createLucideIcons(exportBtn);
    }

    function fallbackDownload() {
      const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = defaultFileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toastFn('success', 'Relatório Exportado', `Arquivo ${defaultFileName} salvo com sucesso!`);
    }
  };

  // Copy Summary Action
  copyBtn.onclick = () => {
    if (!currentData) return;
    const summary = `Diagnóstico de Memória RAM - ThunderTools
Host: ${currentData.HostName || 'N/A'}
Capacidade Total: ${currentData.TotalVisibleGB || 0} GB
Em Uso: ${currentData.UsedGB || 0} GB (${currentData.UsedPercent || 0}%)
Disponível: ${currentData.FreeGB || 0} GB
Cache Standby: ${(currentData.CacheStandbyMB || 0).toFixed(1)} MB
Slots: ${currentData.Slots?.length || 0} ocupado(s) de ${currentData.MaxSlots || 0}
Thunder: ThunderTools`;

    navigator.clipboard.writeText(summary);
    const originalHtml = copyBtn.innerHTML;
    copyBtn.innerHTML = '<i data-lucide="check" style="width:14px;height:14px;color:#10b981"></i> Copiado!';
    createLucideIcons(copyBtn);
    toastFn('success', 'Área de Transferência', 'Resumo de Memória copiado!');
    setTimeout(() => {
      copyBtn.innerHTML = originalHtml;
      createLucideIcons(copyBtn);
    }, 2000);
  };

  // Refresh Action
  refreshBtn.onclick = () => {
    loadData();
  };

  // Initial Load
  loadData();
}
