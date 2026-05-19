﻿const container = document.getElementById('toast-container')
const AUTO_CLOSE = 8000
let isCommandRunning = false;
const globalCancelBtn = document.getElementById('cancel-btn');

function createLucideIcons() {
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons()
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

function toggleFavorite(cmd, title, desc, icon) {
  const favorites = getFavorites()
  const index = favorites.findIndex(f => f.cmd === cmd)
  
  if (index >= 0) {
    favorites.splice(index, 1)
  } else {
    favorites.push({ cmd, title, desc, icon })
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
            : `<i data-lucide="${item.icon || (item.success === 'cancelled' ? 'ban' : (item.success ? 'check' : 'x'))}" style="width:18px;height:18px"></i>`}
          
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
  
  favoritesList.innerHTML = favorites.map(fav => `
    <div class="tool-btn" data-cmd="${fav.cmd.replace(/"/g, '&quot;')}" style="width: calc(50% - 6px); cursor: pointer; position: relative;">
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
  `).join('')
  
  createLucideIcons()
  attachToolButtonListeners()
}

function showDetailsModal(title, output, formattedMsg) {
  const overlay = document.createElement('div')
  overlay.className = 'modal-overlay'
  const content = formatNotificationMessage(formattedMsg || output || 'Nenhuma saída registrada.')
  
  overlay.innerHTML = `
    <div class="modal" style="max-width: 95%; width: 650px; max-height: 85vh; display: flex; flex-direction: column;">
      <div class="modal-title">
        <i data-lucide="info" style="width:20px;height:20px"></i>
        ${title}
      </div>
      <div class="modal-desc" style="margin-bottom: 12px;">Resultados da operação:</div>
      <div id="modal-content-area" style="background: rgba(0,0,0,0.4); padding: 20px; border-radius: 12px; color: #e0e0e0; font-family: "Mostica Sans", Poppins, sans-serif; font-size: 13px; flex: 1; overflow-y: auto; border: 1px solid rgba(139, 92, 246, 0.2); line-height: 1.7; scrollbar-gutter: stable;">
        ${content}
      </div>
      <div class="modal-buttons" style="margin-top: 20px; gap: 12px;">
        <button class="modal-btn secondary" id="modal-copy-details" style="display: flex; align-items: center; gap: 8px;">
          <i data-lucide="copy" style="width:14px;height:14px"></i>Copiar
        </button>
        <button class="modal-btn primary" id="modal-close-details">Fechar</button>
      </div>
    </div>
  `
  document.body.appendChild(overlay)
  createLucideIcons()

  document.getElementById('modal-copy-details').onclick = () => {
    const textToCopy = document.getElementById('modal-content-area').innerText
    navigator.clipboard.writeText(textToCopy)
    const copyBtn = document.getElementById('modal-copy-details')
    const originalContent = copyBtn.innerHTML
    copyBtn.innerHTML = '<i data-lucide="check" style="width:14px;height:14px"></i> Copiado!'
    createLucideIcons()
    setTimeout(() => {
      copyBtn.innerHTML = originalContent
      createLucideIcons()
    }, 2000)
  }

  document.getElementById('modal-close-details').onclick = () => overlay.remove()
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
        renderHistory();
        toast('success', 'Histórico', '🟡 O histórico de comandos foi removido.');
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
  warning: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fde68a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`
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
  const cpuEl = document.getElementById('cpu-usage')
  const ramEl = document.getElementById('ram-usage')
  const diskEl = document.getElementById('cpu-temp') // Mantendo o ID original para compatibilidade com o HTML existente
  const cpuBar = document.getElementById('cpu-bar')
  const ramBar = document.getElementById('ram-bar')
  
  cpuEl.textContent = `${data.cpu}%`
  ramEl.textContent = `${data.ram}%`
  if (diskEl) diskEl.textContent = data.disk !== null ? `${data.disk}%` : '—'
  
  // Atualiza barras com cores dinâmicas
  cpuBar.style.width = `${data.cpu}%`
  ramBar.style.width = `${data.ram}%`
  
  // CPU
  cpuBar.className = 'stat-bar-fill'
  if (data.cpu < 50) cpuBar.classList.add('low')
  else if (data.cpu < 80) cpuBar.classList.add('medium')
  else cpuBar.classList.add('high')
  
  // RAM
  ramBar.className = 'stat-bar-fill'
  if (data.ram < 60) ramBar.classList.add('low')
  else if (data.ram < 85) ramBar.classList.add('medium')
  else ramBar.classList.add('high')
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

function isInternalWindowsUser(userName) {
  return /^(Administrador|Administrator|Convidado|Guest|DefaultAccount|WDAGUtilityAccount|CodexSandboxOffline|CodexSandboxOnline)$/i.test(String(userName || '').trim())
}

const STATE_LABEL = {
  RUNNING: '🟢 Em execução',       // English
  STOPPED: '🔴 Parado',         // English
  START_PENDING: '🟡 Iniciando',  // English
  STOP_PENDING: '🟡 Parando',     // English
  '4': '🟢 Em execução', '1': '🔴 Parado', '2': '🟡 Iniciando', '3': '🟡 Parando', // Numeric
  'EM EXECUÇÃO': '🟢 Em execução', // Portuguese
  'PARADO': '🔴 Parado',           // Portuguese
  'INÍCIO PENDENTE': '🟡 Iniciando', // Portuguese
  'PARADA PENDENTE': '🟡 Parando'   // Portuguese
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
      const stateRaw = (out.match(/STATE\s*:\s*\d+\s+([^\r\n(]+)/i) || [])[1]?.trim().toUpperCase()
      const state = STATE_LABEL[stateRaw] || '⚪ Desconhecido'
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
        const block = out.split(/\r?\n\r?\n/).find(b => new RegExp(svc, 'i').test(b)) || ''
        const stateRaw = (block.match(/STATE\s*:\s*\d+\s+(\w+)/i) || [])[1]?.toUpperCase()
        const state = STATE_LABEL[stateRaw] || '⚪ Desconhecido'
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
  { match: cmd => cmd.includes('powercfg /setactive'),
    result: () => '⚡ Plano de energia <b>Alto Desempenho</b> ativado' },

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
  { match: cmd => cmd.includes('OA3xOriginalProductKey'),
    result: (_, out) => {
      const key = out.trim().split('\n').pop()?.trim()
      if (key && key.length > 10 && key.includes('-'))
        return `<b>Chave do Produto:</b> ${key}`
      return '<b>Status:</b> âšª Chave nÃ£o encontrada ou nÃ£o disponÃ­vel'
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

  // ConexÃµes ativas
  { match: cmd => cmd.includes('netstat -ano') && !cmd.includes('LISTENING'),
    result: (_, out) => {
      const lines = out.trim().split(/\r?\n/).filter(l => l.trim() && /TCP|UDP/i.test(l))
      return `<b>ConexÃµes ativas:</b> ${lines.length}`
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
  { match: cmd => cmd.includes('set dns'),
    result: (_, out) => {
      if (cmd.includes('8.8.8.8'))
        return '<b>Status:</b> 🟢 DNS configurado para Google (8.8.8.8)'
      if (cmd.includes('1.1.1.1'))
        return '<b>Status:</b> 🟢 DNS configurado para Cloudflare (1.1.1.1)'
      return '<b>Status:</b> 🟢 DNS configurado'
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
  for (const s of STEPS) {
    if (s.match(cmd)) return s.steps
  }
  return ['Executando...']
}

// â”€â”€ Toast â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function toast(type, title, msg) {
  const el = document.createElement('div')
  el.className = `toast ${type}`
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
    <div class="toast-icon">${type === 'loading' ? '<span class="spinner"></span>' : SVG[type]}</div>
    <div class="toast-body">
      <div class="toast-title">${title}</div>
      <div class="toast-msg">${formatNotificationMessage(msg)}</div>
    </div>
    ${type === 'loading'
      ? `<button class="toast-cancel-btn cancel-btn-premium" title="Cancelar comando" style="background: rgba(239, 68, 68, 0.15); color: #fca5a5; border: 1px solid rgba(239, 68, 68, 0.4); border-radius: 6px; padding: 5px 10px; font-size: 10px; font-weight: 800; cursor: pointer; margin-left: 10px; white-space: nowrap; animation: pulse-cancel 2s infinite; text-shadow: 0 0 5px rgba(239, 68, 68, 0.3); transition: all 0.2s; backdrop-filter: blur(4px);">CANCELAR</button>`
      : `<button class="toast-close" title="Fechar"><i data-lucide="x" style="width:14px;height:14px"></i></button>`}
    <div class="toast-bar" ${type !== 'loading' ? `style="animation-duration:${AUTO_CLOSE}ms"` : ''}></div>
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
  if (type !== 'loading') setTimeout(() => dismiss(el), AUTO_CLOSE)
  return el
}

function dismiss(el) {
  el.classList.add('hide')
  setTimeout(() => el.remove(), 400)
}

function updateToast(el, type, title, html) {
  if (!el || !el.parentNode) return;

  el.className = `toast ${type}`
  
  // Se parou de carregar, remove o botão "CANCELAR" e coloca o "X" para fechar
  const cancelBtn = el.querySelector('.toast-cancel-btn')
  if (cancelBtn && type !== 'loading') {
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
  
  el.querySelector('.toast-icon').innerHTML = SVG[type]
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
    setTimeout(() => el.remove(), 250)
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
        setTimeout(() => el.remove(), 250)
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
    document.getElementById(tabId).classList.add('active')
    
    // Renderizar histórico/favoritos ao abrir
    if (btn.dataset.tab === 'historico') renderHistory()
    if (btn.dataset.tab === 'favoritos') renderFavorites()
  })
})

// â”€â”€ BotÃµes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// â”€â”€ BotÃµes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// â”€â”€ BotÃµes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function transitionModalToExecution(overlay, title, initialStatus) {
  const modal = overlay.querySelector('.modal');
  modal.innerHTML = `
    <div class="modal-title">
      <i data-lucide="loader-2" class="spinner" style="width:20px;height:20px"></i>
      ${title}
    </div>
    <div class="modal-desc" id="modal-status">${initialStatus}</div>
    <div id="modal-log-area" style="background: rgba(0,0,0,0.5); padding: 15px; border-radius: 8px; color: #a78bfa; font-family: 'Consolas', 'Cascadia Code', 'Courier New', monospace; font-size: 12px; max-height: 220px; overflow-y: auto; border: 1px solid rgba(139, 92, 246, 0.3); margin-top: 10px; white-space: pre-wrap; display: none; line-height: 1.6; box-shadow: inset 0 0 15px rgba(0,0,0,0.6);"></div>
    <div class="modal-buttons" style="margin-top: 20px; flex-direction: column; align-items: stretch;">
      <button class="modal-btn primary" id="modal-close-btn" disabled>Aguarde...</button>
    </div>
  `;
  createLucideIcons();

  const statusEl = modal.querySelector('#modal-status');
  const logEl = modal.querySelector('#modal-log-area');
  const closeBtn = modal.querySelector('#modal-close-btn');

  return {
    setStatus: (msg, success) => {
      statusEl.innerHTML = msg;
      statusEl.style.color = success ? '#86efac' : '#fca5a5';
      closeBtn.disabled = false;
      closeBtn.textContent = 'Fechar';
      closeBtn.onclick = () => overlay.remove();
      const titleIcon = modal.querySelector('.modal-title i');
      if (titleIcon) {
        titleIcon.setAttribute('data-lucide', success ? 'check-circle-2' : 'alert-triangle');
        titleIcon.classList.remove('spinner');
      }
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
  overlay.className = 'modal-overlay'
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-title">
        <i data-lucide="user-cog" style="width:20px;height:20px"></i>
        ${title}
      </div>
      <div class="modal-desc">${description}</div>
      <input type="${inputType}" class="modal-input modal-input-field" placeholder="${placeholder}" autocomplete="off">
      <div class="modal-buttons" style="flex-direction: column; align-items: stretch;">
        <button class="modal-btn primary btn-confirm">Confirmar</button>
        <button class="modal-btn secondary btn-cancel">Cancelar</button>
      </div>
    </div>
  `
  
  document.body.appendChild(overlay)
  createLucideIcons()
  
  const input = overlay.querySelector('.modal-input-field')
  const confirmBtn = overlay.querySelector('.btn-confirm')
  const cancelBtn = overlay.querySelector('.btn-cancel')
  
  input.focus()
  
  const close = () => {
    overlay.style.opacity = '0'
    setTimeout(() => overlay.remove(), 200)
  }
  
  confirmBtn.addEventListener('click', () => {
    const value = input.value.trim()
    if (value) {
      callback(value, overlay)
    } else {
      input.style.borderColor = 'rgba(239, 68, 68, 0.6)'
      input.focus()
    }
  })
  
  cancelBtn.addEventListener('click', close)
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close()
  })
  
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') confirmBtn.click()
    if (e.key === 'Escape') close()
  })
}

