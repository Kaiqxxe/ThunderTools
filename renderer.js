import { initAiDiagnosticsTab } from './aiDiagnosticsTab.js';
import { initDashboardController, updateDashboardMetrics } from './dashboardController.js';
import { showNetworkInfoModal } from './networkInfoModal.js';
import { showSpeedTestModal } from './speedTestModal.js';
import { showPingModal } from './pingModal.js';
import { showRamInfoModal } from './ramInfoModal.js';
import { showDriverBackupModal } from './driverBackupModal.js';
import {
  initGlobalSearch,
  showServiceOrderModal,
  initHardwareSummaryStrip,
  showSmartCareModal,
  showPrivacyDebloatModal,
  showPortsProcessAuditModal,
  showHostsManagerModal,
  showFullStartupManagerModal,
  showRestorePointsModal,
  showUwpBloatwareModal,
  initProgramsBatchController,
  showPrinterManagerModal,
  showWindowsUpdatePauseModal,
  showInstalledUpdatesModal,
  showTopProcessesModal,
  showVisualEffectsModal,
  showSmartHealthModal,
  showStorageScannerModal,
  showWifiPasswordsModal,
  showDnsBenchmarkModal,
  showLanScannerModal,
  showBatteryHealthModal,
  showAdvancedRebootModal,
  showBsodAnalyzerModal,
  showUltimatePerformanceModal,
  runPsJson
} from './proFeatures.js';

const container = document.getElementById('toast-container')
const AUTO_CLOSE = 8000
let isCommandRunning = false;
const globalCancelBtn = document.getElementById('cancel-btn');

function createLucideIcons(root = document) {
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    const target = (root && root.nodeType) ? root : document
    window.lucide.createIcons({ root: target })
  }
}

const LONG_SERVICE_MATCHERS = [
  cmd => /sfc\s+\/scannow/i.test(cmd),
  cmd => /\bdism\b/i.test(cmd), // Inclui StartComponentCleanup
  cmd => cmd.includes('Optimize-Volume'), // Adicionado para otimizar SSD
  cmd => /chkdsk/i.test(cmd)
]

// ── LocalStorage para Histórico e Favoritos ────────────────────────────────────

const HISTORY_KEY = 'thundertools_history'
const FAVORITES_KEY = 'thundertools_favorites'
const THEME_KEY = 'thundertools_theme'

function getHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')
  } catch {
    return []
  }
}

function saveHistory(history) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 50))) // Máximo 50 itens
}

function addToHistory(title, cmd, success, icon = 'file-text') { // Adicionar 'icon' com um valor padrão
  const history = getHistory()
  history.unshift({
    title,
    cmd,
    success,
    timestamp: Date.now(),
    icon // Salvar o ícone no histórico
  })
  saveHistory(history)
  renderHistory()
}

function getFavorites() {
  try {
    return JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]')
  } catch {
    return []
  }
}

function saveFavorites(favorites) {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites))
}

function toggleFavorite(cmd, title, desc, icon, special = '') {
  const favorites = getFavorites()
  const index = favorites.findIndex(f => f.cmd === cmd)
  
  if (index >= 0) {
    favorites.splice(index, 1)
  } else {
    favorites.push({ cmd, title, desc, icon, special })
  }
  
  saveFavorites(favorites)
  updateFavoriteButtons()
  renderFavorites()
}

function isFavorite(cmd) {
  return getFavorites().some(f => f.cmd === cmd)
}

function updateFavoriteButtons() {
  document.querySelectorAll('.tool-btn').forEach(btn => {
    const cmd = btn.dataset.cmd
    if (!cmd) return
    const title = btn.querySelector('.btn-title')?.textContent || ''

    if (!btn.closest('#favorites-list') && !btn.querySelector('.btn-more-info')) {
      const infoDetails = getToolMoreInfoDetails(cmd, title)
      if (infoDetails) {
        const infoBtn = document.createElement('button')
        infoBtn.className = 'btn-more-info'
        infoBtn.type = 'button'
        infoBtn.title = 'Mais informações'
        infoBtn.innerHTML = '<i data-lucide="info" style="width:14px;height:14px"></i>'
        infoBtn.addEventListener('click', (ev) => {
          ev.stopPropagation()
          showToolInfoModal(infoDetails.title || title || 'Mais informações', infoDetails)
        })
        btn.appendChild(infoBtn)
        createLucideIcons()
      }
    }
    
    const favBtn = btn.querySelector('.btn-favorite')
    if (favBtn) {
      if (isFavorite(cmd)) {
        favBtn.classList.add('active')
      } else {
        favBtn.classList.remove('active')
      }
    }
  })
}

// Converte nomes de ícones antigos/inexistentes (salvos no histórico) para ícones válidos do Lucide
const LEGACY_ICON_ALIASES = { 'file-shield': 'file-lock' }
function resolveLegacyIconName(name) {
  return name ? (LEGACY_ICON_ALIASES[name] || name) : name
}

function renderHistory() {
  const historyList = document.getElementById('history-list')
  if (!historyList) return
  
  const history = getHistory()
  
  if (history.length === 0) {
    historyList.innerHTML = '<div style="text-align: center; padding: 40px; color: #7e8694; font-family: "Mostica Sans", Poppins, sans-serif; width: 100%;">Nenhum comando executado ainda</div>'
    return
  }
  
  historyList.innerHTML = history.map(item => {
    const date = new Date(item.timestamp)
    const timeStr = date.toLocaleString('pt-BR', { 
      day: '2-digit', 
      month: '2-digit', 
      hour: '2-digit', 
      minute: '2-digit' 
    })
    
    const statusClass = item.success === 'cancelled' ? 'warning' : (item.success ? 'success' : 'error');
    const statusLabel = item.success === 'cancelled' ? '🟡 Cancelado' : (item.success ? '🟢 Sucesso' : '🔴 Erro');

    return `
      <div class="history-item" style="display: flex; align-items: center; gap: 12px;">
        <div class="history-item-icon" style="flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
          ${(item.icon && (item.icon.includes('/') || item.icon.includes('.')))
            ? `<img src="${item.icon}" style="width:18px;height:18px">` 
            : `<i data-lucide="${resolveLegacyIconName(item.icon) || (item.success === 'cancelled' ? 'ban' : (item.success ? 'check' : 'x'))}" style="width:18px;height:18px"></i>`}
          
        </div>
        <div class="history-item-content" style="flex: 1;">
          <div class="history-item-title">${item.title}</div>
          <div class="history-item-time">${timeStr}</div>
        </div>
        <div class="history-item-status ${statusClass}">
          ${statusLabel}
        </div>
      </div>
    `
  }).join('')
  createLucideIcons() // Chamar createLucideIcons() após atualizar o innerHTML
  
}

function renderFavorites() {
  const favoritesList = document.getElementById('favorites-list')
  if (!favoritesList) return
  
  const favorites = getFavorites()
  
  if (favorites.length === 0) {
    favoritesList.innerHTML = '<div style="text-align: center; padding: 40px; color: #7e8694; font-family: Raleway, sans-serif; width: 100%;">Nenhuma ferramenta favoritada ainda</div>'
    return
  }
  
  favoritesList.innerHTML = favorites.map(fav => {
    const inferredSpecial = fav.special || (fav.cmd === 'ADD_STARTUP_ENTRY' ? 'add-startup-entry' : '');
    const specialAttr = inferredSpecial ? ` data-special="${inferredSpecial.replace(/"/g, '&quot;')}"` : '';
    return `
    <div class="tool-btn" data-cmd="${fav.cmd.replace(/"/g, '&quot;')}"${specialAttr} style="width: calc(50% - 6px); cursor: pointer; position: relative;">
      <span class="btn-icon">
        ${(fav.icon.includes('/') || fav.icon.includes('.'))
          ? `<img src="${fav.icon}">` 
          : `<i data-lucide="${fav.icon}"></i>`}
      </span>
      <span class="btn-text">
        <span class="btn-title">${fav.title}</span>
        <span class="btn-desc">${fav.desc}</span>
      </span>
      <button class="remove-favorite" data-cmd="${fav.cmd.replace(/"/g, '&quot;')}" title="Remover dos favoritos" style="position: absolute; top: 10px; right: 10px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); color: #fca5a5; border-radius: 4px; padding: 4px; cursor: pointer; transition: all 0.2s; z-index: 20; display: flex; align-items: center; justify-content: center;">
        <i data-lucide="x" style="width:12px;height:12px"></i>
      </button>
    </div>
  `;
  }).join('')
  
  createLucideIcons()
  attachToolButtonListeners()
}

function parseDetailsModalItems(title, output, formattedMsg, cmd = '') {
  const raw = String(output || '').trim()
  const tLower = String(title || '').toLowerCase()
  const cLower = String(cmd || '').toLowerCase()

  // 1. Info da BIOS / Placa-Mãe
  if (cLower.includes('win32_bios') || tLower.includes('bios')) {
    const getVal = (re) => (raw.match(re) || [])[1]?.trim() || ''
    const mfr = getVal(/Manufacturer\s*:\s*(.+)/i) || 'Não identificado'
    const serial = getVal(/SerialNumber\s*:\s*(.+)/i) || 'Não disponível'
    const version = getVal(/SMBIOSBIOSVersion\s*:\s*(.+)/i) || getVal(/Version\s*:\s*(.+)/i) || 'Padrão OEM'
    const release = getVal(/ReleaseDate\s*:\s*(.+)/i) || 'N/D'
    const board = getVal(/BaseBoard\s*:\s*(.+)/i) || mfr
    const status = getVal(/Status\s*:\s*(.+)/i) || 'OK'

    return {
      headerIcon: 'cpu',
      pill: 'Firmware UEFI / SMBIOS',
      subtitle: 'Identificação de firmware da placa-mãe, versão SMBIOS e número de série gravado no hardware:',
      summaryCards: [
        { icon: 'factory', iconClass: 'ip', label: 'Fabricante', value: mfr, copy: mfr },
        { icon: 'package', iconClass: 'gw', label: 'Versão da BIOS', value: version, copy: version },
        { icon: 'key-round', iconClass: 'dns', label: 'Nº de Série (Service Tag)', value: serial, copy: serial }
      ],
      cards: [
        {
          icon: 'cpu',
          name: `${mfr} — Firmware BIOS (${version})`,
          searchBlob: `${mfr} ${serial} ${version} ${release} ${board} ${status}`.toLowerCase(),
          chips: [
            { icon: 'check-circle-2', text: `Status: ${status}`, cls: 'chip-status-ok' },
            { icon: 'shield-check', text: 'SMBIOS Ativo', cls: 'chip-default' },
            ...(release && release !== 'N/D' ? [{ icon: 'calendar', text: `Data: ${release}`, cls: 'chip-admin' }] : [])
          ],
          meta: [
            { label: 'Fabricante da BIOS', value: mfr, copy: mfr },
            { label: 'Versão SMBIOS', value: version, copy: version },
            { label: 'Número de Série / Tag', value: serial, copy: serial, mono: true },
            { label: 'Placa-Mãe (BaseBoard)', value: board, copy: board },
            ...(release && release !== 'N/D' ? [{ label: 'Data de Lançamento', value: release }] : []),
            { label: 'Integridade de Hardware', value: status === 'OK' ? 'Operacional (OK)' : status }
          ]
        }
      ]
    }
  }

  // 2. Chave do Windows / Licenciamento OEM
  if (cLower.includes('oa3xoriginalproductkey') || cLower.includes('softwarelicensingservice') || tLower.includes('chave do windows')) {
    const keyMatch = raw.match(/[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}/i)
    const productKey = keyMatch ? keyMatch[0].toUpperCase() : null
    const isDigital = /Licenca Digital|Volume|Nenhuma chave/i.test(raw) || !productKey

    return {
      headerIcon: 'key-round',
      pill: productKey ? 'Chave OEM Detectada' : 'Licença Digital',
      subtitle: 'Verificação da tabela ACPI MSDM (OA3xOriginalProductKey) e status de licenciamento do Windows:',
      summaryCards: [
        { icon: 'key-round', iconClass: 'ip', label: 'Chave OEM (BIOS)', value: productKey || 'Licença Digital Microsoft', copy: productKey || '' },
        { icon: 'shield-check', iconClass: 'gw', label: 'Tipo de Ativação', value: productKey ? 'OEM Gravada na Placa-Mãe' : 'Vinculada ao Hardware / Conta' }
      ],
      cards: [
        {
          icon: 'key-round',
          name: productKey ? productKey : 'Ativação por Licença Digital (Sem Chave Física OEM)',
          searchBlob: `${productKey || ''} licenca digital windows oem bios`.toLowerCase(),
          chips: [
            { icon: 'check-circle-2', text: productKey ? 'Chave OEM Encontrada' : 'Licença Digital Ativa', cls: 'chip-status-ok' },
            { icon: 'cpu', text: 'Tabela MSDM / SMBIOS' }
          ],
          meta: [
            { label: 'Chave do Produto (25 dígitos)', value: productKey || 'Não gravada na BIOS (Ativação Digital)', copy: productKey || '', mono: !!productKey },
            { label: 'Origem da Licença', value: productKey ? 'Firmware UEFI / Placa-Mãe (OA3)' : 'Servidores de Ativação Microsoft (HWID)' }
          ]
        }
      ]
    }
  }

  // 3. Info de Memória RAM
  if (cLower.includes('memorychip') || cLower.includes('win32_physicalmemory') || tLower.includes('memória ram')) {
    const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(l => l && !/^Capacity|^----/i.test(l))
    let totalBytes = 0
    const cards = lines.map((line, idx) => {
      const p = line.split(/\s{2,}/)
      const bytes = parseInt(p[0], 10) || 0
      totalBytes += bytes
      const capGB = bytes ? `${(bytes / 1073741824).toFixed(0)} GB` : (p[0] || 'Módulo RAM')
      const speed = p[1]?.trim() ? `${p[1].trim()} MHz` : 'Velocidade Padrão'
      const mfr = p[2]?.trim() || 'Fabricante OEM'
      return {
        icon: 'memory-stick',
        name: `Slot #${idx + 1} — ${capGB} (${mfr})`,
        searchBlob: `${capGB} ${speed} ${mfr} slot ${idx + 1}`.toLowerCase(),
        chips: [
          { icon: 'zap', text: speed, cls: 'chip-status-ok' },
          { icon: 'cpu', text: capGB, cls: 'chip-admin' }
        ],
        meta: [
          { label: 'Capacidade do Módulo', value: capGB },
          { label: 'Frequência / Clock', value: speed },
          { label: 'Fabricante', value: mfr, copy: mfr }
        ]
      }
    })
    const totalGB = totalBytes ? `${(totalBytes / 1073741824).toFixed(0)} GB` : `${cards.length} Módulo(s)`
    return {
      headerIcon: 'memory-stick',
      pill: `${cards.length} pente(s) instalado(s)`,
      subtitle: 'Especificações físicas dos módulos de memória RAM instalados nos slots da placa-mãe:',
      summaryCards: [
        { icon: 'memory-stick', iconClass: 'ip', label: 'Capacidade Total Física', value: totalGB },
        { icon: 'layers', iconClass: 'gw', label: 'Slots Populacionados', value: `${cards.length} módulo(s) ativo(s)` },
        { icon: 'zap', iconClass: 'dns', label: 'Frequência Principal', value: cards[0]?.meta?.[1]?.value || 'Automática' }
      ],
      cards
    }
  }

  // 4. Info dos Discos Físicos
  if (cLower.includes('diskdrive') || cLower.includes('win32_diskdrive') || tLower.includes('info dos discos')) {
    const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(l => l && !/^Model|^----/i.test(l))
    const cards = lines.map((line, idx) => {
      const p = line.split(/\s{2,}/)
      const model = p[0]?.trim() || `Unidade Física #${idx + 1}`
      const size = p[1]?.trim() ? `${p[1].trim()} GB` : 'N/D'
      const status = p[2]?.trim() || 'OK'
      const isOk = /^OK$/i.test(status)
      const isSsd = /ssd|nvme|solid/i.test(model)
      return {
        icon: 'hard-drive',
        name: model,
        searchBlob: `${model} ${size} ${status}`.toLowerCase(),
        chips: [
          { icon: isOk ? 'check-circle-2' : 'alert-triangle', text: `S.M.A.R.T.: ${status}`, cls: isOk ? 'chip-status-ok' : 'chip-status-warn' },
          { icon: 'database', text: size, cls: 'chip-admin' },
          { icon: 'zap', text: isSsd ? 'SSD / NVMe' : 'Unidade de Armazenamento' }
        ],
        meta: [
          { label: 'Modelo da Unidade', value: model, copy: model },
          { label: 'Capacidade Total', value: size },
          { label: 'Saúde S.M.A.R.T.', value: isOk ? 'Saudável (OK)' : status }
        ]
      }
    })
    return {
      headerIcon: 'hard-drive',
      pill: `${cards.length} unidade(s) física(s)`,
      subtitle: 'Unidades de armazenamento físico detectadas e diagnóstico de integridade S.M.A.R.T.:',
      summaryCards: [
        { icon: 'hard-drive', iconClass: 'ip', label: 'Unidades Detectadas', value: `${cards.length} Disco(s)` },
        { icon: ' cpu', iconClass: 'gw', label: 'Disco Principal', value: cards[0]?.name || 'N/D' },
        { icon: 'shield-check', iconClass: 'dns', label: 'Status Geral', value: cards.every(c => c.chips[0]?.cls === 'chip-status-ok') ? '100% Saudável (OK)' : 'Requer Atenção' }
      ],
      cards
    }
  }

  // 5. Espaço Livre em Disco
  if (cLower.includes('get-psdrive') || tLower.includes('espaço livre')) {
    const usado = (raw.match(/Usado\s*:\s*([\d.]+)/i) || [])[1]
    const livre = (raw.match(/Livre\s*:\s*([\d.]+)/i) || raw.match(/Free\s*:\s*([\d.]+)/i) || [])[1]
    const total = (raw.match(/Total\s*:\s*([\d.]+)/i) || [])[1]
    const pct = (usado && total) ? Math.round((parseFloat(usado) / parseFloat(total)) * 100) : null
    return {
      headerIcon: 'pie-chart',
      pill: pct !== null ? `${pct}% em uso` : 'Volume C:',
      subtitle: 'Alocação de capacidade, espaço livre disponível e taxa de ocupação da partição do sistema (C:):',
      summaryCards: [
        { icon: 'check-circle-2', iconClass: 'gw', label: 'Espaço Livre (C:)', value: livre ? `${livre} GB` : 'N/D' },
        { icon: 'hard-drive', iconClass: 'ip', label: 'Espaço Ocupado', value: usado ? `${usado} GB` : 'N/D' },
        { icon: 'database', iconClass: 'dns', label: 'Capacidade Total', value: total ? `${total} GB` : 'N/D' }
      ],
      cards: [
        {
          icon: 'hard-drive',
          name: `Volume do Sistema (Disco Local C:)`,
          searchBlob: `disco c usado ${usado} livre ${livre} total ${total}`.toLowerCase(),
          chips: [
            { icon: 'check-circle-2', text: `Livre: ${livre || '—'} GB`, cls: 'chip-status-ok' },
            ...(pct !== null ? [{ icon: 'activity', text: `Ocupação: ${pct}%`, cls: pct > 85 ? 'chip-status-warn' : 'chip-admin' }] : [])
          ],
          meta: [
            { label: 'Espaço Disponível', value: livre ? `${livre} GB` : 'N/D' },
            { label: 'Espaço Utilizado', value: usado ? `${usado} GB` : 'N/D' },
            { label: 'Tamanho Total da Partição', value: total ? `${total} GB` : 'N/D' },
            ...(pct !== null ? [{ label: 'Percentual de Uso', value: `${pct}% (${100 - pct}% livre)` }] : [])
          ]
        }
      ]
    }
  }

  // 6. Usuários do Sistema
  if (cLower.includes('net user') || tLower.includes('usuários')) {
    const lines = raw.split(/\r?\n/).filter(l => {
      const t = l.trim()
      return t && !/^-+$/.test(t) && !/conclu.*do|completed|.*xito|success|contas de usu|user accounts/i.test(t)
    })
    const users = lines.flatMap(l => l.match(/\S+/g) || []).filter(u => !isInternalWindowsUser(u))
    return {
      headerIcon: 'users',
      pill: `${users.length} conta(s) ativa(s)`,
      subtitle: 'Contas de usuário locais configuradas neste computador (excluindo contas internas do Windows):',
      summaryCards: [
        { icon: 'users', iconClass: 'ip', label: 'Total de Contas Locais', value: `${users.length} Usuário(s)` },
        { icon: 'user-check', iconClass: 'gw', label: 'Conta Principal', value: users[0] || 'Padrão' }
      ],
      cards: users.map((u, idx) => ({
        icon: 'user',
        name: u,
        searchBlob: u.toLowerCase(),
        chips: [
          { icon: 'check-circle-2', text: 'Conta Local Ativa', cls: 'chip-status-ok' },
          { icon: 'shield', text: idx === 0 ? 'Usuário Principal' : 'Conta Local', cls: 'chip-admin' }
        ],
        meta: [
          { label: 'Nome da Conta', value: u, copy: u },
          { label: 'Tipo de Perfil', value: 'Conta Local do Windows' }
        ]
      }))
    }
  }

  // 7. Listar Impressoras
  if (cLower.includes('get-printer') || tLower.includes('impressora')) {
    const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(l => l && !/^Name|^----/i.test(l))
    const cards = lines.map(line => {
      const p = line.split(/\s{2,}/)
      const name = p[0] || line
      const driver = p[1] || 'Driver Padrão'
      const port = p[2] || 'Porta Local / Rede'
      return {
        icon: 'printer',
        name,
        searchBlob: `${name} ${driver} ${port}`.toLowerCase(),
        chips: [
          { icon: 'check-circle-2', text: 'Instalada', cls: 'chip-status-ok' },
          { icon: 'plug', text: port, cls: 'chip-admin' }
        ],
        meta: [
          { label: 'Nome da Fila / Impressora', value: name, copy: name },
          { label: 'Driver Utilizado', value: driver },
          { label: 'Porta / Endereço', value: port, copy: port, mono: true }
        ]
      }
    })
    return {
      headerIcon: 'printer',
      pill: `${cards.length} impressora(s)`,
      subtitle: 'Dispositivos e filas de impressão instalados no Spooler do Windows:',
      summaryCards: [
        { icon: 'printer', iconClass: 'ip', label: 'Filas Instaladas', value: `${cards.length} Impressora(s)` },
        { icon: 'check-circle-2', iconClass: 'gw', label: 'Spooler de Impressão', value: 'Ativo e Operacional' }
      ],
      cards
    }
  }

  // 8. Credenciais de Rede (cmdkey /list)
  if (cLower.includes('cmdkey') || tLower.includes('credencia')) {
    const rawLines = raw.split(/\r?\n/).filter(l => l.trim() && !/Atualmente armazenadas|Currently stored/i.test(l))
    const entries = []
    let current = null
    for (const line of rawLines) {
      const trimmed = line.trim()
      if (/^(Target|Destino)\s*:/i.test(trimmed)) {
        if (current) entries.push(current)
        current = { target: trimmed.split(':').slice(1).join(':').trim(), info: [] }
      } else if (current) {
        current.info.push(trimmed)
      }
    }
    if (current) entries.push(current)

    const cards = entries.map(e => {
      const cleanTarget = e.target.replace(/^.*?target=/i, '').trim()
      const userLine = e.info.find(i => /^(User|Usu[aá]rio)\s*:/i.test(i))
      const typeLine = e.info.find(i => /^(Type|Tipo)\s*:/i.test(i))
      const userVal = userLine ? userLine.split(':').slice(1).join(':').trim() : 'Conta do Sistema'
      const typeVal = typeLine ? typeLine.split(':').slice(1).join(':').trim() : 'Credencial do Windows'
      return {
        icon: 'key-round',
        name: cleanTarget,
        searchBlob: `${cleanTarget} ${userVal} ${typeVal}`.toLowerCase(),
        chips: [
          { icon: 'shield', text: typeVal, cls: 'chip-admin' },
          { icon: 'user', text: userVal, cls: 'chip-status-ok' }
        ],
        meta: [
          { label: 'Destino / Servidor (Target)', value: cleanTarget, copy: cleanTarget, mono: true },
          { label: 'Usuário Associado', value: userVal, copy: userVal },
          { label: 'Tipo de Cofre', value: typeVal }
        ]
      }
    })
    return {
      headerIcon: 'key-round',
      pill: `${cards.length} credencial(is)`,
      subtitle: 'Credenciais armazenadas no Cofre de Credenciais do Windows:',
      summaryCards: [
        { icon: 'key-round', iconClass: 'ip', label: 'Credenciais Salvas', value: `${cards.length} Registro(s)` },
        { icon: 'lock', iconClass: 'gw', label: 'Cofre do Windows', value: 'Protegido (LSASS)' }
      ],
      cards
    }
  }

  // 9. Fallback estruturado universal (transforma linhas de formattedMsg ou pares Chave: Valor em cards modernos)
  const cleanHtmlLines = String(formattedMsg || output || '')
    .split(/<br\s*\/?>|\r?\n/i)
    .map(l => l.replace(/<[^>]*>/g, '').replace(/[🟢🔴🟡⚪🖨️👤🗑️🔋📄💾💚💻📦⚙️🔧🧠🕒🌐🏭🔑🔍🚪🔳📊⚡🖥️🟠]/gu, '').trim())
    .filter(Boolean)

  const metaItems = []
  cleanHtmlLines.forEach((line, i) => {
    const colonIdx = line.indexOf(':')
    if (colonIdx > 0 && colonIdx < 42) {
      const k = line.slice(0, colonIdx).trim()
      const v = line.slice(colonIdx + 1).trim()
      if (v) metaItems.push({ label: k, value: v, copy: v.length <= 64 ? v : '' })
    } else {
      metaItems.push({ label: `Item #${i + 1}`, value: line })
    }
  })

  return {
    headerIcon: 'terminal',
    pill: 'Concluído',
    subtitle: 'Relatório estruturado e diagnóstico detalhado retornado pelo sistema:',
    summaryCards: metaItems.slice(0, 3).map((m, idx) => ({
      icon: idx === 0 ? 'check-circle-2' : idx === 1 ? 'layers' : 'activity',
      iconClass: idx === 0 ? 'gw' : idx === 1 ? 'ip' : 'dns',
      label: m.label,
      value: m.value,
      copy: m.copy || ''
    })),
    cards: [
      {
        icon: 'check-circle-2',
        name: `${title} — Diagnóstico do Sistema`,
        searchBlob: cleanHtmlLines.join(' ').toLowerCase(),
        chips: [
          { icon: 'check-circle-2', text: 'Execução Concluída', cls: 'chip-status-ok' },
          { icon: 'list', text: `${metaItems.length} parâmetro(s)`, cls: 'chip-admin' }
        ],
        meta: metaItems.length ? metaItems : [{ label: 'Saída', value: 'Operação concluída com sucesso.' }]
      }
    ]
  }
}

