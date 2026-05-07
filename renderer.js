const container = document.getElementById('toast-container')
const AUTO_CLOSE = 8000

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

function addToHistory(title, cmd, success) {
  const history = getHistory()
  history.unshift({
    title,
    cmd,
    success,
    timestamp: Date.now()
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
    historyList.innerHTML = '<div style="text-align: center; padding: 40px; color: #7e8694; font-family: Raleway, sans-serif; width: 100%;">Nenhum comando executado ainda</div>'
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
    
    return `
      <div class="history-item">
        <div class="history-item-icon">
          <i data-lucide="${item.success ? 'check' : 'x'}" style="width:18px;height:18px"></i>
        </div>
        <div class="history-item-content">
          <div class="history-item-title">${item.title}</div>
          <div class="history-item-time">${timeStr}</div>
        </div>
        <div class="history-item-status ${item.success ? 'success' : 'error'}">
          ${item.success ? '🟢 Sucesso' : '🔴 Erro'}
        </div>
      </div>
    `
  }).join('')
  
  lucide.createIcons()
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
        ${fav.icon.includes('/') || fav.icon.includes('.') // Verifica se é um caminho/URL
          ? `<img src="${fav.icon}" style="width:22px;height:22px;object-fit:contain">` 
          : `<i data-lucide="${fav.icon}" style="width:22px;height:22px"></i>`}
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
  
  lucide.createIcons()
  attachToolButtonListeners()
}

function showDetailsModal(title, output) {
  const overlay = document.createElement('div')
  overlay.className = 'modal-overlay'
  overlay.innerHTML = `
    <div class="modal" style="max-width: 650px; width: 90%;">
      <div class="modal-title">
        <i data-lucide="terminal" style="width:20px;height:20px"></i>
        Detalhes da Execução: ${title}
      </div>
      <div class="modal-desc" style="margin-bottom: 12px;">Saída técnica do terminal (Log):</div>
      <pre style="background: rgba(0,0,0,0.4); padding: 16px; border-radius: 10px; color: #818cf8; font-family: monospace; font-size: 12px; max-height: 250px; overflow-y: auto; white-space: pre-wrap; word-break: break-all; border: 1px solid rgba(139, 92, 246, 0.2); line-height: 1.6;">${output || 'Nenhuma saída registrada.'}</pre>
      <div class="modal-buttons" style="margin-top: 20px;">
        <button class="modal-btn primary" id="modal-close-details">Fechar Detalhes</button>
      </div>
    </div>
  `
  document.body.appendChild(overlay)
  lucide.createIcons()
  document.getElementById('modal-close-details').onclick = () => overlay.remove()
}

// ── Toggle Tema ───────────────────────────────────────────────────────────────

function getTheme() {
  return localStorage.getItem(THEME_KEY) || 'dark'
}

function setTheme(theme) {
  localStorage.setItem(THEME_KEY, theme)
  document.body.setAttribute('data-theme', theme)
  
  const icon = document.querySelector('#theme-toggle i')
  if (icon) {
    icon.setAttribute('data-lucide', theme === 'dark' ? 'sun' : 'moon')
    lucide.createIcons()
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
  if (confirm('Deseja limpar todo o histórico?')) {
    localStorage.removeItem(HISTORY_KEY)
    renderHistory()
  }
})

// Cancelar comando
document.getElementById('cancel-btn')?.addEventListener('click', () => {
  window.api.cancelCommand()
})

const SVG = {
  success: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#86efac" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
  error:   `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fca5a5" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
  warning: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fde68a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`
}

// ── Header Stats ────────────────────────────────────────────────────────────────────────

// Relógio
function updateClock() {
  const now = new Date()
  const h = String(now.getHours()).padStart(2, '0')
  const m = String(now.getMinutes()).padStart(2, '0')
  const s = String(now.getSeconds()).padStart(2, '0')
  document.getElementById('clock').textContent = `${h}:${m}:${s}`
}
updateClock()
setInterval(updateClock, 1000)