function showChoiceModal(title, description, options, callback, oldOverlay = null) {
  if (oldOverlay) oldOverlay.remove();
  const overlay = document.createElement('div')
  overlay.className = 'modal-overlay'
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-title">
        <i data-lucide="help-circle" style="width:20px;height:20px"></i>
        ${title}
      </div>
      <div class="modal-desc">${description}</div>
      <div class="modal-buttons" style="flex-direction: column; align-items: stretch; gap: 12px; margin-top: 20px;">
        ${options.map((opt, idx) => `
          <button class="modal-btn ${opt.primary ? 'primary' : 'secondary'} choice-btn" data-index="${idx}" style="min-width: 120px; flex: 1 1 auto; text-align: center;">${opt.label}</button>
        `).join('')}
      </div>
    </div>
  `
  document.body.appendChild(overlay)
  createLucideIcons()

  // Permitir fechar o modal ao clicar no fundo (overlay)
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove()
  })

  overlay.querySelectorAll('.choice-btn').forEach(btn => {
    btn.onclick = () => {
      const idx = btn.dataset.index
      callback(options[idx].value, overlay)
    }
  })
}

function showDeleteUserModal(users, currentUser, callback) {
  const overlay = document.createElement('div')
  overlay.className = 'modal-overlay'
  overlay.innerHTML = `
    <div class="modal" style="width: 560px; max-width: 92vw;">
      <div class="modal-title">
        <i data-lucide="user-x" style="width:20px;height:20px"></i>
        Excluir usuario
      </div>
      <div class="modal-desc" style="margin-bottom: 14px;">
        Selecione uma conta local ativa para excluir. Contas padrão do Windows, Administrador e o usuário em uso (${escapeHtml(currentUser || 'atual')}) foram bloqueados.
      </div>
      <div style="background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.35); color: #fecaca; border-radius: 10px; padding: 12px 14px; font-size: 12px; line-height: 1.6; margin-bottom: 16px;">
        <b>Aviso importante:</b> excluir um usuário remove a conta local e pode impedir o acesso aos arquivos, configurações e permissões vinculadas a ela. Confira backups e confirme que ninguém depende dessa conta antes de continuar.
      </div>
      <div id="delete-user-list" style="display: flex; flex-direction: column; gap: 8px; max-height: 260px; overflow-y: auto; margin-bottom: 16px; scrollbar-gutter: stable;">
        ${users.map((user, idx) => `
          <label class="delete-user-option" style="display: flex; gap: 12px; align-items: flex-start; padding: 12px; border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; background: rgba(0,0,0,0.22); cursor: pointer;">
            <input type="radio" name="delete-user" value="${escapeHtml(user.name)}" ${idx === 0 ? 'checked' : ''} style="margin-top: 3px;">
            <span style="display: flex; flex-direction: column; gap: 4px;">
              <span style="color: #e8eaed; font-weight: 600;">${escapeHtml(user.name)}</span>
              ${user.fullName ? `<span style="color: #9ca3af; font-size: 12px;">${escapeHtml(user.fullName)}</span>` : ''}
              ${user.description ? `<span style="color: #7e8694; font-size: 11px; line-height: 1.4;">${escapeHtml(user.description)}</span>` : ''}
            </span>
          </label>
        `).join('')}
      </div>
      <label style="display: flex; gap: 10px; align-items: flex-start; color: #d1d5db; font-size: 12px; line-height: 1.5; margin-bottom: 18px;">
        <input type="checkbox" id="delete-user-aware" style="margin-top: 2px;">
        Estou ciente de que esta ação é destrutiva e pode remover o acesso aos dados deste usuário.
      </label>
      <div class="modal-buttons" style="flex-direction: column; align-items: stretch;">
        <button class="modal-btn primary" id="delete-user-confirm" disabled style="background: linear-gradient(135deg, #dc2626, #991b1b); opacity: 0.55;">Excluir usuario</button>
        <button class="modal-btn secondary" id="delete-user-cancel">Cancelar</button>
      </div>
    </div>
  `

  document.body.appendChild(overlay)
  createLucideIcons()

  const aware = document.getElementById('delete-user-aware')
  const confirmBtn = document.getElementById('delete-user-confirm')
  const cancelBtn = document.getElementById('delete-user-cancel')
  const close = () => overlay.remove()

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
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close()
  })

  confirmBtn.addEventListener('click', () => {
    const selected = overlay.querySelector('input[name="delete-user"]:checked')?.value
    if (!selected) return
    callback(selected, overlay)
  })

  updateConfirmState()
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
        toggleFavorite(favBtn.dataset.cmd, favBtn.dataset.title, favBtn.dataset.desc, favBtn.dataset.icon)
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
      
      // Comandos especiais que precisam de input
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
        showInputModal('Ping em IP/Host', 'Digite o endereço IP ou nome do computador para testar a conexão.', 'IP ou Hostname', async (target, overlay) => {
          const modal = transitionModalToExecution(overlay, title, `Fazendo ping em ${target}...`);
          
          const pingCmd = `ping -n 4 ${target}`;
          const result = await window.api.runCommand(pingCmd);
          const parsed = parseOutput(pingCmd, result.output || '');

          if (result.success) {
            modal.setStatus(formatNotificationMessage(parsed.msg), true);
          } else {
            modal.setStatus('Falha na conexão', false);
          }

          const cleanOutput = (result.output || 'Sem resposta do servidor.')
            .replace(/Estat.sticas/gi, 'EstatÃ­sticas')
            .replace(/M.nimo/gi, 'Mínimo')
            .replace(/M.ximo/gi, 'Máximo')
            .replace(/M.dia/gi, 'Média')
            .replace(/n.mero/gi, 'número')
            .replace(/tempo</g, 'tempo < ');
            
          modal.setLog(cleanOutput);
          addToHistory(title, pingCmd, result.success, icon);
        });
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
      let i = 1
      const interval = steps.length > 1 ? setInterval(() => {
        if (i < steps.length) {
          const nextStep = steps[i++]
          if (serviceWindow) serviceWindow.update({ message: nextStep })
          else if (t) t.querySelector('.toast-msg').textContent = nextStep
        }
      }, 2200) : null

      const removeProgressListener = trackingId && window.api.onCommandProgress
        ? window.api.onCommandProgress((data) => {
          if (data.id !== trackingId || !serviceWindow) return
          serviceWindow.update({ percent: data.percent, message: data.message })
        })
        : null

      const result = longService ? await window.api.runTrackedCommand(cmd, trackingId) : await window.api.runCommand(cmd)
      if (interval) clearInterval(interval)
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
                            cmd.includes('net user') || cmd.includes('OA3xOriginalProductKey') ||
                            cmd.includes('Get-PSDrive') ||
                            cmd.includes('cmdkey /list');

      if (result.success) {
        const parsed = parseOutput(cmd, result.output)
        const isActuallySuccess = parsed.type !== 'error'
        if (serviceWindow) {
          serviceWindow.finish(isActuallySuccess, parsed.msg.replace(/<[^>]*>/g, ' '))
        } else if (isLargeOutput) {
          dismiss(t)
          showDetailsModal(title, result.output, parsed.msg)
        } else {
          if (t && t.parentNode) {
            updateToast(t, parsed.type, title, parsed.msg);
          } else {
            // Se o toast original foi fechado/cancelado, mostra o resultado em um novo
            toast(parsed.type, title, parsed.msg);
          }
        }
        addToHistory(title, cmd, isActuallySuccess, icon);
      } else {
        if (result.cancelled) {
          const cancelMsg = '🟡 Comando cancelado pelo usuário.'
          if (serviceWindow) {
            serviceWindow.finish(false, cancelMsg)
          } else {
            toast('warning', title, cancelMsg)
          }
          addToHistory(title, cmd, 'cancelled', icon)
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