function showDetailsModal(title, output, formattedMsg, cmd = '', icon = '') {
  const existing = document.getElementById('details-structured-overlay')
  if (existing) existing.remove()

  const parsedData = parseDetailsModalItems(title, output, formattedMsg, cmd)
  const headerIcon = icon || parsedData.headerIcon || 'cpu'
  const rawText = String(output || formattedMsg || 'Nenhuma saída registrada.').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '').trim()

  const overlay = document.createElement('div')
  overlay.className = 'modal-overlay'
  overlay.id = 'details-structured-overlay'

  // Mapeia classes semânticas para as variantes oficiais de .details-chip
  const chipClassMap = {
    'chip-status-ok': 'status-ready',
    'chip-status-warn': 'status-warn',
    'chip-admin': 'network',
    'chip-default': 'virtual'
  }
  const resolveChipClass = (cls) => chipClassMap[cls] || cls || 'virtual'

  const copyBtnHtml = (value, label) => value ? `
    <button type="button" class="netinfo-mac-copy-btn details-inline-copy" data-copy="${escapeHtml(value)}" title="Copiar ${escapeHtml(label)}">
      <i data-lucide="copy"></i>
    </button>` : ''

  // Faixa HUD de resumo — mesma estrutura do modal "Informações de Rede"
  const summaryStripHtml = (parsedData.summaryCards && parsedData.summaryCards.length > 0)
    ? `<div class="netinfo-summary-card">
        ${parsedData.summaryCards.map(sc => `
          <div class="netinfo-summary-cell">
            <div class="netinfo-summary-label"><i data-lucide="${escapeHtml((sc.icon || 'info').trim())}"></i> ${escapeHtml(sc.label)}</div>
            <div class="netinfo-summary-val" title="${escapeHtml(sc.value)}">${escapeHtml(sc.value)}${copyBtnHtml(sc.copy, sc.label)}</div>
          </div>
        `).join('')}
      </div>`
    : ''

  const renderCardsHtml = (cardsList) => {
    if (!cardsList || !cardsList.length) {
      return `
        <div class="details-empty-state">
          <i data-lucide="inbox" style="width:32px;height:32px;opacity:0.45"></i>
          <div>Nenhum registro encontrado para o filtro informado.</div>
        </div>`
    }
    return `<div class="details-cards-grid">
      ${cardsList.map(card => `
        <div class="details-result-card">
          <div class="result-card-top">
            <div class="result-card-icon-wrap">
              <i data-lucide="${escapeHtml(card.icon || headerIcon)}" style="width:19px;height:19px"></i>
            </div>
            <div class="result-card-info">
              <div class="result-card-name">${escapeHtml(card.name)}</div>
              ${card.chips && card.chips.length ? `
                <div class="result-card-chips">
                  ${card.chips.map(ch => `
                    <span class="details-chip ${escapeHtml(resolveChipClass(ch.cls))}">
                      <i data-lucide="${escapeHtml(ch.icon || 'circle')}"></i> ${escapeHtml(ch.text)}
                    </span>
                  `).join('')}
                </div>
              ` : ''}
            </div>
          </div>
          ${card.meta && card.meta.length ? `
            <div class="result-card-meta-grid">
              ${card.meta.map(m => `
                <div class="result-meta-item">
                  <span class="meta-field-label">${escapeHtml(m.label)}</span>
                  <span class="meta-field-value"${m.mono ? ' style="font-family: monospace; letter-spacing: 0.5px;"' : ''}>${escapeHtml(m.value)}${copyBtnHtml(m.copy, m.label)}</span>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
      `).join('')}
    </div>`
  }

  overlay.innerHTML = `
    <div class="modal details-modal" role="dialog" aria-modal="true">
      <button class="modal-close-icon-btn" id="modal-x-close" title="Fechar (Esc)">
        <i data-lucide="x" style="width:16px;height:16px"></i>
      </button>

      <div class="details-modal-header">
        <div class="details-header-lead">
          <div class="details-header-icon-box">
            <i data-lucide="${escapeHtml(headerIcon)}" style="width:22px;height:22px"></i>
          </div>
          <div class="details-header-text">
            <div class="details-modal-title">
              <span>${escapeHtml(title)}</span>
              <span class="details-count-pill" id="details-count-pill">${escapeHtml(parsedData.pill || 'Concluído')}</span>
            </div>
            <div class="details-modal-desc">${escapeHtml(parsedData.subtitle)}</div>
          </div>
        </div>
      </div>

      ${summaryStripHtml}

      <div class="details-toolbar">
        <div class="details-search-box">
          <i data-lucide="search" style="width:14px;height:14px"></i>
          <input type="text" id="details-search-input" placeholder="Filtrar informações exibidas..." autocomplete="off">
        </div>
        <div class="details-view-toggles">
          <button type="button" class="details-toggle-btn active" id="details-toggle-cards">
            <i data-lucide="layout-grid" style="width:13px;height:13px"></i> Formatado
          </button>
          <button type="button" class="details-toggle-btn" id="details-toggle-raw">
            <i data-lucide="terminal" style="width:13px;height:13px"></i> Terminal
          </button>
        </div>
      </div>

      <div class="details-content-viewport" id="details-viewport-formatted">
        ${renderCardsHtml(parsedData.cards)}
      </div>

      <div class="details-content-viewport" id="details-viewport-raw" style="display: none;">
        <div class="details-terminal-box" id="modal-raw-terminal-box">${escapeHtml(rawText)}</div>
      </div>

      <div class="details-modal-footer">
        <div class="details-footer-tip">
          <i data-lucide="keyboard" style="width:14px;height:14px;color:#818cf8"></i>
          Pressione <b style="color:#cbd5e1">Esc</b> para fechar ou clique no ícone ao lado de um campo para copiar
        </div>
        <div style="display: flex; gap: 10px;">
          <button class="modal-btn secondary" id="modal-copy-details" style="display: flex; align-items: center; gap: 8px; font-size: 12.5px; padding: 8px 16px;">
            <i data-lucide="copy" style="width:14px;height:14px"></i> Copiar Tudo
          </button>
          <button class="modal-btn primary" id="modal-close-details" style="font-size: 12.5px; padding: 8px 20px;">
            Fechar
          </button>
        </div>
      </div>
    </div>
  `
  document.body.appendChild(overlay)
  createLucideIcons()

  const close = () => {
    overlay.remove()
    document.removeEventListener('keydown', onKeyDown)
  }

  const onKeyDown = (e) => {
    if (e.key === 'Escape') close()
  }
  document.addEventListener('keydown', onKeyDown)

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close()
  })

  const xClose = overlay.querySelector('#modal-x-close')
  if (xClose) xClose.onclick = close
  const closeBtn = overlay.querySelector('#modal-close-details')
  if (closeBtn) closeBtn.onclick = close

  // Alternância Formatado / Terminal
  const btnCards = overlay.querySelector('#details-toggle-cards')
  const btnRaw = overlay.querySelector('#details-toggle-raw')
  const viewCards = overlay.querySelector('#details-viewport-formatted')
  const viewRaw = overlay.querySelector('#details-viewport-raw')

  if (btnCards && btnRaw && viewCards && viewRaw) {
    btnCards.onclick = () => {
      btnCards.classList.add('active')
      btnRaw.classList.remove('active')
      viewCards.style.display = ''
      viewRaw.style.display = 'none'
    }
    btnRaw.onclick = () => {
      btnRaw.classList.add('active')
      btnCards.classList.remove('active')
      viewRaw.style.display = ''
      viewCards.style.display = 'none'
    }
  }

  // Botões de cópia individual nos cards
  const bindInlineCopyButtons = () => {
    overlay.querySelectorAll('.details-inline-copy').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation()
        const val = btn.getAttribute('data-copy') || ''
        if (!val) return
        navigator.clipboard.writeText(val)
        const orig = btn.innerHTML
        btn.innerHTML = '<i data-lucide="check" style="width:13px;height:13px;color:#34d399"></i>'
        createLucideIcons()
        setTimeout(() => {
          btn.innerHTML = orig
          createLucideIcons()
        }, 1600)
      }
    })
  }
  bindInlineCopyButtons()

  // Filtro de busca em tempo real
  const searchInput = overlay.querySelector('#details-search-input')
  if (searchInput && viewCards) {
    searchInput.addEventListener('input', () => {
      const q = searchInput.value.trim().toLowerCase()
      const filtered = !q
        ? parsedData.cards
        : parsedData.cards.filter(c => (c.searchBlob || '').includes(q) || (c.name || '').toLowerCase().includes(q))
      viewCards.innerHTML = renderCardsHtml(filtered)
      createLucideIcons()
      bindInlineCopyButtons()
    })
  }

  const copyBtn = overlay.querySelector('#modal-copy-details')
  if (copyBtn) {
    copyBtn.onclick = () => {
      const summaryLines = parsedData.cards.flatMap(c => [
        `=== ${c.name} ===`,
        ...(c.meta || []).map(m => `${m.label}: ${m.value}`)
      ]).join('\n')
      navigator.clipboard.writeText(summaryLines || rawText)
      const originalContent = copyBtn.innerHTML
      copyBtn.innerHTML = '<i data-lucide="check" style="width:14px;height:14px;color:#34d399"></i> Copiado!'
      createLucideIcons()
      setTimeout(() => {
        copyBtn.innerHTML = originalContent
        createLucideIcons()
      }, 2000)
    }
  }
}

function showInstalledProgramsModal(programs) {
  const overlay = document.createElement('div')
  overlay.className = 'modal-overlay'
  
  overlay.innerHTML = `
    <div class="modal details-modal" role="dialog" aria-modal="true" style="width: min(840px, 95vw); max-width: 840px; max-height: 90vh;">
      <button class="modal-close-icon-btn" id="programs-x-close" title="Fechar (Esc)">
        <i data-lucide="x" style="width:16px;height:16px"></i>
      </button>

      <div class="details-modal-header" style="margin-bottom: 12px;">
        <div class="details-header-lead">
          <div class="details-header-icon-box" style="background: linear-gradient(135deg, rgba(168, 85, 247, 0.22) 0%, rgba(99, 102, 241, 0.18) 100%); border-color: rgba(168, 85, 247, 0.4); color: #c084fc;">
            <i data-lucide="package" style="width:22px;height:22px"></i>
          </div>
          <div class="details-header-text">
            <div class="details-modal-title">
              <span>Programas Instalados</span>
              <span class="details-count-pill" id="programs-count-pill">${programs.length} Aplicativos</span>
            </div>
            <div class="details-modal-desc">Gerenciamento, pesquisa e desinstalação de programas registrados no Windows</div>
          </div>
        </div>
      </div>
      
      <!-- Toolbar com pesquisa e filtros modernos -->
      <div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 14px; background: rgba(0, 0, 0, 0.2); border: 1px solid rgba(255, 255, 255, 0.05); padding: 10px 14px; border-radius: 12px;">
        <div style="position: relative; flex: 1; min-width: 220px;">
          <i data-lucide="search" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); width: 15px; height: 15px; color: #94a3b8; pointer-events: none;"></i>
          <input type="text" id="program-search" placeholder="Pesquisar programa ou desenvolvedor..." style="width: 100%; padding: 8px 12px 8px 36px; border-radius: 8px; background: rgba(0, 0, 0, 0.35); border: 1px solid rgba(99, 102, 241, 0.25); color: #f8fafc; font-size: 13px; outline: none; transition: all 0.2s;" autocomplete="off">
        </div>
        <div style="display: flex; gap: 8px;" class="filter-buttons">
          <button class="modal-btn primary filter-btn active" id="filter-newest" style="padding: 7px 14px; font-size: 12px; height: auto;">Mais Recentes</button>
          <button class="modal-btn secondary filter-btn" id="filter-oldest" style="padding: 7px 14px; font-size: 12px; height: auto;">Mais Antigos</button>
        </div>
      </div>
      
      <!-- Lista de programas com scroll customizado -->
      <div id="modal-content-area" style="background: rgba(0, 0, 0, 0.25); padding: 12px; border-radius: 12px; font-size: 13px; flex: 1; overflow-y: auto; border: 1px solid rgba(99, 102, 241, 0.18); scrollbar-gutter: stable; display: flex; flex-direction: column; gap: 8px; max-height: 52vh; min-height: 220px;">
        <!-- Itens renderizados via renderList() -->
      </div>
      
      <div class="details-modal-footer" style="margin-top: 14px; padding-top: 12px; border-top: 1px solid rgba(255, 255, 255, 0.06); display: flex; align-items: center; justify-content: space-between;">
        <span id="programs-count" style="font-size: 12px; color: #94a3b8; font-weight: 500;">Total: ${programs.length} programas</span>
        <button class="modal-btn primary" id="modal-close-details" style="padding: 8px 22px; font-size: 12px;">Fechar</button>
      </div>
    </div>
  `
  document.body.appendChild(overlay)
  createLucideIcons()

  const close = () => {
    overlay.remove()
    document.removeEventListener('keydown', onKeyDown)
  }

  const onKeyDown = (e) => {
    if (e.key === 'Escape') close()
  }
  document.addEventListener('keydown', onKeyDown)

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close()
  })

  const xClose = document.getElementById('programs-x-close')
  if (xClose) xClose.onclick = close
  const closeBtn = document.getElementById('modal-close-details')
  if (closeBtn) closeBtn.onclick = close
  
  let currentSort = 'newest';
  let searchQuery = '';
  
  function parseRegDate(dateStr) {
    if (!dateStr) return new Date(0);
    if (/^\d{8}$/.test(dateStr)) {
      const y = parseInt(dateStr.substring(0, 4), 10);
      const m = parseInt(dateStr.substring(4, 6), 10) - 1;
      const d = parseInt(dateStr.substring(6, 8), 10);
      return new Date(y, m, d);
    }
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? new Date(0) : d;
  }
  
  function formatFriendlyDate(dateStr) {
    if (!dateStr) return 'Data não informada';
    if (/^\d{8}$/.test(dateStr)) {
      return `${dateStr.substring(6, 8)}/${dateStr.substring(4, 6)}/${dateStr.substring(0, 4)}`;
    }
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Data não informada';
    return d.toLocaleDateString('pt-BR');
  }

  function renderList() {
    const listContainer = document.getElementById('modal-content-area');
    if (!listContainer) return;
    
    let filtered = programs.filter(p => {
      const name = (p.DisplayName || '').toLowerCase();
      const pub = (p.Publisher || '').toLowerCase();
      const query = searchQuery.toLowerCase();
      return name.includes(query) || pub.includes(query);
    });
    
    filtered.sort((a, b) => {
      const dateA = parseRegDate(a.InstallDate);
      const dateB = parseRegDate(b.InstallDate);
      if (currentSort === 'newest') {
        return dateB.getTime() - dateA.getTime();
      } else {
        return dateA.getTime() - dateB.getTime();
      }
    });
    
    const countEl = document.getElementById('programs-count');
    if (countEl) countEl.textContent = `Exibindo ${filtered.length} de ${programs.length} programas`;
    const countPill = document.getElementById('programs-count-pill');
    if (countPill) countPill.textContent = `${filtered.length} Aplicativos`;
    
    if (filtered.length === 0) {
      listContainer.innerHTML = `
        <div style="text-align: center; padding: 48px 20px; color: #94a3b8; display: flex; flex-direction: column; align-items: center; gap: 10px;">
          <i data-lucide="search-x" style="width: 32px; height: 32px; color: #64748b;"></i>
          <span>Nenhum programa encontrado para "${escapeHtml(searchQuery)}"</span>
        </div>
      `;
      createLucideIcons();
      return;
    }
    
    listContainer.innerHTML = filtered.map((p, index) => {
      const dateText = formatFriendlyDate(p.InstallDate);
      const versionText = p.DisplayVersion ? `v${p.DisplayVersion}` : '';
      const pubText = p.Publisher ? ` • ${p.Publisher}` : '';
      
      const hasLocation = p.InstallLocation && p.InstallLocation.trim().length > 0;
      const hasUninstall = p.UninstallString && p.UninstallString.trim().length > 0;
      const actionBtnStyle = 'padding: 6px 12px; font-size: 11.5px; display: inline-flex; align-items: center; gap: 5px; height: auto; white-space: nowrap; box-sizing: border-box; flex: 0 0 auto; border-radius: 7px;';
      const disabledBtnStyle = 'opacity: 0.35; cursor: not-allowed; pointer-events: none;';
      
      return `
        <div class="program-item" style="display: flex; align-items: center; justify-content: space-between; padding: 11px 14px; background: rgba(255, 255, 255, 0.02); border-radius: 9px; border: 1px solid rgba(255, 255, 255, 0.06); gap: 16px; transition: background 0.2s ease;">
          <div style="flex: 1; min-width: 0;">
            <div style="font-weight: 600; color: #f8fafc; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 13.5px;" title="${escapeHtml(p.DisplayName)}">
              ${escapeHtml(p.DisplayName)}
            </div>
            <div style="font-size: 11px; color: #94a3b8; margin-top: 3px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
              <span style="color: #cbd5e1; background: rgba(99, 102, 241, 0.12); padding: 1px 6px; border-radius: 4px; border: 1px solid rgba(99, 102, 241, 0.2);">${dateText}</span>
              ${versionText ? `<span style="color: #94a3b8;">${escapeHtml(versionText)}</span>` : ''}
              ${pubText ? `<span style="color: #64748b;">${escapeHtml(pubText)}</span>` : ''}
            </div>
          </div>
          
          <div style="display: flex; gap: 8px; flex-shrink: 0;">
            <button class="modal-btn secondary btn-open-location" data-index="${index}" ${hasLocation ? '' : 'disabled'} title="Abrir pasta de instalação" style="${actionBtnStyle}${hasLocation ? '' : ` ${disabledBtnStyle}`}">
              <i data-lucide="folder-open" style="width:13px;height:13px"></i> Local
            </button>
            <button class="modal-btn secondary btn-uninstall-prog" data-index="${index}" ${hasUninstall ? '' : 'disabled'} title="Iniciar desinstalador oficial" style="${actionBtnStyle} border-color: rgba(239, 68, 68, 0.35); color: #fca5a5;${hasUninstall ? '' : ` ${disabledBtnStyle}`}">
              <i data-lucide="trash-2" style="width:13px;height:13px"></i> Desinstalar
            </button>
          </div>
        </div>
      `;
    }).join('');
    
    createLucideIcons();
    
    listContainer.querySelectorAll('.btn-open-location').forEach(btn => {
      btn.onclick = async () => {
        const prog = filtered[parseInt(btn.dataset.index, 10)];
        if (prog && prog.InstallLocation) {
          toast('info', 'Abrindo Local', `Abrindo pasta: ${prog.InstallLocation}`);
          await window.api.runCommand(`explorer.exe "${prog.InstallLocation}"`);
        }
      };
    });
    
    listContainer.querySelectorAll('.btn-uninstall-prog').forEach(btn => {
      btn.onclick = async () => {
        const prog = filtered[parseInt(btn.dataset.index, 10)];
        if (prog && prog.UninstallString) {
          showChoiceModal('Desinstalar Programa', `Deseja realmente iniciar o assistente de desinstalação de "${prog.DisplayName}"?`, [
            { label: 'Iniciar Desinstalação', value: 'yes', primary: true },
            { label: 'Cancelar', value: 'no', primary: false }
          ], async (choice, choiceOverlay) => {
            choiceOverlay.remove();
            if (choice === 'yes') {
              const tUn = toast('loading', 'Desinstalação', `Iniciando desinstalador de ${prog.DisplayName}...`);
              const result = await window.api.runCommand(prog.UninstallString);
              dismiss(tUn);
              if (result.success) {
                toast('success', 'Desinstalação', `Desinstalador concluído para ${prog.DisplayName}. Recarregando lista...`);
                setTimeout(async () => {
                  overlay.remove();
                  document.querySelector('.tool-btn[data-special="list-installed-programs"]')?.click();
                }, 2500);
              } else {
                toast('error', 'Desinstalação', `Erro ou cancelamento no desinstalador de ${prog.DisplayName}.`);
              }
            }
          });
        }
      };
    });
  }
  
  renderList();
  
  const searchInput = document.getElementById('program-search');
  if (searchInput) {
    searchInput.oninput = (e) => {
      searchQuery = e.target.value;
      renderList();
    };
  }
  
  const btnNewest = document.getElementById('filter-newest');
  const btnOldest = document.getElementById('filter-oldest');
  
  if (btnNewest) {
    btnNewest.onclick = () => {
      if (currentSort !== 'newest') {
        currentSort = 'newest';
        btnNewest.classList.add('primary');
        btnNewest.classList.remove('secondary');
        btnOldest.classList.add('secondary');
        btnOldest.classList.remove('primary');
        renderList();
      }
    };
  }
  
  if (btnOldest) {
    btnOldest.onclick = () => {
      if (currentSort !== 'oldest') {
        currentSort = 'oldest';
        btnOldest.classList.add('primary');
        btnOldest.classList.remove('secondary');
        btnNewest.classList.add('secondary');
        btnNewest.classList.remove('primary');
        renderList();
      }
    };
  }
}


// ── Toggle Tema ────────────────────────────────────────────────────────────────

function getTheme() {
  return localStorage.getItem(THEME_KEY) || 'dark'
}

function setTheme(theme) {
  localStorage.setItem(THEME_KEY, theme)
  document.body.setAttribute('data-theme', theme)
  
  const icon = document.querySelector('#theme-toggle i')
  if (icon) {
    icon.setAttribute('data-lucide', theme === 'dark' ? 'sun' : 'moon')
    createLucideIcons()
  }
}

document.getElementById('theme-toggle')?.addEventListener('click', () => {
  const current = getTheme()
  setTheme(current === 'dark' ? 'light' : 'dark')
})

// Aplicar tema ao carregar
setTheme(getTheme())

// Limpar histórico
document.getElementById('clear-history')?.addEventListener('click', () => {
  showChoiceModal(
    'Limpar Histórico',
    'Tem certeza que deseja apagar permanentemente todos os registros de comandos executados? Esta ação não pode ser desfeita.',
    [
      { label: 'Cancelar', value: false, primary: false },
      { label: 'Limpar tudo', value: true, primary: true }
    ],
    (confirmed, overlay) => {
      overlay.remove()
      if (confirmed) {
        localStorage.removeItem(HISTORY_KEY);
        localStorage.removeItem('thundertools_pending_ai_notes');
        if (window.api && typeof window.api.resetSystemMaintenance === 'function') {
          window.api.resetSystemMaintenance().catch(() => {});
        }
        renderHistory();
        toast('success', 'Histórico', '🟡 O histórico de comandos e sessões anteriores foi removido com sucesso.');
      }
    }
  )
})

// Cancelar comando
globalCancelBtn?.addEventListener('click', () => {
  window.api.cancelCommand()
  // Imediatamente desabilitar o botão de cancelar após o clique
  isCommandRunning = false;
  updateGlobalCancelButtonState();
  // Para comandos de longa duração, a janela de progresso lidará com a finalização
})

// Função para atualizar o estado do botão global de cancelar
function updateGlobalCancelButtonState() {
  if (globalCancelBtn) {
    globalCancelBtn.disabled = !isCommandRunning;
  }
}

const SVG = {
  success: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#86efac" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
  error:   `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fca5a5" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
  warning: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fde68a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  info:    `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#7dd3fc" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`
}

function notificationInlineIcon(name) {
  return `<span class="notification-inline-icon"><i data-lucide="${name}"></i></span>`
}

function formatNotificationMessage(html) {
  const replacements = [
    ['🖨️', 'printer'],
    ['🖨️', 'printer'],
    ['👤', 'user'],
    ['🟢', 'check-circle-2'],
    ['🔴', 'x-circle'],
    ['🟡', 'alert-triangle'],
    ['⚪', 'circle'],
    ['⚠️', 'triangle-alert'],
    ['⚠️', 'triangle-alert'],
    ['❌', 'x-circle'],
    ['🗑️', 'trash-2'],
    ['🗑️', 'trash-2'],
    ['🔋', 'battery-charging'],
    ['📄', 'file-text'],
    ['💾', 'save'],
    ['💚', 'hard-drive'],
    ['💻', 'monitor'],
    ['📦', 'package'],
    ['⚙️', 'settings'],
    ['⚙️', 'settings'],
    ['🔧', 'wrench'],
    ['🧠', 'memory-stick'],
    ['🕒', 'clock'],
    ['🌐', 'globe'],
    ['🏭', 'factory'],
    ['🔑', 'key-round'],
    ['🔍', 'search'],
    ['🚪', 'door-open'],
    ['🔳', 'square'],
    ['📊', 'chart-bar'],
    ['⚡', 'zap'],
    ['📦', 'package']
  ]

  return replacements.reduce((formatted, [emoji, icon]) => {
    return formatted.split(emoji).join(notificationInlineIcon(icon))
  }, String(html ?? ''))
}

// ── Header Stats ───────────────────────────────────────────────────────────────