// Stats do sistema (CPU/RAM)
window.api.onSystemStats((data) => {
  const cpuEl = document.getElementById('cpu-usage')
  const ramEl = document.getElementById('ram-usage')
  const cpuBar = document.getElementById('cpu-bar')
  const ramBar = document.getElementById('ram-bar')
  
  cpuEl.textContent = `${data.cpu}%`
  ramEl.textContent = `${data.ram}%`
  
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

// ── Helpers ──────────────────────────────────────────────────────────────────

const toGB = bytes => bytes ? (parseInt(bytes) / 1073741824).toFixed(1) + ' GB' : null

const STATE_LABEL = {
  RUNNING: '🟢 Em execução', STOPPED: '🔴 Parado',
  START_PENDING: '🟡 Iniciando', STOP_PENDING: '🟡 Parando',
  '4': '🟢 Em execução', '1': '🔴 Parado', '2': '🟡 Iniciando', '3': '🟡 Parando'
}

// ── Parsers por comando ───────────────────────────────────────────────────────

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
      const stateRaw = (out.match(/STATE\s*:\s*\d+\s+(\w+)/i) || [])[1]?.toUpperCase()
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

  // Memória RAM
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
      if (/successfully repaired|reparados com êxito/i.test(out))
        return '<b>Status:</b> 🟡 Arquivos reparados'
      if (/unable to fix|não foi possível reparar/i.test(out))
        return '<b>Status:</b> 🔴 Não foi possível reparar'
      return '<b>Status:</b> 🟢 Verificação concluída'
    }
  },

  // DISM
  { match: cmd => cmd.includes('DISM'),
    result: (_, out) => {
      if (/restore operation completed|restauração.*concluída/i.test(out))
        return '<b>Status:</b> 🟢 Imagem restaurada'
      if (/no component store corruption|nenhuma corrupção/i.test(out))
        return '<b>Status:</b> 🟢 Nenhuma corrupção detectada'
      return '<b>Status:</b> 🟢 Operação concluída'
    }
  },

  // CHKDSK
  { match: cmd => cmd.includes('chkdsk'),
    result: (_, out) => {
      if (/cannot lock|não é possível bloquear/i.test(out) || /scheduled|agendado/i.test(out))
        return { type: 'warning', msg: '🟡 Disco em uso — verificação <b>agendada para o próximo reinício</b>' }
      if (/found no problems|nenhum problema/i.test(out))
        return '🟢 Disco verificado — nenhum problema encontrado'
      return { type: 'warning', msg: '🟡 Verificação agendada para o próximo reinício' }
    }
  },

  // Desfragmentar
  { match: cmd => cmd.includes('defrag'),
    result: (_, out) => {
      if (/100%|concluído|completed/i.test(out))
        return '<b>Status:</b> 🟢 Desfragmentação concluída'
      if (/solid state|SSD|não é necessário/i.test(out))
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

  // Limpar credenciais de rede
  { match: cmd => cmd.includes('cmdkey'),
    result: (_, out) => {
      const deletedCount = (out.match(/exclu[íi]do|deleted/gi) || []).length
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
      const mask = (out.match(/Subnet Mask.*?:\s*([\d.]+)/i) || out.match(/Máscara.*?:\s*([\d.]+)/i) || [])[1]
      const gw   = (out.match(/Default Gateway.*?:\s*([\d.]+)/i) || out.match(/Gateway Padrão.*?:\s*([\d.]+)/i) || [])[1]
      const dns  = (out.match(/DNS Servers.*?:\s*([\d.]+)/i) || out.match(/Servidores DNS.*?:\s*([\d.]+)/i) || [])[1]
      if (!ip) return '⚪ Nenhuma conexão de rede ativa encontrada'
      return [
        ip   ? `🌐 IP: <b>${ip}</b>` : null,
        mask ? `🔲 Máscara: <b>${mask}</b>` : null,
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
      const avg  = (out.match(/Average\s*=\s*(\d+)ms/i) || out.match(/Média\s*=\s*(\d+)ms/i) || [])[1]
      if (recv === undefined) return '<b>Status:</b> 🔴 Sem resposta'
      const ok = parseInt(lost) === 0
      return [
        `<b>Status:</b> ${ok ? '🟢 Conexão estável' : '🟡 Conexão com perdas'}`,
        recv !== undefined ? `<b>Pacotes:</b> ${recv}/4` : null,
        avg  ? `<b>Latência:</b> ${avg}ms` : null
      ].filter(Boolean).join('<br>')
    }
  },

  // Sincronizar data/hora
  { match: cmd => cmd.includes('w32tm') && cmd.includes('resync'),
    result: (_, out) => {
      if (/sending resync|enviando ressincroniza/i.test(out) || /successfully|com êxito/i.test(out) || out.trim() === '')
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
      const version = get([/OS Version.*?:\s*(.+)/i, /Versão do SO.*?:\s*(.+)/i])
      const arch = get([/System Type.*?:\s*(.+)/i, /Tipo de Sistema.*?:\s*(.+)/i])
      const proc = get([/Processor\(s\).*?:\s*\d+.*?\[\d+\]:\s*(.+)/i, /Processador\(es\).*?:\s*\d+.*?\[\d+\]:\s*(.+)/i])
      const ram = get([/Total Physical Memory.*?:\s*(.+)/i, /Memória Física Total.*?:\s*(.+)/i])
      const boot = get([/System Boot Time.*?:\s*(.+)/i, /Hora de Inicialização.*?:\s*(.+)/i])
      const domain = get([/Domain.*?:\s*(.+)/i, /Domínio.*?:\s*(.+)/i])
      const hostname = get([/Host Name.*?:\s*(.+)/i, /Nome do Host.*?:\s*(.+)/i])
      
      const lines = []
      if (hostname) lines.push(`🖥️ Host: <b>${hostname}</b>`)
      if (os) lines.push(`💻 SO: <b>${os.replace('Microsoft ', '').replace('Windows ', 'Win ')}</b>`)
      if (version) lines.push(`📦 Versão: <b>${version.split(' ')[0]}</b>`)
      if (arch) lines.push(`⚙️ Arquitetura: <b>${arch.includes('x64') ? '64-bit' : arch}</b>`)
      if (proc) lines.push(`🔧 CPU: <b>${proc.replace(/\s+@.*/, '')}</b>`)
      if (ram) lines.push(`🧠 RAM Total: <b>${ram}</b>`)
      if (boot) lines.push(`🕐 Último boot: <b>${boot}</b>`)
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
               !/^Contas|^User accounts|^----|^O comando|^The command/i.test(t) &&
               !/conclu[íi]do|completed|[êe]xito|success/i.test(t)
      })
      const users = lines.flatMap(l => l.trim().split(/\s{2,}/).filter(Boolean))
      if (!users.length) return '⚪ Nenhum usuário encontrado'
      return users.map(u => `👤 <b>${u}</b>`).join('<br>')
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
      if (/success|êxito|concluído/i.test(out))
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
      return '<b>Status:</b> ⚪ Chave não encontrada ou não disponível'
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
      const lines = out.trim().split(/\r?\n/).filter(l => l.trim() && /TCP|UDP/i.test(l))
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
    result: () => '<b>Status:</b> 🟢 Limpeza de componentes iniciada<br>⚪ Isso pode levar vários minutos'
  },

  // TRIM SSD
  { match: cmd => cmd.includes('Optimize-Volume') && cmd.includes('ReTrim'),
    result: () => '<b>Status:</b> 🟢 Comando TRIM executado no SSD'
  },

  // Ponto de restauração
  { match: cmd => cmd.includes('Checkpoint-Computer'),
    result: (_, out) => {
      if (/successfully|sucesso|êxito/i.test(out))
        return '<b>Status:</b> 🟢 Ponto de restauração criado'
      return '<b>Status:</b> 🟡 Verifique se a proteção do sistema está ativada'
    }
  },

  // Winget - Instalação de programas
  { match: cmd => cmd.includes('winget install'),
    result: (_, out) => {
      if (out.includes('Successfully installed') || out.includes('instalado com êxito'))
        return '<b>Status:</b> 🟢 Programa instalado com sucesso'
      if (out.includes('already installed') || out.includes('já está instalado'))
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

// ── Etapas de progresso ───────────────────────────────────────────────────────

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

// ── Toast ─────────────────────────────────────────────────────────────────────

function toast(type, title, msg) {
  const el = document.createElement('div')
  el.className = `toast ${type}`
  el.innerHTML = `
    <div class="toast-icon">${type === 'loading' ? '<span class="spinner"></span>' : SVG[type]}</div>
    <div class="toast-body">
      <div class="toast-title">${title}</div>
      <div class="toast-msg">${msg}</div>
    </div>
    <button class="toast-close" title="Fechar">✕</button>
    <div class="toast-bar" ${type !== 'loading' ? `style="animation-duration:${AUTO_CLOSE}ms"` : ''}></div>
  `
  el.querySelector('.toast-close').addEventListener('click', () => dismiss(el))
  container.appendChild(el)
  if (type !== 'loading') setTimeout(() => dismiss(el), AUTO_CLOSE)
  return el
}

function dismiss(el) {
  el.classList.add('hide')
  setTimeout(() => el.remove(), 400)
}

function updateToast(el, type, title, html) {
  el.className = `toast ${type}`
  
  // Detecta se precisa expandir (mais de 4 linhas ou mais de 200 caracteres)
  const lineCount = (html.match(/<br>/gi) || []).length + 1
  const charCount = html.replace(/<[^>]*>/g, '').length
  if (lineCount > 4 || charCount > 200) {
    el.classList.add('expanded')
  }
  
  el.querySelector('.toast-icon').innerHTML = SVG[type]
  el.querySelector('.toast-title').textContent = title
  el.querySelector('.toast-msg').innerHTML = html
  const bar = el.querySelector('.toast-bar')
  bar.style.animation = 'none'
  bar.offsetHeight
  bar.style.animation = `shrink ${AUTO_CLOSE}ms linear forwards`
  setTimeout(() => dismiss(el), AUTO_CLOSE)
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

// ── Tabs ────────────────────────────────────────────────────────────────────

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

// ── Botões ────────────────────────────────────────────────────────────────────

// ── Botões ────────────────────────────────────────────────────────────────

// ── Botões ────────────────────────────────────────────────────────────────

function showInputModal(title, description, placeholder, callback) {
  const overlay = document.createElement('div')
  overlay.className = 'modal-overlay'
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-title">
        <i data-lucide="user-cog" style="width:20px;height:20px"></i>
        ${title}
      </div>
      <div class="modal-desc">${description}</div>
      <input type="text" class="modal-input" placeholder="${placeholder}" id="modal-input" autocomplete="off">
      <div class="modal-buttons">
        <button class="modal-btn secondary" id="modal-cancel">Cancelar</button>
        <button class="modal-btn primary" id="modal-confirm">Confirmar</button>
      </div>
    </div>
  `
  
  document.body.appendChild(overlay)
  lucide.createIcons()
  
  const input = document.getElementById('modal-input')
  const confirmBtn = document.getElementById('modal-confirm')
  const cancelBtn = document.getElementById('modal-cancel')
  
  input.focus()
  
  const close = () => {
    overlay.style.opacity = '0'
    setTimeout(() => overlay.remove(), 200)
  }
  
  confirmBtn.addEventListener('click', () => {
    const value = input.value.trim()
    if (value) {
      callback(value)
      close()
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

function attachToolButtonListeners() {
  document.querySelectorAll('.tool-btn').forEach(btn => {
    const cmd = btn.dataset.cmd
    if (!cmd) return
    
    // Adicionar botão de favorito se não existir
    if (!btn.closest('#favorites-list') && !btn.querySelector('.btn-favorite')) {
      const title = btn.querySelector('.btn-title')?.textContent || ''
      const desc = btn.querySelector('.btn-desc')?.textContent || ''
      const iconEl = btn.querySelector('.btn-icon i, .btn-icon img')
      const icon = iconEl?.tagName === 'IMG' ? iconEl.src : (iconEl?.getAttribute('data-lucide') || 'star')
      
      const favBtn = document.createElement('button')
      favBtn.className = 'btn-favorite'
      favBtn.dataset.cmd = cmd
      favBtn.dataset.title = title
      favBtn.dataset.desc = desc
      favBtn.dataset.icon = icon
      favBtn.innerHTML = '<i data-lucide="star" style="width:14px;height:14px"></i>'
      
      btn.appendChild(favBtn)
      lucide.createIcons()
    }
    
    // Remover listeners antigos
    const newBtn = btn.cloneNode(true)
    btn.parentNode.replaceChild(newBtn, btn)
    
    // Listener para o botão de remoção rápida na aba de favoritos
    const removeBtn = newBtn.querySelector('.remove-favorite')
    if (removeBtn) {
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        const cmd = newBtn.dataset.cmd
        const title = newBtn.querySelector('.btn-title').textContent
        toggleFavorite(cmd, title) // O toggle cuidará da remoção
      })
    }

    // Re-atribui o listener ao botão de favorito (cloneNode não copia listeners)
    const favBtn = newBtn.querySelector('.btn-favorite')
    if (favBtn) {
      favBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        toggleFavorite(favBtn.dataset.cmd, favBtn.dataset.title, favBtn.dataset.desc, favBtn.dataset.icon)
      })
    }

    // Adicionar novo listener
    newBtn.addEventListener('click', async (e) => {
      if (e.target.closest('.btn-favorite') || e.target.closest('.remove-favorite')) return
      
      const title = newBtn.querySelector('.btn-title').textContent
      const cmd = newBtn.dataset.cmd
      const special = newBtn.dataset.special
      
      // Comandos especiais que precisam de input
      if (special === 'rename-admin') {
        showInputModal(
          'Renomear Administrador',
          'Digite o novo nome para a conta Administrador. Isso aumenta a segurança do sistema.',
          'Novo nome (ex: Admin2024)',
          async (newName) => {
            const renameCmd = `wmic useraccount where name='Administrador' rename '${newName}'`
            
            newBtn.disabled = true
            newBtn.style.opacity = '0.6'
            
            const t = toast('loading', title, 'Renomeando conta Administrador...')
            const result = await window.api.runCommand(renameCmd)
            
            newBtn.disabled = false
            newBtn.style.opacity = '1'
            
            if (result.success || result.output.includes('successfully') || result.output.trim() === '') {
              updateToast(t, 'success', title, `<b>Status:</b> 🟢 Conta renomeada para <b>${newName}</b><br>⚪ Reinicie o sistema para aplicar`)
              addToHistory(title, renameCmd, true)
            } else {
              updateToast(t, 'error', title, '<b>Status:</b> 🔴 Erro ao renomear<br>⚪ Execute como Administrador')
              addToHistory(title, renameCmd, false)
            }
          }
        )
        return
      }
      
      if (special === 'rename-pc') {
        showInputModal(
          'Renomear Computador',
          'Digite o novo nome para o computador. Será necessário reiniciar o sistema.',
          'Novo nome (ex: PC-ESCRITORIO)',
          async (newName) => {
            const renameCmd = `wmic computersystem where name="%computername%" call rename name="${newName}"`
            
            newBtn.disabled = true
            newBtn.style.opacity = '0.6'
            
            const t = toast('loading', title, 'Renomeando computador...')
            const result = await window.api.runCommand(renameCmd)
            
            newBtn.disabled = false
            newBtn.style.opacity = '1'
            
            if (result.success || result.output.includes('successfully') || result.output.includes('ReturnValue = 0')) {
              updateToast(t, 'warning', title, `<b>Status:</b> 🟡 Computador renomeado para <b>${newName}</b><br>🔴 <b>Reinicie o sistema</b> para aplicar`)
              addToHistory(title, renameCmd, true)
            } else {
              updateToast(t, 'error', title, '<b>Status:</b> 🔴 Erro ao renomear<br>⚪ Execute como Administrador')
              addToHistory(title, renameCmd, false)
            }
          }
        )
        return
      }
      
      if (special === 'custom-message') {
        showInputModal(
          'Mensagem Personalizada',
          'Digite a mensagem que deseja exibir na tela do usuário.',
          'Sua mensagem aqui...',
          async (message) => {
            const msgCmd = `msg * "${message}"`
            
            newBtn.disabled = true
            newBtn.style.opacity = '0.6'
            
            const t = toast('loading', title, 'Enviando mensagem...')
            const result = await window.api.runCommand(msgCmd)
            
            newBtn.disabled = false
            newBtn.style.opacity = '1'
            
            if (result.success || result.output.trim() === '') {
              updateToast(t, 'success', title, `<b>Status:</b> 🟢 Mensagem enviada<br><b>Conteúdo:</b> "${message}"`)
              addToHistory(title, msgCmd, true)
            } else {
              updateToast(t, 'error', title, '<b>Status:</b> 🔴 Erro ao enviar mensagem')
              addToHistory(title, msgCmd, false)
            }
          }
        )
        return
      }

      if (newBtn.tagName === 'BUTTON') newBtn.disabled = true
      newBtn.style.pointerEvents = 'none'
      newBtn.style.opacity = '0.6'

      const steps = getSteps(cmd)
      const t = toast('loading', title, steps[0])

      let i = 1
      const interval = steps.length > 1 ? setInterval(() => {
        if (i < steps.length) t.querySelector('.toast-msg').textContent = steps[i++]
      }, 2200) : null

      const result = await window.api.runCommand(cmd)
      if (interval) clearInterval(interval)

      newBtn.disabled = false
      newBtn.style.opacity = '1'

      if (result.success) {
        const parsed = parseOutput(cmd, result.output)
        updateToast(t, parsed.type, title, parsed.msg)
        addToHistory(title, cmd, true)
      } else {
        const parsed = parseOutput(cmd, result.output)
        const isGeneric = parsed.msg === '🟢 Operação concluída'
        updateToast(t, 'error', title, isGeneric ? '❌ Erro ao executar o comando.<br>Execute o aplicativo como <b>Administrador</b>.' : parsed.msg)
        addToHistory(title, cmd, false)
      }
    })
  })
  
  updateFavoriteButtons()
}

attachToolButtonListeners()
