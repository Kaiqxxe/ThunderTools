const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron')
const path = require('path')
const { exec, execFile, spawn, execSync } = require('child_process')
const os = require('os')
const fs = require('fs')
const si = require('systeminformation')
const https = require('https')

app.commandLine.appendSwitch('no-sandbox')

let currentProcess = null
let lastCpuStats = getSystemCpuInfo()
let mainWindow = null
let statsInterval = null
let isCancelling = false
const gotSingleInstanceLock = app.requestSingleInstanceLock()

// BLOCKED_LOCAL_USERS agora contém apenas contas que não devem ser listadas de forma alguma
const BLOCKED_LOCAL_USERS = [
  'Convidado',
  'Guest',
  'DefaultAccount',
  'WDAGUtilityAccount',
  'CodexSandboxOffline',
  'CodexSandboxOnline'
]



// ── Decodificador de terminal Windows (OEM CP850 / UTF-8 / Mojibake) ───────────
const CP850_TABLE = [
  '\u00C7', '\u00FC', '\u00E9', '\u00E2', '\u00E4', '\u00E0', '\u00E5', '\u00E7',
  '\u00EA', '\u00EB', '\u00E8', '\u00EF', '\u00EE', '\u00EC', '\u00C4', '\u00C5',
  '\u00C9', '\u00E6', '\u00C6', '\u00F4', '\u00F6', '\u00F2', '\u00FB', '\u00F9',
  '\u00FF', '\u00D6', '\u00DC', '\u00F8', '\u00A3', '\u00D8', '\u00D7', '\u0192',
  '\u00E1', '\u00ED', '\u00F3', '\u00FA', '\u00F1', '\u00D1', '\u00AA', '\u00BA',
  '\u00BF', '\u00AE', '\u00AC', '\u00BD', '\u00BC', '\u00A1', '\u00AB', '\u00BB',
  '\u2591', '\u2592', '\u2593', '\u2502', '\u2524', '\u00C1', '\u00C2', '\u00C0',
  '\u00A9', '\u2523', '\u2551', '\u2557', '\u255D', '\u00A2', '\u00A5', '\u2510',
  '\u2514', '\u2534', '\u252C', '\u251C', '\u2500', '\u253C', '\u00E3', '\u00C3',
  '\u255A', '\u2554', '\u2569', '\u2566', '\u2560', '\u2550', '\u256C', '\u00A4',
  '\u00F0', '\u00D0', '\u00CA', '\u00CB', '\u00C8', '\u0131', '\u00CD', '\u00CE',
  '\u00CF', '\u2518', '\u250C', '\u2588', '\u2584', '\u00A6', '\u00CC', '\u2580',
  '\u00D3', '\u00DF', '\u00D4', '\u00D2', '\u00F5', '\u00D5', '\u00B5', '\u00FE',
  '\u00DE', '\u00DA', '\u00DB', '\u00D9', '\u00FD', '\u00DD', '\u00AF', '\u00B4',
  '\u00AD', '\u00B1', '\u2017', '\u00BE', '\u00B6', '\u00A7', '\u00F7', '\u00B8',
  '\u00B0', '\u00A8', '\u00B7', '\u00B9', '\u00B3', '\u00B2', '\u25A0', '\u00A0'
];

const MOJIBAKE_REPLACEMENTS = [
  ['âšª', '⚪'], ['â”€', '─'], ['âœ”', '✔'], ['â Œ', '❌'], ['âš ', '⚠️'],
  ['DiagnÃstico', 'Diagnóstico'], ['diagnÃstico', 'diagnóstico'],
  ['EstatÃsticas', 'Estatísticas'], ['estatÃsticas', 'estatísticas'],
  ['Ã¡', 'á'], ['Ã ', 'à'], ['Ã£', 'ã'], ['Ã¢', 'â'], ['Ã¤', 'ä'],
  ['Ã©', 'é'], ['Ã¨', 'è'], ['Ãª', 'ê'], ['Ã«', 'ë'],
  ['Ã­', 'í'], ['Ã¬', 'ì'], ['Ã®', 'î'], ['Ã¯', 'ï'],
  ['Ã³', 'ó'], ['Ã²', 'ò'], ['Ãµ', 'õ'], ['Ã´', 'ô'], ['Ã¶', 'ö'],
  ['Ãº', 'ú'], ['Ã¹', 'ù'], ['Ã»', 'û'], ['Ã¼', 'ü'],
  ['Ã§', 'ç'], ['Ã±', 'ñ'],
  ['Ã ', 'Á'], ['Ã€', 'À'], ['Ãƒ', 'Ã'], ['Ã‚', 'Â'], ['Ã„', 'Ä'],
  ['Ã‰', 'É'], ['Ãˆ', 'È'], ['ÃŠ', 'Ê'], ['Ã‹', 'Ë'],
  ['Ã ', 'Í'], ['ÃŒ', 'Ì'], ['ÃŽ', 'Î'], ['Ã ', 'Ï'],
  ['Ã“', 'Ó'], ['Ã’', 'Ò'], ['Ã•', 'Õ'], ['Ã”', 'Ô'], ['Ã–', 'Ö'],
  ['Ãš', 'Ú'], ['Ã™', 'Ù'], ['Ã›', 'Û'], ['Ãœ', 'Ü'],
  ['Ã‡', 'Ç'], ['Ã‘', 'Ñ'],
  ['Â°', '°'], ['Âº', 'º'], ['Âª', 'ª'], ['Â§', '§'], ['Â±', '±']
];

function cleanMojibake(text) {
  if (!text || typeof text !== 'string') return text || '';
  let res = text;
  for (let i = 0; i < MOJIBAKE_REPLACEMENTS.length; i++) {
    const [broken, fixed] = MOJIBAKE_REPLACEMENTS[i];
    if (res.includes(broken)) {
      res = res.split(broken).join(fixed);
    }
  }
  return res;
}

function decodeCP850(buf) {
  let res = '';
  for (let i = 0; i < buf.length; i++) {
    const b = buf[i];
    if (b < 0x80) res += String.fromCharCode(b);
    else res += CP850_TABLE[b - 0x80];
  }
  return res;
}