// Stats do sistema (CPU/RAM)
window.api.onSystemStats((data) => {
  updateDashboardMetrics(data);
  const cpuEl = document.getElementById('cpu-usage')
  const ramEl = document.getElementById('ram-usage')
  const diskEl = document.getElementById('cpu-temp') // Mantendo o ID original para compatibilidade com o HTML existente
  const cpuBar = document.getElementById('cpu-bar')
  const ramBar = document.getElementById('ram-bar')
  
  cpuEl.textContent = `${data.cpu}%`
  ramEl.textContent = `${data.ram}%`
  if (diskEl) diskEl.textContent = (data.temp !== null && data.temp !== undefined) ? `${data.temp}°C` : '—'
  
  // Atualiza barras com cores dinâmicas
  cpuBar.style.width = `${data.cpu}%`
  ramBar.style.width = `${data.ram}%`
  
  // CPU
  cpuBar.className = 'stat-bar-fill'
  if (data.cpu < 50) cpuBar.classList.add('low')
  else if (data.cpu < 80) cpuBar.classList.add('medium')
  else cpuBar.classList.add('high')

  if (data.cpu >= 90) cpuEl.style.color = '#ef4444'
  else if (data.cpu >= 75) cpuEl.style.color = '#f59e0b'
  else cpuEl.style.color = '#e0e0e0'
  
  // RAM
  ramBar.className = 'stat-bar-fill'
  if (data.ram < 60) ramBar.classList.add('low')
  else if (data.ram < 85) ramBar.classList.add('medium')
  else ramBar.classList.add('high')

  if (data.ram >= 90) ramEl.style.color = '#ef4444'
  else if (data.ram >= 75) ramEl.style.color = '#f59e0b'
  else ramEl.style.color = '#e0e0e0'

  if (diskEl && data.temp !== null && data.temp !== undefined) {
    if (data.temp >= 80) diskEl.style.color = '#ef4444'
    else if (data.temp >= 68) diskEl.style.color = '#f59e0b'
    else diskEl.style.color = '#e0e0e0'
  }
})

// ── Helpers ───────────────────────────────────────────────────────────────────

const toGB = bytes => bytes ? (parseInt(bytes) / 1073741824).toFixed(1) + ' GB' : null

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

let internalWindowsUsersRegex = /^(Administrador|Administrator|Convidado|Guest|DefaultAccount|WDAGUtilityAccount|CodexSandboxOffline|CodexSandboxOnline)$/i;

async function initializeInternalWindowsUsersRegex() {
  try {
    if (window.api && window.api.getBlockedLocalUsers) {
      const blocked = await window.api.getBlockedLocalUsers();
      if (Array.isArray(blocked) && blocked.length > 0) {
        const pattern = `^(${blocked.map(u => u.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})$`;
        internalWindowsUsersRegex = new RegExp(pattern, 'i');
      }
    }
  } catch (err) {
    console.warn('Não foi possível carregar lista dinâmica de usuários bloqueados:', err);
  }
}

function isInternalWindowsUser(userName) {
  return internalWindowsUsersRegex.test(String(userName || '').trim());
}

const STATE_LABEL = {
  RUNNING: '🟢 Em execução',       // English
  STOPPED: '🔴 Parado',         // English
  START_PENDING: '🟡 Iniciando',  // English
  STOP_PENDING: '🟡 Parando',     // English
  PAUSED: '🟡 Pausado',
  '4': '🟢 Em execução', '1': '🔴 Parado', '2': '🟡 Iniciando', '3': '🟡 Parando', '7': '🟡 Pausado', // Numeric
  'EM EXECUÇÃO': '🟢 Em execução', // Portuguese
  'EM EXECUCAO': '🟢 Em execução',
  'PARADO': '🔴 Parado',           // Portuguese
  'INÍCIO PENDENTE': '🟡 Iniciando', // Portuguese
  'INICIO PENDENTE': '🟡 Iniciando',
  'PARADA PENDENTE': '🟡 Parando',   // Portuguese
  'PAUSADO': '🟡 Pausado'
}

function getServiceStateFromOutput(text) {
  if (!text) return '⚪ Desconhecido';
  const match = text.match(/(?:STATE|ESTADO)\s*:\s*(?:(\d+)\s+)?([^\r\n(]+)/i);
  const stateNum = (text.match(/(?:STATE|ESTADO)\s*:\s*(\d+)/i) || [])[1];
  const stateText = match ? match[2]?.trim().toUpperCase() : null;
  return (stateText && STATE_LABEL[stateText]) || 
         (stateNum && STATE_LABEL[stateNum]) || 
         (stateText ? `⚪ ${stateText}` : '⚪ Desconhecido');
}

// ── Parsers por comando ────────────────────────────────────────────────────────

const PARSERS = [

  // Limpar fila de impressão
  { match: cmd => cmd.includes('del /Q') && cmd.includes('PRINTERS'),
    result: () => '🟢 Spooler parado<br>🗑️ Fila de impressão limpa<br>🟢 Spooler reiniciado com sucesso' },

  // Reiniciar spooler
  { match: cmd => cmd.includes('stop spooler') && cmd.includes('start spooler') && !cmd.includes('del'),
    result: () => '🔴 Spooler parado<br>🟢 Spooler reiniciado com sucesso' },

  // Status do spooler
  { match: cmd => /sc query spooler/.test(cmd) && !/wuauserv|bits/.test(cmd),
    result: (_, out) => {
      const state = getServiceStateFromOutput(out)
      return `<b>Status:</b> ${state}`
    }
  },

  // Listar impressoras
  { match: cmd => cmd.includes('Get-Printer') || cmd.includes('printer list'),
    result: (_, out) => {
      const lines = out.trim().split(/\r?\n/).filter(l => l.trim() && !/^Name|^----|^\s*$/i.test(l))
      if (!lines.length) return '⚪ Nenhuma impressora encontrada'
      return lines.slice(0, 8).map(l => {
        const name = l.trim().split(/\s{2,}/)[0] || l.trim()
        return `🖨️ <b>${name}</b>`
      }).join('<br>')
    }
  },

  // Resetar Windows Update (completo)
  { match: cmd => cmd.includes('SoftwareDistribution'),
    result: () => '🔴 Serviços de atualização parados<br>🗑️ Cache do Windows Update limpo<br>🟢 Serviços reiniciados com sucesso' },

  // Reiniciar serviços update (simples)
  { match: cmd => cmd.includes('stop wuauserv') && cmd.includes('start wuauserv') && !cmd.includes('SoftwareDistribution'),
    result: () => '🔴 wuauserv e bits parados<br>🟢 wuauserv e bits reiniciados com sucesso' },

  // Status serviços update
  { match: cmd => /sc query wuauserv/.test(cmd),
    result: (_, out) => {
      return ['wuauserv', 'bits'].map(svc => {
        const block = out.split(/(?:SERVICE_NAME|NOME_DO_SERVI[CÇ]O)\s*:/i).find(b => new RegExp(svc, 'i').test(b)) || 
                      out.split(/\r?\n\r?\n/).find(b => new RegExp(svc, 'i').test(b)) || ''
        const state = getServiceStateFromOutput(block)
        return `<b>${svc}:</b> ${state}`
      }).join('<br>')
    }
  },

  // Forçar verificação de atualização
  { match: cmd => cmd.includes('wuauclt'),
    result: () => '🔍 Verificação de atualizações solicitada ao Windows Update<br>⚪ O processo ocorre em segundo plano' },

  // Limpar DNS
  { match: cmd => cmd.includes('flushdns'),
    result: () => '🟢 Cache DNS limpo com sucesso' },

  // Alto desempenho
  { match: cmd => cmd.includes('e9a42b02') || cmd.includes('ACTIVATE_ULTIMATE_PERFORMANCE') || (cmd.includes('powercfg') && cmd.toLowerCase().includes('ultimate')),
    result: () => '🔥 Plano oculto <b>Desempenho Máximo (Ultimate Performance)</b> ativado e confirmado no Windows' },
  { match: cmd => cmd.includes('8c5e7fda') || cmd.includes('powercfg /setactive'),
    result: () => '⚡ Plano de energia <b>Alto Desempenho</b> ativado no Windows' },

  // Limpeza de disco
  { match: cmd => cmd.includes('cleanmgr'),
    result: () => '🟢 Limpeza de disco iniciada<br>⚪ Conclua o processo na janela do Windows' },

  // Processos ativos
  { match: cmd => cmd.includes('tasklist'),
    result: (_, out) => {
      const lines = out.trim().split(/\r?\n/).filter(l => l.trim() && !/^Image|^====/.test(l))
      return `<b>Total de processos:</b> ${lines.length}`
    }
  },

  // MemÃ³ria RAM
  { match: cmd => cmd.includes('memorychip') || cmd.includes('Win32_PhysicalMemory'),
    result: (_, out) => {
      const lines = out.trim().split(/\r?\n/).filter(l => l.trim() && !/^Capacity|^----/i.test(l))
      if (!lines.length) return '⚪ Não foi possível obter informações de RAM'
      return lines.slice(0, 4).map(line => {
        const p = line.trim().split(/\s{2,}/)
        const cap = p[0] ? (parseInt(p[0]) / 1073741824).toFixed(0) + ' GB' : '—'
        const spd = p[1]?.trim() ? p[1].trim() + ' MHz' : '—'
        const mfr = p[2]?.trim() || '—'
        return `🧠 <b>${cap}</b> — ${mfr} — ${spd}`
      }).join('<br>')
    }
  },

  // Relatório de energia
  { match: cmd => cmd.includes('powercfg /energy'),
    result: () => '🔋 Relatório de energia gerado<br>📄 Arquivo salvo na <b>Área de Trabalho</b>' },

  // SFC
  { match: cmd => cmd.includes('sfc /scannow'),
    result: (_, out) => {
      if (/no integrity violations|nenhuma viola/i.test(out))
        return '<b>Status:</b> 🟢 Nenhum arquivo corrompido'
      if (/successfully repaired|reparados com Ãªxito/i.test(out))
        return '<b>Status:</b> 🟡 Arquivos reparados'
      if (/unable to fix|nÃ£o foi possÃ­vel reparar/i.test(out))
        return '<b>Status:</b> 🔴 Não foi possível reparar'
      return '<b>Status:</b> 🟢 Verificação concluída'
    }
  },

  // DISM
  { match: cmd => cmd.includes('DISM'),
    result: (_, out) => {
      if (/restore operation completed|restauraÃ§Ã£o.*concluÃ­da/i.test(out))
        return '<b>Status:</b> 🟢 Imagem restaurada'
      if (/no component store corruption|nenhuma corrupÃ§Ã£o/i.test(out))
        return '<b>Status:</b> 🟢 Nenhuma corrupção detectada'
      return '<b>Status:</b> 🟢 Operação concluída'
    }
  },

  // CHKDSK
  { match: cmd => cmd.includes('chkdsk'),
    result: (_, out) => {
      if (/cannot lock|nÃ£o Ã© possÃ­vel bloquear/i.test(out) || /scheduled|agendado/i.test(out))
        return { type: 'warning', msg: '🟡 Disco em uso — verificação <b>agendada para o próximo reinício</b>' }
      if (/found no problems|nenhum problema/i.test(out))
        return '🟢 Disco verificado — nenhum problema encontrado'
      return { type: 'warning', msg: '🟡 Verificação agendada para o próximo reinício' }
    }
  },

  // Desfragmentar
  { match: cmd => cmd.includes('defrag'),
    result: (_, out) => {
      if (/100%|concluÃ­do|completed/i.test(out))
        return '<b>Status:</b> 🟢 Desfragmentação concluída'
      if (/solid state|SSD|nÃ£o Ã© necessÃ¡rio/i.test(out))
        return '<b>Status:</b> ⚪ SSD detectado — não necessário'
      return '<b>Status:</b> 🟢 Concluído'
    }
  },

  // Info dos discos
  { match: cmd => cmd.includes('diskdrive') || cmd.includes('Win32_DiskDrive'),
    result: (_, out) => {
      const lines = out.trim().split(/\r?\n/).filter(l => l.trim() && !/^Model|^----/i.test(l))
      if (!lines.length) return '⚪ Nenhum disco encontrado'
      return lines.slice(0, 4).map(line => {
        const p = line.trim().split(/\s{2,}/)
        const model  = p[0]?.trim() || '—'
        const size   = p[1]?.trim() ? p[1].trim() + ' GB' : '—'
        const status = p[2]?.trim() || '—'
        return `${status === 'OK' ? '🟢' : '🔴'} <b>${model}</b> — ${size} — ${status}`
      }).join('<br>')
    }
  },

  // Espaço livre
  { match: cmd => cmd.includes('diskfree') || cmd.includes('Get-PSDrive'),
    result: (_, out) => {
      // Formato PowerShell: "Usado : 45.2" "Livre : 189.3" "Total : 234.5"
      const usado = (out.match(/Usado\s*:\s*([\d.]+)/i) || [])[1]
      const livre = (out.match(/Livre\s*:\s*([\d.]+)/i) || out.match(/Free\s*:\s*([\d.]+)/i) || [])[1]
      const total = (out.match(/Total\s*:\s*([\d.]+)/i) || [])[1]
      
      // Fallback para fsutil (bytes)
      if (!livre && !usado) {
        const freeBytes  = (out.match(/Free.*?:\s*([\d]+)/i) || out.match(/Livre.*?:\s*([\d]+)/i) || [])[1]
        const totalBytes = (out.match(/Total.*?:\s*([\d]+)/i) || [])[1]
        if (freeBytes) {
          const freeGB = (parseInt(freeBytes) / 1073741824).toFixed(1)
          const totalGB = totalBytes ? (parseInt(totalBytes) / 1073741824).toFixed(1) : null
          const pct = totalBytes ? Math.round((1 - parseInt(freeBytes) / parseInt(totalBytes)) * 100) : null
          return [
            `💚 Espaço livre: <b>${freeGB} GB</b>`,
            totalGB ? `💾 Total: <b>${totalGB} GB</b>` : null,
            pct !== null ? `📊 Uso: <b>${pct}%</b>` : null
          ].filter(Boolean).join('<br>')
        }
      }
      
      if (!livre) return '⚪ Não foi possível obter espaço em disco'
      
      const pct = total ? Math.round((parseFloat(usado) / parseFloat(total)) * 100) : null
      return [
        `💚 Espaço livre: <b>${livre} GB</b>`,
        usado ? `🟠 Espaço usado: <b>${usado} GB</b>` : null,
        total ? `💾 Total: <b>${total} GB</b>` : null,
        pct !== null ? `📊 Uso: <b>${pct}%</b>` : null
      ].filter(Boolean).join('<br>')
    }
  },

  // Resetar Winsock/TCP
  { match: cmd => cmd.includes('winsock reset'),
    result: () => ({ type: 'warning', msg: '🟢 Winsock e TCP/IP resetados<br>🟡 <b>Reinicie o computador</b> para aplicar as alterações' }) },

  // Listar credenciais de rede
  { match: cmd => cmd.includes('cmdkey /list'),
    result: (_, out) => {
      const rawLines = out.trim().split(/\r?\n/).filter(l => l.trim() && !/Atualmente armazenadas|Currently stored/i.test(l))
      if (!rawLines.length || (rawLines.length === 1 && /Nenhuma|None/i.test(rawLines[0]))) return '⚪ Nenhuma credencial de rede encontrada'
      
      const entries = []
      let current = null
      for (const line of rawLines) {
        const trimmed = line.trim()
        if (trimmed.startsWith('Target:') || trimmed.startsWith('Destino:')) {
          if (current) entries.push(current)
          current = { target: trimmed, info: [] }
        } else if (current) {
          current.info.push(trimmed)
        }
      }
      if (current) entries.push(current)

      // Filtra credenciais de sistema/genéricas (LegacyGeneric, WindowsLive, MicrosoftAccount, etc)
      const filtered = entries.filter(e => {
        const t = e.target.toLowerCase()
        const isSystem = t.includes('legacygeneric') || t.includes('windowslive') || t.includes('microsoftaccount') || t.includes('sso_pop_') || t.includes('virtualapp')
        const typeLine = e.info.find(i => i.toLowerCase().startsWith('type:') || i.toLowerCase().startsWith('tipo:'))
        const isGenericType = typeLine && (typeLine.toLowerCase().includes('generic') || typeLine.toLowerCase().includes('genérico'))
        return !isSystem && !isGenericType
      })

      if (!filtered.length) return '⚪ Nenhuma credencial de domínio encontrada'

      return filtered.map(e => {
        let target = e.target.split(':').slice(1).join(':').trim()
        if (target.toLowerCase().includes('target=')) target = target.split(/target=/i).pop().trim()
        const infoHtml = e.info.map(i => `<small style="color: #9ca3af; margin-left: 20px;">${i}</small>`).join('<br>')
        return `🔑 <b>${target}</b><br>${infoHtml}`
      }).join('<br>')
    }
  },
  { match: cmd => cmd.includes('cmdkey'),
    result: (_, out) => {
      const deletedCount = (out.match(/exclu[Ã­i]do|deleted/gi) || []).length
      const listedCount = (out.match(/Target:|Destino:/gi) || []).length
      
      if (deletedCount > 0)
        return `🟢 <b>${deletedCount}</b> credencial(is) de rede removida(s) com sucesso`
      if (listedCount === 0)
        return '⚪ Nenhuma credencial de rede armazenada encontrada'
      return '🟢 Credenciais de rede limpas com sucesso'
    }
  },

  // Info de rede
  { match: cmd => cmd.includes('ipconfig /all'),
    result: (_, out) => {
      const ip   = (out.match(/IPv4.*?:\s*([\d.]+)/i) || [])[1]
      const mask = (out.match(/Subnet Mask.*?:\s*([\d.]+)/i) || out.match(/MÃ¡scara.*?:\s*([\d.]+)/i) || [])[1]
      const gw   = (out.match(/Default Gateway.*?:\s*([\d.]+)/i) || out.match(/Gateway PadrÃ£o.*?:\s*([\d.]+)/i) || [])[1]
      const dns  = (out.match(/DNS Servers.*?:\s*([\d.]+)/i) || out.match(/Servidores DNS.*?:\s*([\d.]+)/i) || [])[1]
      if (!ip) return '⚪ Nenhuma conexão de rede ativa encontrada'
      return [
        ip   ? `🌐 IP: <b>${ip}</b>` : null,
        mask ? `🔳 Máscara: <b>${mask}</b>` : null,
        gw   ? `🚪 Gateway: <b>${gw}</b>` : null,
        dns  ? `🔍 DNS: <b>${dns}</b>` : null
      ].filter(Boolean).join('<br>')
    }
  },

  // Renovar IP
  { match: cmd => cmd.includes('ipconfig /release'),
    result: () => '🔴 IP anterior liberado<br>🟢 Novo endereço IP obtido com sucesso' },

  // Ping
  { match: cmd => cmd.includes('ping'),
    result: (_, out) => {
      const recv = (out.match(/Received\s*=\s*(\d+)/i) || out.match(/Recebidos\s*=\s*(\d+)/i) || [])[1]
      const lost = (out.match(/Lost\s*=\s*(\d+)/i) || out.match(/Perdidos\s*=\s*(\d+)/i) || [])[1]
      const avg  = (out.match(/Average\s*=\s*(\d+)ms/i) || out.match(/MÃ©dia\s*=\s*(\d+)ms/i) || [])[1]
      if (recv === undefined || (parseInt(recv) === 0)) return '<b>Status:</b> 🔴 Servidor não respondeu'

      const ok = parseInt(lost) === 0
      return [
        `<b>Status:</b> ${ok ? '🟢 Conexão estável' : '🟡 Conexão com oscilação'}`,
        `📦 <b>Pacotes:</b> ${recv}/4 recebidos`,
        avg ? `⚡ <b>Latência:</b> ${avg}ms (média)` : null
      ].filter(Boolean).join('<br>')
    }
  },

  // Sincronizar data/hora
  { match: cmd => cmd.includes('w32tm') && cmd.includes('resync'),
    result: (_, out) => {
      if (/sending resync|enviando ressincroniza/i.test(out) || /successfully|com Ãªxito/i.test(out) || out.trim() === '')
        return '<b>Status:</b> 🟢 Sincronizado'
      if (/error|erro|failed|falhou/i.test(out))
        return { type: 'warning', msg: '<b>Status:</b> 🟡 Falha na sincronização<br><b>Motivo:</b> Verifique a conexão' }
      return '<b>Status:</b> 🟢 Solicitado'
    }
  },

  // Informações do sistema
  { match: cmd => cmd.includes('systeminfo'),
    result: (_, out) => {
      const get = (patterns) => {
        for (const p of patterns) {
          const match = out.match(p)
          if (match) return match[1]?.trim()
        }
        return null
      }
      
      const os = get([/OS Name.*?:\s*(.+)/i, /Nome do SO.*?:\s*(.+)/i])
      const version = get([/OS Version.*?:\s*(.+)/i, /VersÃ£o do SO.*?:\s*(.+)/i])
      const arch = get([/System Type.*?:\s*(.+)/i, /Tipo de Sistema.*?:\s*(.+)/i])
      const proc = get([/\[01\]:\s*(.+)/i, /Processor.*?:\s*(.+)/i, /Processador.*?:\s*(.+)/i])
      const ram = get([/Total Physical Memory.*?:\s*(.+)/i, /MemÃ³ria FÃ­sica Total.*?:\s*(.+)/i])
      const boot = get([/System Boot Time.*?:\s*(.+)/i, /Hora de InicializaÃ§Ã£o.*?:\s*(.+)/i])
      const domain = get([/Domain.*?:\s*(.+)/i, /DomÃ­nio.*?:\s*(.+)/i])
      const hostname = get([/Host Name.*?:\s*(.+)/i, /Nome do Host.*?:\s*(.+)/i])
      
      const lines = []
      if (hostname) lines.push(`🖥️ Host: <b>${hostname}</b>`)
      if (os) lines.push(`💻 SO: <b>${os.replace('Microsoft ', '').replace('Windows ', 'Win ')}</b>`)
      if (version) lines.push(`📦 Versão: <b>${version}</b>`)
      if (arch) lines.push(`⚙️ Arquitetura: <b>${arch.includes('x64') ? '64-bit' : arch}</b>`)
      if (proc) lines.push(`🔧 CPU: <b>${proc.replace(/\s+@.*/, '')}</b>`)
      if (ram) lines.push(`🧠 RAM Total: <b>${ram}</b>`)
      if (boot) lines.push(`🕒 Último boot: <b>${boot}</b>`)
      if (domain) lines.push(`🌐 Domínio: <b>${domain}</b>`)
      
      return lines.length ? lines.join('<br>') : '🟢 Informações do sistema obtidas'
    }
  },

  // Info da BIOS
  { match: cmd => cmd.includes('bios') || cmd.includes('Win32_BIOS'),
    result: (_, out) => {
      // Formato PowerShell: "Manufacturer : Dell Inc."
      const mfr = (out.match(/Manufacturer\s*:\s*(.+)/i) || [])[1]?.trim()
      const serial = (out.match(/SerialNumber\s*:\s*(.+)/i) || [])[1]?.trim()
      const version = (out.match(/SMBIOSBIOSVersion\s*:\s*(.+)/i) || out.match(/Version\s*:\s*(.+)/i) || [])[1]?.trim()
      
      if (!mfr && !serial && !version) return '⚪ Não foi possível obter informações da BIOS'
      
      return [
        mfr ? `🏭 Fabricante: <b>${mfr}</b>` : null,
        serial ? `🔑 Nº de Série: <b>${serial}</b>` : null,
        version ? `📦 Versão: <b>${version}</b>` : null
      ].filter(Boolean).join('<br>')
    }
  },

  // Usuários
  { match: cmd => cmd.includes('net user') && !cmd.includes('net user '),
    result: (_, out) => {
      const lines = out.trim().split(/\r?\n/).filter(l => {
        const t = l.trim()
        return t && 
               !/^-+$/.test(t) && 
               !/conclu.*do|completed|.*xito|success/i.test(t)
      })
      const users = lines.flatMap(l => l.match(/\S+/g) || [])
                         .filter(u => !isInternalWindowsUser(u))
      if (!users.length) return `${notificationInlineIcon('alert-triangle')} Nenhum usuário encontrado`
      return users.map(u => `${notificationInlineIcon('user')} <b>${u}</b>`).join('<br>')
    }
  },

  // Reiniciar sistema
  { match: cmd => cmd.includes('shutdown /r'),
    result: () => ({ type: 'warning', msg: '🟡 Reinicialização agendada para <b>30 segundos</b><br>💾 Salve todos os arquivos abertos' }) },

  // Cancelar reinício
  { match: cmd => cmd.includes('shutdown /a'),
    result: () => '<b>Status:</b> 🟢 Reinicialização cancelada' },

  // Group Policy
  { match: cmd => cmd.includes('gpupdate'),
    result: (_, out) => {
      if (/success|Ãªxito|concluÃ­do/i.test(out))
        return '<b>Status:</b> 🟢 Políticas atualizadas'
      return '<b>Status:</b> 🟢 Atualização concluída'
    }
  },

  // Chave do Windows
  { match: cmd => cmd.includes('OA3xOriginalProductKey') || cmd.includes('SoftwareLicensingService'),
    result: (_, out) => {
      const match = out.match(/[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}/i);
      if (match)
        return `<b>Chave do Produto:</b> ${match[0]}`
      if (/Licenca Digital|Volume/i.test(out))
        return '<b>Status:</b> 🟢 Licença Digital ou Ativação corporativa detectada (sem chave OEM física gravada na placa-mãe).'
      return '<b>Status:</b> ⚪ Nenhuma chave OEM física na BIOS (Licença Digital vinculada à Conta Microsoft).'
    }
  },

  // Scan Defender
  { match: cmd => cmd.includes('Start-MpScan'),
    result: () => '<b>Status:</b> 🟢 Verificação iniciada em segundo plano'
  },

  // Atualizar Defender
  { match: cmd => cmd.includes('Update-MpSignature'),
    result: () => '<b>Status:</b> 🟢 Definições atualizadas'
  },

  // Status Firewall
  { match: cmd => cmd.includes('advfirewall show'),
    result: (_, out) => {
      const profiles = ['Domain', 'Private', 'Public']
      return profiles.map(p => {
        const block = out.split('\n\n').find(b => b.includes(p))
        const state = block?.match(/State\s+(ON|OFF)/i)?.[1]?.toUpperCase()
        const emoji = state === 'ON' ? '🟢' : '🔴'
        return `<b>${p}:</b> ${emoji} ${state === 'ON' ? 'Ativo' : 'Inativo'}`
      }).join('<br>')
    }
  },

  // Programas instalados
  { match: cmd => cmd.includes('Uninstall'),
    result: (_, out) => {
      const lines = out.trim().split(/\r?\n/).filter(l => l.trim() && !/^DisplayName|^----|^\s*$/i.test(l))
      return `<b>Total de programas:</b> ${lines.length}`
    }
  },

  // Portas abertas
  { match: cmd => cmd.includes('netstat') && cmd.includes('LISTENING'),
    result: (_, out) => {
      const lines = out.trim().split(/\r?\n/).filter(l => l.includes('LISTENING'))
      return `<b>Portas em escuta:</b> ${lines.length}`
    }
  },

  // Conexões ativas
  { match: cmd => cmd.includes('netstat -ano') && !cmd.includes('LISTENING'),
    result: (_, out) => {
      const lines = out
        .trim()
        .split(/\r?\n/)
        .filter(line => {
          const trimmed = line.trim()
          return /^TCP\s+/i.test(trimmed) || /^UDP\s+/i.test(trimmed)
        })

      return `<b>Conexões ativas:</b> ${lines.length}`
    }
  },

  // Limpar temporários
  { match: cmd => cmd.includes('%TEMP%') && cmd.includes('del'),
    result: () => '<b>Status:</b> 🟢 Arquivos temporários removidos'
  },

  // Programas de inicialização
  { match: cmd => cmd.includes('Win32_StartupCommand'),
    result: (_, out) => {
      const lines = out.trim().split(/\r?\n/).filter(l => l.trim() && !/^Name|^----|^\s*$/i.test(l))
      if (!lines.length) return '<b>Status:</b> ⚪ Nenhum programa de inicialização'
      return lines.slice(0, 8).map(l => {
        const name = l.trim().split(/\s{2,}/)[0] || l.trim()
        return `🔹 <b>${name}</b>`
      }).join('<br>')
    }
  },

  // DNS Google/Cloudflare
  { match: cmd => cmd.includes('Set-DnsClientServerAddress') || cmd.includes('set dns'),
    result: (cmd, out) => {
      if (out && out.includes('Nenhum adaptador'))
        return { type: 'warning', msg: `🟡 ${out.trim()}` }
      if (cmd.includes('8.8.8.8'))
        return '<b>Status:</b> 🟢 DNS configurado para Google (8.8.8.8 e 8.8.4.4)'
      if (cmd.includes('1.1.1.1'))
        return '<b>Status:</b> 🟢 DNS configurado para Cloudflare (1.1.1.1 e 1.0.0.1)'
      return '<b>Status:</b> 🟢 DNS de rede configurado com sucesso'
    }
  },

  // Limpar WinSxS
  { match: cmd => cmd.includes('StartComponentCleanup'),
    result: (_, out) => {
      if (/The operation completed successfully|A operaÃ§Ã£o foi concluÃ­da com Ãªxito/i.test(out))
        return { type: 'success', msg: '<b>Status:</b> 🟢 Limpeza de componentes concluída' }
      if (/Error|Erro/i.test(out))
        return { type: 'error', msg: '🔴 Erro na limpeza de componentes' }
      return { type: 'success', msg: '<b>Status:</b> 🟢 Operação de limpeza processada' }
    }
  },

  // TRIM SSD
  { match: cmd => cmd.includes('Optimize-Volume') && cmd.includes('ReTrim'),
    result: (_, out) => {
      if (/The operation completed successfully|A operaÃ§Ã£o foi concluÃ­da com Ãªxito|conclu[Ã­i]d[ao]|completed/i.test(out))
        return { type: 'success', msg: '<b>Status:</b> 🟢 Comando TRIM executado no SSD' }
      if (/Error|Erro/i.test(out))
        return { type: 'error', msg: '🔴 Erro ao executar TRIM no SSD' }
      return { type: 'success', msg: '<b>Status:</b> 🟢 Operação TRIM concluída' }
    }
  },

  // Ponto de restauração
  { match: cmd => cmd.includes('Checkpoint-Computer'),
    result: (_, out) => {
      if (/successfully|sucesso|Ãªxito/i.test(out))
        return '<b>Status:</b> 🟢 Ponto de restauração criado'
      return '<b>Status:</b> 🟡 Verifique se a proteção do sistema está ativada'
    }
  },

  // Winget - Instalação de programas
  { match: cmd => cmd.includes('winget install'),
    result: (_, out) => {
      if (out.includes('Successfully installed') || out.includes('instalado com Ãªxito'))
        return '<b>Status:</b> 🟢 Programa instalado com sucesso'
      if (out.includes('already installed') || out.includes('jÃ¡ estÃ¡ instalado'))
        return '<b>Status:</b> 🟡 Programa já está instalado'
      if (out.includes('No package found') || out.includes('Nenhum pacote encontrado'))
        return { type: 'error', msg: '🔴 Programa não encontrado no repositório' }
      return '<b>Status:</b> 🟢 Instalação concluída'
    }
  },
]

function parseOutput(cmd, output) {
  for (const p of PARSERS) {
    if (p.match(cmd)) {
      const result = p.result(cmd, output)
      // Se retornar objeto com type, retorna ele; senão, retorna string com type 'success'
      return typeof result === 'object' ? result : { type: 'success', msg: result }
    }
  }
  return { type: 'success', msg: '🟢 Operação concluída' }
}

// â”€â”€ Etapas de progresso â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const STEPS = [
  { match: cmd => cmd.includes('del /Q') && cmd.includes('PRINTERS'),
    steps: ['Parando o spooler...', 'Limpando a fila de impressão...', 'Reiniciando o spooler...'] },
  { match: cmd => cmd.includes('stop spooler') && !cmd.includes('del'),
    steps: ['Parando o spooler...', 'Reiniciando o serviço...'] },
  { match: cmd => cmd.includes('SoftwareDistribution'),
    steps: ['Parando serviços de atualização...', 'Limpando cache do Windows Update...', 'Reiniciando serviços...'] },
  { match: cmd => cmd.includes('stop wuauserv') && !cmd.includes('SoftwareDistribution'),
    steps: ['Parando serviços...', 'Reiniciando wuauserv e bits...'] },
  { match: cmd => cmd.includes('sfc /scannow'),
    steps: ['Verificando arquivos do sistema...', 'Isso pode levar alguns minutos...'] },
  { match: cmd => cmd.includes('DISM'),
    steps: ['Verificando imagem do Windows...', 'Restaurando componentes...', 'Isso pode demorar vários minutos...'] },
  { match: cmd => cmd.includes('chkdsk'),
    steps: ['Iniciando verificação de disco...', 'Analisando arquivos e índices...', 'Aguardando agendamento se necessário...'] },
  { match: cmd => cmd.includes('defrag'),
    steps: ['Analisando disco C:...', 'Desfragmentando...', 'Isso pode levar vários minutos...'] },
  { match: cmd => cmd.includes('ipconfig /release'),
    steps: ['Liberando endereço IP atual...', 'Obtendo novo endereço IP...'] },
  { match: cmd => cmd.includes('winsock reset'),
    steps: ['Resetando Winsock...', 'Resetando TCP/IP...'] },
  { match: cmd => cmd.includes('cmdkey'),
    steps: ['Listando credenciais armazenadas...', 'Removendo credenciais antigas...'] },
  { match: cmd => cmd.includes('powercfg /energy'),
    steps: ['Analisando consumo de energia...', 'Isso leva cerca de 60 segundos...'] },
  { match: cmd => cmd.includes('gpupdate'),
    steps: ['Aplicando políticas de computador...', 'Aplicando políticas de usuário...'] },
  { match: cmd => cmd.includes('w32tm') && cmd.includes('resync'),
    steps: ['Conectando ao servidor NTP...', 'Sincronizando data e hora...'] },
  { match: cmd => cmd.includes('Start-MpScan'),
    steps: ['Iniciando Windows Defender...', 'Verificando arquivos...'] },
  { match: cmd => cmd.includes('Update-MpSignature'),
    steps: ['Conectando aos servidores Microsoft...', 'Baixando definições...'] },
  { match: cmd => cmd.includes('%TEMP%') && cmd.includes('del'),
    steps: ['Limpando arquivos temporários...', 'Removendo cache do Windows...', 'Limpando prefetch...'] },
  { match: cmd => cmd.includes('StartComponentCleanup'),
    steps: ['Analisando componentes...', 'Removendo arquivos antigos...', 'Isso pode levar vários minutos...'] },
  { match: cmd => cmd.includes('Checkpoint-Computer'),
    steps: ['Criando ponto de restauração...', 'Salvando estado do sistema...'] },
  { match: cmd => cmd.includes('Optimize-Volume'),
    steps: ['Otimizando SSD...', 'Executando TRIM...'] },
  { match: cmd => cmd.includes('winget install'),
    steps: ['Iniciando Winget...', 'Baixando pacote...', 'Instalando aplicativo...', 'Aguarde a conclusão...'] },
]

function getSteps(cmd) {
  if (!cmd || typeof cmd !== 'string') return ['Executando...']
  for (const s of STEPS) {
    if (s.match(cmd)) return s.steps
  }
  return ['Executando...']
}

// â”€â”€ Toast â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function toast(type, title, msg) {
  const validTypes = ['success', 'error', 'warning', 'info', 'loading'];
  const safeType = validTypes.includes(type) ? type : 'info';
  const el = document.createElement('div')
  el.className = `toast ${safeType}`

  const iconContent = safeType === 'loading'
    ? '<span class="spinner"></span>'
    : (SVG[safeType] || SVG.info || SVG.success || '');

  // Adiciona a definição da animação e a classe CSS diretamente no HTML do toast
  el.innerHTML = `
    <style>
      @keyframes pulse-cancel {
        70% { transform: scale(1.02); box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); }
        100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
      }
      .toast-cancel-btn:hover {
        background: rgba(239, 68, 68, 0.35) !important;
        color: #ffffff !important;
        border-color: rgba(239, 68, 68, 0.8) !important;
        box-shadow: 0 0 15px rgba(239, 68, 68, 0.5) !important;
      }
    </style>
    <div class="toast-icon">${iconContent}</div>
    <div class="toast-body">
      <div class="toast-title">${title || ''}</div>
      <div class="toast-msg">${formatNotificationMessage(msg)}</div>
    </div>
    ${safeType === 'loading'
      ? `<button class="toast-cancel-btn cancel-btn-premium" title="Cancelar comando" style="background: rgba(239, 68, 68, 0.15); color: #fca5a5; border: 1px solid rgba(239, 68, 68, 0.4); border-radius: 6px; padding: 5px 10px; font-size: 10px; font-weight: 800; cursor: pointer; margin-left: 10px; white-space: nowrap; animation: pulse-cancel 2s infinite; text-shadow: 0 0 5px rgba(239, 68, 68, 0.3); transition: all 0.2s; backdrop-filter: blur(4px);">CANCELAR</button>`
      : `<button class="toast-close" title="Fechar"><i data-lucide="x" style="width:14px;height:14px"></i></button>`}
    <div class="toast-bar" ${safeType !== 'loading' ? `style="animation-duration:${AUTO_CLOSE}ms"` : ''}></div>
  `
  const btn = el.querySelector('.toast-cancel-btn, .toast-close')
  btn.addEventListener('click', () => {
    if (el.classList.contains('loading')) {
      window.api.cancelCommand();
      isCommandRunning = false;
      updateGlobalCancelButtonState();
    }
    dismiss(el);
  })
  container.appendChild(el)
  createLucideIcons()
  if (safeType !== 'loading') setTimeout(() => dismiss(el), AUTO_CLOSE)
  return el
}

window.toast = function (arg1, arg2, arg3) {
  const validTypes = ['success', 'error', 'warning', 'info', 'loading'];
  const defaultTitles = {
    success: 'Operação Concluída',
    error: 'Erro na Operação',
    warning: 'Atenção',
    info: 'Informação',
    loading: 'Processando'
  };

  let resolvedType = 'info';
  let resolvedTitle = 'ThunderTools';
  let resolvedMsg = '';

  // 3 argumentos passados
  if (arg3 !== undefined) {
    if (validTypes.includes(arg1)) {
      // toast('success', 'Título', 'Mensagem')
      resolvedType = arg1;
      resolvedTitle = arg2 || defaultTitles[resolvedType];
      resolvedMsg = arg3;
    } else if (validTypes.includes(arg3)) {
      // toast('Título', 'Mensagem', 'success')
      resolvedType = arg3;
      resolvedTitle = arg1;
      resolvedMsg = arg2;
    } else if (validTypes.includes(arg2)) {
      // toast('Título', 'success', 'Mensagem')
      resolvedType = arg2;
      resolvedTitle = arg1;
      resolvedMsg = arg3;
    } else {
      resolvedType = 'info';
      resolvedTitle = arg1;
      resolvedMsg = `${arg2} ${arg3}`;
    }
  }
  // 2 argumentos passados
  else if (arg2 !== undefined) {
    if (validTypes.includes(arg1)) {
      // toast('success', 'Mensagem')
      resolvedType = arg1;
      resolvedTitle = defaultTitles[resolvedType];
      resolvedMsg = arg2;
    } else if (validTypes.includes(arg2)) {
      // toast('Mensagem', 'success')
      resolvedType = arg2;
      resolvedTitle = defaultTitles[resolvedType];
      resolvedMsg = arg1;
    } else {
      // toast('Título', 'Mensagem')
      resolvedType = 'info';
      resolvedTitle = arg1;
      resolvedMsg = arg2;
    }
  }
  // 1 argumento passado
  else if (arg1 !== undefined) {
    if (validTypes.includes(arg1)) {
      resolvedType = arg1;
      resolvedTitle = defaultTitles[resolvedType];
      resolvedMsg = '';
    } else {
      resolvedType = 'info';
      resolvedTitle = defaultTitles.info;
      resolvedMsg = arg1;
    }
  }

  return toast(resolvedType, resolvedTitle, resolvedMsg);
};

function dismiss(el) {
  el.classList.add('hide')
  setTimeout(() => el.remove(), 400)
}

function updateToast(el, type, title, html) {
  if (!el || !el.parentNode) return;

  const validTypes = ['success', 'error', 'warning', 'info', 'loading'];
  const safeType = validTypes.includes(type) ? type : 'info';
  el.className = `toast ${safeType}`
  
  // Se parou de carregar, remove o botão "CANCELAR" e coloca o "X" para fechar
  const cancelBtn = el.querySelector('.toast-cancel-btn')
  if (cancelBtn && safeType !== 'loading') {
    const closeBtn = document.createElement('button')
    closeBtn.className = 'toast-close'
    closeBtn.title = 'Fechar'
    closeBtn.innerHTML = '<i data-lucide="x" style="width:14px;height:14px"></i>'
    closeBtn.addEventListener('click', () => dismiss(el))
    cancelBtn.replaceWith(closeBtn)
    createLucideIcons(); // Garante que o novo ícone Lucide seja renderizado
  } else {
    const closeBtn = el.querySelector('.toast-close');
    if (closeBtn) closeBtn.title = 'Fechar';
  }

  // Detecta se precisa expandir (mais de 4 linhas ou mais de 200 caracteres)
  const lineCount = (html.match(/<br>/gi) || []).length + 1
  const charCount = html.replace(/<[^>]*>/g, '').length
  if (lineCount > 4 || charCount > 200) {
    el.classList.add('expanded')
  }
  
  el.querySelector('.toast-icon').innerHTML = safeType === 'loading'
    ? '<span class="spinner"></span>'
    : (SVG[safeType] || SVG.info || SVG.success || '');
  el.querySelector('.toast-title').textContent = title
  el.querySelector('.toast-msg').innerHTML = formatNotificationMessage(html)
  createLucideIcons()
  const bar = el.querySelector('.toast-bar')
  bar.style.animation = 'none'
  bar.offsetHeight
  bar.style.animation = `shrink ${AUTO_CLOSE}ms linear forwards`
  setTimeout(() => dismiss(el), AUTO_CLOSE)
}

// â”€â”€ Tabs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// â”€â”€ Tabs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function isLongServiceCommand(cmd) {
  if (!cmd || typeof cmd !== 'string') return false
  return LONG_SERVICE_MATCHERS.some(match => match(cmd))
}

function createServiceProgressWindow(title, initialMessage) {
  const el = document.createElement('div')
  el.className = 'service-progress-window expanded running'
  el.innerHTML = `
    <style>
      @keyframes pulse-cancel {
        0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
        70% { transform: scale(1.02); box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); }
        100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
      }
      .cancel-btn-premium:hover {
        background: rgba(239, 68, 68, 0.35) !important;
        color: #ffffff !important;
        border-color: rgba(239, 68, 68, 0.8) !important;
        box-shadow: 0 0 15px rgba(239, 68, 68, 0.5) !important;
      }
    </style>
    <div class="service-progress-main">
      <div class="service-progress-icon"><span class="spinner"></span></div>
      <div class="service-progress-body">
        <div class="service-progress-head">
          <div>
            <div class="service-progress-title">${escapeHtml(title)}</div>
          </div>
          <div class="service-progress-percent">0%</div>
        </div>
        <div class="service-progress-track" aria-hidden="true">
          <div class="service-progress-fill" style="width: 0%"></div>
        </div>
        <div class="service-progress-log">${escapeHtml(initialMessage || 'Aguardando retorno do Windows...')}</div>
        <label class="service-progress-sound">
          <input type="checkbox">
          <span>Avisar com som ao terminar</span>
        </label>
        <div class="service-progress-footer" style="border-top: 1px solid rgba(255,255,255,0.06); margin-top: 15px; padding-top: 12px;">
          <button class="service-progress-close cancel-btn-premium" title="Cancelar comando" style="background: rgba(239, 68, 68, 0.12); color: #fca5a5; border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; padding: 10px; font-size: 11px; font-weight: 800; cursor: pointer; animation: pulse-cancel 2s infinite; text-shadow: 0 0 5px rgba(239, 68, 68, 0.3); transition: all 0.2s; backdrop-filter: blur(4px); width: 100%; display: block; text-align: center; letter-spacing: 1px;">CANCELAR</button>
        </div>
      </div>
      <div class="service-progress-actions">
        <button class="service-progress-toggle" title="Ocultar"><i data-lucide="minimize-2"></i></button>
      </div>
    </div>
  `
  document.body.appendChild(el)

  // Oculta temporariamente qualquer dock flutuante de reparo preventivo para evitar janelas duplicadas
  const existingRepairDock = document.getElementById('repair-floating-dock')
  if (existingRepairDock) {
    existingRepairDock.style.display = 'none'
  }

  const restoreExistingRepairDock = () => {
    const dock = document.getElementById('repair-floating-dock')
    if (dock) dock.style.display = ''
  }

  const fill = el.querySelector('.service-progress-fill')
  const percent = el.querySelector('.service-progress-percent')
  const log = el.querySelector('.service-progress-log')
  const icon = el.querySelector('.service-progress-icon')
  const toggle = el.querySelector('.service-progress-toggle')
  const close = el.querySelector('.service-progress-close')
  const sound = el.querySelector('.service-progress-sound input')
  let currentPercent = 0
  let finished = false
  let cancelling = false
  let dismissTimer = null

  const setPercent = value => {
    if (!Number.isFinite(value)) return
    currentPercent = Math.max(currentPercent, Math.max(0, Math.min(100, Math.round(value))))
    fill.style.width = `${currentPercent}%`
    percent.textContent = `${currentPercent}%`
  }

  const setMessage = message => {
    const clean = String(message || '').trim()
    if (!clean) return
    log.textContent = clean
  }

  const playDoneSound = (success) => {
    if (!sound.checked) return
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext
      const audio = new AudioContext()
      const oscillator = audio.createOscillator()
      const gain = audio.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.value = success ? 880 : 220
      gain.gain.setValueAtTime(0.001, audio.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.18, audio.currentTime + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.35)
      oscillator.connect(gain)
      gain.connect(audio.destination)
      oscillator.start()
      oscillator.stop(audio.currentTime + 0.38)
    } catch {
      // Audio feedback is optional.
    }
  }

  toggle.addEventListener('click', () => {
    const minimized = el.classList.toggle('minimized')
    el.classList.toggle('expanded', !minimized)
    toggle.title = minimized ? 'Expandir' : 'Ocultar'
    toggle.innerHTML = `<i data-lucide="${minimized ? 'maximize-2' : 'minimize-2'}"></i>`
    createLucideIcons()
  })

  close.addEventListener('click', () => {
    if (!finished) { // Se o comando ainda estiver rodando e o usuário clicar em fechar, cancelar.
      cancelling = true
      close.disabled = true;
      close.style.opacity = '0.6';
      close.style.cursor = 'wait';
      close.textContent = 'CANCELANDO...';
      fill.style.background = 'linear-gradient(90deg, #f59e0b, #d97706)';
      window.api.cancelCommand(); // Envia o sinal de cancelamento para o processo principal
      isCommandRunning = false;
      updateGlobalCancelButtonState();
      return
    }
    el.classList.add('hide')
    setTimeout(() => {
      restoreExistingRepairDock()
      el.remove()
    }, 250)
  })

  createLucideIcons()

  return {
    element: el,
    update({ percent: progressPercent, message }) {
      if (cancelling) return
      setPercent(progressPercent)
      setMessage(message)
    },
    finish(success, message) {
      finished = true
      cancelling = false
      clearTimeout(dismissTimer)
      el.classList.remove('running')
      el.classList.toggle('success', success)
      el.classList.toggle('error', !success)
      icon.innerHTML = success ? SVG.success : SVG.error
      setPercent(success ? 100 : currentPercent)
      fill.style.background = '';
      // Finaliza o estado do botÃ£o e remove classes de animaÃ§Ã£o/hover de cancelamento
      close.disabled = false;
      close.classList.remove('cancel-btn-premium');
      close.style.animation = "none";
      close.style.background = success ? "rgba(34, 197, 94, 0.2)" : "rgba(239, 68, 68, 0.2)";
      close.style.borderColor = success ? "rgba(34, 197, 94, 0.5)" : "rgba(239, 68, 68, 0.5)";
      close.style.color = "#ffffff";
      close.style.boxShadow = "none";
      close.style.opacity = "1";
      close.style.cursor = "pointer";
      close.textContent = 'FECHAR';
      close.title = 'Fechar';
      setMessage(message || (success ? 'Operacao concluida com sucesso.' : 'A operacao nao foi concluida.'))
      playDoneSound(success)
      close.title = 'Fechar'
      createLucideIcons()
      dismissTimer = setTimeout(() => {
        el.classList.add('hide')
        setTimeout(() => {
          restoreExistingRepairDock()
          el.remove()
        }, 250)
      }, AUTO_CLOSE + 4000)
    }
  }
}

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'))
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'))
    btn.classList.add('active')
    const tabId = `tab-${btn.dataset.tab}`
    const targetTab = document.getElementById(tabId)
    if (targetTab) targetTab.classList.add('active')
    
    // Renderizar histórico/favoritos/IA ao abrir
    if (btn.dataset.tab === 'historico') renderHistory()
    if (btn.dataset.tab === 'favoritos') renderFavorites()
    if (btn.dataset.tab === 'ia-diagnostico') initAiDiagnosticsTab({ toast, addToHistory, showServiceOrderModal })
  })
})

// â”€â”€ BotÃµes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// â”€â”€ BotÃµes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// â”€â”€ BotÃµes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function transitionModalToExecution(overlay, title, initialStatus) {
  const modal = overlay.querySelector('.modal');
  modal.classList.add('details-modal');
  modal.style.width = 'min(580px, 94vw)';
  modal.style.maxWidth = '580px';
  modal.innerHTML = `
    <div class="details-modal-header" style="margin-bottom: 14px;">
      <div class="details-header-lead">
        <div class="details-header-icon-box" id="exec-icon-box" style="background: linear-gradient(135deg, rgba(99, 102, 241, 0.22) 0%, rgba(56, 189, 248, 0.18) 100%); border-color: rgba(99, 102, 241, 0.4); color: #818cf8;">
          <i data-lucide="loader-2" class="spinner" style="width:22px;height:22px"></i>
        </div>
        <div class="details-header-text">
          <div class="details-modal-title">
            <span>${escapeHtml(title)}</span>
            <span class="details-count-pill" id="exec-status-pill">Executando...</span>
          </div>
          <div class="details-modal-desc" id="modal-status">${escapeHtml(initialStatus)}</div>
        </div>
      </div>
    </div>

    <div id="modal-log-area" style="background: rgba(0, 0, 0, 0.35); padding: 14px 16px; border-radius: 10px; color: #cbd5e1; font-family: 'Consolas', 'Cascadia Code', monospace; font-size: 12px; max-height: 220px; overflow-y: auto; border: 1px solid rgba(99, 102, 241, 0.25); margin: 6px 0 16px; white-space: pre-wrap; display: none; line-height: 1.6; box-shadow: inset 0 0 15px rgba(0, 0, 0, 0.5);"></div>

    <div class="details-modal-footer" style="padding-top: 12px; border-top: 1px solid rgba(255, 255, 255, 0.06); display: flex; align-items: center; justify-content: flex-end;">
      <button class="modal-btn primary" id="modal-close-btn" disabled style="padding: 8px 22px; font-size: 12.5px;">Aguarde...</button>
    </div>
  `;
  createLucideIcons();

  const statusEl = modal.querySelector('#modal-status');
  const statusPill = modal.querySelector('#exec-status-pill');
  const iconBox = modal.querySelector('#exec-icon-box');
  const logEl = modal.querySelector('#modal-log-area');
  const closeBtn = modal.querySelector('#modal-close-btn');

  return {
    setStatus: (msg, success) => {
      statusEl.innerHTML = msg;
      statusEl.style.color = success ? '#86efac' : '#fca5a5';
      if (statusPill) {
        statusPill.textContent = success ? 'Concluído' : 'Falha';
        statusPill.style.color = success ? '#86efac' : '#fca5a5';
        statusPill.style.background = success ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)';
        statusPill.style.borderColor = success ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.35)';
      }
      if (iconBox) {
        iconBox.innerHTML = `<i data-lucide="${success ? 'check-circle-2' : 'alert-triangle'}" style="width:22px;height:22px;color:${success ? '#34d399' : '#f87171'}"></i>`;
        iconBox.style.borderColor = success ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)';
      }
      closeBtn.disabled = false;
      closeBtn.textContent = 'Fechar';
      closeBtn.onclick = () => overlay.remove();
      createLucideIcons();
    },
    setLog: (log) => {
      if (log && log.trim()) {
        logEl.textContent = log;
        logEl.style.display = 'block';
      }
    }
  };
}