function decodeTerminalOutput(bufferOrString) {
  if (!bufferOrString) return '';
  if (typeof bufferOrString === 'string') {
    return cleanMojibake(bufferOrString);
  }
  const buf = Buffer.isBuffer(bufferOrString) ? bufferOrString : Buffer.from(bufferOrString);
  if (buf.length === 0) return '';

  try {
    const utf8Str = new TextDecoder('utf-8', { fatal: true }).decode(buf);
    return cleanMojibake(utf8Str);
  } catch (_) {
    return cleanMojibake(decodeCP850(buf));
  }
}

function runPowerShellScript(script) {
  return new Promise((resolve) => {
    const normalizedScript = `
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
${script}
`
    const encoded = Buffer.from(normalizedScript, 'utf16le').toString('base64')
    execFile(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded],
      { encoding: 'buffer', windowsHide: true },
      (error, stdoutBuf, stderrBuf) => {
        const outText = decodeTerminalOutput(stdoutBuf);
        const errText = decodeTerminalOutput(stderrBuf);
        if (error) {
          resolve({ success: false, output: (errText || outText || error.message).replace(/^\ufeff/, '').replace(/\0/g, '').trim() })
          return
        }

        resolve({ success: true, output: outText.replace(/^\ufeff/, '').replace(/\0/g, '').trim() })
      }
    )
  })
}


function escapePowerShellSingleQuoted(value) {
  return String(value).replace(/'/g, "''")
}

function writeAppLog(message) {
  try {
    const logDir = path.join(app.getPath('userData'), 'logs')
    fs.mkdirSync(logDir, { recursive: true })
    fs.appendFileSync(path.join(logDir, 'main.log'), `[${new Date().toISOString()}] ${message}\n`)
  } catch {
    // Logging must never crash the app.
  }
}

function showStartupError(title, details) {
  if (!mainWindow || mainWindow.isDestroyed()) return

  const safeTitle = String(title || 'Erro ao iniciar').replace(/[<>&"]/g, char => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    '"': '&quot;'
  }[char]))
  const safeDetails = String(details || '').replace(/[<>&"]/g, char => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    '"': '&quot;'
  }[char]))

  mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8">
        <title>ThunderTools</title>
        <style>
          body {
            margin: 0;
            min-height: 100vh;
            display: grid;
            place-items: center;
            background: #111827;
            color: #e5e7eb;
            font-family: Poppins, Raleway, sans-serif;
          }
          main {
            width: min(720px, calc(100vw - 48px));
            background: #1f2937;
            border: 1px solid #374151;
            border-radius: 10px;
            padding: 24px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35);
          }
          h1 {
            margin: 0 0 10px;
            font-size: 20px;
            color: #fca5a5;
          }
          p {
            margin: 0 0 14px;
            line-height: 1.5;
            color: #d1d5db;
          }
          code {
            display: block;
            white-space: pre-wrap;
            overflow-wrap: anywhere;
            background: #111827;
            border: 1px solid #374151;
            border-radius: 8px;
            padding: 14px;
            color: #f3f4f6;
          }
        </style>
      </head>
      <body>
        <main>
          <h1>${safeTitle}</h1>
          <p>O ThunderTools não conseguiu carregar a interface. O detalhe abaixo também foi salvo no log do aplicativo.</p>
          <code>${safeDetails}</code>
        </main>
      </body>
    </html>
  `)}`).catch((error) => {
    writeAppLog(`Failed to show startup error page: ${error.stack || error.message}`)
  })

  if (!mainWindow.isVisible()) {
    mainWindow.show()
  }
}

function getSystemCpuInfo() {
  const cpus = os.cpus()
  let idle = 0
  let total = 0
  cpus.forEach(cpu => {
    for (let type in cpu.times) {
      total += cpu.times[type]
    }
    idle += cpu.times.idle
  })
  return { idle, total }
}