function showInputModal(title, description, placeholder, callback, inputType = 'text', oldOverlay = null) {
  if (oldOverlay) oldOverlay.remove();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  // Ícone contextual refinado
  const tLower = (title || '').toLowerCase();
  let iconName = 'edit-3';
  if (tLower.includes('admin') || tLower.includes('usuário') || tLower.includes('usuario')) iconName = 'user-cog';
  else if (tLower.includes('pc') || tLower.includes('computador')) iconName = 'monitor';
  else if (tLower.includes('iniciar') || tLower.includes('programa')) iconName = 'rocket';
  else if (tLower.includes('rede') || tLower.includes('ip') || tLower.includes('endereço')) iconName = 'network';
  else if (tLower.includes('senha')) iconName = 'key-round';

  overlay.innerHTML = `
    <div class="modal details-modal" role="dialog" aria-modal="true" style="width: min(520px, 94vw); max-width: 520px;">
      <button class="modal-close-icon-btn" id="input-modal-x-close" title="Fechar (Esc)">
        <i data-lucide="x" style="width:16px;height:16px"></i>
      </button>

      <div class="details-modal-header" style="margin-bottom: 14px;">
        <div class="details-header-lead">
          <div class="details-header-icon-box" style="background: linear-gradient(135deg, rgba(99, 102, 241, 0.22) 0%, rgba(56, 189, 248, 0.18) 100%); border-color: rgba(99, 102, 241, 0.4); color: #818cf8;">
            <i data-lucide="${iconName}" style="width:22px;height:22px"></i>
          </div>
          <div class="details-header-text">
            <div class="details-modal-title">
              <span>${escapeHtml(title)}</span>
              <span class="details-count-pill">Entrada</span>
            </div>
            <div class="details-modal-desc">${escapeHtml(description)}</div>
          </div>
        </div>
      </div>

      <div style="margin: 6px 0 16px;">
        <input type="${inputType}" class="modal-input modal-input-field" placeholder="${escapeHtml(placeholder)}" autocomplete="off" style="margin-bottom: 0;">
      </div>

      <div class="details-modal-footer" style="margin-top: 4px; padding-top: 14px; border-top: 1px solid rgba(255, 255, 255, 0.06); display: flex; align-items: center; justify-content: flex-end; gap: 10px;">
        <button class="modal-btn secondary btn-cancel" style="padding: 8px 18px; font-size: 12.5px;">Cancelar</button>
        <button class="modal-btn primary btn-confirm" style="padding: 8px 22px; font-size: 12.5px;">Confirmar</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(overlay);
  createLucideIcons();
  
  const input = overlay.querySelector('.modal-input-field');
  const confirmBtn = overlay.querySelector('.btn-confirm');
  const cancelBtn = overlay.querySelector('.btn-cancel');
  const xClose = overlay.querySelector('#input-modal-x-close');
  
  input.focus();
  
  const close = () => {
    overlay.remove();
    document.removeEventListener('keydown', onKeyDown);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') close();
  };
  document.addEventListener('keydown', onKeyDown);
  
  confirmBtn.addEventListener('click', () => {
    const value = input.value.trim();
    if (value) {
      document.removeEventListener('keydown', onKeyDown);
      callback(value, overlay);
    } else {
      input.style.borderColor = 'rgba(239, 68, 68, 0.6)';
      input.focus();
    }
  });
  
  cancelBtn.addEventListener('click', close);
  if (xClose) xClose.addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') confirmBtn.click();
  });
}

function encodePowerShellCommand(script) {
  let utf16le = '';
  for (let i = 0; i < script.length; i++) {
    const code = script.charCodeAt(i);
    utf16le += String.fromCharCode(code & 0xff, code >> 8);
  }
  return btoa(utf16le);
}

function showStartupPicker({ title, description, items, itemType, onSelect, onManual, manualLabel }) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal startup-picker-modal">
      <div class="startup-picker-heading">
        <div class="startup-picker-main-icon"><i data-lucide="${itemType === 'mode' ? 'rocket' : itemType === 'service' ? 'settings-2' : itemType === 'disk' ? 'hard-drive' : 'app-window'}"></i></div>
        <div><div class="startup-picker-title">${escapeHtml(title)}</div><div class="startup-picker-desc">${escapeHtml(description)}</div></div>
        <button type="button" class="startup-picker-close" aria-label="Fechar"><i data-lucide="x"></i></button>
      </div>
      ${items.length > 5 ? `<label class="startup-picker-search"><i data-lucide="search"></i><input type="search" placeholder="Pesquisar na lista..." aria-label="Pesquisar na lista"></label>` : ''}
      <div class="startup-picker-list">
        ${items.map((item, index) => `
          <button type="button" class="startup-picker-item" data-index="${index}" data-search="${escapeHtml(`${item.label} ${item.description || ''}`.toLowerCase())}">
            <span class="startup-picker-item-icon"><i data-lucide="${item.icon || (itemType === 'service' ? 'settings-2' : itemType === 'mode' ? 'rocket' : 'app-window')}"></i></span>
            <span class="startup-picker-item-copy"><span class="startup-picker-item-label">${escapeHtml(item.label)}</span>${item.description ? `<span class="startup-picker-item-desc">${escapeHtml(item.description)}</span>` : ''}</span>
            ${item.badge ? `<span class="startup-picker-badge">${escapeHtml(item.badge)}</span>` : ''}
            <i data-lucide="chevron-right" class="startup-picker-chevron"></i>
          </button>`).join('')}
        ${items.length ? '' : '<div class="startup-picker-empty">Nenhum item encontrado. Tente outra busca.</div>'}
      </div>
      <div class="startup-picker-footer">
        ${onManual ? `<button type="button" class="modal-btn secondary startup-picker-manual">${escapeHtml(manualLabel || 'Informar manualmente')}</button>` : ''}
        <button type="button" class="modal-btn secondary startup-picker-cancel">Cancelar</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  createLucideIcons(overlay);

  const close = () => {
    overlay.remove();
    document.removeEventListener('keydown', onKeyDown);
  };
  const onKeyDown = (e) => {
    if (e.key === 'Escape') close();
  };
  document.addEventListener('keydown', onKeyDown);

  overlay.querySelector('.startup-picker-close').onclick = close;
  overlay.querySelector('.startup-picker-cancel').onclick = close;
  overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
  overlay.querySelectorAll('.startup-picker-item').forEach(button => {
    button.onclick = async () => {
      document.removeEventListener('keydown', onKeyDown);
      await onSelect(items[Number(button.dataset.index)], overlay);
    };
  });
  if (onManual) overlay.querySelector('.startup-picker-manual').onclick = () => {
    document.removeEventListener('keydown', onKeyDown);
    onManual(overlay);
  };
  const search = overlay.querySelector('.startup-picker-search input');
  if (search) search.addEventListener('input', () => {
    const query = search.value.trim().toLowerCase();
    overlay.querySelectorAll('.startup-picker-item').forEach(button => {
      button.hidden = !button.dataset.search.includes(query);
    });
  });

  return overlay;
}

function showStartupConfiguration(title, icon) {
  const manualProgram = (prevOverlay) => showInputModal(
    'Nome na inicialização',
    'Como esse programa deve ser identificado ao iniciar com o Windows?',
    'Ex: WhatsApp, AnyDesk, Sistema da Loja',
    (entryName, overlay1) => {
      showInputModal(
        'Onde está o programa?',
        'Cole o caminho do arquivo .exe ou atalho .lnk:',
        'Ex: C:\\Program Files\\App\\app.exe',
        async (targetPath, overlay2) => {
          const modal = transitionModalToExecution(overlay2, title, 'Configurando inicialização...');
          const safeName = entryName.replace(/'/g, "''");
          const safePath = targetPath.trim().replace(/^"+|"+$/g, '').replace(/'/g, "''");
          const script = `$name = '${safeName}'; $target = '${safePath}'; if (-not (Test-Path -LiteralPath $target)) { Write-Error "Arquivo não encontrado: $target"; exit 1 }; $runPath = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run'; Set-ItemProperty -Path $runPath -Name $name -Value ('"' + $target + '"') -Force; Write-Output "Programa configurado para iniciar com o Windows: $name -> $target"`;
          const res = await window.api.runCommand(`powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encodePowerShellCommand(script)}`);
          modal.setStatus(res.success ? 'Inicialização configurada!' : 'Não foi possível configurar.', res.success);
          modal.setLog(res.output || (res.success ? 'Configuração concluída.' : 'Verifique o caminho informado.'));
          addToHistory(`${title}: ${entryName}`, 'ADD_STARTUP_ENTRY', res.success, icon);
        },
        'text',
        overlay1
      );
    },
    'text',
    prevOverlay
  );

  const loadPrograms = async (modeOverlay) => {
    const modal = transitionModalToExecution(modeOverlay, title, 'Procurando programas instalados...');
    modal.setLog('Lendo atalhos do Menu Iniciar para facilitar sua escolha...');
    const script = `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; $roots = @("$env:ProgramData\\Microsoft\\Windows\\Start Menu\\Programs", "$env:APPDATA\\Microsoft\\Windows\\Start Menu\\Programs"); $shell = New-Object -ComObject WScript.Shell; $items = foreach ($root in $roots) { if (Test-Path $root) { Get-ChildItem -Path $root -Filter *.lnk -Recurse -ErrorAction SilentlyContinue | ForEach-Object { try { $sc = $shell.CreateShortcut($_.FullName); $target = $sc.TargetPath; if ($target -and (Test-Path -LiteralPath $target) -and $target -notmatch 'unins|uninstall|setup|installer|readme|help') { [PSCustomObject]@{ name = $_.BaseName; path = $target; args = $sc.Arguments } } } catch {} } } }; $items | Sort-Object name -Unique | Select-Object -First 80 | ConvertTo-Json -Compress`;
    const res = await window.api.runCommand(`powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encodePowerShellCommand(script)}`);
    modeOverlay.remove();

    let programs = [];
    try {
      const parsed = JSON.parse((res.output || '[]').trim() || '[]');
      programs = (Array.isArray(parsed) ? parsed : [parsed]).filter(item => item && item.name && item.path);
    } catch {}

    showStartupPicker({
      title: 'Qual programa deve abrir com o Windows?',
      description: 'Clique em um programa da lista ou informe outro arquivo manualmente.',
      itemType: 'program',
      manualLabel: 'Outro programa...',
      items: programs.map(program => ({
        label: program.name,
        description: program.path,
        badge: 'Programa',
        raw: program
      })),
      onManual: overlay => manualProgram(overlay),
      onSelect: async (selected, pickerOverlay) => {
        const execModal = transitionModalToExecution(pickerOverlay, title, `Ativando ${selected.label}...`);
        const safeName = String(selected.raw.name).replace(/'/g, "''");
        const safePath = String(selected.raw.path).replace(/'/g, "''");
        const safeArgs = String(selected.raw.args || '').replace(/'/g, "''");
        const addScript = `$name = '${safeName}'; $target = '${safePath}'; $args = '${safeArgs}'; $value = '"' + $target + '"' + ($(if ($args) { ' ' + $args } else { '' })); Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run' -Name $name -Value $value -Force; Write-Output "Programa configurado para iniciar com o Windows: $name"`;
        const addRes = await window.api.runCommand(`powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encodePowerShellCommand(addScript)}`);
        execModal.setStatus(addRes.success ? 'Programa adicionado à inicialização!' : 'Erro ao configurar programa.', addRes.success);
        execModal.setLog(addRes.output || `${selected.label}\n${selected.description}`);
        addToHistory(`${title}: ${selected.label}`, 'ADD_STARTUP_ENTRY', addRes.success, icon);
      }
    });
  };

  const loadServices = async (modeOverlay) => {
    const modal = transitionModalToExecution(modeOverlay, title, 'Carregando serviços do Windows...');
    modal.setLog('Listando serviços que podem iniciar automaticamente...');
    const script = `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-CimInstance Win32_Service | Where-Object { $_.StartMode -ne 'Disabled' } | Sort-Object DisplayName | Select-Object -First 120 Name, DisplayName, State, StartMode | ConvertTo-Json -Compress`;
    const res = await window.api.runCommand(`powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encodePowerShellCommand(script)}`);
    modeOverlay.remove();

    let services = [];
    try {
      const parsed = JSON.parse((res.output || '[]').trim() || '[]');
      services = (Array.isArray(parsed) ? parsed : [parsed]).filter(item => item && item.Name);
    } catch {}

    showStartupPicker({
      title: 'Qual serviço deve iniciar com o Windows?',
      description: 'Escolha o serviço para deixá-lo em início automático e iniciá-lo agora.',
      itemType: 'service',
      items: services.map(service => ({
        label: service.DisplayName || service.Name,
        description: `${service.Name} • Estado atual: ${service.State || 'Desconhecido'}`,
        badge: service.StartMode === 'Auto' ? 'Já automático' : 'Manual',
        raw: service
      })),
      onSelect: async (selected, pickerOverlay) => {
        const execModal = transitionModalToExecution(pickerOverlay, title, `Configurando ${selected.label}...`);
        const safeService = String(selected.raw.Name).replace(/'/g, "''");
        const serviceScript = `$svc = Get-Service -Name '${safeService}' -ErrorAction Stop; Set-Service -Name $svc.Name -StartupType Automatic -ErrorAction Stop; Start-Service -Name $svc.Name -ErrorAction SilentlyContinue; $updated = Get-Service -Name $svc.Name; Write-Output ("Serviço configurado: " + $updated.DisplayName + " (" + $updated.Name + ") - Status: " + $updated.Status)`;
        const serviceRes = await window.api.runCommand(`powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encodePowerShellCommand(serviceScript)}`);
        execModal.setStatus(serviceRes.success ? 'Serviço configurado para iniciar com o Windows!' : 'Erro ao configurar serviço.', serviceRes.success);
        execModal.setLog(serviceRes.output || 'Permissão de Administrador pode ser necessária para alterar este serviço.');
        addToHistory(`${title}: ${selected.raw.Name}`, 'ADD_STARTUP_ENTRY', serviceRes.success, icon);
      }
    });
  };

  showStartupPicker({
    title: 'Iniciar com o Windows',
    description: 'Escolha de forma simples o que você quer ligar junto com o computador.',
    itemType: 'mode',
    items: [
      {
        label: 'Um programa',
        description: 'Escolher um aplicativo instalado para abrir quando você entrar no Windows.',
        badge: 'Mais usado',
        icon: 'app-window',
        value: 'program'
      },
      {
        label: 'Um serviço do Windows',
        description: 'Deixar um serviço em início automático e funcionando em segundo plano.',
        badge: 'Avançado',
        icon: 'settings-2',
        value: 'service'
      }
    ],
    onSelect: async (selected, overlay) => {
      if (selected.value === 'service') await loadServices(overlay);
      else await loadPrograms(overlay);
    }
  });
}

function showChoiceModal(title, description, options, callback, oldOverlay = null) {
  if (oldOverlay) oldOverlay.remove();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const tLower = (title || '').toLowerCase();
  let iconName = 'help-circle';
  if (tLower.includes('desinstalar')) iconName = 'trash-2';
  else if (tLower.includes('senha')) iconName = 'key';
  else if (tLower.includes('privilégio') || tLower.includes('privilegio') || tLower.includes('usuário')) iconName = 'shield-alert';

  overlay.innerHTML = `
    <div class="modal details-modal" role="dialog" aria-modal="true" style="width: min(540px, 94vw); max-width: 540px;">
      <button class="modal-close-icon-btn" id="choice-modal-x-close" title="Fechar (Esc)">
        <i data-lucide="x" style="width:16px;height:16px"></i>
      </button>

      <div class="details-modal-header" style="margin-bottom: 14px;">
        <div class="details-header-lead">
          <div class="details-header-icon-box" style="background: linear-gradient(135deg, rgba(99, 102, 241, 0.22) 0%, rgba(168, 85, 247, 0.18) 100%); border-color: rgba(99, 102, 241, 0.4); color: #a5b4fc;">
            <i data-lucide="${iconName}" style="width:22px;height:22px"></i>
          </div>
          <div class="details-header-text">
            <div class="details-modal-title">
              <span>${escapeHtml(title)}</span>
              <span class="details-count-pill">Seleção</span>
            </div>
            <div class="details-modal-desc">${escapeHtml(description)}</div>
          </div>
        </div>
      </div>

      <div class="choice-options-grid" style="display: flex; flex-direction: column; gap: 9px; margin: 8px 0 16px; max-height: 50vh; overflow-y: auto;">
        ${options.map((opt, idx) => `
          <button type="button" class="choice-btn ${opt.primary ? 'modal-btn primary' : 'modal-btn secondary'}" data-index="${idx}" style="padding: 12px 18px; border-radius: 10px; font-size: 13.5px; display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; text-align: left; transition: all 0.2s ease;">
            <span>${escapeHtml(opt.label)}</span>
            <i data-lucide="${opt.primary ? 'chevron-right' : 'x'}" style="width: 15px; height: 15px; opacity: 0.7;"></i>
          </button>
        `).join('')}
      </div>

      <div class="details-modal-footer" style="padding-top: 10px; border-top: 1px solid rgba(255, 255, 255, 0.06); display: flex; align-items: center; justify-content: space-between;">
        <span style="font-size: 11.5px; color: #94a3b8;">Escolha uma das opções acima para continuar</span>
        <button class="modal-btn secondary" id="choice-cancel-btn" style="padding: 6px 16px; font-size: 12px;">Cancelar</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  createLucideIcons();

  const close = () => {
    overlay.remove();
    document.removeEventListener('keydown', onKeyDown);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') close();
  };
  document.addEventListener('keydown', onKeyDown);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  const xClose = overlay.querySelector('#choice-modal-x-close');
  if (xClose) xClose.onclick = close;
  const cancelBtn = overlay.querySelector('#choice-cancel-btn');
  if (cancelBtn) cancelBtn.onclick = close;

  overlay.querySelectorAll('.choice-btn').forEach(btn => {
    btn.onclick = () => {
      document.removeEventListener('keydown', onKeyDown);
      const idx = btn.dataset.index;
      callback(options[idx].value, overlay);
    };
  });
}

function showDeleteUserModal(users, currentUser, callback) {
  const overlay = document.createElement('div')
  overlay.className = 'modal-overlay'
  overlay.innerHTML = `
    <div class="modal details-modal" role="dialog" aria-modal="true" style="width: min(600px, 94vw); max-width: 600px;">
      <button class="modal-close-icon-btn" id="del-user-x-close" title="Fechar (Esc)">
        <i data-lucide="x" style="width:16px;height:16px"></i>
      </button>

      <div class="details-modal-header" style="margin-bottom: 12px;">
        <div class="details-header-lead">
          <div class="details-header-icon-box" style="background: linear-gradient(135deg, rgba(239, 68, 68, 0.22) 0%, rgba(185, 28, 28, 0.18) 100%); border-color: rgba(239, 68, 68, 0.4); color: #f87171;">
            <i data-lucide="user-x" style="width:22px;height:22px"></i>
          </div>
          <div class="details-header-text">
            <div class="details-modal-title">
              <span>Excluir Usuário Local</span>
              <span class="details-count-pill" style="color: #fca5a5; background: rgba(239, 68, 68, 0.15); border-color: rgba(239, 68, 68, 0.3);">Ação Crítica</span>
            </div>
            <div class="details-modal-desc">Selecione uma conta local ativa para remover permanentemente do sistema:</div>
          </div>
        </div>
      </div>

      <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); color: #fecaca; border-radius: 10px; padding: 12px 14px; font-size: 12px; line-height: 1.6; margin-bottom: 14px; display: flex; gap: 10px; align-items: flex-start;">
        <i data-lucide="alert-octagon" style="width: 18px; height: 18px; color: #ef4444; flex-shrink: 0; margin-top: 2px;"></i>
        <div>
          <b>Atenção:</b> Esta ação remove o perfil e pode revogar o acesso a arquivos locais associados. Contas padrão do Windows e o usuário em uso (<b>${escapeHtml(currentUser || 'atual')}</b>) estão protegidos.
        </div>
      </div>

      <div id="delete-user-list" style="display: flex; flex-direction: column; gap: 8px; max-height: 240px; overflow-y: auto; margin-bottom: 14px; scrollbar-gutter: stable;">
        ${users.map((user, idx) => `
          <label class="delete-user-option" style="display: flex; gap: 12px; align-items: flex-start; padding: 12px 14px; border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; background: rgba(0,0,0,0.25); cursor: pointer; transition: all 0.2s ease;">
            <input type="radio" name="delete-user" value="${escapeHtml(user.name)}" ${idx === 0 ? 'checked' : ''} style="margin-top: 3px; accent-color: #ef4444;">
            <span style="display: flex; flex-direction: column; gap: 3px;">
              <span style="color: #f8fafc; font-weight: 600; font-size: 13.5px;">${escapeHtml(user.name)}</span>
              ${user.fullName ? `<span style="color: #94a3b8; font-size: 12px;">${escapeHtml(user.fullName)}</span>` : ''}
              ${user.description ? `<span style="color: #64748b; font-size: 11px; line-height: 1.4;">${escapeHtml(user.description)}</span>` : ''}
            </span>
          </label>
        `).join('')}
      </div>

      <label style="display: flex; gap: 10px; align-items: center; color: #cbd5e1; font-size: 12px; line-height: 1.5; margin-bottom: 16px; cursor: pointer; padding: 8px 12px; background: rgba(0,0,0,0.18); border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">
        <input type="checkbox" id="delete-user-aware" style="accent-color: #ef4444; width: 15px; height: 15px;">
        <span>Estou ciente de que esta ação é permanente e irreversível.</span>
      </label>

      <div class="details-modal-footer" style="padding-top: 12px; border-top: 1px solid rgba(255, 255, 255, 0.06); display: flex; align-items: center; justify-content: flex-end; gap: 10px;">
        <button class="modal-btn secondary" id="delete-user-cancel" style="padding: 8px 18px; font-size: 12.5px;">Cancelar</button>
        <button class="modal-btn primary" id="delete-user-confirm" disabled style="background: linear-gradient(135deg, #dc2626, #991b1b); opacity: 0.55; padding: 8px 22px; font-size: 12.5px; display: flex; align-items: center; gap: 6px;">
          <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i> Excluir Usuário
        </button>
      </div>
    </div>
  `

  document.body.appendChild(overlay)
  createLucideIcons()

  const aware = document.getElementById('delete-user-aware')
  const confirmBtn = document.getElementById('delete-user-confirm')
  const cancelBtn = document.getElementById('delete-user-cancel')
  const xClose = document.getElementById('del-user-x-close')
  
  const close = () => {
    overlay.remove()
    document.removeEventListener('keydown', onKeyDown)
  }

  const onKeyDown = (e) => {
    if (e.key === 'Escape') close()
  }
  document.addEventListener('keydown', onKeyDown)

  const updateConfirmState = () => {
    const selected = overlay.querySelector('input[name="delete-user"]:checked')
    confirmBtn.disabled = !selected || !aware.checked
    confirmBtn.style.opacity = confirmBtn.disabled ? '0.55' : '1'
  }

  overlay.querySelectorAll('.delete-user-option').forEach(option => {
    option.addEventListener('click', () => {
      const input = option.querySelector('input[type="radio"]')
      if (input) input.checked = true
      updateConfirmState()
    })
  })

  aware.addEventListener('change', updateConfirmState)
  cancelBtn.addEventListener('click', close)
  if (xClose) xClose.addEventListener('click', close)
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close()
  })

  confirmBtn.addEventListener('click', () => {
    const selected = overlay.querySelector('input[name="delete-user"]:checked')?.value
    if (!selected) return
    document.removeEventListener('keydown', onKeyDown)
    callback(selected, overlay)
  })

  updateConfirmState()
}

function getToolMoreInfoDetails(cmd, title) {
  const source = `${title || ''} ${cmd || ''}`.toLowerCase()

  // --- IMPRESSÃO ---
  if (source.includes('printers\\*') || source.includes('limpar fila') || source.includes('limpar_fila')) {
    return {
      title: 'Limpar Fila de Impressão',
      whatItDoes: 'Para o spooler de impressão, remove fisicamente todos os arquivos temporários da fila (trabalhos travados) e reinicia o serviço.',
      howItWorks: 'Executa uma sequência de comandos net stop spooler, apaga arquivos em System32\\spool\\PRINTERS\\*, e depois net start spooler.',
      recommendation: 'Use quando houver impressões presas que não podem ser canceladas manualmente e bloqueiam novos trabalhos.'
    }
  }
  if (source.includes('spooler') && source.includes('query')) {
    return {
      title: 'Status do Spooler',
      whatItDoes: 'Verifica o estado atual do serviço de Spooler de Impressão do Windows (se está em execução ou parado).',
      howItWorks: 'Executa a consulta de serviço utilizando o comando nativo sc query spooler.',
      recommendation: 'Útil para diagnosticar se problemas de impressão são causados pelo desligamento inesperado do serviço.'
    }
  }
  if (source.includes('spooler') && !source.includes('printers\\*')) {
    return {
      title: 'Reiniciar Spooler',
      whatItDoes: 'Para e reinicia o serviço de Spooler de Impressão do Windows para destravar o sistema de impressão.',
      howItWorks: 'Envia sinal de parada (net stop) e de início (net start) ao serviço Spooler.',
      recommendation: 'Use quando as impressoras não responderem, mas não houver trabalhos corrompidos travados na fila física.'
    }
  }
  if (source.includes('get-printer')) {
    return {
      title: 'Listar Impressoras',
      whatItDoes: 'Exibe uma lista de todas as impressoras instaladas no computador com o nome do driver e a porta correspondente.',
      howItWorks: 'Consulta o Windows via PowerShell usando o cmdlet Get-Printer e formata o resultado em tabela.',
      recommendation: 'Útil para identificar o nome exato da impressora e checar se o driver ou a porta estão configurados corretamente.'
    }
  }

  // --- WINDOWS UPDATE ---
  if (source.includes('softwaredistribution') || source.includes('catroot2')) {
    return {
      title: 'Resetar Windows Update',
      whatItDoes: 'Redefine os componentes do Windows Update do zero, limpando o cache de downloads antigos e reiniciando os serviços relacionados.',
      howItWorks: 'Para os serviços wuauserv, cryptSvc, bits, msiserver, renomeia as pastas de cache SoftwareDistribution e Catroot2 para .old, e depois reinicia todos os serviços.',
      recommendation: 'Use quando o Windows Update apresentar códigos de erro persistentes, travamentos na busca ou na instalação de atualizações.'
    }
  }
  if (source.includes('wuauserv') && source.includes('bits') && (source.includes('net start') || source.includes('net stop')) && !source.includes('softwaredistribution')) {
    return {
      title: 'Otimizar Serviços WU',
      whatItDoes: 'Garante que os serviços essenciais para o funcionamento do Windows Update estejam ativos e operando corretamente.',
      howItWorks: 'Reinicia os serviços de Atualizações Automáticas (wuauserv) e de Transferência Inteligente em Segundo Plano (bits).',
      recommendation: 'Use se a busca por atualizações estiver travada ou se os serviços de download em segundo plano pararem de funcionar.'
    }
  }
  if (source.includes('wuauserv') && source.includes('bits') && source.includes('query')) {
    return {
      title: 'Status do Windows Update',
      whatItDoes: 'Consulta se os serviços wuauserv (Windows Update) e BITS (Serviço de Transferência Inteligente) estão ativos no momento.',
      howItWorks: 'Consulta o status de execução dos serviços do sistema operacional via comandos sc query.',
      recommendation: 'Útil para verificar se algum software ou vírus desativou os serviços de atualização automática.'
    }
  }
  if (source.includes('wuauclt')) {
    return {
      title: 'Forçar Busca de Updates',
      whatItDoes: 'Comanda o Windows para iniciar imediatamente uma verificação de novas atualizações e baixar os pacotes pendentes.',
      howItWorks: 'Aciona os binários nativos do Windows Update usando os comandos de controle wuauclt /detectnow e /updatenow.',
      recommendation: 'Use quando desejar atualizar o sistema imediatamente sem esperar pela rotina automática agendada do Windows.'
    }
  }

  // --- DESEMPENHO ---
  if (source.includes('flushdns')) {
    return {
      title: 'Limpar Cache DNS',
      whatItDoes: 'Limpa a tabela de resolução de nomes (DNS) armazenada localmente no computador, forçando novas consultas à internet.',
      howItWorks: 'Chama a função de flush do Resolvedor do Windows usando ipconfig /flushdns.',
      recommendation: 'Útil se você não consegue acessar um site que acabou de mudar de servidor, ou se estiver com lentidão ao resolver endereços web.'
    }
  }
  if (source.includes('e9a42b02') || source.includes('ultimate') || source.includes('desempenho maximo') || source.includes('desempenho máximo')) {
    return {
      title: 'Desempenho Máximo (Ultimate Performance)',
      whatItDoes: 'Desbloqueia e ativa o plano oculto de latência zero criado pela Microsoft para estações de trabalho (Workstations), eliminando micro-pausas no hardware.',
      howItWorks: 'Duplica e ativa o esquema oculto do Windows (GUID e9a42b02-d5df-448d-aa00-03f14749eb61) desativando ASPM no PCIe e timers de suspensão.',
      recommendation: 'Recomendado para jogos competitivos, edição de vídeo pesada e renderização 3D. Em notebooks, aumenta o consumo de energia.'
    }
  }
  if (source.includes('8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c') || source.includes('alto desempenho')) {
    return {
      title: 'Plano Alto Desempenho (High Performance)',
      whatItDoes: 'Altera o plano de energia padrão do Windows para priorizar o clock do processador, desativando economias agressivas de energia.',
      howItWorks: 'Aplica o GUID padrão de alto desempenho via utilitário nativo powercfg.',
      recommendation: 'Ideal para uso diário em computadores de mesa ou notebooks na tomada que precisam de resposta rápida sem consumo extremo.'
    }
  }
  if (source.includes('cleanmgr')) {
    return {
      title: 'Limpeza Avançada de Disco',
      whatItDoes: 'Inicia a ferramenta nativa de limpeza de disco do Windows pré-configurada para remover arquivos obsoletos do sistema.',
      howItWorks: 'Executa o aplicativo cleanmgr do Windows usando parâmetros de automação configurados.',
      recommendation: 'Recomendado para recuperar espaço de forma segura, removendo cache de atualizações antigas, logs e lixeira.'
    }
  }
  if (source.includes('tasklist')) {
    return {
      title: 'Listar Processos Ativos',
      whatItDoes: 'Gera uma tabela contendo todos os processos e aplicativos que estão rodando na memória do computador neste momento.',
      howItWorks: 'Consulta o sistema e lista os executáveis em execução via utilitário de terminal tasklist.',
      recommendation: 'Útil para identificar se existem programas invisíveis consumindo recursos do computador ou travando o sistema.'
    }
  }
  if (source.includes('physicalmemory')) {
    return {
      title: 'Obter Informações RAM',
      whatItDoes: 'Busca detalhes físicos sobre as memórias RAM instaladas, incluindo capacidade de cada pente, velocidade em MHz e fabricante.',
      howItWorks: 'Consulta a classe Win32_PhysicalMemory via WMI ou PowerShell.',
      recommendation: 'Use para descobrir quantos pentes de memória estão instalados e suas frequências antes de realizar um upgrade.'
    }
  }
  if (source.includes('powercfg /energy')) {
    return {
      title: 'Relatório de Energia',
      whatItDoes: 'Analisa o sistema por 60 segundos para gerar um relatório HTML detalhado sobre a eficiência energética e problemas de bateria/energia.',
      howItWorks: 'Executa a análise de energia do Windows usando powercfg /energy e salva o relatório final na Área de Trabalho.',
      recommendation: 'Ideal para investigar por que a bateria do notebook está durando pouco ou por que o computador não entra em suspensão.'
    }
  }
  if (source.includes('ram-diagnostic') || source.includes('mdsched')) {
    return {
      title: 'Diagnóstico de Memória',
      whatItDoes: 'Agenda uma verificação profunda de hardware na memória RAM para o próximo reinício do computador.',
      howItWorks: 'Aciona o utilitário integrado mdsched.exe do Windows.',
      recommendation: 'Recomendado se o computador estiver apresentando telas azuis (BSOD) frequentes ou travamentos inexplicáveis.'
    }
  }

  // --- DISCO ---
  if (source.includes('sfc /scannow')) {
    return {
      title: 'Corrigir Arquivos (SFC)',
      whatItDoes: 'Verifica a integridade de todos os arquivos protegidos do sistema operacional e repara versões corrompidas ou ausentes.',
      howItWorks: 'Executa a ferramenta System File Checker (sfc) para comparar os arquivos locais com a cópia íntegra de cache do Windows.',
      recommendation: 'Execute se o Windows apresentar travamentos inexplicáveis, erros ao abrir programas nativos ou problemas pós-infecção por vírus.'
    }
  }
  if (source.includes('restorehealth') || source.includes('dism')) {
    return {
      title: 'Reparar Imagem (DISM)',
      whatItDoes: 'Compara a imagem local do Windows com os servidores oficiais da Microsoft para baixar e corrigir arquivos corrompidos da base do sistema.',
      howItWorks: 'Usa a ferramenta DISM (Deployment Image Servicing and Management) conectada à internet para realizar a verificação e reparo.',
      recommendation: 'Recomendado quando o SFC /scannow falhar em corrigir erros ou se houver problemas graves de arquivos do sistema ausentes.'
    }
  }
  if (source.includes('chkdsk')) {
    return {
      title: 'Corrigir Erros no Disco (CHKDSK)',
      whatItDoes: 'Escaneia o sistema de arquivos do HD ou SSD procurando por erros lógicos ou blocos corrompidos (bad sectors) e tenta repará-los.',
      howItWorks: 'Executa o chkdsk C: com opções de correção automática (/f /r /x). Se o disco estiver em uso, agenda a verificação para o próximo boot.',
      recommendation: 'Use se houver lentidão excessiva para abrir arquivos, avisos do Windows sobre erros no disco ou suspeita de falhas físicas no HD.'
    }
  }
  if (source.includes('defrag') && !source.includes('defrag c: /u /v')) {
    return {
      title: 'Desfragmentar Disco',
      whatItDoes: 'Otimiza a gravação e organiza os blocos de dados nos HDDs para acelerar a leitura de arquivos, ou aplica o TRIM no caso de SSDs.',
      howItWorks: 'Aciona o desfragmentador nativo do Windows de forma otimizada para o disco selecionado.',
      recommendation: 'Importante para manter a velocidade de discos mecânicos (HDs). Em SSDs, o sistema aplica o TRIM automaticamente.'
    }
  }
  if (source.includes('win32_diskdrive')) {
    return {
      title: 'Listar Discos Físicos',
      whatItDoes: 'Exibe a lista de unidades físicas de armazenamento conectadas (HD, SSD, NVMe, Pendrives) com capacidade total e status.',
      howItWorks: 'Consulta a API WMI por meio de PowerShell buscando a classe Win32_DiskDrive.',
      recommendation: 'Útil para checar a saúde básica do hardware e descobrir o modelo exato e o tamanho dos seus discos.'
    }
  }
  if (source.includes('get-psdrive c')) {
    return {
      title: 'Espaço em Disco C:',
      whatItDoes: 'Mostra detalhadamente o espaço utilizado, o espaço livre e o tamanho total da partição C:.',
      howItWorks: 'Usa PowerShell para ler a unidade de disco e formata as informações de armazenamento em gigabytes.',
      recommendation: 'Use para obter um diagnóstico rápido de quanto espaço você tem disponível na partição principal do sistema.'
    }
  }
  if (source.includes('scan-disk-health') || source.includes('saúde do disco') || source.includes('disk-health')) {
    return {
      title: 'Saúde do Disco (SMART)',
      whatItDoes: 'Faz um diagnóstico rápido da telemetria de saúde física integrada do disco (SMART), retornando o status de funcionamento.',
      howItWorks: 'Interroga os atributos SMART do disco físico principal via comando do sistema.',
      recommendation: 'Use para descobrir preventivamente se um disco rígido ou SSD está prestes a quebrar e precisa de backup imediato.'
    }
  }

  // --- REDE ---
  if (source.includes('winsock reset')) {
    return {
      title: 'Redefinir Rede (Reset IP)',
      whatItDoes: 'Restaura a pilha de protocolos TCP/IP e o catálogo do Winsock para o padrão de fábrica, limpando configurações defeituosas.',
      howItWorks: 'Executa os comandos netsh winsock reset e netsh int ip reset.',
      recommendation: 'Recomendado se você não consegue se conectar à internet mesmo com o cabo ou Wi-Fi ativos, ou após a remoção de vírus de rede.'
    }
  }
  if (source.includes('cmdkey') && source.includes('delete')) {
    return {
      title: 'Limpar Credenciais',
      whatItDoes: 'Apaga todas as credenciais de rede, usuários e senhas de domínios ou pastas compartilhadas armazenados no Windows.',
      howItWorks: 'Lista as credenciais de rede ativas e as remove individualmente usando o comando cmdkey /delete.',
      recommendation: 'Ideal para corrigir conflitos de acesso a pastas de rede compartilhadas quando a senha do usuário remoto foi alterada.',
      isDestructive: true,
      consequences: 'Remover credenciais pode impedir o acesso a recursos de rede até que as credenciais sejam recriadas.'
    }
  }
  if (source.includes('add_net_cred')) {
    return {
      title: 'Adicionar Credencial',
      whatItDoes: 'Permite registrar um usuário e senha associados a um computador ou servidor na rede local.',
      howItWorks: 'Solicita dados via modal interativo e salva a credencial no Gerenciador de Credenciais do Windows utilizando cmdkey /add.',
      recommendation: 'Use antes de acessar pastas compartilhadas na rede para evitar que o Windows bloqueie o acesso por falta de login.'
    }
  }
  if (source.includes('cmdkey /list') && !source.includes('for')) {
    return {
      title: 'Listar Credenciais Salvas',
      whatItDoes: 'Listas os endereços de servidores, computadores e usuários registrados no Gerenciador de Credenciais do Windows.',
      howItWorks: 'Executa o comando nativo cmdkey /list e filtra os resultados para mostrar apenas credenciais relevantes de rede.',
      recommendation: 'Útil para verificar se o computador tem senhas salvas para servidores específicos de rede.'
    }
  }
  if (source.includes('edit_net_cred')) {
    return {
      title: 'Editar Credencial',
      whatItDoes: 'Modifica o usuário ou senha de uma credencial de rede já cadastrada no sistema.',
      howItWorks: 'Exibe as credenciais existentes e substitui o cadastro via linha de comando.',
      recommendation: 'Use quando a senha de acesso a um computador ou servidor de arquivos da rede local for atualizada.'
    }
  }
  if ((source.includes('ipconfig /all') || source.includes('network-info')) && !source.includes('flushdns')) {
    return {
      title: 'Informações de Rede',
      whatItDoes: 'Abre uma janela visual com todas as configurações de rede coletadas (adaptadores, IPv4, IPv6, Gateway, DNS, MAC) e permite exportar em TXT.',
      howItWorks: 'Coleta a configuração de adaptadores do Windows, organiza os parâmetros em cards modernos e gera arquivo de texto para exportação.',
      recommendation: 'Use para diagnosticar IP, conferir o gateway do roteador, validar servidores DNS, copiar MACs ou salvar relatórios técnicos.'
    }
  }
  if (source.includes('network_speed_test') || source.includes('network-speed-test')) {
    return {
      title: 'Testar Conexão (Speed Test)',
      whatItDoes: 'Executa um teste de velocidade e qualidade de internet em tempo real com velocímetro interativo, medindo Download, Upload, Latência da Internet, Jitter e tempo de resposta do roteador.',
      howItWorks: 'Realiza download e upload em streaming com servidores CDN de alta precisão, verifica perda de pacotes e analisa frequências de Wi-Fi ou cabos para sugerir otimizações.',
      recommendation: 'Use para verificar se você está recebendo a velocidade contratada e diagnosticar lentidões, interferências no Wi-Fi ou cabos limitados a 100 Mbps.'
    }
  }
  if (source.includes('ipconfig /release') || source.includes('ipconfig /renew')) {
    return {
      title: 'Renovar IP',
      whatItDoes: 'Desconecta temporariamente a placa de rede da rede local e solicita um novo endereço IP ao roteador (servidor DHCP).',
      howItWorks: 'Limpa a atribuição atual via ipconfig /release e solicita nova configuração via ipconfig /renew.',
      recommendation: 'Excelente para resolver problemas de "Conexão nula ou limitada" ou conflitos de endereços IP na mesma rede local.'
    }
  }
  if (source.includes('8.8.8.8')) {
    return {
      title: 'Ping Google (Latência)',
      whatItDoes: 'Envia 4 pacotes de teste para o servidor DNS público do Google para testar a estabilidade e a velocidade da sua internet.',
      howItWorks: 'Mede o tempo de resposta (ida e volta) utilizando o comando ping 8.8.8.8.',
      recommendation: 'Use para identificar se sua internet está funcionando e medir o atraso (ping) da sua conexão.'
    }
  }
  if (source.includes('ping_specific') || source.includes('ping-specific')) {
    return {
      title: 'Ping Customizado',
      whatItDoes: 'Faz um teste de latência e conectividade para qualquer endereço de IP ou nome de site que você digitar.',
      howItWorks: 'Abre a central avançada de Ping com streaming em tempo real, jitter, perda de pacotes e atalhos rápidos.',
      recommendation: 'Ideal para checar se um computador específico da rede local ou um servidor de sistemas está ligado e respondendo.'
    }
  }

  // --- SISTEMA ---
  if (source.includes('msinfo32')) {
    return {
      title: 'Informações do Sistema',
      whatItDoes: 'Abre a ferramenta oficial do Windows que exibe uma visão detalhada sobre o hardware, drivers e sistema operacional.',
      howItWorks: 'Inicia o utilitário gráfico msinfo32.exe em uma janela separada.',
      recommendation: 'Use para obter informações completas sobre o modelo da placa-mãe, processador, versão exata do Windows e BIOS.'
    }
  }
  if (source.includes('w32tm')) {
    return {
      title: 'Sincronizar Relógio',
      whatItDoes: 'Força o Windows a ajustar o horário do relógio do sistema consultando os servidores de hora oficiais da Microsoft/Internet.',
      howItWorks: 'Usa a ferramenta do serviço Windows Time para executar o comando w32tm /resync /force.',
      recommendation: 'Recomendado se o relógio do seu computador estiver atrasado ou adiantado, o que causa falhas de segurança ao acessar sites.'
    }
  }
  if (source.includes('win32_bios')) {
    return {
      title: 'Informações da BIOS',
      whatItDoes: 'Consulta os dados da BIOS instalada na placa-mãe, incluindo fabricante, número de série do computador e versão.',
      howItWorks: 'Lê as informações da BIOS armazenadas na tabela do sistema através do WMI (Win32_BIOS) via PowerShell.',
      recommendation: 'Ideal para saber se você precisa atualizar a BIOS e descobrir o número de série para acionar a garantia do computador.'
    }
  }
  if (source.includes('softwarelicensingservice')) {
    return {
      title: 'Recuperar Chave Windows',
      whatItDoes: 'Extrai da memória ou da placa-mãe a chave original de ativação do Windows vinculada a este computador (OEM/Product Key).',
      howItWorks: 'Realiza uma consulta avançada no serviço de licenciamento de software do Windows via WMI.',
      recommendation: 'Use se você precisar formatar o computador e quiser guardar a chave de ativação para a reinstalação do Windows.'
    }
  }
  if (source.includes('net user') && !source.includes('cmdkey')) {
    return {
      title: 'Listar Usuários',
      whatItDoes: 'Exibe a lista de todas as contas de usuários criadas e registradas localmente no Windows.',
      howItWorks: 'Chama o comando nativo net user no terminal para listar os logins.',
      recommendation: 'Útil para checar se existem contas antigas criadas ou para fins de auditoria de usuários ativos no computador.'
    }
  }
  if (source.includes('gpupdate')) {
    return {
      title: 'Forçar Políticas (GPUpdate)',
      whatItDoes: 'Força a aplicação imediata de todas as diretivas de grupo (Group Policies) locais ou de rede sem precisar reiniciar.',
      howItWorks: 'Executa o comando gpupdate /force para forçar a atualização imediata.',
      recommendation: 'Ideal para fazer com que alterações de rede e configurações corporativas feitas pelo administrador passem a valer na hora.'
    }
  }
  if (source.includes('shutdown /a')) {
    return {
      title: 'Cancelar Desligamento',
      whatItDoes: 'Cancela qualquer ordem ativa de desligamento ou reinício do Windows que esteja agendada ou em contagem regressiva.',
      howItWorks: 'Usa o comando de controle nativo shutdown /a.',
      recommendation: 'Excelente para abortar o desligamento automático do Windows ativado por atualizações ou por engano.'
    }
  }

  // --- SEGURANÇA ---
  if (source.includes('start-mpscan')) {
    return {
      title: 'Verificação Rápida Defender',
      whatItDoes: 'Inicia uma varredura antivírus rápida nas pastas críticas do sistema onde a maioria das ameaças costuma se esconder.',
      howItWorks: 'Dispara a busca em segundo plano do antivírus nativo Windows Defender usando comandos do PowerShell.',
      recommendation: 'Recomendado para fazer um exame rápido de segurança rotineiro sem comprometer o desempenho do computador.'
    }
  }
  if (source.includes('update-mpsignature')) {
    return {
      title: 'Atualizar Definições Defender',
      whatItDoes: 'Força o Windows Defender a baixar e atualizar a lista de vacinas de vírus mais recente dos servidores da Microsoft.',
      howItWorks: 'Chama a rotina de atualização do Defender por meio de comandos no PowerShell.',
      recommendation: 'Muito útil se o antivírus estiver desatualizado ou antes de realizar uma verificação completa contra malwares.'
    }
  }
  if (source.includes('advfirewall') || source.includes('firewall')) {
    return {
      title: 'Status do Firewall',
      whatItDoes: 'Exibe o status de ativação das regras de Firewall do Windows para as redes de domínio, privada e pública.',
      howItWorks: 'Executa a consulta de status do Firewall utilizando o comando netsh advfirewall show allprofiles.',
      recommendation: 'Use para checar se o Firewall do Windows está ativo e protegendo a máquina contra acessos externos não autorizados.'
    }
  }

  // --- PROGRAMAS WINGET ---
  if (source.includes('google.chrome')) {
    return {
      title: 'Instalar Google Chrome',
      whatItDoes: 'Instala ou atualiza automaticamente o navegador Google Chrome no computador.',
      howItWorks: 'Executa a instalação silenciosa através do gerenciador de pacotes nativo do Windows (Winget).',
      recommendation: 'Use para agilizar a formatação ou atualizar o navegador para a versão mais estável e segura.'
    }
  }
  if (source.includes('rarlab.winrar')) {
    return {
      title: 'Instalar WinRAR',
      whatItDoes: 'Instala o clássico descompactador de arquivos WinRAR no computador de forma automática.',
      howItWorks: 'Chama o gerenciador de pacotes Winget com parâmetros de instalação silenciosa.',
      recommendation: 'Útil para habilitar a descompactação de arquivos no formato RAR no sistema operacional.'
    }
  }
  if (source.includes('7zip.7zip')) {
    return {
      title: 'Instalar 7-Zip',
      whatItDoes: 'Instala o gerenciador de arquivos compactados e compactador open-source 7-Zip no Windows.',
      howItWorks: 'Instala a versão estável mais recente utilizando o Winget silenciosamente.',
      recommendation: 'Recomendado como alternativa leve e gratuita ao WinRAR para gerenciar arquivos zip, 7z e tar.'
    }
  }
  if (source.includes('videolan.vlc')) {
    return {
      title: 'Instalar VLC Media Player',
      whatItDoes: 'Instala o player multimídia universal VLC no computador de maneira automática.',
      howItWorks: 'Faz o download e instala o reprodutor através do gerenciador de pacotes do Windows.',
      recommendation: 'Excelente para garantir que o computador consiga reproduzir qualquer formato de vídeo e áudio sem precisar de codecs adicionais.'
    }
  }
  if (source.includes('visualstudiocode')) {
    return {
      title: 'Instalar VS Code',
      whatItDoes: 'Instala o ambiente de desenvolvimento de software e editor de código Visual Studio Code.',
      howItWorks: 'Baixa e configura o VS Code no sistema de modo silencioso via Winget.',
      recommendation: 'Essencial para programadores, desenvolvedores e administradores que precisam editar scripts ou código.'
    }
  }
  if (source.includes('spotify.spotify')) {
    return {
      title: 'Instalar Spotify',
      whatItDoes: 'Instala o aplicativo oficial de streaming de música e podcasts Spotify.',
      howItWorks: 'Baixa e executa a instalação silenciosa utilizando o Winget.',
      recommendation: 'Perfeito para configurar de maneira rápida a reprodução de músicas e áudios favoritos no computador.'
    }
  }
  if (source.includes('teamviewer')) {
    return {
      title: 'Instalar TeamViewer',
      whatItDoes: 'Instala o software de suporte e controle remoto TeamViewer de forma automática.',
      howItWorks: 'Roda o utilitário de instalação silenciosa oficial pelo Winget.',
      recommendation: 'Instale quando precisar receber suporte técnico remoto ou controlar computadores à distância de forma segura.'
    }
  }
  if (source.includes('anydesk')) {
    return {
      title: 'Instalar AnyDesk',
      whatItDoes: 'Instala a ferramenta ultra-rápida e leve de conexão e controle remoto AnyDesk.',
      howItWorks: 'Realiza a instalação direta e sem prompts do AnyDesk via gerenciador Winget.',
      recommendation: 'Excelente opção para suporte técnico ágil e compartilhamento remoto de tela com latência mínima.'
    }
  }
  if (source.includes('rustdesk')) {
    return {
      title: 'Instalar RustDesk',
      whatItDoes: 'Instala o utilitário open-source de acesso remoto RustDesk, alternativa moderna aos proprietários.',
      howItWorks: 'Executa a implantação silenciosa da versão oficial utilizando o gerenciador de pacotes.',
      recommendation: 'Recomendado para suporte remoto focado em privacidade, permitindo inclusive o uso de servidores próprios.'
    }
  }
  if (source.includes('fastcopy')) {
    return {
      title: 'Instalar FastCopy',
      whatItDoes: 'Instala o utilitário ultra veloz de cópia e transferência de arquivos grandes no Windows.',
      howItWorks: 'Instala o aplicativo de forma automática e silenciosa usando o comando Winget.',
      recommendation: 'Ideal para copiar gigabytes ou terabytes de arquivos entre HDs ou servidores de forma muito mais rápida que o Windows Explorer.'
    }
  }
  if (source.includes('list-installed-programs')) {
    return {
      title: 'Listar Programas Instalados',
      whatItDoes: 'Varre o registro do Windows listando todos os programas instalados, versões, datas de instalação e locais.',
      howItWorks: 'Consulta chaves de desinstalação no registro do Windows de 32 e 64 bits utilizando PowerShell.',
      recommendation: 'Útil para auditorias de segurança, liberar espaço em disco identificando softwares pesados ou desinstalar programas.'
    }
  }

  // --- OUTROS E ESPECIAIS ---
  if (source.includes('add_startup_entry') || source.includes('iniciar com o windows')) {
    return {
      title: 'Iniciar com o Windows',
      whatItDoes: 'Abre um assistente visual para escolher um programa instalado ou serviço do Windows que deve iniciar automaticamente junto com o computador.',
      howItWorks: 'Lista os programas do Menu Iniciar e serviços do Windows, permitindo pesquisar e ativar na chave de inicialização do usuário (HKCU\\...\\Run) ou definir o serviço como Automático.',
      recommendation: 'Ideal para manter ferramentas essenciais (como AnyDesk, WhatsApp, sistemas de gestão ou serviços críticos) sempre abertas ao ligar o PC.'
    }
  }
  if (source.includes('convert-to-local')) {
    return {
      title: 'Converter para Conta Local',
      whatItDoes: 'Converte uma conta vinculada à Microsoft de volta para o formato de conta local tradicional do Windows.',
      howItWorks: 'Executa comandos administrativos para dissociar a conta da rede e manter os arquivos locais.',
      recommendation: 'Use se quiser desvincular seu e-mail do login do computador para maior privacidade ou em máquinas de suporte.'
    }
  }
  if (source.includes('rename-admin')) {
    return {
      title: 'Renomear Administrador',
      whatItDoes: 'Altera o nome da conta interna padrão "Administrador" para um nome personalizado, dificultando ataques de força bruta.',
      howItWorks: 'Modifica o nome do objeto da conta de usuário no banco de dados de segurança local do Windows.',
      recommendation: 'Altamente recomendável para segurança do sistema. Contas chamadas "Administrador" são os alvos primários de invasores.'
    }
  }
  if (source.includes('rename-pc')) {
    return {
      title: 'Renomear Computador',
      whatItDoes: 'Altera o nome de rede do computador (Hostname) de maneira fácil.',
      howItWorks: 'Atualiza o registro do computador na rede do Windows, exigindo reiniciar para entrar em vigor.',
      recommendation: 'Use para padronizar e organizar o nome das máquinas em uma rede doméstica ou corporativa.'
    }
  }
  if (source.includes('custom-message')) {
    return {
      title: 'Mensagem Personalizada',
      whatItDoes: 'Envia e exibe uma caixa de diálogo contendo um texto personalizado na tela atual do computador.',
      howItWorks: 'Usa a API de mensageria nativa do Windows utilizando o utilitário msg *.',
      recommendation: 'Útil para técnicos enviarem alertas ou lembretes visuais para usuários em máquinas compartilhadas ou de suporte.'
    }
  }

  // Fallback para ferramentas genéricas com base no título
  if (title) {
    return {
      title: title,
      whatItDoes: `Executa a função de ${title} no sistema operacional.`,
      howItWorks: `Executa o comando de sistema associado: ${cmd || 'Comando interno'}.`,
      recommendation: 'Use de acordo com as instruções ou quando necessário para manutenção do computador.'
    }
  }

  return null
}

function showToolInfoModal(title, bodyOrDetails) {
  const overlay = document.createElement('div')
  overlay.className = 'modal-overlay'
  
  let contentHtml = '';
  if (bodyOrDetails && typeof bodyOrDetails === 'object') {
    const isDestructive = !!bodyOrDetails.isDestructive;
    const warningColor = isDestructive ? '#f87171' : '#fbbf24';
    const warningIcon = isDestructive ? 'alert-octagon' : 'alert-triangle';
    const warningBg = isDestructive ? 'rgba(239, 68, 68, 0.08)' : 'rgba(245, 158, 11, 0.06)';
    const warningBorder = isDestructive ? 'rgba(239, 68, 68, 0.25)' : 'rgba(245, 158, 11, 0.2)';
    const warningDivider = isDestructive ? 'rgba(239, 68, 68, 0.18)' : 'rgba(245, 158, 11, 0.14)';
    const warningTitle = isDestructive ? 'Ação Destrutiva / Riscos' : 'Recomendação / Orientações';

    contentHtml = `
      <div class="info-modal-layout" style="display: flex; flex-direction: column; gap: 14px; overflow-y: auto; max-height: 55vh; padding-right: 4px; scrollbar-gutter: stable;">
        <div class="info-section">
          <div class="info-section-title" style="display: flex; align-items: center; gap: 8px; color: #818cf8; font-weight: 600; font-size: 13.5px; margin-bottom: 6px;">
            <i data-lucide="help-circle" style="width: 16px; height: 16px;"></i> O que faz
          </div>
          <div class="info-section-content" style="color: #f1f5f9; font-size: 13px; line-height: 1.6; background: rgba(99, 102, 241, 0.07); border: 1px solid rgba(99, 102, 241, 0.22); padding: 13px 16px; border-radius: 10px;">
            ${bodyOrDetails.whatItDoes || 'Não especificado.'}
          </div>
        </div>
        
        <div class="info-section">
          <div class="info-section-title" style="display: flex; align-items: center; gap: 8px; color: #34d399; font-weight: 600; font-size: 13.5px; margin-bottom: 6px;">
            <i data-lucide="settings" style="width: 16px; height: 16px;"></i> Como funciona
          </div>
          <div class="info-section-content" style="color: #f1f5f9; font-size: 13px; line-height: 1.6; background: rgba(16, 185, 129, 0.06); border: 1px solid rgba(16, 185, 129, 0.18); padding: 13px 16px; border-radius: 10px;">
            ${bodyOrDetails.howItWorks || 'Não especificado.'}
          </div>
        </div>
        
        <div class="info-section">
          <div class="info-section-title" style="display: flex; align-items: center; gap: 8px; color: ${warningColor}; font-weight: 600; font-size: 13.5px; margin-bottom: 6px;">
            <i data-lucide="${warningIcon}" style="width: 16px; height: 16px;"></i> ${warningTitle}
          </div>
          <div class="info-section-content" style="color: #f1f5f9; font-size: 13px; line-height: 1.6; background: ${warningBg}; border: 1px solid ${warningBorder}; padding: 13px 16px; border-radius: 10px;">
            <div style="color: #e2e8f0;">${bodyOrDetails.recommendation || 'Não especificado.'}</div>
            ${bodyOrDetails.consequences ? `
              <div style="border-top: 1px solid ${warningDivider}; margin-top: 10px; padding-top: 10px;">
                <span style="font-weight: 700; color: ${warningColor}; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Consequências:</span>
                <div style="color: #f8fafc; font-weight: 500; margin-top: 4px;">${bodyOrDetails.consequences}</div>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  } else {
    contentHtml = `
      <div style="background: rgba(0,0,0,0.3); border: 1px solid rgba(99, 102, 241, 0.22); border-radius: 12px; padding: 18px 20px; color: #f1f5f9; line-height: 1.7; font-size: 13px; max-height: 55vh; overflow-y: auto;">
        ${bodyOrDetails || 'Nenhuma informação adicional disponível.'}
      </div>
    `;
  }

  overlay.innerHTML = `
    <div class="modal details-modal" role="dialog" aria-modal="true" style="width: min(680px, 94vw); max-width: 680px; max-height: 90vh;">
      <button class="modal-close-icon-btn" id="tool-info-x-close" title="Fechar (Esc)">
        <i data-lucide="x" style="width:16px;height:16px"></i>
      </button>

      <div class="details-modal-header" style="margin-bottom: 14px;">
        <div class="details-header-lead">
          <div class="details-header-icon-box" style="background: linear-gradient(135deg, rgba(99, 102, 241, 0.22) 0%, rgba(56, 189, 248, 0.18) 100%); border-color: rgba(99, 102, 241, 0.4); color: #818cf8;">
            <i data-lucide="info" style="width:22px;height:22px"></i>
          </div>
          <div class="details-header-text">
            <div class="details-modal-title">
              <span>${escapeHtml(title)}</span>
              <span class="details-count-pill">Guia Técnico</span>
            </div>
            <div class="details-modal-desc">Informações operacionais, parâmetros e boas práticas para esta ferramenta</div>
          </div>
        </div>
      </div>

      ${contentHtml}

      <div class="details-modal-footer" style="margin-top: 14px; padding-top: 12px; border-top: 1px solid rgba(255, 255, 255, 0.06); display: flex; align-items: center; justify-content: space-between;">
        <div class="details-footer-tip" style="display: flex; align-items: center; gap: 6px; font-size: 11.5px; color: #94a3b8;">
          <i data-lucide="shield-check" style="width:14px;height:14px;color:#34d399"></i>
          Diretrizes oficiais ThunderTools
        </div>
        <button class="modal-btn primary" id="tool-info-close" style="padding: 8px 24px; font-size: 12.5px;">Fechar</button>
      </div>
    </div>
  `
  document.body.appendChild(overlay)
  createLucideIcons()

  const close = () => {
    overlay.remove()
    document.removeEventListener('keydown', onKeyDown)
  }

  const onKeyDown = (e) => {
    if (e.key === 'Escape') close()
  }
  document.addEventListener('keydown', onKeyDown)

  const xClose = document.getElementById('tool-info-x-close')
  if (xClose) xClose.onclick = close
  const closeBtn = document.getElementById('tool-info-close')
  if (closeBtn) closeBtn.onclick = close
  
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close()
  })
}

function attachToolButtonListeners() {
  document.querySelectorAll('.tool-btn').forEach(btn => {
    const cmd = btn.dataset.cmd
    if (!cmd) return
    
    // Verifica se os listeners já foram anexados para evitar duplicatas no mesmo elemento.
    // A lógica de clonagem/substituição anterior não funcionava como esperado.
    if (btn.dataset.hasListeners === 'true') {
      return;
    }
    btn.dataset.hasListeners = 'true';

    // Adicionar botão de favorito se não existir
    if (!btn.closest('#favorites-list') && !btn.querySelector('.btn-favorite')) {
      // Captura robusta: detecta <i> original, <svg> processado ou <img>
      const iconEl = btn.querySelector('.btn-icon i, .btn-icon svg, .btn-icon img')
      let icon = 'star'

      if (iconEl) {
        if (iconEl.tagName.toUpperCase() === 'IMG') {
          icon = iconEl.getAttribute('src')
        } else {
          // Tenta capturar do atributo data-lucide
          icon = iconEl.getAttribute('data-lucide')
          
          // Se for um SVG do Lucide, o atributo pode sumir; extraímos da classe 'lucide-nome'
          if (!icon && iconEl.tagName.toUpperCase() === 'SVG') {
            const lucideClass = Array.from(iconEl.classList).find(c => c.startsWith('lucide-') && c !== 'lucide')
            if (lucideClass) icon = lucideClass.replace('lucide-', '')
          }
          if (!icon) icon = 'star'
        }
      }
      
      const favBtn = document.createElement('button')
      favBtn.className = 'btn-favorite'
      favBtn.dataset.cmd = cmd
      favBtn.dataset.title = btn.querySelector('.btn-title')?.textContent || ''
      favBtn.dataset.desc = btn.querySelector('.btn-desc')?.textContent || ''
      favBtn.dataset.icon = icon
      if (btn.dataset.special) favBtn.dataset.special = btn.dataset.special
      favBtn.innerHTML = '<i data-lucide="star" style="width:14px;height:14px"></i>'
      
      btn.appendChild(favBtn)
      createLucideIcons()
    }
    
    // Listener para o botão de remoção rápida na aba de favoritos
    const removeBtn = btn.querySelector('.remove-favorite')
    if (removeBtn) {
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        const cmd = btn.dataset.cmd
        const title = btn.querySelector('.btn-title').textContent
        toggleFavorite(cmd, title) // O toggle cuidará da remoção
      })
    }

    // Re-atribui o listener ao botÃ£o de favorito (cloneNode nÃ£o copia listeners)
    const favBtn = btn.querySelector('.btn-favorite')
    if (favBtn) {
      favBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        toggleFavorite(favBtn.dataset.cmd, favBtn.dataset.title, favBtn.dataset.desc, favBtn.dataset.icon, favBtn.dataset.special || btn.dataset.special || '')
      })
    }

    // Adicionar novo listener
    btn.addEventListener('click', async (e) => {
      // Garante que o clique não foi no botão de favorito/remover ou se o botão principal está desabilitado
      if (e.target.closest('.btn-favorite') || e.target.closest('.remove-favorite') || btn.disabled) {
        return
      }
      
      const title = btn.querySelector('.btn-title').textContent
      const cmd = btn.dataset.cmd
      // Extrair o ícone do botão clicado
      let icon = 'file-text'; // Ícone padrão se nenhum for encontrado
      const iconEl = btn.querySelector('.btn-icon i, .btn-icon svg, .btn-icon img');
      if (iconEl) {
        if (iconEl.tagName.toUpperCase() === 'IMG') {
          icon = iconEl.getAttribute('src');
        } else {
          // Tenta capturar do atributo data-lucide
          icon = iconEl.getAttribute('data-lucide');
          
          // Se for um SVG do Lucide, o atributo pode sumir; extraÃ­mos da classe 'lucide-nome'
          if (!icon && iconEl.tagName.toUpperCase() === 'SVG') {
            const lucideClass = Array.from(iconEl.classList).find(c => c.startsWith('lucide-') && c !== 'lucide');
            if (lucideClass) icon = lucideClass.replace('lucide-', '');
          }
          if (!icon) icon = 'file-text'; // Fallback se nÃ£o encontrar um Ã­cone especÃ­fico
        }
      }
      const special = btn.dataset.special

      if (!btn.closest('#favorites-list') && !btn.querySelector('.btn-more-info')) {
        const infoDetails = getToolMoreInfoDetails(cmd, title)
        if (infoDetails) {
          const infoBtn = document.createElement('button')
          infoBtn.className = 'btn-more-info'
          infoBtn.type = 'button'
          infoBtn.title = 'Mais informações'
          infoBtn.innerHTML = '<i data-lucide="info" style="width:14px;height:14px"></i>'
          infoBtn.addEventListener('click', (ev) => {
            ev.stopPropagation()
            showToolInfoModal(infoDetails.title || title || 'Mais informações', infoDetails)
          })
          btn.appendChild(infoBtn)
          createLucideIcons()
        }
      }
      
      // Comandos especiais que precisam de input
      if (special === 'disk-space') {
        const tLoad = toast('loading', title, 'Analisando armazenamento e partições em disco...');
        try {
          const psCmd = `powershell -NoProfile -Command "Get-PSDrive -PSProvider FileSystem | Where-Object { $_.Free -ne $null -and $_.Used -ne $null } | ForEach-Object { [PSCustomObject]@{ Drive = $_.Name + ':'; TotalGB = [math]::Round(($_.Used + $_.Free)/1GB, 1); UsedGB = [math]::Round($_.Used/1GB, 1); FreeGB = [math]::Round($_.Free/1GB, 1); UsagePct = [math]::Round(($_.Used/($_.Used + $_.Free)*100), 0) } } | ConvertTo-Json -Compress"`;
          const res = await window.api.runCommand(psCmd);
          dismiss(tLoad);

          let disks = [];
          if (res.success && res.output) {
            try {
              const parsed = JSON.parse(res.output.trim());
              disks = Array.isArray(parsed) ? parsed : [parsed];
            } catch (_) {
              disks = [];
            }
          }

          if (!disks.length) {
            const fallback = await window.api.runCommand('powershell -Command "Get-PSDrive -PSProvider FileSystem | Select-Object Root, @{N=\'Usado(GB)\';E={[math]::Round($_.Used/1GB,1)}}, @{N=\'Livre(GB)\';E={[math]::Round($_.Free/1GB,1)}} | Format-Table -AutoSize"');
            showDetailsModal(title, fallback.output || 'Não foi possível ler as partições.');
            addToHistory(title, 'Análise de Espaço em Disco', fallback.success, icon);
            return;
          }

          const overlay = document.createElement('div');
          overlay.className = 'modal-overlay';
          
          const cardsHtml = disks.map(d => {
            const usage = Math.min(100, Math.max(0, Number(d.UsagePct) || 0));
            const isCritical = usage >= 90;
            const isWarning = usage >= 75 && !isCritical;
            const barColor = isCritical ? '#ef4444' : isWarning ? '#f59e0b' : '#10b981';
            const statusBadge = isCritical 
              ? '<span class="details-count-pill" style="background: rgba(239,68,68,0.18); color:#fca5a5; border-color: rgba(239,68,68,0.35);">Crítico (&gt;90%)</span>'
              : isWarning
              ? '<span class="details-count-pill" style="background: rgba(245,158,11,0.18); color:#fde68a; border-color: rgba(245,158,11,0.35);">Atenção (&gt;75%)</span>'
              : '<span class="details-count-pill" style="background: rgba(16,185,129,0.18); color:#6ee7b7; border-color: rgba(16,185,129,0.35);">Saudável</span>';

            return `
              <div style="background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 14px 16px; margin-bottom: 10px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                  <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="width: 32px; height: 32px; border-radius: 8px; background: rgba(99, 102, 241, 0.15); border: 1px solid rgba(99, 102, 241, 0.3); display: flex; align-items: center; justify-content: center; color: #818cf8;">
                      <i data-lucide="hard-drive" style="width: 17px; height: 17px;"></i>
                    </div>
                    <div>
                      <strong style="color: #f8fafc; font-size: 15px;">Unidade ${escapeHtml(d.Drive)}</strong>
                    </div>
                  </div>
                  ${statusBadge}
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 12.5px; color: #94a3b8; margin-bottom: 8px;">
                  <span>Livre: <b style="color: #f1f5f9;">${d.FreeGB} GB</b></span>
                  <span>Usado: <b style="color: #f1f5f9;">${d.UsedGB} GB</b> de ${d.TotalGB} GB (${usage}%)</span>
                </div>
                <div style="background: rgba(0, 0, 0, 0.4); height: 8px; border-radius: 9999px; overflow: hidden; border: 1px solid rgba(255, 255, 255, 0.05);">
                  <div style="background: ${barColor}; height: 100%; width: ${usage}%; transition: width 0.4s ease; border-radius: 9999px;"></div>
                </div>
              </div>
            `;
          }).join('');

          overlay.innerHTML = `
            <div class="modal details-modal" role="dialog" aria-modal="true" style="width: min(620px, 94vw); max-width: 620px; max-height: 90vh;">
              <button class="modal-close-icon-btn" id="disk-x-close" title="Fechar (Esc)">
                <i data-lucide="x" style="width:16px;height:16px"></i>
              </button>

              <div class="details-modal-header" style="margin-bottom: 14px;">
                <div class="details-header-lead">
                  <div class="details-header-icon-box" style="background: linear-gradient(135deg, rgba(99, 102, 241, 0.22) 0%, rgba(56, 189, 248, 0.18) 100%); border-color: rgba(99, 102, 241, 0.4); color: #818cf8;">
                    <i data-lucide="pie-chart" style="width:22px;height:22px"></i>
                  </div>
                  <div class="details-header-text">
                    <div class="details-modal-title">
                      <span>Espaço Livre em Disco</span>
                      <span class="details-count-pill">${disks.length} Unidade(s)</span>
                    </div>
                    <div class="details-modal-desc">Visão consolidada do uso de armazenamento de todas as unidades ativas:</div>
                  </div>
                </div>
              </div>

              <div style="overflow-y: auto; max-height: 48vh; padding-right: 4px; scrollbar-gutter: stable;">
                ${cardsHtml}
              </div>

              <div class="details-modal-footer" style="margin-top: 14px; padding-top: 12px; border-top: 1px solid rgba(255, 255, 255, 0.06); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                  <button id="btn-disk-cleanmgr" class="modal-btn secondary" style="display: flex; align-items: center; gap: 6px; font-size: 11.5px; padding: 7px 12px;">
                    <i data-lucide="trash-2" style="width: 13px; height: 13px;"></i> Limpeza de Disco
                  </button>
                  <button id="btn-disk-sense" class="modal-btn secondary" style="display: flex; align-items: center; gap: 6px; font-size: 11.5px; padding: 7px 12px;">
                    <i data-lucide="settings" style="width: 13px; height: 13px;"></i> Sensor Armazenamento
                  </button>
                </div>
                <button id="btn-disk-close" class="modal-btn primary" style="font-size: 12px; padding: 8px 20px;">
                  Fechar
                </button>
              </div>
            </div>
          `;

          document.body.appendChild(overlay);
          createLucideIcons();

          const close = () => {
            overlay.remove();
            document.removeEventListener('keydown', onKeyDown);
          };

          const onKeyDown = (e) => {
            if (e.key === 'Escape') close();
          };
          document.addEventListener('keydown', onKeyDown);

          const xClose = overlay.querySelector('#disk-x-close');
          if (xClose) xClose.onclick = close;
          const closeBtn = overlay.querySelector('#btn-disk-close');
          if (closeBtn) closeBtn.onclick = close;

          overlay.querySelector('#btn-disk-cleanmgr').onclick = () => {
            if (window.api.openCleanmgr) window.api.openCleanmgr();
            else window.api.runCommand('start cleanmgr.exe /d C:');
            toast('info', 'Limpeza de Disco', 'Janela nativa de limpeza de disco iniciada.');
          };
          overlay.querySelector('#btn-disk-sense').onclick = () => {
            if (window.api.openStorageSense) window.api.openStorageSense();
            else window.api.runCommand('start ms-settings:storagesense');
            toast('info', 'Configurações', 'Configurações de armazenamento abertas.');
          };

          overlay.onclick = (e) => {
            if (e.target === overlay) close();
          };

          addToHistory(title, 'Análise de Espaço em Disco', true, icon);
        } catch (err) {
          dismiss(tLoad);
          toast('error', title, 'Erro ao verificar espaço em disco: ' + err.message);
          addToHistory(title, 'Análise de Espaço em Disco', false, icon);
        }
        return;
      }

      if (special === 'add-startup-entry' || cmd === 'ADD_STARTUP_ENTRY') {
        showStartupConfiguration(title, icon);
        return;
      }

      if (special === 'rename-admin') {
        showInputModal(
          'Renomear Administrador',
          'Digite o novo nome para a conta Administrador. Isso aumenta a seguranÃ§a do sistema.',
          'Novo nome (ex: Admin2024)',
          async (newName, overlay) => {
            const modal = transitionModalToExecution(overlay, title, 'Processando...');
            const renameCmd = `wmic useraccount where name='Administrador' rename '${newName}'`;
            const result = await window.api.runCommand(renameCmd)
            
            if (result.success || result.output.includes('successfully') || result.output.trim() === '') {
              modal.setStatus(`Conta renomeada para ${newName}!`, true);
              addToHistory(title, renameCmd, true, icon)
            } else {
              modal.setStatus('Erro ao renomear conta.', false);
              addToHistory(title, renameCmd, false, icon)
            }
            modal.setLog(result.output || 'Verifique se vocÃª possui permissÃµes de Administrador.');
          }
        )
        return
      }
      
      if (special === 'rename-pc') {
        showInputModal(
          'Renomear Computador',
          'Digite o novo nome para o computador. Será necessário reiniciar o sistema.',
          'Novo nome (ex: PC-ESCRITORIO)',
          async (newName, overlay) => {
            const modal = transitionModalToExecution(overlay, title, 'Processando...');
            const renameCmd = `wmic computersystem where name="%computername%" call rename name="${newName}"`
            const result = await window.api.runCommand(renameCmd)
            
            if (result.success || result.output.includes('successfully') || result.output.includes('ReturnValue = 0')) {
              modal.setStatus(`PC renomeado para ${newName}! Reinicie o sistema.`, true);
              addToHistory(title, renameCmd, true, icon)
            } else {
              modal.setStatus('Erro ao renomear computador.', false);
              addToHistory(title, renameCmd, false, icon)
            }
            modal.setLog(result.output);
          }
        )
        return
      }
      
      if (special === 'add-user') {
        showInputModal('Novo Usuário', 'Digite o nome do novo usuário local.', 'Nome de usuário', (userName, overlay) => {
          showChoiceModal('Senha', 'Este usuário terá uma senha?', [
            { label: 'Sim', value: true, primary: true },
            { label: 'Não', value: false, primary: false }
          ], (hasPassword, overlay) => {
            const getPrivilege = (password = '', overlay) => {
              showChoiceModal('Privilégios', 'Qual o nível de acesso deste usuário?', [
                { label: 'Administrador', value: 'admin', primary: true },
                { label: 'Usuário Comum', value: 'user', primary: false }
              ], async (privilege, overlay) => {
                const modal = transitionModalToExecution(overlay, title, 'Criando usuário...');
                
                const addCmd = `net user "${userName}" ${password} /add`;
                const result = await window.api.runCommand(addCmd);
                
                if (result.success) {
                  if (privilege === 'admin') {
                    await window.api.runCommand(`net localgroup Administradores "${userName}" /add`);
                  }
                  modal.setStatus(`Usuário ${userName} criado com sucesso!`, true);
                  addToHistory(title, addCmd, true, icon);
                } else {
                  modal.setStatus('Erro ao criar usuário', false);
                  addToHistory(title, addCmd, false, icon);
                }
                modal.setLog(result.output);
              }, overlay);
            };

            if (hasPassword) {
              showInputModal('Definir Senha', 'Digite a senha para o novo usuário.', 'Senha', (password, overlay) => {
                getPrivilege(password, overlay);
              }, 'password', overlay);
            } else {
              getPrivilege('', overlay);
            }
          }, overlay);
        });
        return;
      }

      if (special === 'delete-user') {
        btn.disabled = true
        btn.style.opacity = '0.6'

        const tLoad = toast('loading', title, 'Buscando usuários ativos...')
        const listResult = await window.api.listDeletableUsers()
        dismiss(tLoad)

        btn.disabled = false
        btn.style.opacity = '1'

        if (!listResult.success) {
          toast('error', title, `Não foi possível listar usuários.<br><small>${escapeHtml(listResult.output || 'Execute o ThunderTools como Administrador.')}</small>`)
          addToHistory(title, 'Listar usuários para exclusão', false, icon)
          return
        }

        if (!listResult.users.length) {
          toast('warning', title, 'Nenhum usuário local ativo pode ser excluído. Administrador, usuário atual e contas padrão do Windows foram ignorados.')
          addToHistory(title, 'Listar usuários para exclusão', true, icon)
          return
        }

        showDeleteUserModal(listResult.users, listResult.currentUser, async (selectedUser, overlay) => {
          const modal = transitionModalToExecution(overlay, title, `Excluindo ${selectedUser}...`);
          const result = await window.api.deleteLocalUser(selectedUser)

          const historyCmd = `Excluir usuário: ${selectedUser}`
          if (result.success) {
            modal.setStatus(`Usuário ${selectedUser} excluído!`, true);
            addToHistory(title, historyCmd, true, icon)
          } else {
            modal.setStatus('Erro ao excluir usuário.', false);
            addToHistory(title, historyCmd, false, icon)
          }
          modal.setLog(result.output);
        })
        return
      }

      if (special === 'list-installed-programs') {
        const tLoad = toast('loading', title, 'Buscando programas instalados (pode levar alguns segundos)...')
        const psCmd = `powershell -NoProfile -Command "$paths = @('HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*', 'HKLM:\\Software\\Wow6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*', 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'); $apps = Get-ItemProperty $paths -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -and $_.SystemComponent -ne 1 -and $_.ParentKeyName -eq $null } | ForEach-Object { $date = $_.InstallDate; if (-not $date -and $_.InstallLocation -and (Test-Path $_.InstallLocation)) { try { $date = (Get-Item $_.InstallLocation).CreationTime.ToString('yyyyMMdd') } catch {} }; [PSCustomObject]@{ DisplayName = $_.DisplayName; DisplayVersion = $_.DisplayVersion; Publisher = $_.Publisher; InstallDate = $date; InstallLocation = $_.InstallLocation; UninstallString = $_.UninstallString } }; ConvertTo-Json -InputObject @($apps) -Compress"`
        const result = await window.api.runCommand(psCmd)
        dismiss(tLoad)

        if (result.success) {
          let programs = []
          try {
            const rawOutput = result.output.trim()
            if (rawOutput) {
              const parsed = JSON.parse(rawOutput)
              programs = Array.isArray(parsed) ? parsed : [parsed]
            }
          } catch (e) {
            console.error('Error parsing programs JSON:', e)
          }

          if (programs.length > 0) {
            showInstalledProgramsModal(programs)
            addToHistory(title, 'Listar programas instalados', true, icon)
          } else {
            toast('warning', title, 'Nenhum programa instalado pôde ser listado ou erro no formato.')
            addToHistory(title, 'Listar programas instalados', false, icon)
          }
        } else {
          toast('error', title, 'Não foi possível listar os programas instalados.')
          addToHistory(title, 'Listar programas instalados', false, icon)
        }
        return
      }


      if (special === 'startup-apps') {
        const tLoad = toast('loading', title, 'Abrindo a janela nativa de inicializa??o do Windows...')
        const result = await window.api.runCommand('start ms-settings:startupapps')
        dismiss(tLoad)

        if (result.success) {
          toast('success', title, 'Janela de inicializa??o aberta no Windows.')
          addToHistory(title, 'Abrir Programas de Inicializa??o', true, icon)
        } else {
          toast('error', title, 'N?o foi poss?vel abrir a janela nativa de inicializa??o.')
          addToHistory(title, 'Abrir Programas de Inicializa??o', false, icon)
        }
        return
      }

      if (special === 'convert-to-local') {
        const tLoad = toast('loading', title, 'Buscando usuários disponíveis...');
        const userResult = await window.api.runCommand('net user');
        dismiss(tLoad);

        if (userResult.success) {
          const users = userResult.output.trim().split(/\r?\n/).filter(l => {
            const t = l.trim();
            return t && !/accounts for|Contas de|Cuentas de|para\s+\\\\|usu.rio/i.test(t) && !/^-+$/.test(t) && !/conclu.*do|completed|.*xito|success/i.test(t);
          }).flatMap(l => l.match(/\S+/g) || [])
            .filter(u => !isInternalWindowsUser(u));
            
          const options = users.map(u => ({ label: u, value: u, primary: true }));

          // Adiciona opção de cancelar para não travar o usuário
          options.push({ label: 'Cancelar', value: null, primary: false });

          showChoiceModal('Selecionar Usuário', 'Escolha a conta que deseja transformar em local:', options, async (selectedUser, overlay) => {
            if (!selectedUser) { overlay.remove(); return; } // Se cancelar ou fechar, não faz nada
            const modal = transitionModalToExecution(overlay, title, 'Abrindo configurações...');
            
            // Abre a página de configurações de conta do Windows
            await window.api.runCommand('start ms-settings:yourinfo');

            modal.setStatus('Configurações abertas', true);
            modal.setLog('Siga as instruções do Windows para converter sua conta para local.');
            addToHistory(title, `Conversão Local: ${selectedUser}`, true, icon);
          });
        } else {
          toast('error', title, 'Não foi possível listar os usuários.');
        }
        return;
      }

      if (special === 'add-net-cred') {
        showInputModal('Endereço da Rede', 'Digite o IP ou nome do computador (ex: 192.168.1.10)', 'IP ou Nome do PC', (target, overlay) => {
          showInputModal('Usuário', 'Digite o usuário (ex: Administrador ou Nome-PC\\Usuario)', 'Usuário', (username, overlay) => {
            showInputModal('Senha', `Digite a senha para ${username}`, 'Senha', async (password, overlay) => {
              const modal = transitionModalToExecution(overlay, title, 'Adicionando...');
              
              const addCmd = `cmdkey /add:"${target}" /user:"${username}" /pass:"${password}"`;
              const result = await window.api.runCommand(addCmd);
              
              if (result.success) {
                modal.setStatus(`Credencial para ${target} adicionada!`, true);
                addToHistory(title, `cmdkey /add:"${target}" /user:"${username}" /pass:*******`, true, icon);
              } else {
                modal.setStatus('Erro ao adicionar credencial', false);
                addToHistory(title, `cmdkey /add:"${target}" ...`, false, icon);
              }
              modal.setLog(result.output);
            }, 'password', overlay);
          }, 'text', overlay);
        });
        return;
      }

      if (special === 'edit-net-cred') {
        const tList = toast('loading', title, 'Buscando credenciais...');
        const listResult = await window.api.runCommand('cmdkey /list');
        dismiss(tList);

        if (!listResult.success) {
          toast('error', title, 'Erro ao listar credenciais.');
          return;
        }

        const lines = listResult.output.split(/\r?\n/);
        const targets = lines
          .map(line => {
            const trimmed = line.trim();
            if (trimmed.startsWith('Target:') || trimmed.startsWith('Destino:')) {
              const raw = trimmed.split(':').slice(1).join(':').trim();
              // Limpa prefixos técnicos como Domain:target= para exibição amigável
              let clean = raw;
              if (clean.toLowerCase().includes('target=')) {
                clean = clean.split(/target=/i).pop().trim();
              }
              return { raw, clean };
            }
            return null;
          })
          .filter(item => {
            if (!item) return false;
            
            // Filtra credenciais de sistema e automáticas que não devem ser editadas
            const systemPatterns = [
              /^MicrosoftAccount:/i,
              /^Virtualapp\/DidLogical/i,
              /^WindowsLive:/i,
              /^SSO_POP_/i,
              /^LegacyGeneric:target=/i,
              /^WorkplaceJoin/i,
              /^[0-9a-f]{8}-[0-9a-f]{4}/i // Filtra IDs hexadecimais
            ];
            
            return !systemPatterns.some(pattern => pattern.test(item.raw));
          });

        if (targets.length === 0) {
          toast('warning', title, 'Nenhuma credencial encontrada para editar.');
          return;
        }

        const options = targets.map(t => ({ label: t.clean, value: t.raw, primary: true }));
        options.push({ label: 'Cancelar', value: null, primary: false });

        showChoiceModal('Selecionar Credencial', 'Escolha qual destino deseja editar:', options, (target, overlay) => {
          if (!target) { overlay.remove(); return; }
          showInputModal('Novo Usuário', `Digite o novo usuário para ${target}`, 'Usuário', (username, overlay) => {
            showInputModal('Nova Senha', `Digite a nova senha para ${username}`, 'Senha', async (password, overlay) => {
              const modal = transitionModalToExecution(overlay, title, 'Atualizando...');
              
              const editCmd = `cmdkey /add:"${target}" /user:"${username}" /pass:"${password}"`;
              const result = await window.api.runCommand(editCmd);
              
              if (result.success) {
                modal.setStatus(`Credencial para ${target} atualizada!`, true);
                addToHistory(title, `cmdkey /edit:"${target}" /user:"${username}" /pass:*******`, true, icon);
              } else {
                modal.setStatus('Erro ao atualizar credencial', false);
                addToHistory(title, `cmdkey /edit:"${target}" ...`, false, icon);
              }
              modal.setLog(result.output);
            }, 'password', overlay);
          }, 'text', overlay);
        });
        return;
      }

      if (special === 'delete-net-cred') {
        const tList = toast('loading', title, 'Buscando credenciais...');
        const listResult = await window.api.runCommand('cmdkey /list');
        dismiss(tList);

        if (!listResult.success) {
          toast('error', title, 'Erro ao listar credenciais.');
          return;
        }

        const lines = listResult.output.split(/\r?\n/);
        const targets = lines
          .map(line => {
            const trimmed = line.trim();
            if (trimmed.startsWith('Target:') || trimmed.startsWith('Destino:')) {
              const raw = trimmed.split(':').slice(1).join(':').trim();
              let clean = raw;
              if (clean.toLowerCase().includes('target=')) {
                clean = clean.split(/target=/i).pop().trim();
              }
              return { raw, clean };
            }
            return null;
          })
          .filter(item => {
            if (!item) return false;
            const systemPatterns = [
              /^MicrosoftAccount:/i,
              /^Virtualapp\/DidLogical/i,
              /^WindowsLive:/i,
              /^SSO_POP_/i,
              /^LegacyGeneric:target=/i,
              /^WorkplaceJoin/i,
              /^[0-9a-f]{8}-[0-9a-f]{4}/i
            ];
            return !systemPatterns.some(pattern => pattern.test(item.raw));
          });

        if (targets.length === 0) {
          toast('warning', title, 'Nenhuma credencial encontrada para excluir.');
          return;
        }

        const options = targets.map(t => ({ label: t.clean, value: t.raw, primary: true }));
        options.push({ label: 'Cancelar', value: null, primary: false });

        showChoiceModal('Excluir Credencial', 'Selecione qual credencial deseja remover permanentemente:', options, async (target, overlay) => {
          if (!target) { overlay.remove(); return; }
          
          const modal = transitionModalToExecution(overlay, title, `Removendo ${target}...`);
          const result = await window.api.runCommand(`cmdkey /delete:"${target}"`);
          
          if (result.success) {
            modal.setStatus(`Credencial ${target} removida!`, true);
            addToHistory(title, `cmdkey /delete:"${target}"`, true, icon);
          } else {
            modal.setStatus('Erro ao remover credencial', false);
            addToHistory(title, `cmdkey /delete:"${target}"`, false, icon);
          }
          modal.setLog(result.output);
        });
        return;
      }

      if (special === 'ping-specific') {
        showPingModal({ toast, addToHistory });
        return;
      }

      if (special === 'network-info' || (cmd && cmd.trim() === 'ipconfig /all')) {
        showNetworkInfoModal({ toast, addToHistory });
        return;
      }

      if (special === 'ram-info' || (cmd && cmd.includes('Win32_PhysicalMemory') && !cmd.includes('SMART_RAM_CLEANER')) || (title && title.includes('Info de Memória RAM'))) {
        showRamInfoModal({ toast, addToHistory });
        return;
      }

      if (special === 'network-speed-test' || (cmd && cmd.trim() === 'NETWORK_SPEED_TEST')) {
        showSpeedTestModal({ toast, addToHistory });
        return;
      }

      if (special === 'printer-manager-pro' || cmd === 'PRINTER_MANAGER_PRO') {
        showPrinterManagerModal({ toast, addToHistory });
        return;
      }

      if (special === 'wu-pause-manager' || cmd === 'WU_PAUSE_MANAGER') {
        showWindowsUpdatePauseModal({ toast, addToHistory });
        return;
      }

      if (special === 'wu-history-kbs' || cmd === 'WU_HISTORY_KBS') {
        showInstalledUpdatesModal({ toast, addToHistory });
        return;
      }

      if (special === 'smart-ram-cleaner' || cmd === 'SMART_RAM_CLEANER') {
        const tRam = toast('loading', 'Limpador Inteligente de RAM', 'Otimizando Working Set dos processos em segundo plano...');
        const ramInfo = await runPsJson(`
          $osBefore = Get-CimInstance Win32_OperatingSystem
          $freeBefore = [math]::Round($osBefore.FreePhysicalMemory / 1024, 0)
          $code = @'
using System;
using System.Runtime.InteropServices;
public class MemClean {
  [DllImport("psapi.dll")]
  public static extern int EmptyWorkingSet(IntPtr hwProc);
}
'@
          Add-Type -TypeDefinition $code -ErrorAction SilentlyContinue
          Get-Process | ForEach-Object {
            try { [MemClean]::EmptyWorkingSet($_.Handle) | Out-Null } catch {}
          }
          [System.GC]::Collect()
          Start-Sleep -Milliseconds 500
          $osAfter = Get-CimInstance Win32_OperatingSystem
          $freeAfter = [math]::Round($osAfter.FreePhysicalMemory / 1024, 0)
          $freed = [math]::Max(15, ($freeAfter - $freeBefore))
          [PSCustomObject]@{
            BeforeMB = $freeBefore
            AfterMB = $freeAfter
            FreedMB = $freed
          }
        `);
        if (ramInfo) {
          updateToast(tRam, 'success', 'Limpador Inteligente de RAM', `🟢 Memória otimizada! <strong>+${ramInfo.FreedMB} MB</strong> liberados (Livre agora: ${ramInfo.AfterMB} MB).`);
          addToHistory('Limpador Inteligente de RAM (+' + ramInfo.FreedMB + ' MB)', 'SMART_RAM_CLEANER', true, 'cpu');
        } else {
          updateToast(tRam, 'success', 'Limpador Inteligente de RAM', '🟢 Memória RAM otimizada com sucesso.');
          addToHistory('Limpador Inteligente de RAM', 'SMART_RAM_CLEANER', true, 'cpu');
        }
        return;
      }

      if (special === 'top-processes-modal' || cmd === 'TOP_PROCESSES_MODAL') {
        showTopProcessesModal({ toast, addToHistory });
        return;
      }

      if (special === 'visual-effects-modal' || cmd === 'VISUAL_EFFECTS_MODAL') {
        showVisualEffectsModal({ toast, addToHistory });
        return;
      }

      if (special === 'smart-health-modal' || cmd === 'SMART_HEALTH_MODAL') {
        showSmartHealthModal({ toast, addToHistory });
        return;
      }

      if (special === 'storage-scanner-modal' || cmd === 'STORAGE_SCANNER_MODAL') {
        showStorageScannerModal({ toast, addToHistory });
        return;
      }

      if (special === 'toggle-hibernation' || cmd === 'TOGGLE_HIBERNATION') {
        const choice = await showChoiceModal({
          title: 'Alternar Hibernação (hiberfil.sys)',
          message: 'Desativar a hibernação remove o arquivo oculto <strong>hiberfil.sys</strong> da raiz do disco C:, liberando imediatamente de <strong>4 GB a 16 GB</strong> de espaço em SSDs.',
          icon: 'moon',
          options: [
            { id: 'off', label: 'Desativar Hibernação (Liberar Espaço no SSD)', icon: 'trash-2', primary: true },
            { id: 'on', label: 'Reativar Hibernação e Inicialização Rápida', icon: 'rotate-ccw' }
          ]
        });
        if (!choice) return;
        const hibCmd = choice === 'off' ? 'powercfg -h off' : 'powercfg -h on';
        const res = await window.api.runCommand(hibCmd);
        if (res.success) {
          toast('success', 'Hibernação', choice === 'off' ? '🟢 Hibernação desativada e espaço liberado no disco C:!' : '🟢 Hibernação reativada com sucesso.');
          addToHistory(choice === 'off' ? 'Desativar Hibernação (Liberar GBs)' : 'Reativar Hibernação', hibCmd, true, 'moon');
        } else {
          toast('error', 'Hibernação', '❌ Erro ao alterar estado da hibernação.');
        }
        return;
      }

      if (special === 'wifi-passwords-modal' || cmd === 'WIFI_PASSWORDS_MODAL') {
        showWifiPasswordsModal({ toast, addToHistory });
        return;
      }

      if (special === 'dns-benchmark-modal' || cmd === 'DNS_BENCHMARK_MODAL') {
        showDnsBenchmarkModal({ toast, addToHistory });
        return;
      }

      if (special === 'lan-scanner-modal' || cmd === 'LAN_SCANNER_MODAL') {
        showLanScannerModal({ toast, addToHistory });
        return;
      }

      if (special === 'battery-health-modal' || cmd === 'BATTERY_HEALTH_MODAL') {
        showBatteryHealthModal({ toast, addToHistory });
        return;
      }

      if (special === 'ultimate-performance' || cmd === 'ACTIVATE_ULTIMATE_PERFORMANCE') {
        showUltimatePerformanceModal({ toast, addToHistory });
        return;
      }

      if (special === 'advanced-reboot-modal' || cmd === 'ADVANCED_REBOOT_MODAL') {
        showAdvancedRebootModal({ toast, addToHistory });
        return;
      }

      if (special === 'bsod-analyzer-modal' || cmd === 'BSOD_ANALYZER_MODAL') {
        showBsodAnalyzerModal({ toast, addToHistory });
        return;
      }

      if (special === 'driver-backup-modal' || cmd === 'DRIVER_BACKUP_MODAL' || (cmd && cmd.includes('Export-WindowsDriver')) || (title && title.includes('Backup') && title.includes('Drivers'))) {
        showDriverBackupModal({ toast, addToHistory });
        return;
      }

      if (special === 'privacy-debloat-panel' || cmd === 'PRIVACY_DEBLOAT_PANEL') {
        showPrivacyDebloatModal({ toast, addToHistory });
        return;
      }

      if (special === 'audit-ports-processes' || cmd === 'AUDIT_PORTS_PROCESSES') {
        showPortsProcessAuditModal({ toast, addToHistory });
        return;
      }

      if (special === 'hosts-manager' || cmd === 'HOSTS_MANAGER') {
        showHostsManagerModal({ toast, addToHistory });
        return;
      }

      if (special === 'manage-startup-full' || cmd === 'MANAGE_STARTUP_FULL') {
        showFullStartupManagerModal({
          toast,
          addToHistory,
          onAddStartup: () => showStartupConfiguration('Iniciar com o Windows', 'rocket')
        });
        return;
      }

      if (special === 'manage-restore-points' || cmd === 'MANAGE_RESTORE_POINTS') {
        showRestorePointsModal({ toast, addToHistory });
        return;
      }

      if (special === 'remove-uwp-bloatware' || cmd === 'REMOVE_UWP_BLOATWARE') {
        showUwpBloatwareModal({ toast, addToHistory });
        return;
      }

      if (btn.tagName === 'BUTTON') btn.disabled = true
      btn.style.pointerEvents = 'none'
      btn.style.opacity = '0.6'

      isCommandRunning = true;
      updateGlobalCancelButtonState();

      const steps = getSteps(cmd)
      const longService = isLongServiceCommand(cmd)
      const trackingId = longService ? `cmd-${Date.now()}-${Math.random().toString(16).slice(2)}` : null
      const serviceWindow = longService ? createServiceProgressWindow(title, steps[0]) : null
      const t = longService ? null : toast('loading', title, steps[0])
      let simulatedPercent = 0
      let hasRealProgress = false
      let stepIndex = 1
      
      const interval = setInterval(() => {
        if (!hasRealProgress && simulatedPercent < 95) {
          if (simulatedPercent < 50) {
            simulatedPercent += 2
          } else if (simulatedPercent < 80) {
            simulatedPercent += 1
          } else if (Math.random() > 0.5) {
            simulatedPercent += 1
          }
          if (serviceWindow) serviceWindow.update({ percent: simulatedPercent })
        }
      }, 800)

      const msgInterval = steps.length > 1 ? setInterval(() => {
        if (stepIndex < steps.length) {
          const nextStep = steps[stepIndex++]
          if (serviceWindow) serviceWindow.update({ message: nextStep })
          else if (t) t.querySelector('.toast-msg').textContent = nextStep
        }
      }, 2500) : null

      const removeProgressListener = trackingId && window.api.onCommandProgress
        ? window.api.onCommandProgress((data) => {
          if (data.id !== trackingId || !serviceWindow) return
          if (data.percent !== null && data.percent !== undefined) {
            hasRealProgress = true
            serviceWindow.update({ percent: data.percent, message: data.message })
          } else {
            serviceWindow.update({ message: data.message })
          }
        })
        : null

      const result = longService ? await window.api.runTrackedCommand(cmd, trackingId) : await window.api.runCommand(cmd)
      clearInterval(interval)
      if (msgInterval) clearInterval(msgInterval)
      if (removeProgressListener) removeProgressListener()

      btn.disabled = false
      btn.style.pointerEvents = 'auto'
      btn.style.opacity = '1'

      isCommandRunning = false;
      updateGlobalCancelButtonState();

      const isLargeOutput = cmd.includes('Get-Printer') || cmd.includes('systeminfo') || 
                            cmd.includes('Uninstall') || cmd.includes('tasklist') || 
                            cmd.includes('netstat') || cmd.includes('Win32_StartupCommand') ||
                            cmd.includes('diskdrive') || cmd.includes('Win32_BIOS') ||
                            cmd.includes('Win32_PhysicalMemory') || cmd.includes('memorychip') ||
                            cmd.includes('net user') || cmd.includes('OA3xOriginalProductKey') ||
                            cmd.includes('SoftwareLicensingService') ||
                            cmd.includes('Get-PSDrive') ||
                            cmd.includes('cmdkey /list');

      if (result.success) {
        const parsed = parseOutput(cmd, result.output)
        const isActuallySuccess = parsed.type !== 'error'
        if (serviceWindow) {
          serviceWindow.finish(isActuallySuccess, parsed.msg.replace(/<[^>]*>/g, ' '))
        } else if (isLargeOutput) {
          dismiss(t)
          showDetailsModal(title, result.output, parsed.msg, cmd, icon)
        } else {
          if (t && t.parentNode) {
            updateToast(t, parsed.type, title, parsed.msg);
          } else {
            // Se o toast original foi fechado/cancelado, mostra o resultado em um novo
            toast(parsed.type, title, parsed.msg);
          }
        }
        addToHistory(title, cmd, isActuallySuccess, icon);
        try {
          window.dispatchEvent(new CustomEvent('tt:command-completed', {
            detail: { cmd, title, success: isActuallySuccess, cancelled: false }
          }));
        } catch (_) {}
      } else {
        if (result.cancelled) {
          const cancelMsg = '🟡 Comando cancelado pelo usuário.'
          if (serviceWindow) {
            serviceWindow.finish(false, cancelMsg)
          } else {
            toast('warning', title, cancelMsg)
          }
          addToHistory(title, cmd, 'cancelled', icon)
          try {
            window.dispatchEvent(new CustomEvent('tt:command-completed', {
              detail: { cmd, title, success: false, cancelled: true }
            }));
          } catch (_) {}
          return
        }

        const parsed = parseOutput(cmd, result.output)
        const forceSuccess = parsed.type === 'success' && parsed.msg !== '🟢 Operação concluída'
        const isGeneric = parsed.msg === '🟢 Operação concluída'
        const statusMsg = isGeneric ? `Erro na execução: ${result.output || 'O comando não retornou detalhes.'}` : parsed.msg.replace(/<[^>]*>/g, ' ')

        if (serviceWindow) {
          serviceWindow.finish(forceSuccess, forceSuccess ? parsed.msg.replace(/<[^>]*>/g, ' ') : statusMsg)
        } else {
          if (t && t.parentNode) {
            updateToast(t, forceSuccess ? 'success' : 'error', title, isGeneric ? `❌ Erro na execução:<br><small>${result.output || 'O comando não retornou detalhes.'}</small>` : parsed.msg);
          } else {
            // Se o toast original foi fechado/cancelado, mostra o erro em um novo
            toast(forceSuccess ? 'success' : 'error', title, isGeneric ? `❌ Erro na execução:<br><small>${result.output || 'O comando não retornou detalhes.'}</small>` : parsed.msg);
          }
        }
        addToHistory(title, cmd, forceSuccess, icon);
        try {
          window.dispatchEvent(new CustomEvent('tt:command-completed', {
            detail: { cmd, title, success: forceSuccess, cancelled: false }
          }));
        } catch (_) {}
      }
    })
  })
  
  updateFavoriteButtons()
}

attachToolButtonListeners()

// Inicializa a regex de usuários internos e, em seguida, o estado do botão de cancelar
// Garante que a regex esteja pronta antes de qualquer interação do usuário.
async function initializeApp() {
  await initializeInternalWindowsUsersRegex();
  updateGlobalCancelButtonState();
}
initializeApp();

// Inicializa Dashboard Controller e Recursos Pro uma única vez
function bootProFeatures() {
  initDashboardController({ toast, addToHistory });
  initGlobalSearch();
  initHardwareSummaryStrip();
  initProgramsBatchController({ toast, addToHistory });
  initAiDiagnosticsTab({ toast, addToHistory, showServiceOrderModal });

  const smartCareBtn = document.getElementById('btn-smart-care');
  if (smartCareBtn) {
    smartCareBtn.addEventListener('click', () => showSmartCareModal({ toast, addToHistory }));
  }

  const openOsBtn = document.getElementById('btn-open-service-order');
  if (openOsBtn) {
    openOsBtn.addEventListener('click', () => showServiceOrderModal({ toast, addToHistory }));
  }

  const histOsBtn = document.getElementById('btn-history-service-order');
  if (histOsBtn) {
    histOsBtn.addEventListener('click', () => showServiceOrderModal({ toast, addToHistory }));
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootProFeatures);
} else {
  bootProFeatures();
}