function createWindow() {
  writeAppLog('Creating main window')
  
  // 1. Configuração inicial da janela
  mainWindow = new BrowserWindow({
    width: 1200, 
    height: 800,
    resizable: true,
    show: false, 
    title: 'ThunderTools',
    icon: path.join(__dirname, 'icon.ico'),
    backgroundColor: '#0a0a0a', 
    
    // === AQUI ESTÁ O SEGREDO QUE FALTAVA ===
    titleBarStyle: 'hidden', // Diz ao Electron para esconder a barra cinza padrão do Windows
    
    titleBarOverlay: {
      color: '#1a1a2e',         // Mesma cor usada no topo do seu CSS (--header-bg)
      symbolColor: '#747d8c',   // Cor dos botões (X, Minimizar, Maximizar)
      height: 34                // Altura ideal para alinhar com seus botões
    },
    // ======================================
    
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true
    }
  })

  // 2. Comandos de tela cheia
  mainWindow.maximize(); 

  mainWindow.setMenuBarVisibility(false)
  
  mainWindow.once('ready-to-show', () => {
    writeAppLog('Main window ready to show')
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show()
    }
  })
  
  
  mainWindow.on('close', () => {
    writeAppLog('Main window close requested')
  })
  mainWindow.on('closed', () => {
    writeAppLog('Main window closed')
    mainWindow = null
    if (statsInterval) {
      clearInterval(statsInterval)
      statsInterval = null
    }
  })
  mainWindow.webContents.on('render-process-gone', (_, details) => {
    writeAppLog(`Renderer process gone: ${JSON.stringify(details)}`)
    showStartupError('A interface parou de responder', JSON.stringify(details, null, 2))
  })
  mainWindow.webContents.on('preload-error', (_, preloadPath, error) => {
    writeAppLog(`Preload failed ${preloadPath}: ${error.stack || error.message}`)
    showStartupError('Falha ao carregar o preload', error.stack || error.message)
  })
  mainWindow.webContents.on('console-message', (_, level, message, line, sourceId) => {
    writeAppLog(`Renderer console[${level}] ${sourceId}:${line} ${message}`)
  })
  mainWindow.webContents.on('did-fail-load', (_, errorCode, errorDescription, validatedURL) => {
    writeAppLog(`Failed to load ${validatedURL}: ${errorCode} ${errorDescription}`)
    if (validatedURL.startsWith('file:')) {
      showStartupError('Falha ao carregar a interface', `${errorCode} ${errorDescription}`)
    }
  })
  mainWindow.webContents.on('did-finish-load', () => {
    writeAppLog('Renderer finished loading index.html')
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      mainWindow.show()
    }
  })
  mainWindow.loadFile(path.join(__dirname, 'index.html')).catch((error) => {
    writeAppLog(`loadFile failed: ${error.stack || error.message}`)
  })
  
  // Cache de temperatura CPU — atualizado a cada 8s via si (sem spawn PowerShell)
  let lastCpuTemp = null;
  const refreshTemp = async () => {
    try {
      const t = await si.cpuTemperature();
      const val = t.main || t.max || (Array.isArray(t.cores) && t.cores[0]) || null;
      if (val && val > 0 && val < 130) lastCpuTemp = Math.round(val);
    } catch (_) { /* sem temperatura disponivel */ }
  };
  refreshTemp();
  const tempPollInterval = setInterval(refreshTemp, 8000);

  // Envia stats a cada 2s (CPU/RAM via os nativo — rápido; temp via cache si)
  statsInterval = setInterval(async () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;

    // 1. CPU: Adicionamos um pequeno filtro de suavização para evitar "pulos" visuais
    const currentCpuStats = getSystemCpuInfo();
    const idleDiff  = currentCpuStats.idle  - lastCpuStats.idle;
    const totalDiff = currentCpuStats.total - lastCpuStats.total;
    
    // Cálculo seguro
    let cpuUsage = 0;
    if (totalDiff > 0) {
        cpuUsage = Math.round(100 * (1 - (idleDiff / totalDiff)));
    }
    lastCpuStats = currentCpuStats;

    // 2. RAM: Opcional - Se quiser um valor mais "realista" como o Gerenciador de Tarefas
    // O os.freemem() é exato, mas o uso real é (Total - Livre - Cache)
    const totalMem = os.totalmem();
    const freeMem  = os.freemem();
    // Valor bruto é bom para diagnóstico de hardware
    const ramUsage = Math.round(((totalMem - freeMem) / totalMem) * 100);

    if (!mainWindow || mainWindow.isDestroyed()) return;

    mainWindow.webContents.send('system-stats', {
      cpu:  Math.max(0, Math.min(100, cpuUsage)),
      ram:  ramUsage,
      temp: lastCpuTemp
    });
  }, 2000);

  mainWindow.once('closed', () => clearInterval(tempPollInterval));
}

process.on('uncaughtException', (error) => {
  writeAppLog(`Uncaught exception: ${error.stack || error.message}`)
})

process.on('unhandledRejection', (reason) => {
  writeAppLog(`Unhandled rejection: ${reason?.stack || reason}`)
})

function checkAdminPrivileges() {
  if (process.platform === 'win32') {
    try {
      execSync('net session', { stdio: 'ignore' })
      return true
    } catch (e) {
      return false
    }
  }
  return true
}

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  })

  app.whenReady().then(() => {
    writeAppLog(`App ready. Packaged: ${app.isPackaged}. App path: ${app.getAppPath()}`)
    const hasAdmin = checkAdminPrivileges()
    if (!hasAdmin) {
      writeAppLog('App running without administrator privileges')
      dialog.showMessageBoxSync({
        type: 'warning',
        title: 'Aviso de Privilégios',
        message: 'O ThunderTools foi iniciado sem privilégios de Administrador.',
        detail: 'Algumas funções de manutenção do sistema e otimização de disco podem não funcionar corretamente. Recomenda-se fechar e iniciar o aplicativo como Administrador.',
        buttons: ['Continuar mesmo assim']
      })
    }
    createWindow()
  }).catch((error) => {
    writeAppLog(`App startup failed: ${error.stack || error.message}`)
  })
}
app.on('window-all-closed', () => {
  writeAppLog('All windows closed, quitting app')
  app.quit()
})
app.on('before-quit', () => {
  writeAppLog('App before-quit')
})
app.on('will-quit', () => {
  writeAppLog('App will-quit')
})

function extractCommandProgress(chunk) {
  const text = String(chunk || '').replace(/\0/g, '').replace(/\ufeff/g, '')
  const percentMatches = [...text.matchAll(/(\d{1,3})(?:[,.]\d+)?\s*%/g)]
    .map(match => Number(match[1]))
    .filter(value => Number.isFinite(value) && value >= 0 && value <= 100)
  const percent = percentMatches.length ? percentMatches[percentMatches.length - 1] : null
  const lines = text.replace(/\r/g, '\n').split('\n').map(line => line.trim()).filter(Boolean)
  let message = lines.length ? lines[lines.length - 1] : ''

  // Limpeza de ruído visual do terminal (barras de progresso e porcentagens redundantes)
  // Filtra linhas que contenham sequências de caracteres de barra [===] ou apenas números/porcentagem
  if (message.match(/[\[\]#=>-]{5,}/) || message.match(/^[\d.,\s%]+$/)) {
    message = '' 
  }

  return { percent, message, chunk: text }
}

function sendCommandProgress(trackingId, payload) {
  if (!trackingId || !mainWindow || mainWindow.isDestroyed()) return
  mainWindow.webContents.send('command-progress', { id: trackingId, ...payload })
}

// Function to handle running commands
ipcMain.handle('run-command', async (_, command, trackingId = null) => {
  // Tratamento especial para comandos que abrem configurações ou URLs externas
  if (command.startsWith('start ms-settings:')) {
    const url = command.replace('start ', '').trim()
    try {
      await shell.openExternal(url)
      return { success: true, output: `Configurações abertas: ${url}` }
    } catch (e) {
      return { success: false, output: `Erro ao abrir configurações: ${e.message}` }
    }
  }

  // Abre a janela nativa de Informações do Sistema do Windows sem passar pelo cmd
  if (/^start\s+msinfo32(\.exe)?$/i.test(command.trim())) {
    const systemRoot = process.env.SystemRoot || 'C:\\Windows'
    const systemDir = (process.arch === 'ia32' && process.env.PROCESSOR_ARCHITEW6432) ? 'Sysnative' : 'System32'
    const msinfoPath = path.join(systemRoot, systemDir, 'msinfo32.exe')
    return new Promise((resolve) => {
      try {
        const child = spawn(msinfoPath, [], {
          detached: true,
          stdio: 'ignore'
        })
        child.once('spawn', () => {
          child.unref()
          resolve({ success: true, output: 'Informações do Sistema abertas' })
        })
        child.once('error', (e) => {
          writeAppLog(`Erro ao abrir msinfo32.exe: ${e.message}`)
          resolve({ success: false, output: `Erro ao abrir Informações do Sistema: ${e.message}` })
        })
      } catch (e) {
        resolve({ success: false, output: `Erro ao abrir Informações do Sistema: ${e.message}` })
      }
    })
  }

  // Abre a janela nativa do Diagnóstico de Memória do Windows (mdsched.exe)
  if (/^start\s+mdsched(\.exe)?$/i.test(command.trim())) {
    const systemRoot = process.env.SystemRoot || 'C:\\Windows'
    const systemDir = (process.arch === 'ia32' && process.env.PROCESSOR_ARCHITEW6432) ? 'Sysnative' : 'System32'
    const mdschedPath = path.join(systemRoot, systemDir, 'MdSched.exe')
    return new Promise((resolve) => {
      try {
        const child = spawn(mdschedPath, [], { detached: true, stdio: 'ignore' })
        child.once('spawn', () => {
          child.unref()
          resolve({ success: true, output: 'Diagnóstico de Memória do Windows aberto' })
        })
        child.once('error', (e) => {
          writeAppLog(`Erro ao abrir mdsched.exe: ${e.message}`)
          resolve({ success: false, output: `Erro ao abrir o Diagnóstico de Memória: ${e.message}` })
        })
      } catch (e) {
        resolve({ success: false, output: `Erro ao abrir o Diagnóstico de Memória: ${e.message}` })
      }
    })
  }

  // Abre a janela nativa de Remoção de Drivers de Impressora (Propriedades do Servidor de Impressão)
  if (/^(start\s+)?printui(\.exe)?\s+\/s\s+\/t2/i.test(command.trim())) {
    const systemRoot = process.env.SystemRoot || 'C:\\Windows'
    const systemDir = (process.arch === 'ia32' && process.env.PROCESSOR_ARCHITEW6432) ? 'Sysnative' : 'System32'
    const printuiPath = path.join(systemRoot, systemDir, 'printui.exe')
    return new Promise((resolve) => {
      try {
        const child = spawn(printuiPath, ['/s', '/t2'], { detached: true, stdio: 'ignore' })
        child.once('spawn', () => {
          child.unref()
          resolve({ success: true, output: 'Gerenciador nativo de drivers de impressora aberto' })
        })
        child.once('error', (e) => {
          writeAppLog(`Erro ao abrir printui.exe: ${e.message}`)
          resolve({ success: false, output: `Erro ao abrir o gerenciador de drivers: ${e.message}` })
        })
      } catch (e) {
        resolve({ success: false, output: `Erro ao abrir o gerenciador de drivers: ${e.message}` })
      }
    })
  }

  // Garante acesso aos binários 64-bit se o app for 32-bit (Sysnative)
  let cmdToRun = command
  if (process.arch === 'ia32' && process.env.PROCESSOR_ARCHITEW6432) {
    cmdToRun = command.replace(/\b(sfc|dism|chkdsk)\b/gi, 'C:\\Windows\\Sysnative\\$1.exe')
  }

  // Automatiza resposta para o CHKDSK se ele solicitar agendamento
  if (cmdToRun.toLowerCase().includes('chkdsk')) {
    cmdToRun = `echo S | ${cmdToRun}`
  }

  // Special handling for 'net user' command to ensure correct encoding.
  // Running cmd.exe /c "net user" inside PowerShell to capture its output reliably in UTF-8.
  // This helps prevent character encoding issues (e.g., "usuário" appearing as "usurio").
  if (cmdToRun.toLowerCase().startsWith('net user')) {
    const psScript = `
      # Se for apenas o comando de listagem geral, usamos PowerShell nativo para evitar erros de encoding e cabeçalho
      $trimmedCmd = "${cmdToRun.trim().toLowerCase()}"
      if ($trimmedCmd -eq "net user") {
          Get-LocalUser | Select-Object -ExpandProperty Name | Out-String
      } else {
          # Forçamos a página de código 65001 (UTF-8) dentro da subchamada do CMD
          cmd.exe /c "chcp 65001 > nul && ${cmdToRun.replace(/"/g, '`"')}" | Out-String
      }
    `
    const psResult = await runPowerShellScript(psScript)
    if (psResult.success) {
      const cleanedOutput = psResult.output.replace(/^\ufeff/, '').replace(/\0/g, '').trim()
      return { success: true, output: cleanedOutput }
    } else {
      return { success: false, output: psResult.output }
    }
  }

  return new Promise((resolve) => {
    isCancelling = false
    let stdoutBuffer = ''
    let stderrBuffer = ''
    // Buffer binário com decodificação inteligente de caracteres Windows (CP850 / UTF-8)
    currentProcess = exec(`chcp 65001 > nul && ${cmdToRun}`, { shell: 'cmd.exe', encoding: 'buffer', maxBuffer: 1024 * 1024 * 10 }, (error, stdoutBuf, stderrBuf) => {
      const cancelled = isCancelling || (error && error.killed)
      isCancelling = false
      currentProcess = null
      sendCommandProgress(trackingId, { done: true, percent: cancelled || error ? null : 100 })
      const outText = decodeTerminalOutput(stdoutBuf || stdoutBuffer)
      const errText = decodeTerminalOutput(stderrBuf || stderrBuffer)
      if (cancelled) resolve({ success: false, output: outText || 'Operação cancelada pelo usuário.', cancelled: true, rawOutput: outText })
      else if (error) resolve({ success: false, output: errText || outText || error.message })
      else resolve({ success: true, output: outText.replace(/^\ufeff/, '').replace(/\0/g, '') })
    })

    currentProcess.stdout?.on('data', chunk => {
      const textChunk = decodeTerminalOutput(chunk)
      stdoutBuffer += textChunk
      const progress = extractCommandProgress(textChunk)
      sendCommandProgress(trackingId, {
        percent: progress.percent,
        message: progress.message,
        chunk: textChunk,
        stream: 'stdout'
      })
    })

    currentProcess.stderr?.on('data', chunk => {
      const textChunk = decodeTerminalOutput(chunk)
      stderrBuffer += textChunk
      const progress = extractCommandProgress(textChunk)
      sendCommandProgress(trackingId, {
        percent: progress.percent,
        message: progress.message,
        chunk: textChunk,
        stream: 'stderr'
      })
    })
  })
})

ipcMain.handle('list-deletable-users', async () => {
  const systemBlockedUsers = BLOCKED_LOCAL_USERS.map(user => `'${escapePowerShellSingleQuoted(user)}'`).join(',')
  const script = `
$ErrorActionPreference = 'Stop'
$currentUser = [Environment]::UserName
$systemBlockedUsers = @(${systemBlockedUsers})
$adminAccounts = @('Administrador', 'Administrator')

$allLocalUsers = Get-LocalUser |
  Where-Object {
    $systemBlockedUsers -notcontains $_.Name -and
    $_.Name -notmatch '^\\$' -and
    $_.Name -notmatch '^SUPPORT_'
  } |
  Select-Object @{Name='name';Expression={$_.Name}},
                @{Name='fullName';Expression={$_.FullName}},
                @{Name='description';Expression={$_.Description}},
                @{Name='enabled';Expression={$_.Enabled}},
                @{Name='isDeletable';Expression={
                    $_.Enabled -eq $true -and $_.Name -ne $currentUser -and $adminAccounts -notcontains $_.Name
                }}

[pscustomobject]@{
  currentUser = $currentUser
  users = @($allLocalUsers)
} | ConvertTo-Json -Depth 4 -Compress
`

  const result = await runPowerShellScript(script)
  if (!result.success) return { success: false, output: result.output, users: [], currentUser: '' }

  try {
    const data = JSON.parse(result.output.trim() || '{}')
    const users = Array.isArray(data.users) ? data.users : (data.users ? [data.users] : [])
    return {
      success: true,
      currentUser: data.currentUser || '',
      users
    }
  } catch (error) {
    return { success: false, output: `Erro ao interpretar usuarios: ${error.message}`, users: [], currentUser: '' }
  }
})


ipcMain.handle('get-blocked-local-users', () => {
  return BLOCKED_LOCAL_USERS
})

ipcMain.handle('delete-local-user', async (_, userName) => {
  const target = String(userName || '').trim()
  const systemBlockedUsersString = BLOCKED_LOCAL_USERS.map(user => `'${escapePowerShellSingleQuoted(user)}'`).join(',')
  const script = `
$ErrorActionPreference = 'Stop'
$target = '${escapePowerShellSingleQuoted(target)}'
$currentUser = [Environment]::UserName
$systemBlockedUsers = @(${systemBlockedUsersString})
$adminAccounts = @('Administrador', 'Administrator')

if ([string]::IsNullOrWhiteSpace($target)) {
  throw 'Nenhum usuario foi selecionado.'
}

if ($systemBlockedUsers -contains $target) {
  throw "O usuario $target e protegido e nao pode ser excluido."
}

if ($target -ieq $currentUser) {
  throw 'Nao e permitido excluir o usuario em uso no momento.'
}

if ($adminAccounts -contains $target) {
  throw "A conta de administrador padrao ($target) e protegida e nao pode ser excluida."
}

$user = Get-LocalUser -Name $target
if (-not $user.Enabled) {
  throw "O usuario $target nao esta ativo."
}

Remove-LocalUser -Name $target
[pscustomobject]@{
  deleted = $true
  user = $target
} | ConvertTo-Json -Compress
`

  const result = await runPowerShellScript(script)
  if (!result.success) return { success: false, output: result.output }

  return { success: true, output: result.output, user: target }
})

// Unificação da lógica de cancelamento
ipcMain.on('cancel-command', () => {
  isCancelling = true
  if (currentProcess) {
    exec(`taskkill /pid ${currentProcess.pid} /T /F`)
  }
})




// ─── Speed Test & Diagnóstico Avançado de Rede ──────────────────────────────
let activeSpeedTestReq = null;
let isSpeedTestCancelled = false;

function parseOutputPing(text) {
  const clean = decodeTerminalOutput(text || '');
  const avgM = clean.match(/(?:M[eé\u00e9\u00c9]dia|Average)\s*=\s*(\d+)ms/i);
  const lossM = clean.match(/\((\d+)%\s*(?:de perda|loss)\)/i);
  const replies = [...clean.matchAll(/(?:tempo|time)[<=](\d+)ms/gi)].map(m => parseInt(m[1], 10));

  let jitter = null;
  if (replies.length > 1) {
    let diff = 0;
    for (let i = 1; i < replies.length; i++) diff += Math.abs(replies[i] - replies[i - 1]);
    jitter = Math.round((diff / (replies.length - 1)) * 10) / 10;
  }

  return {
    avg: avgM ? parseInt(avgM[1], 10) : (replies.length ? Math.round(replies.reduce((a, b) => a + b, 0) / replies.length) : null),
    lossPercent: lossM ? parseInt(lossM[1], 10) : 0,
    jitter
  };
}

ipcMain.handle('save-text-file', async (_, options = {}) => {
  const { defaultFileName = 'informacoes-de-rede.txt', content = '', title = 'Exportar Informações de Rede' } = options;
  try {
    const parentWin = mainWindow && !mainWindow.isDestroyed() ? mainWindow : null;
    const { canceled, filePath } = await dialog.showSaveDialog(parentWin, {
      title,
      defaultPath: defaultFileName,
      filters: [
        { name: 'Arquivos de Texto (*.txt)', extensions: ['txt'] },
        { name: 'Todos os Arquivos (*.*)', extensions: ['*'] }
      ]
    });
    if (canceled || !filePath) {
      return { success: false, cancelled: true };
    }
    await fs.promises.writeFile(filePath, content, 'utf8');
    return { success: true, filePath };
  } catch (err) {
    writeAppLog(`Erro ao salvar arquivo de texto: ${err.message}`);
    return { success: false, error: err.message };
  }
});

ipcMain.on('cancel-speed-test', () => {
  isSpeedTestCancelled = true;
  if (activeSpeedTestReq) {
    try {
      activeSpeedTestReq.destroy();
    } catch (_) {}
    activeSpeedTestReq = null;
  }
});

ipcMain.handle('run-speed-test', async () => {
  isSpeedTestCancelled = false;
  activeSpeedTestReq = null;

  const sendProgress = (payload) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.webContents.send('speed-test-progress', payload);
  };

  try {
    sendProgress({ phase: 'init', statusText: 'Identificando placas de rede e roteador...' });

    // 1. Informações de Adaptador e Gateway
    const [ifaces, defaultGw] = await Promise.all([
      si.networkInterfaces().catch(() => []),
      si.networkGatewayDefault().catch(() => null)
    ]);

    const activeIface = ifaces.find(i => i.ip4 && i.ip4 !== '127.0.0.1' && i.operstate === 'up')
      || ifaces.find(i => i.ip4 && i.ip4 !== '127.0.0.1')
      || ifaces[0]
      || {};

    const isWireless = activeIface.type === 'wireless' || /wi-fi|wireless|wlan/i.test(activeIface.iface || '');
    let wifiDetails = null;

    if (isWireless) {
      try {
        const wlanText = await new Promise(r => exec('netsh wlan show interfaces', { windowsHide: true }, (_, out) => r(out || '')));
        const cleanWlan = decodeTerminalOutput(wlanText);
        const ssidMatch = cleanWlan.match(/SSID\s*:\s*([^\r\n]+)/i);
        const signalMatch = cleanWlan.match(/(?:Sinal|Signal)\s*:\s*(\d+)%/i);
        const bandMatch = cleanWlan.match(/(?:Banda|Band)\s*:\s*([^\r\n]+)/i);
        const channelMatch = cleanWlan.match(/(?:Canal|Channel)\s*:\s*(\d+)/i);
        const rxRateMatch = cleanWlan.match(/(?:Taxa de recepção|Receive rate)[^:]*:\s*([\d\.]+)/i);

        wifiDetails = {
          ssid: ssidMatch ? ssidMatch[1].trim() : 'Rede Sem Fio',
          signal: signalMatch ? parseInt(signalMatch[1], 10) : null,
          band: bandMatch ? bandMatch[1].trim() : '2.4 GHz',
          channel: channelMatch ? channelMatch[1].trim() : null,
          rate: rxRateMatch ? parseFloat(rxRateMatch[1]) : (activeIface.speed || null)
        };
      } catch (_) {}
    }

    const networkInfo = {
      adapterName: activeIface.iface || 'Adaptador de Rede',
      adapterDesc: activeIface.ifaceName || activeIface.iface || 'Placa de Rede',
      type: isWireless ? 'Wi-Fi' : 'Cabo Ethernet',
      isWireless,
      ip4: activeIface.ip4 || 'Desconhecido',
      gateway: defaultGw || '192.168.1.1',
      speed: activeIface.speed || (wifiDetails ? wifiDetails.rate : null),
      mac: activeIface.mac || '',
      wifi: wifiDetails
    };

    sendProgress({ phase: 'info_done', networkInfo, statusText: 'Testando conexão com o roteador local (Gateway)...' });

    if (isSpeedTestCancelled) return { cancelled: true };

    sendProgress({ phase: 'info_done', networkInfo, statusText: 'Medindo latência do roteador e da internet em tempo real...' });

    if (isSpeedTestCancelled) return { cancelled: true };

    // 2 & 3. Latência do Gateway e Internet em Paralelo (Otimizado: ~1.2s total)
    let gatewayLatency = null;
    let gatewayJitter = null;
    let gatewayPacketLoss = 0;
    let internetLatency = null;
    let internetJitter = null;
    let internetPacketLoss = 0;

    const pingGwPromise = (networkInfo.gateway && networkInfo.gateway !== 'Desconhecido')
      ? new Promise(r => exec(`ping -n 2 -w 1000 ${networkInfo.gateway}`, { windowsHide: true }, (_, out) => r(out || '')))
      : Promise.resolve('');

    const pingInetPromise = new Promise(r => exec('ping -n 2 -w 1000 1.1.1.1', { windowsHide: true }, (_, out) => r(out || '')));

    const [gwPingOut, inetPingOut] = await Promise.all([pingGwPromise, pingInetPromise]);

    if (gwPingOut) {
      const parsedGw = parseOutputPing(gwPingOut);
      gatewayLatency = parsedGw.avgLatency;
      gatewayJitter = parsedGw.jitter;
      gatewayPacketLoss = parsedGw.lossPercent;
    }

    if (inetPingOut) {
      const parsedInet = parseOutputPing(inetPingOut);
      internetLatency = parsedInet.avgLatency;
      internetJitter = parsedInet.jitter;
      internetPacketLoss = parsedInet.lossPercent;
    }

    sendProgress({
      phase: 'latency_done',
      gatewayLatency,
      gatewayPacketLoss,
      internetLatency,
      internetJitter,
      internetPacketLoss,
      statusText: 'Iniciando teste de velocidade de download...'
    });

    if (isSpeedTestCancelled) return { cancelled: true };

    // 4. Download Speed Test com streaming em tempo real (Cloudflare CDN / Fallbacks)
    const downloadEndpoints = [
      {
        url: 'https://speed.cloudflare.com/__down?bytes=25000000',
        size: 25000000,
        label: 'Cloudflare CDN'
      },
      {
        url: 'https://speed.cloudflare.com/__down?bytes=10000000',
        size: 10000000,
        label: 'Cloudflare CDN (10MB)'
      },
      {
        url: 'https://proof.ovh.net/files/10Mb.dat',
        size: 10485760,
        label: 'OVH Telecom CDN'
      }
    ];

    let downloadResult = null;
    let lastDownloadError = null;

    for (const ep of downloadEndpoints) {
      if (isSpeedTestCancelled) return { cancelled: true };
      try {
        const testBytes = ep.size;
        const startTime = Date.now();
        let loadedBytes = 0;
        let peakMbps = 0;
        let lastProgressTime = 0;

        await new Promise((resolve, reject) => {
          const req = https.get(ep.url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
              'Accept': '*/*'
            },
            timeout: 15000
          }, (res) => {
            if (res.statusCode && res.statusCode >= 400) {
              res.resume();
              reject(new Error(`Servidor ${ep.label} retornou HTTP ${res.statusCode}`));
              return;
            }

            res.on('data', chunk => {
              if (isSpeedTestCancelled) {
                req.destroy();
                resolve();
                return;
              }

              loadedBytes += chunk.length;
              const now = Date.now();
              const elapsedSec = (now - startTime) / 1000;

              if (elapsedSec > 0.08) {
                const currentMbps = (loadedBytes * 8 / (1024 * 1024)) / elapsedSec;
                if (currentMbps > peakMbps) peakMbps = currentMbps;

                if (now - lastProgressTime > 80) {
                  lastProgressTime = now;
                  const percent = Math.min(100, Math.round((loadedBytes / testBytes) * 100));
                  sendProgress({
                    phase: 'download_progress',
                    currentMbps: Math.round(currentMbps * 10) / 10,
                    peakMbps: Math.round(peakMbps * 10) / 10,
                    percent,
                    loadedBytes,
                    testBytes,
                    statusText: `Baixando dados de teste: ${(loadedBytes / (1024 * 1024)).toFixed(1)} MB (${Math.round(currentMbps * 10) / 10} Mbps)...`
                  });
                }
              }
            });

            res.on('end', resolve);
          });

          activeSpeedTestReq = req;

          req.on('error', err => {
            if (isSpeedTestCancelled) resolve();
            else reject(err);
          });

          req.on('timeout', () => {
            req.destroy();
            reject(new Error(`Tempo limite esgotado em ${ep.label}`));
          });
        });

        activeSpeedTestReq = null;
        if (isSpeedTestCancelled) return { cancelled: true };

        if (loadedBytes > 100000) {
          const totalDurationSec = Math.max(0.1, (Date.now() - startTime) / 1000);
          const avgDownloadMbps = Math.round(((loadedBytes * 8 / (1024 * 1024)) / totalDurationSec) * 10) / 10;
          downloadResult = {
            avgDownloadMbps,
            peakMbps: Math.round(peakMbps * 10) / 10,
            loadedBytes,
            testBytes
          };
          break;
        }
      } catch (err) {
        lastDownloadError = err;
      }
    }

    if (isSpeedTestCancelled) return { cancelled: true };

    if (!downloadResult) {
      throw lastDownloadError || new Error('Não foi possível conectar aos servidores de teste de download.');
    }

    const avgDownloadMbps = downloadResult.avgDownloadMbps;
    const peakMbps = downloadResult.peakMbps;

    // 5. Upload Speed Test (Cloudflare /__up POST 5MB - Ultra rápido ~1.5s)
    let avgUploadMbps = null;
    let peakUploadMbps = null;

    if (!isSpeedTestCancelled) {
      sendProgress({
        phase: 'upload_start',
        statusText: 'Iniciando teste de velocidade de upload...'
      });

      try {
        const uploadBytes = 5000000; // 5 MB
        const chunkBuf = Buffer.alloc(1024 * 64, 0); // 64 KB chunks
        let uploadedBytes = 0;
        let peakUp = 0;
        let lastUpProgress = 0;
        const uploadStart = Date.now();

        await new Promise((resolve, reject) => {
          const req = https.request('https://speed.cloudflare.com/__up', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/octet-stream',
              'Content-Length': uploadBytes,
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
            },
            timeout: 10000
          }, res => {
            res.on('data', () => {});
            res.on('end', () => {
              const durSec = Math.max(0.1, (Date.now() - uploadStart) / 1000);
              avgUploadMbps = Math.round(((uploadedBytes * 8 / (1024 * 1024)) / durSec) * 10) / 10;
              peakUploadMbps = Math.round(peakUp * 10) / 10;
              resolve();
            });
          });

          activeSpeedTestReq = req;

          req.on('error', err => {
            if (isSpeedTestCancelled) resolve();
            else reject(err);
          });

          req.on('timeout', () => {
            req.destroy();
            resolve();
          });

          function pump() {
            while (uploadedBytes < uploadBytes) {
              if (isSpeedTestCancelled) {
                req.destroy();
                resolve();
                return;
              }
              const toWrite = Math.min(chunkBuf.length, uploadBytes - uploadedBytes);
              uploadedBytes += toWrite;

              const now = Date.now();
              const elSec = (now - uploadStart) / 1000;
              if (elSec > 0.08) {
                const curUp = (uploadedBytes * 8 / (1024 * 1024)) / elSec;
                if (curUp > peakUp) peakUp = curUp;

                if (now - lastUpProgress > 80) {
                  lastUpProgress = now;
                  const pct = Math.min(100, Math.round((uploadedBytes / uploadBytes) * 100));
                  sendProgress({
                    phase: 'upload_progress',
                    currentMbps: Math.round(curUp * 10) / 10,
                    peakMbps: Math.round(peakUp * 10) / 10,
                    percent: pct,
                    uploadedBytes,
                    uploadBytes,
                    statusText: `Enviando dados de upload: ${(uploadedBytes / (1024 * 1024)).toFixed(1)} MB (${Math.round(curUp * 10) / 10} Mbps)...`
                  });
                }
              }

              const ok = req.write(chunkBuf.subarray(0, toWrite));
              if (!ok && uploadedBytes < uploadBytes) {
                req.once('drain', pump);
                return;
              }
            }
            req.end();
          }

          pump();
        });

        activeSpeedTestReq = null;
      } catch (err) {
        console.warn('Upload test non-fatal error:', err.message);
      }
    }

    if (isSpeedTestCancelled) return { cancelled: true };

    // 6. Diagnóstico Inteligente & Dicas para Conexões Lentas
    const tips = [];
    let quality = 'excellent';

    if (internetPacketLoss > 15) {
      quality = 'bad';
      tips.push({
        type: 'danger',
        icon: 'alert-triangle',
        title: `Alta Perda de Pacotes (${internetPacketLoss}%)`,
        text: 'A conexão está sofrendo perda de pacotes na internet, causando travamentos em jogos, chamadas de vídeo e lentidão para abrir páginas.',
        tip: 'Reinicie o modem/roteador da operadora desligando-o da tomada por 30 segundos. Se persistir, contate seu provedor de internet.'
      });
    }

    if (gatewayLatency !== null && gatewayLatency > 12) {
      if (quality !== 'bad') quality = 'warning';
      tips.push({
        type: 'warning',
        icon: 'home',
        title: `Latência Alta até o Roteador (${gatewayLatency} ms)`,
        text: 'O atraso está ocorrendo dentro da sua rede local (entre o computador e o roteador), e não na operadora de internet.',
        tip: isWireless 
          ? 'O sinal Wi-Fi está sofrendo interferência ou o computador está distante do roteador. Conecte-se via cabo Ethernet ou aproxime-se do roteador.'
          : 'Verifique o cabo de rede ou se há outro dispositivo saturando o roteador local.'
      });
    }

    if (isWireless && wifiDetails) {
      if (wifiDetails.signal !== null && wifiDetails.signal < 60) {
        if (quality !== 'bad') quality = 'warning';
        tips.push({
          type: 'warning',
          icon: 'wifi-off',
          title: `Sinal Wi-Fi Fraco (${wifiDetails.signal}%)`,
          text: `A intensidade do sinal está baixa para a rede "${wifiDetails.ssid}". Isso reduz drasticamente a velocidade máxima da conexão.`,
          tip: 'Aproxime seu dispositivo do roteador, evite obstáculos físicos ou instale um repetidor/roteador Mesh.'
        });
      }

      if (wifiDetails.band && wifiDetails.band.includes('2.4') && (networkInfo.speed || 0) <= 72) {
        tips.push({
          type: 'info',
          icon: 'radio',
          title: 'Conectado em Wi-Fi 2.4 GHz',
          text: `Sua placa está operando na frequência de 2.4 GHz (link de ${networkInfo.speed || 72} Mbps), que é mais lenta e sofre interferência de vizinhos e eletrodomésticos.`,
          tip: 'Se o seu roteador tiver rede Wi-Fi 5 GHz (Dual Band), conecte-se a ela para atingir velocidades de 200MB a 600MB+.'
        });
      }
    }

    if (!isWireless && networkInfo.speed && networkInfo.speed <= 100) {
      tips.push({
        type: 'info',
        icon: 'cable',
        title: 'Cabo de Rede Limitado a 100 Mbps (Fast Ethernet)',
        text: 'Sua conexão cabeada está negociada em 100 Mbps. Se você assina um plano superior (ex: 200MB, 300MB ou 500MB), a velocidade ficará limitada.',
        tip: 'Substitua o cabo de rede por um modelo Cat5e ou Cat6 e certifique-se de que a porta do roteador suporta Gigabit (1000 Mbps).'
      });
    }

    if (internetLatency !== null && internetLatency > 70) {
      tips.push({
        type: 'info',
        icon: 'globe',
        title: `Latência de Rota Elevada (${internetLatency} ms)`,
        text: 'Os servidores de destino estão demorando para responder aos pacotes da sua conexão.',
        tip: 'Configure os servidores DNS públicos de alta velocidade da Cloudflare (1.1.1.1) ou Google (8.8.8.8) para rotas mais rápidas.'
      });
    }

    if (avgDownloadMbps < 15 && tips.length === 0) {
      quality = 'warning';
      tips.push({
        type: 'warning',
        icon: 'download',
        title: 'Velocidade de Download Abaixo do Padrão',
        text: `A velocidade média registrada foi de ${avgDownloadMbps} Mbps durante o teste.`,
        tip: 'Verifique se há outros dispositivos baixando arquivos, torrents, streams em 4K ou atualizações do Windows Update em segundo plano.'
      });
    }

    if (tips.length === 0) {
      tips.push({
        type: 'success',
        icon: 'check-circle-2',
        title: 'Conexão Otimizada e Saudável',
        text: `Sua conexão está estável, com latência excelente de ${internetLatency || 20}ms e link de ${avgDownloadMbps} Mbps.`,
        tip: 'Nenhum gargalo de hardware, cabo ou roteador foi detectado no momento.'
      });
    }

    const finalReport = {
      networkInfo,
      downloadMbps: avgDownloadMbps,
      peakMbps,
      uploadMbps: avgUploadMbps !== null ? avgUploadMbps : 0,
      peakUploadMbps: peakUploadMbps || 0,
      internetLatency: internetLatency || 0,
      internetJitter: internetJitter || 0,
      internetPacketLoss,
      gatewayLatency,
      gatewayPacketLoss,
      quality,
      tips,
      timestamp: new Date().toISOString()
    };

    sendProgress({ phase: 'done', report: finalReport, statusText: 'Teste de rede concluído!' });

    return { success: true, report: finalReport };
  } catch (error) {
    if (isSpeedTestCancelled) return { cancelled: true };
    return { success: false, error: error.message };
  }
});
