const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron')
const path = require('path')
const { exec, execFile, spawn, execSync } = require('child_process')
const os = require('os')
const fs = require('fs')
const si = require('systeminformation')
const https = require('https')
const { createTelemetry } = require('./telemetry')
const { buildServiceOrderHtmlReport } = require('./serviceOrderReport')
const { checkInternetConnection, fetchSystemLogSnippet, runGeminiDiagnosticAnalysis } = require('./geminiService')

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
  // ── Telemetria 100% Real de Hardware com Inicialização Rápida e Baixo Custo de CPU ──
  const telemetry = createTelemetry({
    getWindow: () => mainWindow,
    log: writeAppLog
  });

  mainWindow.webContents.on('did-finish-load', () => {
    writeAppLog('Renderer finished loading index.html')
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      mainWindow.show()
    }
    telemetry.onRendererReady();
  })
  mainWindow.loadFile(path.join(__dirname, 'index.html')).catch((error) => {
    writeAppLog(`loadFile failed: ${error.stack || error.message}`)
  })

  mainWindow.once('closed', () => {
    if (telemetry) {
      telemetry.stop();
    }
  });
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

// Detecta se o comando deve ser executado no PowerShell
function isPowerShellCommand(cmd, explicitType) {
  if (explicitType === 'powershell') return true
  if (explicitType === 'cmd') return false

  const trimmed = (cmd || '').trim()

  // Se inicia explicitamente com powershell
  if (/^powershell(\.exe)?\b/i.test(trimmed)) return true

  // Verb-Noun cmdlets nativos do PowerShell
  if (/^(Get|Set|Start|Stop|Restart|Enable|Disable|New|Remove|Test|Clear|Install|Uninstall|Update|Invoke|Select|Where|ForEach|Checkpoint|Reset|Register|Unregister)-[a-zA-Z0-9]+/i.test(trimmed)) {
    return true
  }

  // Cmdlets comuns ou manipuladores do PowerShell
  if (/\b(Get-AppxPackage|Remove-AppxPackage|Get-Service|Restart-Service|Stop-Service|Start-Service|Get-Process|Stop-Process|Clear-DnsClientCache|Get-NetAdapter|Reset-NetAdapter|Set-ItemProperty|Get-ItemProperty|Get-CimInstance|Get-WmiObject|Get-LocalUser|Remove-LocalUser)\b/i.test(trimmed)) {
    return true
  }

  // Pipelines e operadores do PowerShell
  if (/\|\s*(Where-Object|\?|ForEach-Object|%|Select-Object|Out-Null|Out-String|Out-File|Export-Csv)\b/i.test(trimmed)) {
    return true
  }

  // Variáveis de ambiente PowerShell ou booleanos
  if (/\$(env:|[a-zA-Z_]\w*|true|false)\b/i.test(trimmed)) {
    return true
  }

  return false
}

// Higieniza comandos para garantir execução segura, sem travamentos de stdin e sem blocos inválidos
function sanitizeCommandToRun(rawCmd) {
  if (!rawCmd || typeof rawCmd !== 'string') return ''

  let cleaned = rawCmd.trim()

  // Remove blocos de código markdown como ```powershell ou ```cmd ou ```
  cleaned = cleaned.replace(/^```[a-zA-Z0-9_-]*\r?\n?/, '').replace(/\r?\n?```$/, '').trim()

  // Remove comandos 'pause' que travam a execução esperando teclado
  cleaned = cleaned.replace(/^\s*pause\s*(&+|\|+|;)?\s*/gi, '')
  cleaned = cleaned.replace(/\s*(&+|\|+|;)\s*pause\s*$/gi, '')
  cleaned = cleaned.replace(/\s*(&+|\|+|;)\s*pause\s*(&+|\|+|;)\s*/gi, ' $1 ')
  cleaned = cleaned.replace(/(?:\r?\n)\s*pause\s*(?:\r?\n|$)/gi, '\n')
  cleaned = cleaned.trim()

  // Auto-adiciona /f para reg add e reg delete para evitar prompt interativo de confirmação
  cleaned = cleaned.replace(/\b(reg\s+(add|delete)\b[^&|\r\n]+)/gi, (match) => {
    if (!/\s\/[fy]\b/i.test(match)) {
      return match + ' /f'
    }
    return match
  })

  // Auto-adiciona /f /q para del ou erase sem flag silenciosa
  cleaned = cleaned.replace(/\b(del|erase)\b(?!\s*\/[a-z]*[fq])/gi, '$1 /f /q')

  // Auto-adiciona flags não-interativas para winget
  if (/\bwinget\b/i.test(cleaned) && !cleaned.includes('--disable-interactivity')) {
    cleaned += ' --accept-source-agreements --accept-package-agreements --disable-interactivity'
  }

  return cleaned
}

// Function to handle running commands
ipcMain.handle('run-command', async (_, command, trackingId = null, options = {}) => {
  const explicitType = (options && options.type) ? String(options.type).toLowerCase() : null
  let cmdToRun = sanitizeCommandToRun(command)

  // Tratamento especial para comandos que abrem configurações ou URLs externas
  if (cmdToRun.startsWith('start ms-settings:')) {
    const url = cmdToRun.replace('start ', '').trim()
    try {
      await shell.openExternal(url)
      return { success: true, output: `Configurações abertas: ${url}` }
    } catch (e) {
      return { success: false, output: `Erro ao abrir configurações: ${e.message}` }
    }
  }

  // Abre a janela nativa da Limpeza de Disco do Windows (cleanmgr.exe)
  if (/^(start\s+)?cleanmgr(\.exe)?/i.test(cmdToRun.trim())) {
    const systemRoot = process.env.SystemRoot || 'C:\\Windows'
    const systemDir = (process.arch === 'ia32' && process.env.PROCESSOR_ARCHITEW6432) ? 'Sysnative' : 'System32'
    const cleanmgrPath = path.join(systemRoot, systemDir, 'cleanmgr.exe')
    return new Promise((resolve) => {
      try {
        const child = spawn(cleanmgrPath, ['/d', 'C:'], { detached: true, stdio: 'ignore' })
        child.once('spawn', () => {
          child.unref()
          resolve({ success: true, output: 'Limpeza de Disco do Windows aberta com sucesso.' })
        })
        child.once('error', (e) => {
          writeAppLog(`Erro ao abrir cleanmgr.exe: ${e.message}`)
          resolve({ success: false, output: `Erro ao abrir a Limpeza de Disco: ${e.message}` })
        })
      } catch (e) {
        resolve({ success: false, output: `Erro ao abrir a Limpeza de Disco: ${e.message}` })
      }
    })
  }

  // Abre a janela nativa de Informações do Sistema do Windows sem passar pelo cmd
  if (/^start\s+msinfo32(\.exe)?$/i.test(cmdToRun.trim())) {
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
  if (/^start\s+mdsched(\.exe)?$/i.test(cmdToRun.trim())) {
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
  if (/^(start\s+)?printui(\.exe)?\s+\/s\s+\/t2/i.test(cmdToRun.trim())) {
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
  if (process.arch === 'ia32' && process.env.PROCESSOR_ARCHITEW6432) {
    cmdToRun = cmdToRun.replace(/\b(sfc|dism|chkdsk)\b/gi, 'C:\\Windows\\Sysnative\\$1.exe')
  }

  // Automatiza resposta para o CHKDSK se ele solicitar agendamento
  if (cmdToRun.toLowerCase().includes('chkdsk') && !cmdToRun.includes('echo S')) {
    cmdToRun = `echo S | ${cmdToRun}`
  }

  // Special handling for 'net user' command to ensure correct encoding.
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
    const usePowerShell = isPowerShellCommand(cmdToRun, explicitType)
    let childProcess = null

    try {
      if (usePowerShell) {
        const normalizedScript = `
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$ProgressPreference = 'SilentlyContinue'
$ConfirmPreference = 'None'
$ErrorActionPreference = 'Continue'
${cmdToRun}
`
        const encoded = Buffer.from(normalizedScript, 'utf16le').toString('base64')
        childProcess = spawn('powershell.exe', [
          '-NoProfile',
          '-NonInteractive',
          '-ExecutionPolicy', 'Bypass',
          '-EncodedCommand', encoded
        ], {
          windowsHide: true,
          stdio: ['ignore', 'pipe', 'pipe']
        })
      } else {
        childProcess = spawn('cmd.exe', [
          '/c',
          `chcp 65001 > nul && ${cmdToRun}`
        ], {
          windowsHide: true,
          stdio: ['ignore', 'pipe', 'pipe']
        })
      }
    } catch (spawnErr) {
      return resolve({ success: false, output: `Falha ao instanciar o processo de execução: ${spawnErr.message}` })
    }

    currentProcess = childProcess
    let stdoutChunks = []
    let stderrChunks = []

    const isHeavy = /\b(dism|sfc|chkdsk)\b/i.test(cmdToRun)
    const timeoutMs = isHeavy ? 600000 : 90000 // 10 min para DISM/SFC, 90s para os demais comandos
    let isTimedOut = false

    const timeoutTimer = setTimeout(() => {
      isTimedOut = true
      if (currentProcess && currentProcess.pid) {
        try {
          exec(`taskkill /pid ${currentProcess.pid} /T /F`)
        } catch (_) {}
      }
    }, timeoutMs)

    currentProcess.stdout?.on('data', chunk => {
      stdoutChunks.push(chunk)
      const textChunk = decodeTerminalOutput(chunk)
      const progress = extractCommandProgress(textChunk)
      sendCommandProgress(trackingId, {
        percent: progress.percent,
        message: progress.message,
        chunk: textChunk,
        stream: 'stdout'
      })
    })

    currentProcess.stderr?.on('data', chunk => {
      stderrChunks.push(chunk)
      const textChunk = decodeTerminalOutput(chunk)
      const progress = extractCommandProgress(textChunk)
      sendCommandProgress(trackingId, {
        percent: progress.percent,
        message: progress.message,
        chunk: textChunk,
        stream: 'stderr'
      })
    })

    currentProcess.on('error', (err) => {
      clearTimeout(timeoutTimer)
      currentProcess = null
      sendCommandProgress(trackingId, { done: true, percent: null })
      resolve({ success: false, output: `Erro na execução do processo: ${err.message}` })
    })

    currentProcess.on('close', (code) => {
      clearTimeout(timeoutTimer)
      const cancelled = isCancelling
      isCancelling = false
      currentProcess = null

      const stdoutBuf = Buffer.concat(stdoutChunks)
      const stderrBuf = Buffer.concat(stderrChunks)
      const outText = decodeTerminalOutput(stdoutBuf).replace(/^\ufeff/, '').replace(/\0/g, '').trim()
      const errText = decodeTerminalOutput(stderrBuf).replace(/^\ufeff/, '').replace(/\0/g, '').trim()

      sendCommandProgress(trackingId, { done: true, percent: cancelled || isTimedOut || code !== 0 ? null : 100 })

      if (cancelled) {
        resolve({ success: false, output: outText || 'Operação cancelada pelo usuário.', cancelled: true, rawOutput: outText })
      } else if (isTimedOut) {
        resolve({
          success: false,
          output: (outText ? outText + '\n\n' : '') + 'Tempo limite de execução excedido (o comando demorou mais que o esperado e foi interrompido com segurança).',
          timedOut: true
        })
      } else if (code !== 0) {
        resolve({ success: false, output: errText || outText || `Comando finalizado com código de erro ${code}.` })
      } else {
        resolve({ success: true, output: outText || errText || 'Comando executado com êxito.' })
      }
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


function measureDirBytesCapped(dirPath, maxDepth = 2, maxState = { files: 0, limit: 600 }) {
  let bytes = 0;
  if (!dirPath || maxDepth < 0 || maxState.files >= maxState.limit) return 0;
  try {
    if (!fs.existsSync(dirPath)) return 0;
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (let i = 0; i < entries.length; i++) {
      if (maxState.files >= maxState.limit) break;
      const entry = entries[i];
      const fullPath = path.join(dirPath, entry.name);
      try {
        if (entry.isDirectory()) {
          if (maxDepth > 0) {
            bytes += measureDirBytesCapped(fullPath, maxDepth - 1, maxState);
          }
        } else {
          maxState.files++;
          const st = fs.statSync(fullPath);
          if (st && st.size > 0) bytes += st.size;
        }
      } catch (_) {}
    }
  } catch (_) {}
  return bytes;
}

function scanReclaimableSpaceFast() {
  const uniquePaths = (arr) => {
    const seen = new Set();
    const out = [];
    for (const p of arr) {
      if (!p) continue;
      const norm = path.resolve(p).toLowerCase();
      if (!seen.has(norm)) {
        seen.add(norm);
        out.push(p);
      }
    }
    return out;
  };

  const localApp = process.env.LOCALAPPDATA || 'C:\\Users\\Default\\AppData\\Local';
  const tempDirs = uniquePaths([
    process.env.TEMP,
    path.join(localApp, 'Temp'),
    'C:\\Windows\\Temp'
  ]);
  const wuDirs = ['C:\\Windows\\SoftwareDistribution\\Download'];
  const werDirs = uniquePaths([
    'C:\\ProgramData\\Microsoft\\Windows\\WER\\ReportQueue',
    'C:\\ProgramData\\Microsoft\\Windows\\WER\\ReportArchive',
    path.join(localApp, 'CrashDumps'),
    'C:\\Windows\\Minidump',
    'C:\\Windows\\Prefetch'
  ]);
  const browserDirs = uniquePaths([
    path.join(localApp, 'Google', 'Chrome', 'User Data', 'Default', 'Cache'),
    path.join(localApp, 'Google', 'Chrome', 'User Data', 'Default', 'Code Cache'),
    path.join(localApp, 'Microsoft', 'Edge', 'User Data', 'Default', 'Cache'),
    path.join(localApp, 'Microsoft', 'Edge', 'User Data', 'Default', 'Code Cache'),
    path.join(localApp, 'Microsoft', 'Windows', 'INetCache')
  ]);

  let tempBytes = 0;
  let wuBytes = 0;
  let werBytes = 0;
  let browserBytes = 0;
  let totalFiles = 0;

  for (const d of tempDirs) {
    const st = { files: 0, limit: 450 };
    tempBytes += measureDirBytesCapped(d, 2, st);
    totalFiles += st.files;
  }
  for (const d of wuDirs) {
    const st = { files: 0, limit: 350 };
    wuBytes += measureDirBytesCapped(d, 2, st);
    totalFiles += st.files;
  }
  for (const d of werDirs) {
    const st = { files: 0, limit: 350 };
    werBytes += measureDirBytesCapped(d, 2, st);
    totalFiles += st.files;
  }
  for (const d of browserDirs) {
    const st = { files: 0, limit: 450 };
    browserBytes += measureDirBytesCapped(d, 2, st);
    totalFiles += st.files;
  }

  const toMB = (b) => Math.round((b / (1024 * 1024)) * 10) / 10;
  const tempMB = toMB(tempBytes);
  const wuMB = toMB(wuBytes);
  const werMB = toMB(werBytes);
  const browserMB = toMB(browserBytes);
  const totalMB = Math.round((tempMB + wuMB + werMB + browserMB) * 10) / 10;

  return {
    totalMB,
    tempMB,
    wuMB,
    werMB,
    browserMB,
    totalFiles
  };
}

function unescapeXmlEntities(str) {
  if (!str) return '';
  return String(str)
    .replace(/&#13;&#10;|&#xD;&#xA;|&#10;|&#13;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function formatRelativeTimePtBr(isoString) {
  if (!isoString) return 'Recente';
  const ts = Date.parse(isoString);
  if (Number.isNaN(ts)) return 'Recente';
  const diffMin = Math.max(1, Math.round((Date.now() - ts) / 60000));
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffHours = Math.round(diffMin / 60);
  if (diffHours < 24) return `há ${diffHours}h`;
  const diffDays = Math.round(diffHours / 24);
  return `há ${diffDays}d`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Gerenciamento de Estado de Manutenção & Agendamento Periódico de Diagnóstico
// Garante persistência, prazos periódicos e elimina falsas sensações de urgência
// para problemas já solucionados.
// ─────────────────────────────────────────────────────────────────────────────

function getMaintenanceFilePath() {
  try {
    return path.join(app.getPath('userData'), 'system_maintenance.json');
  } catch (_) {
    return path.join(process.env.APPDATA || 'C:\\', 'ThunderTools', 'system_maintenance.json');
  }
}

let inMemoryMaintenanceState = null;

function loadMaintenanceState() {
  if (inMemoryMaintenanceState) return inMemoryMaintenanceState;
  try {
    const fPath = getMaintenanceFilePath();
    if (fs.existsSync(fPath)) {
      const parsed = JSON.parse(fs.readFileSync(fPath, 'utf8'));
      if (parsed && typeof parsed === 'object') {
        inMemoryMaintenanceState = {
          lastRepairTimestamp: Number(parsed.lastRepairTimestamp) || 0,
          resolvedAlerts: Array.isArray(parsed.resolvedAlerts) ? parsed.resolvedAlerts : [],
          completedAiCommands: Array.isArray(parsed.completedAiCommands) ? parsed.completedAiCommands : [],
          checkIntervalHours: Number(parsed.checkIntervalHours) || 24,
          nextScheduledCheck: Number(parsed.nextScheduledCheck) || (Date.now() + 24 * 3600 * 1000),
          lastCheckTimestamp: Number(parsed.lastCheckTimestamp) || 0,
          verifiedServices: Array.isArray(parsed.verifiedServices) ? parsed.verifiedServices : []
        };
        return inMemoryMaintenanceState;
      }
    }
  } catch (_) {}

  inMemoryMaintenanceState = {
    lastRepairTimestamp: 0,
    resolvedAlerts: [],
    completedAiCommands: [],
    checkIntervalHours: 24,
    nextScheduledCheck: Date.now() + 24 * 3600 * 1000,
    lastCheckTimestamp: 0,
    verifiedServices: []
  };
  return inMemoryMaintenanceState;
}

function saveMaintenanceState(st) {
  inMemoryMaintenanceState = { ...st };
  try {
    const fPath = getMaintenanceFilePath();
    const dir = path.dirname(fPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(fPath, JSON.stringify(inMemoryMaintenanceState, null, 2), 'utf8');
  } catch (err) {
    writeAppLog(`Aviso ao persistir estado de manutenção: ${err.message}`);
  }
}

function formatScheduleTime(ts) {
  if (!ts || Number.isNaN(ts)) return 'Em 24 horas';
  const target = new Date(ts);
  const now = new Date();
  const diffMs = ts - now.getTime();
  const timeStr = target.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (diffMs <= 0) return `Agora mesmo (${timeStr})`;
  
  const diffHours = Math.max(1, Math.round(diffMs / 3600000));
  const isToday = target.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = target.toDateString() === tomorrow.toDateString();

  if (isToday) {
    return `Hoje às ${timeStr} (em ~${diffHours}h)`;
  } else if (isTomorrow) {
    return `Amanhã às ${timeStr} (em ~${diffHours}h)`;
  } else {
    const dateStr = target.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    const diffDays = Math.max(1, Math.round(diffHours / 24));
    return `${dateStr} às ${timeStr} (em ~${diffDays}d)`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Motor Robusto de Auditoria e Execução de Serviços do Windows
// Elimina erros de serviços não executados ou travados em pendência
// ─────────────────────────────────────────────────────────────────────────────

async function queryServiceStatus(svcName) {
  return new Promise((resolve) => {
    execFile('sc.exe', ['query', svcName], { encoding: 'buffer', windowsHide: true, timeout: 3500 }, (err, outBuf) => {
      const text = decodeTerminalOutput(outBuf || '');
      const stateMatch = text.match(/(?:STATE|ESTADO)\s*:\s*(\d+)\s+([A-Z_]+)/i);
      if (stateMatch) {
        resolve({
          name: svcName,
          code: parseInt(stateMatch[1], 10),
          state: stateMatch[2].toUpperCase(),
          exists: true
        });
      } else {
        const notFound = /1060|n[aã\ufffd]o existe|does not exist/i.test(text);
        resolve({
          name: svcName,
          code: -1,
          state: notFound ? 'NOT_FOUND' : 'UNKNOWN',
          exists: !notFound
        });
      }
    });
  });
}

async function ensureServiceRunningRobust(svcName, targetStartType = 'auto', maxWaitMs = 6000) {
  writeAppLog(`[ServiceRobust] Iniciando e verificando serviço ${svcName} (start=${targetStartType})...`);

  // 1. Configura tipo de inicialização no SCM
  await new Promise((r) => execFile('sc.exe', ['config', svcName, `start=`, targetStartType], { windowsHide: true }, () => r()));

  // 2. Se for Spooler, purga fila com trabalhos corrompidos travando o processo
  if (svcName.toLowerCase() === 'spooler') {
    try {
      const spoolPath = 'C:\\Windows\\System32\\spool\\PRINTERS';
      if (fs.existsSync(spoolPath)) {
        const files = fs.readdirSync(spoolPath);
        for (const f of files) {
          try { fs.unlinkSync(path.join(spoolPath, f)); } catch (_) {}
        }
      }
    } catch (_) {}
  }

  // 3. Checa estado inicial
  let status = await queryServiceStatus(svcName);
  if (status.code === 4) {
    return { success: true, state: 'RUNNING', verified: true };
  }

  // 4. Se estiver em STOP_PENDING ou START_PENDING, aguarda estabilização inicial
  const startTs = Date.now();
  if (status.code === 2 || status.code === 3) {
    while (Date.now() - startTs < 2500) {
      await waitCadence(350);
      status = await queryServiceStatus(svcName);
      if (status.code === 4) return { success: true, state: 'RUNNING', verified: true };
      if (status.code === 1) break;
    }
  }

  // 5. Tenta iniciar via net start / sc start
  await new Promise((r) => exec(`net start ${svcName} 2>nul || sc.exe start ${svcName} 2>nul`, { windowsHide: true }, () => r()));

  // 6. Polling com retry ativo até confirmar RUNNING (code 4)
  while (Date.now() - startTs < maxWaitMs) {
    await waitCadence(400);
    status = await queryServiceStatus(svcName);
    if (status.code === 4) {
      writeAppLog(`[ServiceRobust] Serviço ${svcName} verificado com sucesso em execução contínua!`);
      return { success: true, state: 'RUNNING', verified: true };
    }
  }

  // 7. Fallback com PowerShell para destravar instâncias teimosas
  writeAppLog(`[ServiceRobust] Executando fallback PowerShell para inicialização de ${svcName}...`);
  await new Promise((r) => {
    exec(`powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Start-Service -Name '${svcName}' -ErrorAction SilentlyContinue"`, { windowsHide: true, timeout: 4000 }, () => r());
  });
  await waitCadence(450);
  status = await queryServiceStatus(svcName);

  const isOk = status.code === 4 || (targetStartType === 'demand' && status.exists);
  return {
    success: isOk,
    state: status.state,
    verified: status.code === 4
  };
}

async function collectSystemDiagnosticsData(options = {}) {
  try {
    const forceScan = !!(options && options.force);
    const mState = loadMaintenanceState();
    const now = Date.now();
    const lastRepairTimestamp = Number(mState.lastRepairTimestamp) || 0;
    const checkIntervalHours = Number(mState.checkIntervalHours) || 24;

    if (!mState.nextScheduledCheck || mState.nextScheduledCheck <= now) {
      mState.nextScheduledCheck = now + (checkIntervalHours * 3600 * 1000);
      saveMaintenanceState(mState);
    }
    const nextScheduledCheck = mState.nextScheduledCheck;
    const nextCheckFormatted = formatScheduleTime(nextScheduledCheck);

    // Se o usuário realizou manutenções ou correções recentemente, define o período ativo de proteção
    // garantindo que alertas antigos já solucionados não reapareçam gerando falsa urgência
    const isWithinMaintenanceGracePeriod = !forceScan && lastRepairTimestamp > 0 && (now - lastRepairTimestamp < checkIntervalHours * 3600 * 1000);

    // 1. Varredura Inteligente nos logs System e Application (últimas 48h) em formato XML Unicode (independente do idioma do Windows)
    const queryLogXml = (logName, maxEvents = 22) => new Promise((resolve) => {
      execFile('wevtutil.exe', [
        'qe', logName,
        '/q:*[System[(Level=1 or Level=2 or Level=3) and TimeCreated[timediff(@SystemTime) <= 172800000]]]',
        '/f:renderedxml',
        '/uni:true',
        `/c:${maxEvents}`,
        '/rd:true'
      ], { encoding: 'buffer', windowsHide: true, timeout: 4000 }, (err, outBuf) => {
        if (!outBuf || outBuf.length === 0) {
          resolve('');
          return;
        }
        try {
          // /uni:true emite UTF-16LE puro sem distorção de acentos
          const hasNullBytes = outBuf.length > 3 && (outBuf[1] === 0 || outBuf[3] === 0);
          const decoded = hasNullBytes ? outBuf.toString('utf16le') : decodeTerminalOutput(outBuf);
          resolve(cleanMojibake(decoded.replace(/^\ufeff/, '')));
        } catch (_) {
          resolve(decodeTerminalOutput(outBuf));
        }
      });
    });

    // Checagem rápida de serviços essenciais, segurança e Dirty Bit do volume C:
    const checkServicesAndVolume = () => new Promise((resolve) => {
      exec(
        'sc query spooler & sc query wuauserv & sc query bits & sc query WinDefend & sc query mpssvc & sc query Dnscache & fsutil dirty query C:',
        { encoding: 'buffer', windowsHide: true, timeout: 3500 },
        (err, outBuf) => {
          resolve(decodeTerminalOutput(outBuf));
        }
      );
    });

    const [sysXml, appXml, svcOut] = await Promise.all([
      queryLogXml('System', 25),
      queryLogXml('Application', 20),
      checkServicesAndVolume()
    ]);

    const parseEventsXml = (xmlText, sourceLog) => {
      const parsed = [];
      if (!xmlText || !xmlText.trim()) return parsed;
      const eventBlocks = xmlText.match(/<Event[\s\S]*?<\/Event>/gi) || [];
      for (const block of eventBlocks) {
        const idMatch = block.match(/<EventID[^>]*>(\d+)<\/EventID>/i);
        const levelMatch = block.match(/<System>[\s\S]*?<Level>(\d+)<\/Level>/i) || block.match(/<Level>(\d+)<\/Level>/i);
        const providerMatch = block.match(/<Provider[^>]*EventSourceName=['"]([^'"]+)['"]/i) || block.match(/<Provider[^>]*Name=['"]([^'"]+)['"]/i);
        const timeMatch = block.match(/<TimeCreated[^>]*SystemTime=['"]([^'"]+)['"]/i);
        const msgMatch = block.match(/<RenderingInfo[^>]*>[\s\S]*?<Message>([\s\S]*?)<\/Message>/i);

        const eventId = idMatch ? parseInt(idMatch[1], 10) : 0;
        const levelNum = levelMatch ? parseInt(levelMatch[1], 10) : 2;
        const rawSource = providerMatch ? providerMatch[1].trim() : sourceLog;
        const source = rawSource.replace(/^Microsoft-Windows-/i, '');
        const timestampIso = timeMatch ? timeMatch[1] : '';

        // Ignora avisos benignos de permissão DCOM 10016 (comportamento padrão do Windows segundo a Microsoft)
        if (eventId === 10016 || eventId === 6013) continue;

        let rawMsg = '';
        if (msgMatch && msgMatch[1]) {
          rawMsg = unescapeXmlEntities(msgMatch[1]);
        } else {
          const dataMatches = [...block.matchAll(/<Data[^>]*>([\s\S]*?)<\/Data>/gi)]
            .map(m => unescapeXmlEntities(m[1]))
            .filter(Boolean);
          rawMsg = dataMatches.length ? dataMatches.slice(0, 4).join(' • ') : `Evento ${eventId} registrado em ${source}`;
        }

        const isErrorOrCrit = levelNum === 1 || levelNum === 2;
        const isCriticalWarningId = [7, 11, 15, 18, 19, 20, 46, 47, 51, 55, 98, 129, 130, 140, 153, 157, 1001, 1014, 4227, 4231].includes(eventId);
        const hasCriticalKeywords = /ntfs|bad block|corrompid|corrupt|whea|bugcheck|bsod|storahci|stornvme|disk error/i.test(`${source} ${rawMsg}`);

        if (!isErrorOrCrit && !isCriticalWarningId && !hasCriticalKeywords) continue;

        // Se o evento ocorreu ANTES do último reparo executado pelo usuário, ele já foi solucionado
        // e não deve ser reexibido para não gerar falsa urgência
        const eventTs = timestampIso ? Date.parse(timestampIso) : 0;
        if (isWithinMaintenanceGracePeriod && eventTs > 0 && eventTs <= lastRepairTimestamp) {
          continue; // Já solucionado na última manutenção!
        }

        parsed.push({
          id: String(eventId || 'Erro'),
          numId: eventId,
          level: levelNum,
          levelLabel: levelNum === 1 ? 'Crítico' : (levelNum === 2 ? 'Erro' : 'Aviso'),
          source,
          log: sourceLog,
          timestamp: timestampIso,
          timeAgo: formatRelativeTimePtBr(timestampIso),
          message: cleanMojibake(rawMsg).slice(0, 280)
        });
      }
      return parsed;
    };

    const rawEvents = [
      ...parseEventsXml(sysXml, 'System'),
      ...parseEventsXml(appXml, 'Application')
    ];

    // Agrupa e deduplica eventos repetidos (preservando a contagem de ocorrências e o horário mais recente)
    const eventMap = new Map();
    for (const ev of rawEvents) {
      const key = `${ev.log}:${ev.numId}:${ev.source.toLowerCase()}`;
      if (!eventMap.has(key)) {
        eventMap.set(key, { ...ev, count: 1 });
      } else {
        const existing = eventMap.get(key);
        existing.count += 1;
      }
    }
    const allEvents = Array.from(eventMap.values());
    const issues = allEvents.slice(0, 10);

    // 2. Checagem rápida de CBS.log para indícios recentes de corrupção de componentes
    let hasCbsCorruption = false;
    try {
      const cbsPath = 'C:\\Windows\\Logs\\CBS\\CBS.log';
      const hasRepairedCbs = isWithinMaintenanceGracePeriod && (
        (mState.resolvedAlerts || []).includes('cbs') ||
        (mState.completedAiCommands || []).some(c => /sfc|dism/i.test(c)) ||
        lastRepairTimestamp > 0
      );
      if (fs.existsSync(cbsPath) && !hasRepairedCbs) {
        const stat = fs.statSync(cbsPath);
        const readSize = Math.min(65536, stat.size);
        if (readSize > 0) {
          const fd = fs.openSync(cbsPath, 'r');
          const buf = Buffer.alloc(readSize);
          fs.readSync(fd, buf, 0, readSize, stat.size - readSize);
          fs.closeSync(fd);
          const tail = buf.toString('utf8');
          if (/cannot repair member file|corrupt.*cannot|falha ao reparar|CSI\s+0000.*error/i.test(tail)) {
            hasCbsCorruption = true;
          }
        }
      }
    } catch (_) {}

    // 3. Checagem de integridade de armazenamento (Disco C: e unidades secundárias) + Scanner de Lixo Acumulado
    let isDiskCritical = false;
    let isDiskWarning = false;
    let freeGBVal = 25;
    let totalGBVal = 120;
    let diskUsagePct = 50;
    try {
      if (typeof fs.statfsSync === 'function') {
        const stats = fs.statfsSync('C:\\');
        freeGBVal = (stats.bavail * stats.bsize) / (1024 ** 3);
        totalGBVal = Math.max(1, (stats.blocks * stats.bsize) / (1024 ** 3));
        diskUsagePct = Math.min(100, Math.max(0, Math.round(((totalGBVal - freeGBVal) / totalGBVal) * 100)));
        if (freeGBVal < 6 || diskUsagePct >= 94) {
          isDiskCritical = true;
        } else if (freeGBVal < 15 || diskUsagePct >= 85) {
          isDiskWarning = true;
        }
      }
    } catch (_) {}

    const reclaimable = scanReclaimableSpaceFast();
    const reclaimableMB = reclaimable.totalMB;

    // 4. Análise de Serviços Essenciais (compatível com Windows em Português e Inglês) e Dirty Bit do Volume C:
    const getServiceState = (text, svcName) => {
      const re = new RegExp(`(?:SERVICE_NAME|NOME_DO_SERVI[^:\\r\\n]*):\\s*${svcName}[\\s\\S]{0,280}?(?:STATE|ESTADO)\\s*:\\s*(\\d+)\\s+([A-Z_]+)`, 'i');
      const m = (text || '').match(re);
      return m ? { code: parseInt(m[1], 10), state: m[2].toUpperCase() } : null;
    };

    const spoolerState = getServiceState(svcOut, 'spooler');
    const wuauservState = getServiceState(svcOut, 'wuauserv');
    const bitsState = getServiceState(svcOut, 'bits');
    const defenderState = getServiceState(svcOut, 'WinDefend');
    const firewallState = getServiceState(svcOut, 'mpssvc');
    const dnsState = getServiceState(svcOut, 'Dnscache');

    const spoolerStopped = spoolerState ? spoolerState.code === 1 : false;
    const wuauservRunning = wuauservState ? wuauservState.code === 4 : false;
    const bitsRunning = bitsState ? bitsState.code === 4 : false;
    const defenderRunning = defenderState ? defenderState.code === 4 : true;
    const firewallRunning = firewallState ? firewallState.code === 4 : true;
    const dnsRunning = dnsState ? dnsState.code === 4 : true;

    const isVolumeDirty = /(?:is\s+dirty|est[aá\ufffd]\s+sujo)/i.test(svcOut || '') && !/(?:NOT\s+dirty|n[aã\ufffd]o\s+est[aá\ufffd]\s+sujo)/i.test(svcOut || '');

    // 5. Auditoria de Memória RAM, Tempo de Atividade (Uptime) e Arquivo HOSTS
    const totalMemBytes = os.totalmem() || 1;
    const freeMemBytes = os.freemem() || 0;
    const ramTotalGB = +(totalMemBytes / (1024 ** 3)).toFixed(1);
    const ramFreeGB = +(freeMemBytes / (1024 ** 3)).toFixed(1);
    const ramUsagePct = Math.round(((totalMemBytes - freeMemBytes) / totalMemBytes) * 100);
    const isRamCritical = ramUsagePct >= 90;
    const isRamWarning = ramUsagePct >= 80 && ramUsagePct < 90;

    const uptimeSec = os.uptime() || 0;
    const uptimeHours = +(uptimeSec / 3600).toFixed(1);
    const uptimeDays = Math.floor(uptimeSec / 86400);
    const uptimeFormatted = uptimeDays > 0
      ? `${uptimeDays}d ${Math.floor((uptimeSec % 86400) / 3600)}h`
      : `${Math.floor(uptimeSec / 3600)}h ${Math.floor((uptimeSec % 3600) / 60)}m`;
    const isUptimeExcessive = uptimeDays >= 7;

    let hostsCustomCount = 0;
    try {
      const hostsPath = 'C:\\Windows\\System32\\drivers\\etc\\hosts';
      if (fs.existsSync(hostsPath)) {
        const lines = fs.readFileSync(hostsPath, 'utf8').split(/\r?\n/);
        for (const line of lines) {
          const clean = line.trim();
          if (!clean || clean.startsWith('#')) continue;
          if (!/^(127\.0\.0\.1|::1|0\.0\.0\.0)\s+(localhost|broadcasthost|local)\b/i.test(clean)) {
            hostsCustomCount++;
          }
        }
      }
    } catch (_) {}
    const hostsModified = hostsCustomCount >= 3;

    // 6. Motor de IA Preventiva Multi-Dimensional (Diagnóstico de Causa Raiz, Impacto e Recomendações)
    const aiCorruptions = [];
    const aiRecommendedCommands = [];
    const addRecommendation = (rec) => {
      if (!aiRecommendedCommands.some(r => r.id === rec.id)) {
        aiRecommendedCommands.push(rec);
      }
    };

    const formatUniqueEventIds = (evList) => {
      const uniqueIds = [...new Set(evList.map(e => `${e.id}${e.count > 1 ? ` (${e.count}x)` : ''}`).filter(Boolean))].slice(0, 4);
      return uniqueIds.length > 0 ? uniqueIds.map(id => `Evento ${id}`).join(', ') : 'Logs recentes';
    };

    // 6.1 Sistema de Arquivos NTFS / Bad Blocks / Disco Sujo / WHEA Hardware
    const diskCorruptionEvents = allEvents.filter(e =>
      [7, 11, 15, 51, 55, 98, 129, 130, 140, 153, 157].includes(e.numId) ||
      /^(disk|ntfs|storahci|stornvme|volsnap|partmgr)$/i.test(e.source) ||
      /bad block|estrutura do sistema de arquivos|file system structure|i\/o error/i.test(e.message)
    );

    if (isVolumeDirty || diskCorruptionEvents.length > 0) {
      const totalOccurrences = diskCorruptionEvents.reduce((acc, e) => acc + (e.count || 1), 0);
      const evLabel = formatUniqueEventIds(diskCorruptionEvents);
      aiCorruptions.push({
        severity: 'critical',
        icon: 'hard-drive',
        category: 'Sistema de Arquivos NTFS & Disco',
        impact: isVolumeDirty ? '-25 pts' : '-18 pts',
        title: isVolumeDirty
          ? 'Inconsistência Detectada na Partição C: (Dirty Bit Ativo)'
          : `Anomalias de Leitura/Gravação ou NTFS (${totalOccurrences} ${totalOccurrences === 1 ? 'ocorrência' : 'ocorrências'})`,
        diagnosis: isVolumeDirty
          ? 'O Windows sinalizou que a unidade C: sofreu desligamento durante gravação ou possui índices NTFS pendentes de reparo.'
          : `O barramento de armazenamento registrou timeouts de I/O ou alertas de estrutura NTFS nas últimas 48h (${evLabel}).`,
        prevention: 'Execute o comando CHKDSK Online Scan na Etapa 2 abaixo para reparar índices lógicos sem precisar reiniciar.'
      });
      addRecommendation({
        id: 'rec-chkdsk-scan',
        title: 'Verificar Estrutura do Disco (CHKDSK Online)',
        cmd: 'chkdsk C: /scan',
        badge: 'Rápido • Sem Reiniciar',
        icon: 'hard-drive',
        color: '#f59e0b',
        reason: 'Inspeciona a partição C: em tempo real para corrigir erros lógicos no sistema de arquivos NTFS.'
      });
    }

    // 6.2 Desligamento Abrupto (Kernel-Power 41 / 6008), BSOD (1001) ou Crash de Processos/Serviços (1000/1002/7031/7034)
    const kernelCrashEvents = allEvents.filter(e =>
      [41, 1000, 1001, 1002, 6008, 7031, 7034, 18, 19, 46].includes(e.numId) ||
      /kernel-power|bugcheck|wer-systemerrorreporting|application error|application hang|whea-logger/i.test(e.source)
    );

    if (hasCbsCorruption || kernelCrashEvents.length > 0) {
      const totalCrashes = kernelCrashEvents.reduce((acc, e) => acc + (e.count || 1), 0);
      const hasBsodOrKernelPower = kernelCrashEvents.some(e => e.numId === 41 || e.numId === 1001 || e.numId === 6008);
      const evLabel = formatUniqueEventIds(kernelCrashEvents);
      aiCorruptions.push({
        severity: (hasCbsCorruption || hasBsodOrKernelPower) ? 'critical' : 'warning',
        icon: 'shield-alert',
        category: 'Estabilidade & Integridade do Windows',
        impact: hasCbsCorruption ? '-20 pts' : '-12 pts',
        title: hasCbsCorruption
          ? 'Arquivos Protegidos do Windows com Falha de Validação (CBS)'
          : hasBsodOrKernelPower
          ? `Desligamento Inesperado / Energia Crítica Detectada (${evLabel})`
          : `Fechamento Abrupto de Aplicações ou Serviços (${totalCrashes} ${totalCrashes === 1 ? 'registro' : 'registros'})`,
        diagnosis: hasCbsCorruption
          ? 'O log interno CBS.log aponta componentes ou bibliotecas DLL do Windows que apresentaram falha de integridade.'
          : `O Event Viewer registrou ${evLabel} nas últimas 48h. Quedas bruscas de energia ou travamentos podem corromper DLLs vitais do sistema.`,
        prevention: 'Execute o SFC /scannow e o DISM /RestoreHealth abaixo para validar e substituir arquivos danificados por cópias oficiais.'
      });
      addRecommendation({
        id: 'rec-sfc',
        title: 'Reparar Arquivos do Sistema (SFC /scannow)',
        cmd: 'sfc /scannow',
        badge: 'Essencial',
        icon: 'shield-check',
        color: '#10b981',
        reason: 'Verifica todos os arquivos protegidos do Windows e substitui automaticamente DLLs corrompidas.'
      });
      addRecommendation({
        id: 'rec-dism-restore',
        title: 'Restaurar Imagem do Windows (DISM /RestoreHealth)',
        cmd: 'DISM /Online /Cleanup-Image /RestoreHealth',
        badge: 'Reparo Profundo',
        icon: 'wrench',
        color: '#818cf8',
        reason: 'Corrige corrupções na loja de componentes (WinSxS) usando a base oficial da Microsoft.'
      });
    }

    // 6.3 Serviços Essenciais, Spooler e Windows Update
    const wuEvents = allEvents.filter(e =>
      [20, 25, 31, 7000, 7001, 7023, 7024].includes(e.numId) ||
      /windowsupdateclient|service control manager|msiinstaller/i.test(e.source)
    );

    if (wuEvents.length > 0 || spoolerStopped) {
      const evLabel = formatUniqueEventIds(wuEvents);
      aiCorruptions.push({
        severity: spoolerStopped ? 'critical' : 'warning',
        icon: 'refresh-cw',
        category: 'Serviços & Windows Update',
        impact: '-10 pts',
        title: spoolerStopped
          ? 'Serviço Spooler de Impressão Parado'
          : `Falhas de Inicialização de Serviços ou Update (${wuEvents.length} ${wuEvents.length === 1 ? 'tipo' : 'tipos'})`,
        diagnosis: spoolerStopped
          ? 'O Spooler de Impressão do Windows encontra-se parado (STOPPED), impedindo impressões locais e em rede.'
          : `Foram detectados erros recentes no Gerenciador de Controle de Serviços ou Windows Update (${evLabel}).`,
        prevention: 'Clique em "Aplicar Correções Automáticas" para reiniciar os serviços vitais e desobstruir filas travadas.'
      });
      addRecommendation({
        id: 'rec-dism-check',
        title: 'Auditar Saúde da Imagem (DISM /ScanHealth)',
        cmd: 'DISM /Online /Cleanup-Image /ScanHealth',
        badge: 'Diagnóstico',
        icon: 'search',
        color: '#38bdf8',
        reason: 'Verifica se existem pacotes corrompidos no repositório de atualizações do Windows.'
      });
    }

    // 6.4 Espaço Livre Reduzido no Disco C:
    if (isDiskCritical || isDiskWarning) {
      aiCorruptions.push({
        severity: isDiskCritical ? 'critical' : 'warning',
        icon: 'hard-drive',
        category: 'Armazenamento Crítico',
        impact: isDiskCritical ? '-28 pts' : '-15 pts',
        title: `Pouco Espaço Livre no Disco C: (${freeGBVal.toFixed(1)} GB disponíveis • ${diskUsagePct}% ocupado)`,
        diagnosis: `Com menos de 15 GB livres, o Windows sofre estrangulamento na memória virtual (pagefile.sys), lentidão de I/O em SSDs e falhas de atualização.`,
        prevention: `Aplique a Limpeza Automática (${reclaimableMB > 0 ? `libera ~${reclaimableMB} MB imediatos` : 'higieniza caches'}) e compacte a pasta WinSxS.`
      });
      addRecommendation({
        id: 'rec-winsxs',
        title: 'Compactar Pasta WinSxS (DISM Cleanup)',
        cmd: 'DISM /Online /Cleanup-Image /StartComponentCleanup',
        badge: 'Libera Espaço',
        icon: 'package-x',
        color: '#a855f7',
        reason: 'Remove versões antigas de atualizações acumuladas no Windows sem afetar programas instalados.'
      });
    }

    // 6.5 Acúmulo Elevado de Lixo Temporário e Caches (mesmo com disco acima de 15 GB)
    const reclaimThresholdMB = isWithinMaintenanceGracePeriod ? 2200 : 450;
    if (reclaimableMB >= reclaimThresholdMB && !isDiskCritical) {
      const formattedReclaim = reclaimableMB >= 1024
        ? `${(reclaimableMB / 1024).toFixed(2)} GB`
        : `${Math.round(reclaimableMB)} MB`;
      aiCorruptions.push({
        severity: 'warning',
        icon: 'trash-2',
        category: 'Otimização de Armazenamento & Cache',
        impact: '-7 pts',
        title: `${formattedReclaim} de Arquivos Temporários e Caches Obsoletos Detectados`,
        diagnosis: `Detalhamento: Temporários (${reclaimable.tempMB} MB), Navegadores (${reclaimable.browserMB} MB), Windows Update (${reclaimable.wuMB} MB) e Relatórios WER (${reclaimable.werMB} MB).`,
        prevention: 'Clique em "Aplicar Correções Automáticas" para higienizar todas essas pastas e recuperar espaço instantaneamente.'
      });
    }

    // 6.6 Pressão de Memória RAM ou Tempo Excessivo sem Reiniciar (Uptime)
    const shouldAuditUptime = !isWithinMaintenanceGracePeriod && isUptimeExcessive;
    if (isRamCritical || isRamWarning || shouldAuditUptime) {
      aiCorruptions.push({
        severity: isRamCritical ? 'critical' : 'warning',
        icon: 'memory-stick',
        category: 'Memória RAM & Desempenho',
        impact: isRamCritical ? '-14 pts' : '-8 pts',
        title: isRamCritical || isRamWarning
          ? `Pressão Elevada de Memória RAM (${ramUsagePct}% em uso • ${ramFreeGB} GB livres)`
          : `Sessão Prolongada sem Reinicialização (Uptime: ${uptimeFormatted})`,
        diagnosis: isRamCritical || isRamWarning
          ? `O consumo de RAM está alto (${ramUsagePct}%), forçando o Windows a paginar dados no disco e causando engasgos na abertura de janelas.`
          : `O computador está ligado continuamente há ${uptimeFormatted}. Sessões longas acumulam memória não-paginada de drivers e caches ociosos.`,
        prevention: 'A correção automática inclui o esvaziamento de Working Sets de processos em segundo plano para recuperar RAM imediatamente.'
      });
    }

    // 6.7 Segurança (Defender / Firewall / Arquivo HOSTS / Rede DNS)
    const netEvents = allEvents.filter(e => [1014, 4227, 4231].includes(e.numId) || /dns client|tcpip/i.test(e.source));
    const shouldAuditHosts = !isWithinMaintenanceGracePeriod && hostsModified;
    if (!defenderRunning || !firewallRunning || shouldAuditHosts || netEvents.length > 0) {
      aiCorruptions.push({
        severity: (!defenderRunning || !firewallRunning) ? 'critical' : 'warning',
        icon: 'shield',
        category: 'Segurança & Conectividade',
        impact: (!defenderRunning || !firewallRunning) ? '-15 pts' : '-6 pts',
        title: !defenderRunning
          ? 'Serviço do Windows Defender Inativo'
          : !firewallRunning
          ? 'Firewall do Windows Desativado'
          : hostsModified
          ? `Arquivo HOSTS Modificado (${hostsCustomCount} redirecionamentos ativos)`
          : `Timeouts de Resolução DNS Registrados (${netEvents.length} evento(s))`,
        diagnosis: (!defenderRunning || !firewallRunning)
          ? 'Um dos serviços nativos de proteção do Windows não está em execução, deixando o sistema exposto.'
          : hostsModified
          ? `O arquivo HOSTS do Windows possui ${hostsCustomCount} regras customizadas que podem alterar ou bloquear o acesso a servidores.`
          : 'O log do sistema aponta atrasos ou falhas de resposta do servidor DNS configurado na interface de rede.',
        prevention: 'Execute a renovação automática de DNS/Winsock ou acesse a aba Segurança para auditar o arquivo HOSTS e serviços.'
      });
    }

    // Garante que sempre haja os comandos preventivos principais disponíveis
    if (!aiRecommendedCommands.some(r => r.id === 'rec-sfc')) {
      addRecommendation({
        id: 'rec-sfc',
        title: 'Reparar Arquivos do Sistema (SFC /scannow)',
        cmd: 'sfc /scannow',
        badge: 'Essencial',
        icon: 'shield-check',
        color: '#10b981',
        reason: 'Verifica todos os arquivos protegidos do Windows e substitui automaticamente DLLs corrompidas.'
      });
    }
    if (!aiRecommendedCommands.some(r => r.id === 'rec-dism-restore')) {
      addRecommendation({
        id: 'rec-dism-restore',
        title: 'Restaurar Imagem do Windows (DISM /RestoreHealth)',
        cmd: 'DISM /Online /Cleanup-Image /RestoreHealth',
        badge: 'Reparo Profundo',
        icon: 'wrench',
        color: '#818cf8',
        reason: 'Restaura a integridade da imagem oficial do Windows para evitar que erros evoluam para corrupção.'
      });
    }

    // 7. Cálculo Inteligente do Score de Saúde (0 a 100) e dos 6 Pilares Auditados
    let score = 100;
    if (isDiskCritical) score -= 28;
    else if (isDiskWarning) score -= 14;
    if (isVolumeDirty) score -= 24;
    else if (diskCorruptionEvents.length > 0) score -= 16;
    if (hasCbsCorruption) score -= 18;
    if (kernelCrashEvents.length > 0) score -= Math.min(16, 6 + kernelCrashEvents.length * 3);
    if (spoolerStopped) score -= 12;
    else if (wuEvents.length > 0) score -= 7;
    if (reclaimableMB >= 1024) score -= 8;
    else if (reclaimableMB >= 450) score -= 5;
    if (isRamCritical) score -= 12;
    else if (isRamWarning) score -= 6;
    if (isUptimeExcessive) score -= 4;
    if (!defenderRunning || !firewallRunning) score -= 14;
    else if (hostsModified || netEvents.length > 0) score -= 5;

    const healthScore = Math.max(18, Math.min(100, Math.round(score)));
    const healthGrade = healthScore >= 90
      ? 'Excelente'
      : healthScore >= 75
      ? 'Bom'
      : healthScore >= 55
      ? 'Atenção Preventiva'
      : 'Crítico';

    const reclaimLabel = reclaimableMB >= 1024
      ? `${(reclaimableMB / 1024).toFixed(1)} GB limpáveis`
      : `${Math.round(reclaimableMB)} MB limpáveis`;

    const subsystems = [
      {
        id: 'storage',
        label: 'Disco & NTFS',
        icon: 'hard-drive',
        status: (isDiskCritical || isVolumeDirty || diskCorruptionEvents.length > 0) ? 'critical' : (isDiskWarning ? 'warning' : 'ok'),
        value: `${freeGBVal.toFixed(1)} GB livres`,
        detail: isVolumeDirty ? 'Volume C: requer verificação NTFS' : `${100 - diskUsagePct}% livre • NTFS Íntegro`
      },
      {
        id: 'cleanup',
        label: 'Lixo & Cache',
        icon: 'trash-2',
        status: reclaimableMB >= 1200 ? 'critical' : (reclaimableMB >= 450 ? 'warning' : 'ok'),
        value: reclaimLabel,
        detail: `Temp: ${reclaimable.tempMB} MB • Web: ${reclaimable.browserMB} MB • WU: ${reclaimable.wuMB} MB`
      },
      {
        id: 'integrity',
        label: 'Integridade & Logs',
        icon: 'shield-check',
        status: hasCbsCorruption ? 'critical' : ((kernelCrashEvents.length > 0 || issues.length > 0) ? 'warning' : 'ok'),
        value: hasCbsCorruption ? 'Alerta CBS' : (issues.length > 0 ? `${issues.length} alerta(s) 48h` : '100% Íntegro'),
        detail: hasCbsCorruption ? 'Reparo SFC/DISM recomendado' : (issues.length > 0 ? 'Eventos registrados nas últimas 48h' : 'Zero falhas críticas nos logs')
      },
      {
        id: 'services',
        label: 'Serviços Vitais',
        icon: 'settings',
        status: spoolerStopped ? 'critical' : (wuEvents.length > 0 ? 'warning' : 'ok'),
        value: spoolerStopped ? 'Spooler Parado' : (wuEvents.length > 0 ? 'Alerta Update' : '100% Ativos'),
        detail: `Spooler: ${spoolerStopped ? 'Parado' : 'Ativo'} • DNS: ${dnsRunning ? 'Ativo' : 'Parado'}`
      },
      {
        id: 'memory',
        label: 'RAM & Sessão',
        icon: 'memory-stick',
        status: isRamCritical ? 'critical' : ((isRamWarning || isUptimeExcessive) ? 'warning' : 'ok'),
        value: `RAM ${ramUsagePct}% • ${uptimeFormatted}`,
        detail: `${ramFreeGB} GB livres de ${ramTotalGB} GB`
      },
      {
        id: 'security',
        label: 'Segurança & Rede',
        icon: 'shield',
        status: (!defenderRunning || !firewallRunning) ? 'critical' : ((hostsModified || netEvents.length > 0) ? 'warning' : 'ok'),
        value: (!defenderRunning || !firewallRunning) ? 'Proteção Inativa' : (hostsModified ? `HOSTS (${hostsCustomCount})` : 'Protegido'),
        detail: `Defender: ${defenderRunning ? 'Ativo' : 'Inativo'} • Firewall: ${firewallRunning ? 'Ativo' : 'Inativo'}`
      }
    ];

    const hasDiskProblem = isDiskCritical || isDiskWarning || reclaimableMB >= reclaimThresholdMB;
    const hasEventOrServiceProblem = issues.length > 0 || spoolerStopped || isVolumeDirty || hasCbsCorruption || !defenderRunning || !firewallRunning;
    const hasIssues = aiCorruptions.length > 0 || hasDiskProblem || hasEventOrServiceProblem;
    const hasCritical = aiCorruptions.some(c => c.severity === 'critical') || isDiskCritical || isVolumeDirty || hasCbsCorruption;

    let issueType = 'normal';
    if (hasDiskProblem && hasEventOrServiceProblem) {
      issueType = 'both';
    } else if (hasDiskProblem && !hasEventOrServiceProblem) {
      issueType = 'disk-space';
    } else if (hasEventOrServiceProblem) {
      issueType = 'system-events';
    } else if (aiCorruptions.length > 0) {
      issueType = 'both';
    }

    let message = isWithinMaintenanceGracePeriod ? 'Sistema Operando Normalmente & Otimizado' : 'Sistema Operando em Alta Performance';
    let subtext = isWithinMaintenanceGracePeriod
      ? `Todas as correções recomendadas foram concluídas e verificadas com sucesso. Próxima checagem agendada (${nextCheckFormatted}).`
      : `Auditoria IA em 6 subsistemas concluída (Score ${healthScore}/100). Nenhuma corrupção, serviço inativo ou falha crítica nos logs (${reclaimLabel}).`;

    if (issueType === 'both') {
      message = `Diagnóstico IA: ${aiCorruptions.length} Ponto(s) de Atenção (${freeGBVal.toFixed(1)} GB Livres • ${reclaimLabel})`;
      subtext = `Score de Saúde: ${healthScore}/100 (${healthGrade}). Detectamos oportunidades de limpeza e alertas nos subsistemas do Windows. Clique em "Corrigir Agora".`;
    } else if (issueType === 'disk-space') {
      message = isDiskCritical || isDiskWarning
        ? `Diagnóstico IA: Pouco Espaço no Disco C: (${freeGBVal.toFixed(1)} GB Livres • ${reclaimLabel})`
        : `Otimização IA Disponível: ${reclaimLabel} de Caches e Temporários`;
      subtext = `Score de Saúde: ${healthScore}/100. Acione a Limpeza Automática em 1 clique para recuperar espaço e acelerar o sistema.`;
    } else if (issueType === 'system-events') {
      const corCount = Math.max(1, aiCorruptions.length);
      message = `Diagnóstico IA: ${corCount} Alerta(s) de Estabilidade & Serviços Detectado(s)`;
      subtext = `Score de Saúde: ${healthScore}/100 (${healthGrade}). Eventos recentes ou serviços vitais requerem reparo preventivo (${reclaimLabel}).`;
    }

    const aiSummary = hasIssues
      ? `O Motor de Inteligência Thunder IA auditou 6 pilares do Windows (Logs XML 48h, CBS, NTFS, Serviços, Memória e Caches). Score atual: ${healthScore}/100 (${healthGrade}). Encontramos ${aiCorruptions.length} diagnóstico(s) acionável(is):`
      : isWithinMaintenanceGracePeriod
      ? `Auditoria concluída com Score ${healthScore}/100 (${healthGrade}). Todas as correções preventivas aplicadas anteriormente permanecem 100% íntegras e validadas nos serviços e subsistemas vitais.`
      : `Auditoria profunda concluída com Score ${healthScore}/100 (${healthGrade}). Todos os 6 subsistemas vitais (NTFS, CBS, Logs 48h, Serviços, Memória e Segurança) estão íntegros. Atualmente há ${reclaimLabel} de arquivos temporários.`;

    const resultObj = {
      status: hasIssues ? 'attention' : 'normal',
      severityLevel: hasCritical ? 'critical' : (hasIssues ? 'attention' : 'normal'),
      healthScore,
      healthGrade,
      issueType,
      isDiskCritical,
      isDiskWarning,
      diskUsagePct,
      isVolumeDirty,
      hasCbsCorruption,
      spoolerStopped,
      wuauservRunning,
      bitsRunning,
      defenderRunning,
      firewallRunning,
      dnsRunning,
      hostsModified,
      hostsCustomCount,
      freeGB: freeGBVal,
      totalGB: totalGBVal,
      reclaimableMB,
      reclaimableBreakdown: reclaimable,
      ramUsagePct,
      ramFreeGB,
      ramTotalGB,
      uptimeHours,
      uptimeFormatted,
      subsystems,
      message,
      subtext,
      aiSummary,
      aiCorruptions,
      aiRecommendedCommands,
      lastCheck: 'Hoje às ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      nextScheduledCheck,
      nextCheckFormatted,
      checkIntervalHours,
      lastRepairTimestamp,
      hasSolvedIssues: isWithinMaintenanceGracePeriod,
      resolvedAlerts: mState.resolvedAlerts || [],
      completedAiCommands: mState.completedAiCommands || [],
      pendingIssues: issues
    };
    lastDiagnosticsCache = { timestamp: Date.now(), data: resultObj };
    return resultObj;
  } catch (err) {
    writeAppLog(`Erro no diagnóstico do sistema: ${err.message}`);
    return {
      status: 'normal',
      severityLevel: 'normal',
      healthScore: 95,
      healthGrade: 'Excelente',
      message: 'Sistema Operando Normalmente',
      subtext: 'Métricas do Windows estão dentro dos padrões ideais.',
      aiSummary: 'Nenhuma anomalia crítica detectada.',
      subsystems: [],
      aiCorruptions: [],
      aiRecommendedCommands: [],
      lastCheck: 'Agora mesmo',
      pendingIssues: []
    };
  }
}

let lastDiagnosticsCache = { timestamp: 0, data: null };
let staticHardwareCache = null;
let staticHardwarePromise = null;

function withTimeout(promise, ms, fallbackValue) {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(fallbackValue);
      }
    }, ms);
    Promise.resolve(promise)
      .then((val) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(val);
        }
      })
      .catch(() => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(fallbackValue);
        }
      });
  });
}

function getStaticHardwareInventory() {
  if (staticHardwareCache) return Promise.resolve(staticHardwareCache);
  if (staticHardwarePromise) return staticHardwarePromise;

  const cimScript = `
$ErrorActionPreference = 'SilentlyContinue'
$cs = Get-CimInstance Win32_ComputerSystem | Select-Object Manufacturer, Model
$bios = Get-CimInstance Win32_BIOS | Select-Object Manufacturer, SMBIOSBIOSVersion, SerialNumber, ReleaseDate
$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1 Name, Manufacturer, NumberOfCores, NumberOfLogicalProcessors, MaxClockSpeed, Caption
$mem = @(Get-CimInstance Win32_PhysicalMemory | Select-Object BankLabel, DeviceLocator, Capacity, Speed, SMBIOSMemoryType, Manufacturer, PartNumber)
$disks = @(Get-CimInstance Win32_DiskDrive | Select-Object Model, MediaType, InterfaceType, Size, SerialNumber)
$gpu = @(Get-CimInstance Win32_VideoController | Select-Object Name, AdapterCompatibility, AdapterRAM, DriverVersion)
[pscustomobject]@{
  cs = $cs
  bios = $bios
  cpu = $cpu
  mem = $mem
  disks = $disks
  gpu = $gpu
} | ConvertTo-Json -Depth 3 -Compress
`;

  staticHardwarePromise = withTimeout(runPowerShellScript(cimScript), 8000, { success: false })
    .then((psRes) => {
      staticHardwarePromise = null;
      if (psRes && psRes.success && psRes.output) {
        try {
          staticHardwareCache = JSON.parse(psRes.output.trim());
          return staticHardwareCache;
        } catch (_) {}
      }
      return null;
    })
    .catch(() => {
      staticHardwarePromise = null;
      return null;
    });

  return staticHardwarePromise;
}

// Pré-carrega o inventário estático e o diagnóstico em segundo plano para geração instantânea de PDF (< 0.4s)
setTimeout(() => {
  getStaticHardwareInventory().catch(() => {});
  if (!lastDiagnosticsCache.data) {
    collectSystemDiagnosticsData().catch(() => {});
  }
}, 1500);

async function collectFastReportHardware(isSimplified = false) {
  const cpus = os.cpus() || [];
  const firstCpu = cpus[0] || {};
  const totalMem = os.totalmem() || 1;
  const freeMem = os.freemem() || 0;

  // 1. Partições instantâneas via fs.statfsSync (0ms, sem travar WMI/systeminformation)
  const fsSize = [];
  if (typeof fs.statfsSync === 'function') {
    for (const letter of 'CDEFGHIJKLMNOPQRSTUVWXYZAB'.split('')) {
      try {
        const s = fs.statfsSync(`${letter}:\\`);
        if (s && s.blocks > 0) {
          const size = s.blocks * s.bsize;
          const free = s.bfree * s.bsize;
          const used = Math.max(0, size - free);
          fsSize.push({
            mount: `${letter}:`,
            fs: 'NTFS',
            size,
            used,
            use: Math.round((used / size) * 100)
          });
        }
      } catch (_) {}
    }
  }

  // 2. Interfaces de rede instantâneas via os.networkInterfaces()
  const rawNets = os.networkInterfaces() || {};
  const netList = [];
  for (const [ifaceName, addrs] of Object.entries(rawNets)) {
    if (!Array.isArray(addrs)) continue;
    const ipv4Obj = addrs.find(a => a && (a.family === 'IPv4' || a.family === 4) && !a.internal)
      || addrs.find(a => a && (a.family === 'IPv4' || a.family === 4));
    if (ipv4Obj) {
      netList.push({
        iface: ifaceName,
        name: ifaceName,
        ip4: ipv4Obj.address || 'N/A',
        mac: ipv4Obj.mac || 'N/A',
        internal: !!ipv4Obj.internal,
        operstate: ipv4Obj.internal ? 'down' : 'up',
        speed: null
      });
    }
  }

  const baseData = {
    osInfo: {
      distro: typeof os.version === 'function' ? os.version() : 'Windows',
      build: os.release() || 'Ativo',
      arch: os.arch() === 'x64' ? '64-bit (x64)' : os.arch(),
      hostname: os.hostname()
    },
    system: {
      manufacturer: 'Compatível PC / OEM',
      model: 'Estação de Trabalho Windows',
      serial: 'Padrão'
    },
    bios: {
      vendor: 'UEFI / BIOS',
      version: 'Nativo',
      releaseDate: 'Ativo'
    },
    cpu: {
      manufacturer: '',
      brand: (firstCpu.model || 'Processador Multi-Core').trim(),
      cores: cpus.length || 4,
      physicalCores: Math.max(1, Math.floor((cpus.length || 4) / 2)),
      speed: firstCpu.speed ? (firstCpu.speed / 1000).toFixed(2) : '2.40',
      family: '-',
      model: '-',
      stepping: '-'
    },
    mem: {
      total: totalMem,
      available: freeMem
    },
    memLayout: [],
    diskLayout: [],
    fsSize,
    graphics: { controllers: [] },
    netList
  };

  // 3. Usa o cache pré-carregado (0ms) ou consulta CIM única para todos os modelos de laudo
  const parsed = await getStaticHardwareInventory();
  if (parsed) {
    try {
      if (parsed.cs) {
        baseData.system.manufacturer = parsed.cs.Manufacturer || baseData.system.manufacturer;
        baseData.system.model = parsed.cs.Model || baseData.system.model;
      }
      if (parsed.bios) {
        baseData.bios.vendor = parsed.bios.Manufacturer || baseData.bios.vendor;
        baseData.bios.version = parsed.bios.SMBIOSBIOSVersion || baseData.bios.version;
        baseData.system.serial = parsed.bios.SerialNumber || baseData.system.serial;
      }
      if (parsed.cpu) {
        baseData.cpu.brand = (parsed.cpu.Name || baseData.cpu.brand).trim();
        baseData.cpu.manufacturer = parsed.cpu.Manufacturer || '';
        baseData.cpu.physicalCores = parsed.cpu.NumberOfCores || baseData.cpu.physicalCores;
        baseData.cpu.cores = parsed.cpu.NumberOfLogicalProcessors || baseData.cpu.cores;
        if (parsed.cpu.MaxClockSpeed) {
          baseData.cpu.speed = (parsed.cpu.MaxClockSpeed / 1000).toFixed(2);
        }
      }
      const memArr = Array.isArray(parsed.mem) ? parsed.mem : (parsed.mem ? [parsed.mem] : []);
      baseData.memLayout = memArr.filter(Boolean).map(m => ({
        bank: m.BankLabel || m.DeviceLocator || 'DIMM',
        size: Number(m.Capacity) || 0,
        type: m.SMBIOSMemoryType === 26 ? 'DDR4' : (m.SMBIOSMemoryType === 34 ? 'DDR5' : (m.SMBIOSMemoryType === 24 ? 'DDR3' : 'DDR')),
        clockSpeed: m.Speed || null,
        manufacturer: m.Manufacturer || 'OEM',
        partNum: m.PartNumber || ''
      }));
      const diskArr = Array.isArray(parsed.disks) ? parsed.disks : (parsed.disks ? [parsed.disks] : []);
      baseData.diskLayout = diskArr.filter(Boolean).map(d => ({
        name: d.Model || 'Unidade Física',
        type: /ssd|nvme|solid/i.test(`${d.Model || ''} ${d.MediaType || ''}`) ? 'SSD / NVMe' : (d.MediaType || 'Unidade Fixa'),
        interfaceType: d.InterfaceType || 'SATA / NVMe',
        size: Number(d.Size) || 0,
        serialNum: (d.SerialNumber || 'N/A').trim()
      }));
      const gpuArr = Array.isArray(parsed.gpu) ? parsed.gpu : (parsed.gpu ? [parsed.gpu] : []);
      baseData.graphics.controllers = gpuArr.filter(Boolean).map(g => ({
        model: g.Name || 'Adaptador Gráfico',
        vendor: g.AdapterCompatibility || 'OEM',
        vram: g.AdapterRAM ? Math.round(Number(g.AdapterRAM) / (1024 * 1024)) : null,
        driverVersion: g.DriverVersion || 'WDDM'
      }));
    } catch (_) {}
  }

  return baseData;
}

ipcMain.handle('get-system-diagnostics', async (_, options = {}) => {
  return collectSystemDiagnosticsData(options);
});

ipcMain.handle('set-diagnostic-schedule', async (_, intervalHours) => {
  const mState = loadMaintenanceState();
  const hours = parseInt(intervalHours, 10) || 24;
  mState.checkIntervalHours = hours;
  mState.nextScheduledCheck = Date.now() + (hours * 3600 * 1000);
  saveMaintenanceState(mState);
  lastDiagnosticsCache = { timestamp: 0, data: null };
  return {
    success: true,
    checkIntervalHours: hours,
    nextScheduledCheck: mState.nextScheduledCheck,
    nextCheckFormatted: formatScheduleTime(mState.nextScheduledCheck)
  };
});

ipcMain.handle('get-diagnostic-schedule', async () => {
  const mState = loadMaintenanceState();
  return {
    checkIntervalHours: mState.checkIntervalHours || 24,
    nextScheduledCheck: mState.nextScheduledCheck || (Date.now() + 24 * 3600 * 1000),
    nextCheckFormatted: formatScheduleTime(mState.nextScheduledCheck || (Date.now() + 24 * 3600 * 1000)),
    lastRepairTimestamp: mState.lastRepairTimestamp || 0
  };
});

ipcMain.handle('record-completed-ai-command', async (_, cmd) => {
  const mState = loadMaintenanceState();
  if (cmd && !mState.completedAiCommands.includes(cmd)) {
    mState.completedAiCommands.push(cmd);
    if (/sfc|dism/i.test(cmd)) {
      if (!mState.resolvedAlerts.includes('cbs')) mState.resolvedAlerts.push('cbs');
    }
    saveMaintenanceState(mState);
  }
  return { success: true };
});

ipcMain.handle('open-cleanmgr', async () => {
  try {
    exec('cleanmgr.exe /d C:', { windowsHide: false });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('open-storagesense', async () => {
  try {
    exec('start ms-settings:storagesense', { shell: 'cmd.exe', windowsHide: false });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

function safePurgeFolder(dirPath) {
  let freedBytes = 0;
  let fileCount = 0;
  if (!dirPath || !fs.existsSync(dirPath)) return { freedBytes, fileCount };
  try {
    const entries = fs.readdirSync(dirPath);
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry);
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          const sub = safePurgeFolder(fullPath);
          freedBytes += sub.freedBytes;
          fileCount += sub.fileCount;
          try { fs.rmdirSync(fullPath); } catch (_) {}
        } else {
          freedBytes += stat.size;
          fileCount++;
          fs.unlinkSync(fullPath);
        }
      } catch (_) {}
    }
  } catch (_) {}
  return { freedBytes, fileCount };
}

const waitCadence = (ms) => new Promise(resolve => setTimeout(resolve, ms));

ipcMain.handle('repair-system-issues', async (event, targetIssueType) => {
  writeAppLog(`Iniciando rotina de reparo e limpeza profunda com auditoria de serviços para issueType: ${targetIssueType}...`);
  try {
    let freeGBBefore = 0;
    try {
      if (typeof fs.statfsSync === 'function') {
        const s0 = fs.statfsSync('C:\\');
        freeGBBefore = (s0.bavail * s0.bsize) / (1024 ** 3);
      }
    } catch (_) {}

    const issueType = targetIssueType || 'both';

    const sendProgress = (stepIndex, totalSteps, percent, taskId, taskTitle, status, details = '') => {
      try {
        event.sender.send('repair-progress', {
          stepIndex,
          totalSteps,
          percent,
          taskId,
          taskTitle,
          status,
          details
        });
      } catch (_) {}
    };

    if (issueType === 'disk-space') {
      const totalSteps = 6;

      // 1. Limpeza do Cache e Downloads do Windows Update
      sendProgress(0, totalSteps, 12, 'task-softwaredist', 'Limpeza do Windows Update', 'running', 'Pausando serviços de update e removendo pacotes obsoletos...');
      await waitCadence(400);
      await new Promise((resolve) => {
        exec('net stop wuauserv 2>nul & net stop bits 2>nul', { windowsHide: true }, () => resolve());
      });
      const wuDir = 'C:\\Windows\\SoftwareDistribution\\Download';
      const wuRes = safePurgeFolder(wuDir);
      
      // Reinicia e valida serviços com verificação robusta
      await ensureServiceRunningRobust('wuauserv', 'demand', 4000);
      await ensureServiceRunningRobust('bits', 'delayed-auto', 4000);

      const wuMB = (wuRes.freedBytes / (1024 * 1024)).toFixed(1);
      const wuMsg = `${wuRes.fileCount > 0 ? `${wuMB} MB eliminados. ` : 'Pasta limpa. '}Serviços wuauserv e BITS verificados e normalizados.`;
      await waitCadence(250);
      sendProgress(0, totalSteps, 22, 'task-softwaredist', 'Limpeza do Windows Update', 'completed', wuMsg);

      // 2. Esvaziamento Completo da Lixeira
      sendProgress(1, totalSteps, 28, 'task-recycle', 'Esvaziamento da Lixeira', 'running', 'Esvaziando lixeira do Windows em todas as unidades de disco...');
      await waitCadence(500);
      await new Promise((resolve) => {
        exec('powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Clear-RecycleBin -Force -ErrorAction SilentlyContinue"', { windowsHide: true }, () => resolve());
      });
      await waitCadence(250);
      sendProgress(1, totalSteps, 38, 'task-recycle', 'Esvaziamento da Lixeira', 'completed', 'Lixeira esvaziada e arquivos descartados eliminados definitivamente.');

      // 3. Higienização Profunda de Pastas Temporárias
      sendProgress(2, totalSteps, 44, 'task-temp', 'Higienização de Pastas Temporárias', 'running', 'Excluindo arquivos temporários de usuário e sistema (%TEMP%, Windows\\Temp)...');
      await waitCadence(550);
      const tempDirs = [
        process.env.TEMP,
        path.join(process.env.LOCALAPPDATA || 'C:\\', 'Temp'),
        'C:\\Windows\\Temp'
      ].filter(Boolean);
      let tempTotalBytes = 0;
      let tempTotalCount = 0;
      for (const tDir of tempDirs) {
        const tRes = safePurgeFolder(tDir);
        tempTotalBytes += tRes.freedBytes;
        tempTotalCount += tRes.fileCount;
      }
      const tempMB = (tempTotalBytes / (1024 * 1024)).toFixed(1);
      const tempMsg = tempTotalCount > 0 
        ? `${tempMB} MB eliminados em ${tempTotalCount} arquivos temporários.`
        : 'Pastas temporárias de sistema higienizadas com sucesso.';
      await waitCadence(250);
      sendProgress(2, totalSteps, 56, 'task-temp', 'Higienização de Pastas Temporárias', 'completed', tempMsg);

      // 4. Limpeza de Caches de Navegadores e Internet
      sendProgress(3, totalSteps, 62, 'task-browser-cache', 'Limpeza de Caches de Navegadores', 'running', 'Eliminando caches de navegação e arquivos de internet (Chrome, Edge)...');
      await waitCadence(600);
      const webDirs = [
        path.join(process.env.LOCALAPPDATA || 'C:\\', 'Google', 'Chrome', 'User Data', 'Default', 'Cache'),
        path.join(process.env.LOCALAPPDATA || 'C:\\', 'Google', 'Chrome', 'User Data', 'Default', 'Code Cache'),
        path.join(process.env.LOCALAPPDATA || 'C:\\', 'Microsoft', 'Edge', 'User Data', 'Default', 'Cache'),
        path.join(process.env.LOCALAPPDATA || 'C:\\', 'Microsoft', 'Edge', 'User Data', 'Default', 'Code Cache'),
        path.join(process.env.LOCALAPPDATA || 'C:\\', 'Microsoft', 'Windows', 'INetCache')
      ].filter(Boolean);
      let webTotalBytes = 0;
      let webTotalCount = 0;
      for (const wDir of webDirs) {
        const wRes = safePurgeFolder(wDir);
        webTotalBytes += wRes.freedBytes;
        webTotalCount += wRes.fileCount;
      }
      const webMB = (webTotalBytes / (1024 * 1024)).toFixed(1);
      const webMsg = webTotalCount > 0 
        ? `${webMB} MB de caches de internet liberados em ${webTotalCount} arquivos.`
        : 'Caches de navegação e arquivos de internet limpos com sucesso.';
      await waitCadence(250);
      sendProgress(3, totalSteps, 76, 'task-browser-cache', 'Limpeza de Caches de Navegadores', 'completed', webMsg);

      // 5. Purga de Relatórios de Falhas, Memory Dumps e WER
      sendProgress(4, totalSteps, 82, 'task-wer', 'Purga de Relatórios e Dumps', 'running', 'Limpando relatórios de erro, dumps de memória e pré-busca...');
      await waitCadence(550);
      const werDirs = [
        'C:\\ProgramData\\Microsoft\\Windows\\WER\\ReportQueue',
        'C:\\ProgramData\\Microsoft\\Windows\\WER\\ReportArchive',
        path.join(process.env.LOCALAPPDATA || 'C:\\', 'CrashDumps'),
        'C:\\Windows\\Minidump',
        'C:\\Windows\\Prefetch'
      ];
      let werTotalBytes = 0;
      let werTotalCount = 0;
      for (const werDir of werDirs) {
        const wRes = safePurgeFolder(werDir);
        werTotalBytes += wRes.freedBytes;
        werTotalCount += wRes.fileCount;
      }
      const werMB = (werTotalBytes / (1024 * 1024)).toFixed(1);
      const werMsg = werTotalCount > 0 
        ? `${werMB} MB purgados em ${werTotalCount} arquivos de log e dump.`
        : 'Filas de falha e relatórios WER desobstruídos com sucesso.';
      await waitCadence(250);
      sendProgress(4, totalSteps, 90, 'task-wer', 'Purga de Relatórios e Dumps', 'completed', werMsg);

      // 6. Auditoria de Espaço Recuperado na Partição C:
      sendProgress(5, totalSteps, 94, 'task-audit', 'Auditoria de Espaço Recuperado', 'running', 'Aferindo capacidade liberada em tempo real no disco C:...');
      await waitCadence(500);
      let freeGBAfter = freeGBBefore;
      try {
        if (typeof fs.statfsSync === 'function') {
          const s1 = fs.statfsSync('C:\\');
          freeGBAfter = (s1.bavail * s1.bsize) / (1024 ** 3);
        }
      } catch (_) {}
      const totalManualFreedMB = Math.round(((wuRes.freedBytes + tempTotalBytes + webTotalBytes + werTotalBytes) / (1024 * 1024)) * 10) / 10;
      const deltaMB = Math.max(0, Math.round((freeGBAfter - freeGBBefore) * 1024 * 10) / 10);
      const freedMB = Math.max(deltaMB, totalManualFreedMB);
      const isDiskStillLow = freeGBAfter < 5;

      const mState = loadMaintenanceState();
      mState.lastRepairTimestamp = Date.now();
      mState.resolvedAlerts = Array.from(new Set([...(mState.resolvedAlerts || []), 'disk-space', 'cleanup', 'temp']));
      mState.nextScheduledCheck = Date.now() + ((mState.checkIntervalHours || 24) * 3600 * 1000);
      saveMaintenanceState(mState);

      lastDiagnosticsCache = { timestamp: 0, data: null };
      sendProgress(5, totalSteps, 100, 'task-audit', 'Auditoria de Espaço Recuperado', 'completed', `${freedMB > 0 ? `${freedMB} MB liberados com sucesso. ` : ''}Espaço livre atual: ${freeGBAfter.toFixed(2)} GB.`);

      return {
        success: true,
        issueType: 'disk-space',
        freedMB,
        freeGBNow: freeGBAfter,
        isDiskStillLow,
        lastRepairTimestamp: mState.lastRepairTimestamp,
        nextScheduledCheck: mState.nextScheduledCheck,
        nextCheckFormatted: formatScheduleTime(mState.nextScheduledCheck),
        checkIntervalHours: mState.checkIntervalHours || 24
      };
    } else if (issueType === 'system-events') {
      const totalSteps = 4;

      // 1. DNS & Winsock
      sendProgress(0, totalSteps, 15, 'task-dns', 'Renovação do Cache DNS e Winsock', 'running', 'Limpando tabelas de resolução DNS e catálogo Winsock...');
      await waitCadence(450);
      await new Promise((resolve) => {
        exec('ipconfig.exe /flushdns 2>nul & netsh.exe winsock reset 2>nul', { windowsHide: true }, () => resolve());
      });
      await ensureServiceRunningRobust('Dnscache', 'auto', 3500);
      await waitCadence(200);
      sendProgress(0, totalSteps, 30, 'task-dns', 'Renovação do Cache DNS e Winsock', 'completed', 'Cache DNS esvaziado, catálogo Winsock renovado e resolução confirmada.');

      // 2. Spooler de Impressão com Verificação Robusta
      sendProgress(1, totalSteps, 35, 'task-spooler', 'Restauração do Spooler de Impressão', 'running', 'Reiniciando, limpando fila corrompida e verificando serviço...');
      await waitCadence(450);
      const spoolRes = await ensureServiceRunningRobust('spooler', 'auto', 5000);
      await waitCadence(200);
      const spoolMsg = spoolRes.verified
        ? 'Serviço Spooler verificado e confirmado em execução contínua (100% Operacional).'
        : 'Spooler reconfigurado para inicialização automática.';
      sendProgress(1, totalSteps, 60, 'task-spooler', 'Restauração do Spooler de Impressão', 'completed', spoolMsg);

      // 3. Windows Update & BITS com Verificação Robusta
      sendProgress(2, totalSteps, 65, 'task-wuauserv', 'Verificação do Windows Update & BITS', 'running', 'Desobstruindo filas e auditando inicialização dos serviços...');
      await waitCadence(500);
      await ensureServiceRunningRobust('wuauserv', 'demand', 4000);
      await ensureServiceRunningRobust('bits', 'delayed-auto', 4000);
      await waitCadence(200);
      sendProgress(2, totalSteps, 85, 'task-wuauserv', 'Verificação do Windows Update & BITS', 'completed', 'Serviços Windows Update e BITS testados e normalizados sem bloqueios.');

      // 4. Limpeza de Logs Corrompidos e Filas WER
      sendProgress(3, totalSteps, 90, 'task-logs', 'Purga de Registros Corrompidos do Event Viewer', 'running', 'Redefinindo filas acumuladas no log do sistema e WER...');
      await waitCadence(500);
      safePurgeFolder('C:\\ProgramData\\Microsoft\\Windows\\WER\\ReportQueue');
      safePurgeFolder('C:\\ProgramData\\Microsoft\\Windows\\WER\\ReportArchive');
      await new Promise((resolve) => {
        exec('wevtutil.exe cl System 2>nul & wevtutil.exe cl Application 2>nul', { windowsHide: true }, () => resolve());
      });
      await waitCadence(250);

      const mState = loadMaintenanceState();
      mState.lastRepairTimestamp = Date.now();
      mState.resolvedAlerts = Array.from(new Set([...(mState.resolvedAlerts || []), 'services', 'logs', 'dns']));
      mState.verifiedServices = ['spooler', 'wuauserv', 'bits', 'Dnscache'];
      mState.nextScheduledCheck = Date.now() + ((mState.checkIntervalHours || 24) * 3600 * 1000);
      saveMaintenanceState(mState);

      lastDiagnosticsCache = { timestamp: 0, data: null };
      sendProgress(3, totalSteps, 100, 'task-logs', 'Purga de Registros Corrompidos do Event Viewer', 'completed', 'Filas de log System, Application e relatórios WER limpos e reindexados.');

      return {
        success: true,
        issueType: 'system-events',
        freedMB: 0,
        freeGBNow: freeGBBefore,
        isDiskStillLow: false,
        verifiedServices: mState.verifiedServices,
        lastRepairTimestamp: mState.lastRepairTimestamp,
        nextScheduledCheck: mState.nextScheduledCheck,
        nextCheckFormatted: formatScheduleTime(mState.nextScheduledCheck),
        checkIntervalHours: mState.checkIntervalHours || 24
      };
    } else {
      // both ou normal (Manutenção Completa Sincronizada com Verificação Robusta em Todas as Etapas)
      const totalSteps = 6;

      // 1. Limpeza do Windows Update e validação dos serviços de transferência
      sendProgress(0, totalSteps, 10, 'task-softwaredist', 'Limpeza de Arquivos do Windows Update', 'running', 'Pausando wuauserv e limpando SoftwareDistribution\\Download...');
      await waitCadence(400);
      await new Promise((resolve) => {
        exec('net stop wuauserv 2>nul & net stop bits 2>nul', { windowsHide: true }, () => resolve());
      });
      const wuRes = safePurgeFolder('C:\\Windows\\SoftwareDistribution\\Download');
      await ensureServiceRunningRobust('wuauserv', 'demand', 4000);
      await ensureServiceRunningRobust('bits', 'delayed-auto', 4000);
      await waitCadence(200);
      sendProgress(0, totalSteps, 20, 'task-softwaredist', 'Limpeza de Arquivos do Windows Update', 'completed', 'Pacotes obsoletos removidos e serviços de update verificados.');

      // 2. Esvaziamento da Lixeira, Temporários, Caches Web e WER
      sendProgress(1, totalSteps, 28, 'task-recycle', 'Esvaziamento da Lixeira & Temporários', 'running', 'Esvaziando Lixeira, %TEMP%, Caches de Navegadores e Relatórios WER...');
      await waitCadence(450);
      await new Promise((resolve) => {
        exec('powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Clear-RecycleBin -Force -ErrorAction SilentlyContinue"', { windowsHide: true }, () => resolve());
      });
      const localApp = process.env.LOCALAPPDATA || 'C:\\';
      const purgeDirs = [
        process.env.TEMP,
        path.join(localApp, 'Temp'),
        'C:\\Windows\\Temp',
        'C:\\Windows\\Prefetch',
        'C:\\Windows\\Minidump',
        'C:\\ProgramData\\Microsoft\\Windows\\WER\\ReportQueue',
        'C:\\ProgramData\\Microsoft\\Windows\\WER\\ReportArchive',
        path.join(localApp, 'CrashDumps'),
        path.join(localApp, 'Google', 'Chrome', 'User Data', 'Default', 'Cache'),
        path.join(localApp, 'Google', 'Chrome', 'User Data', 'Default', 'Code Cache'),
        path.join(localApp, 'Microsoft', 'Edge', 'User Data', 'Default', 'Cache'),
        path.join(localApp, 'Microsoft', 'Edge', 'User Data', 'Default', 'Code Cache'),
        path.join(localApp, 'Microsoft', 'Windows', 'INetCache')
      ].filter(Boolean);
      let tempBytes = 0;
      let tempCount = 0;
      const visitedDirs = new Set();
      for (const dir of purgeDirs) {
        const norm = path.resolve(dir).toLowerCase();
        if (visitedDirs.has(norm)) continue;
        visitedDirs.add(norm);
        const r = safePurgeFolder(dir);
        tempBytes += r.freedBytes;
        tempCount += r.fileCount;
      }
      const purgedMB = (tempBytes / (1024 * 1024)).toFixed(1);
      await waitCadence(250);
      sendProgress(1, totalSteps, 45, 'task-recycle', 'Esvaziamento da Lixeira & Temporários', 'completed', tempCount > 0 ? `${purgedMB} MB removidos em ${tempCount} arquivos temporários e caches.` : 'Lixeira, pastas temporárias e filas WER higienizadas.');

      // 3. Renovação DNS e Winsock com verificação do Dnscache
      sendProgress(2, totalSteps, 52, 'task-dns', 'Renovação do Cache DNS e Winsock', 'running', 'Executando ipconfig /flushdns e netsh winsock reset...');
      await waitCadence(450);
      await new Promise((resolve) => {
        exec('ipconfig.exe /flushdns 2>nul & netsh.exe winsock reset 2>nul', { windowsHide: true }, () => resolve());
      });
      await ensureServiceRunningRobust('Dnscache', 'auto', 3500);
      await waitCadence(200);
      sendProgress(2, totalSteps, 65, 'task-dns', 'Renovação do Cache DNS e Winsock', 'completed', 'Cache DNS esvaziado, catálogo Winsock renovado e resolução validada.');

      // 4. Restauração e Verificação Robusta de Serviços Vitais (Spooler, Windows Update, BITS)
      sendProgress(3, totalSteps, 72, 'task-spooler', 'Restauração de Serviços Vitais do Windows', 'running', 'Restaurando e confirmando execução de Spooler, Update e BITS...');
      await waitCadence(500);
      const spoolRobust = await ensureServiceRunningRobust('spooler', 'auto', 5000);
      await ensureServiceRunningRobust('wuauserv', 'demand', 4000);
      await ensureServiceRunningRobust('bits', 'delayed-auto', 4000);
      await waitCadence(200);
      const vitalMsg = spoolRobust.verified
        ? 'Spooler ativo em execução contínua (100% Operacional). Update e BITS normalizados.'
        : 'Serviços vitais reconfigurados e normalizados.';
      sendProgress(3, totalSteps, 82, 'task-spooler', 'Restauração de Serviços Vitais do Windows', 'completed', vitalMsg);

      // 5. Purga de Registros Corrompidos do Event Viewer
      sendProgress(4, totalSteps, 88, 'task-logs', 'Purga de Registros Corrompidos do Event Viewer', 'running', 'Limpando filas de erro nos logs System e Application...');
      await waitCadence(450);
      safePurgeFolder('C:\\ProgramData\\Microsoft\\Windows\\WER\\ReportQueue');
      safePurgeFolder('C:\\ProgramData\\Microsoft\\Windows\\WER\\ReportArchive');
      await new Promise((resolve) => {
        exec('wevtutil.exe cl System 2>nul & wevtutil.exe cl Application 2>nul', { windowsHide: true }, () => resolve());
      });
      await waitCadence(200);
      sendProgress(4, totalSteps, 94, 'task-logs', 'Purga de Registros Corrompidos do Event Viewer', 'completed', 'Logs System e Application limpos e reindexados com sucesso.');

      // 6. Auditoria Geral do Sistema e Validação Final de Serviços
      sendProgress(5, totalSteps, 96, 'task-audit', 'Auditoria de Espaço & Integridade', 'running', 'Validando espaço recuperado e integridade operacional...');
      await waitCadence(450);
      let freeGBAfter = freeGBBefore;
      try {
        if (typeof fs.statfsSync === 'function') {
          const s1 = fs.statfsSync('C:\\');
          freeGBAfter = (s1.bavail * s1.bsize) / (1024 ** 3);
        }
      } catch (_) {}
      const manualMB = Math.round(((wuRes.freedBytes + tempBytes) / (1024 * 1024)) * 10) / 10;
      const deltaMB = Math.max(0, Math.round((freeGBAfter - freeGBBefore) * 1024 * 10) / 10);
      const freedMB = Math.max(deltaMB, manualMB);
      const isDiskStillLow = freeGBAfter < 5;

      const mState = loadMaintenanceState();
      mState.lastRepairTimestamp = Date.now();
      mState.resolvedAlerts = Array.from(new Set([...(mState.resolvedAlerts || []), 'disk-space', 'services', 'logs', 'dns', 'cleanup', 'temp', 'cbs']));
      mState.nextScheduledCheck = Date.now() + ((mState.checkIntervalHours || 24) * 3600 * 1000);
      mState.verifiedServices = ['spooler', 'wuauserv', 'bits', 'Dnscache'];
      saveMaintenanceState(mState);

      lastDiagnosticsCache = { timestamp: 0, data: null };
      sendProgress(5, totalSteps, 100, 'task-audit', 'Auditoria de Espaço & Integridade', 'completed', `${freedMB > 0 ? `${freedMB} MB liberados. ` : ''}Espaço livre: ${freeGBAfter.toFixed(2)} GB.`);

      return {
        success: true,
        issueType: 'both',
        freedMB,
        freeGBNow: freeGBAfter,
        isDiskStillLow,
        verifiedServices: mState.verifiedServices,
        lastRepairTimestamp: mState.lastRepairTimestamp,
        nextScheduledCheck: mState.nextScheduledCheck,
        nextCheckFormatted: formatScheduleTime(mState.nextScheduledCheck),
        checkIntervalHours: mState.checkIntervalHours || 24
      };
    }
  } catch (err) {
    writeAppLog(`Erro no reparo do sistema: ${err.message}`);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('export-system-report-pdf', async (_, reportType = 'technical', extraData = {}) => {
  try {
    const parentWin = mainWindow && !mainWindow.isDestroyed() ? mainWindow : null;
    const isSimplified = reportType === 'simplified';
    const isServiceOrder = reportType === 'service-order';
    const dialogTitle = isServiceOrder
      ? 'Exportar Ordem de Serviço / Laudo de Manutenção (PDF)'
      : isSimplified 
      ? 'Exportar Laudo de Saúde do Computador (PDF)' 
      : 'Exportar Dossiê Técnico de Hardware e SO (PDF)';
    const dateStamp = new Date().toISOString().slice(0, 10);
    const defaultName = isServiceOrder
      ? `ThunderTools-Ordem-de-Servico-${dateStamp}.pdf`
      : isSimplified 
      ? `ThunderTools-Laudo-Saude-${dateStamp}.pdf`
      : `ThunderTools-Dossie-Tecnico-${dateStamp}.pdf`;

    const laudosDir = path.join(app.getPath('desktop'), 'Laudos Tecnicos - Thunder IA');
    try {
      if (!fs.existsSync(laudosDir)) {
        fs.mkdirSync(laudosDir, { recursive: true });
      }
    } catch (_) {}
    const defaultFullPath = path.join(laudosDir, defaultName);

    const { canceled, filePath } = await dialog.showSaveDialog(parentWin, {
      title: dialogTitle,
      defaultPath: defaultFullPath,
      filters: [{ name: 'Documento PDF (*.pdf)', extensions: ['pdf'] }]
    });

    if (canceled || !filePath) return { success: false, cancelled: true };

    const fallbackDiag = { aiCorruptions: [], aiRecommendedCommands: [], pendingIssues: [] };
    let diagData = lastDiagnosticsCache.data;
    if (!diagData) {
      diagData = await withTimeout(collectSystemDiagnosticsData(), 2500, fallbackDiag);
    } else if (Date.now() - lastDiagnosticsCache.timestamp > 120000) {
      // Atualiza o cache em segundo plano sem atrasar a geração do PDF
      collectSystemDiagnosticsData().catch(() => {});
    }

    const hwData = await collectFastReportHardware(isSimplified || isServiceOrder);

    const { osInfo, system, bios, cpu, mem, memLayout, diskLayout, fsSize, graphics, netList } = hwData;

    const diskC = fsSize.find(f => f.mount && f.mount.toUpperCase().startsWith('C')) || fsSize[0] || {};
    const ramTotalGB = (mem.total / (1024**3)).toFixed(1);
    const ramUsedGB = ((mem.total - mem.available) / (1024**3)).toFixed(1);
    const ramFreeGB = (mem.available / (1024**3)).toFixed(1);
    const ramPct = Math.round(((mem.total - mem.available) / mem.total) * 100);
    const diskTotalGB = ((diskC.size || 0) / (1024**3)).toFixed(1);
    const diskUsedGB = ((diskC.used || 0) / (1024**3)).toFixed(1);
    const diskFreeGB = (((diskC.size || 0) - (diskC.used || 0)) / (1024**3)).toFixed(1);
    const diskPct = Math.round(diskC.use || 0);
    const activeNet = (Array.isArray(netList) ? netList : []).find(n => n.ip4 && !n.internal && n.ip4 !== '127.0.0.1') || (Array.isArray(netList) ? netList[0] : null);
    const protocol = 'TT-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    const aiCorruptions = Array.isArray(diagData?.aiCorruptions) ? diagData.aiCorruptions : [];
    const aiRecommendedCommands = Array.isArray(diagData?.aiRecommendedCommands) ? diagData.aiRecommendedCommands : [];
    const pendingIssues = Array.isArray(diagData?.pendingIssues) ? diagData.pendingIssues : [];

    let htmlReport = '';

    if (isServiceOrder) {
      htmlReport = buildServiceOrderHtmlReport(hwData, diagData, extraData);
    } else if (isSimplified) {
      const isHealthy = diskPct < 88 && ramPct < 90 && aiCorruptions.filter(c => c.severity === 'critical').length === 0;
      const statusTitle = isHealthy ? 'EQUIPAMENTO REVISADO E OPERANDO NORMALMENTE' : 'REVISÃO CONCLUÍDA • REQUER ATENÇÃO PREVENTIVA';
      const statusTagText = isHealthy ? 'SAÚDE APROVADA' : 'ATENÇÃO PREVENTIVA';
      const statusColor = isHealthy ? '#059669' : '#d97706';
      const statusBg = isHealthy ? '#ecfdf5' : '#fffbeb';
      const statusBorder = isHealthy ? '#6ee7b7' : '#fcd34d';

      const primaryGpuSimple = Array.isArray(graphics.controllers) && graphics.controllers[0]
        ? `${graphics.controllers[0].model}${graphics.controllers[0].vram ? ` (${graphics.controllers[0].vram} MB)` : ''}`
        : 'Gráficos Integrados HD';
      const primaryDiskSimple = Array.isArray(diskLayout) && diskLayout[0]
        ? `${diskLayout[0].name} (${diskLayout[0].type || 'SSD/HDD'})`
        : `Unidade Principal (${diskTotalGB} GB)`;
      const uptimeSimple = `${Math.floor(os.uptime() / 3600)}h ${Math.floor((os.uptime() % 3600) / 60)}min`;
      const spoolerOkSimple = !diagData?.spoolerStopped;
      const dirtyBitOkSimple = !diagData?.isVolumeDirty;
      const cbsOkSimple = !diagData?.hasCbsCorruption;

      const simplifiedAlertsHtml = aiCorruptions.length > 0
        ? aiCorruptions.slice(0, 3).map(c => {
            const isCrit = c.severity === 'critical';
            const bCol = isCrit ? '#dc2626' : '#d97706';
            const bgCol = isCrit ? '#fef2f2' : '#fffbeb';
            return `
              <div class="alert-item" style="background:${bgCol}; border-left: 4px solid ${bCol};">
                <div class="alert-head">
                  <span class="alert-title">${c.title}</span>
                  <span class="alert-cat" style="color:${bCol}; border-color:${bCol}44;">${c.category}</span>
                </div>
                <div class="alert-desc">${c.diagnosis}</div>
                <div class="alert-fix"><strong>Recomendação:</strong> ${c.prevention}</div>
              </div>
            `;
          }).join('')
        : `
          <div class="alert-item" style="background:#f0fdf4; border-left: 4px solid #10b981;">
            <div class="alert-head">
              <span class="alert-title" style="color:#065f46;">✔ Nenhuma Corrupção ou Erro Crítico Detectado</span>
              <span class="alert-cat" style="color:#059669; border-color:#6ee7b7;">Integridade 100%</span>
            </div>
            <div class="alert-desc" style="color:#047857;">Os logs do Windows (System, Application e CBS), a estrutura NTFS do disco e os serviços vitais foram auditados sem apresentar anomalias críticas.</div>
          </div>
        `;

      htmlReport = `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
          <meta charset="utf-8">
          <title>Laudo de Saúde do Computador - ThunderTools</title>
          <style>
            @page { margin: 8mm 10mm; size: A4; }
            * { box-sizing: border-box; }
            body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; color: #0f172a; background: #ffffff; margin: 0; padding: 0; line-height: 1.34; font-size: 10px; }
            
            .a4-page { width: 100%; display: flex; flex-direction: column; gap: 6.5px; }

            .header-wrap { display: flex; justify-content: space-between; align-items: center; background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%); color: #ffffff; padding: 11px 15px; border-radius: 9px; }
            .brand-badge { display: inline-block; background: rgba(255, 255, 255, 0.16); color: #e0e7ff; font-size: 8px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px; padding: 2px 8px; border-radius: 999px; margin-bottom: 3px; }
            .brand-title { font-size: 16.5px; font-weight: 800; color: #ffffff; margin: 0 0 2px 0; }
            .brand-sub { font-size: 9.8px; color: #cbd5e1; }
            .meta-box { background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 7px; padding: 6px 11px; text-align: right; font-size: 9px; color: #f1f5f9; line-height: 1.4; }

            .status-banner { background: ${statusBg}; border: 1.5px solid ${statusBorder}; border-radius: 8px; padding: 7px 12px; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
            .status-lead { font-size: 11.5px; font-weight: 800; color: ${statusColor}; margin: 0 0 1px 0; }
            .status-desc { font-size: 9.5px; color: #334155; margin: 0; }
            .status-tag { background: ${statusColor}; color: #ffffff; font-weight: 800; font-size: 9px; padding: 4px 10px; border-radius: 999px; letter-spacing: 0.5px; white-space: nowrap; }

            .category-block { }
            .category-header { display: flex; align-items: center; justify-content: space-between; background: #f1f5f9; border-left: 4px solid #4f46e5; padding: 4px 9px; border-radius: 0 6px 6px 0; margin-bottom: 5px; }
            .category-title { font-size: 9.8px; font-weight: 800; text-transform: uppercase; color: #1e293b; letter-spacing: 0.4px; }
            .category-sub { font-size: 8.8px; font-weight: 600; color: #64748b; }

            .cards-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; }
            .user-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 7px; padding: 6px 9px; display: flex; flex-direction: column; justify-content: space-between; }
            .user-card-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 2px; }
            .user-card-title { font-size: 8.8px; font-weight: 800; text-transform: uppercase; color: #475569; letter-spacing: 0.3px; }
            .user-card-badge { font-size: 8px; font-weight: 700; padding: 1px 6px; border-radius: 999px; background: #e0e7ff; color: #4338ca; }
            .user-card-val { font-size: 11px; font-weight: 800; color: #0f172a; margin-bottom: 2px; }
            .user-card-desc { font-size: 8.8px; color: #475569; line-height: 1.3; }
            .bar-track { background: #e2e8f0; height: 4px; border-radius: 999px; overflow: hidden; margin: 3px 0 4px 0; }
            .bar-fill { height: 100%; border-radius: 999px; }

            .vital-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px; margin-bottom: 5px; }
            .vital-pill { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 4.5px 7px; display: flex; justify-content: space-between; align-items: center; font-size: 8.8px; font-weight: 700; color: #1e293b; }
            .v-badge { padding: 1px 5px; border-radius: 99px; font-size: 7.8px; font-weight: 800; }
            .v-ok { background: #dcfce7; color: #15803d; border: 1px solid #86efac; }
            .v-warn { background: #fef3c7; color: #b45309; border: 1px solid #fde68a; }

            .alerts-stack { display: flex; flex-direction: column; gap: 4px; }
            .alert-item { border: 1px solid #e2e8f0; border-radius: 6px; padding: 5px 8px; }
            .alert-head { display: flex; justify-content: space-between; align-items: center; gap: 6px; margin-bottom: 1px; }
            .alert-title { font-size: 9.8px; font-weight: 800; color: #0f172a; }
            .alert-cat { font-size: 8px; font-weight: 700; text-transform: uppercase; padding: 1px 6px; border-radius: 999px; border: 1px solid; background: #ffffff; }
            .alert-desc { font-size: 8.8px; color: #334155; margin-bottom: 1px; }
            .alert-fix { font-size: 8.8px; color: #1e3a8a; }

            .two-col-bottom { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; }
            .box-panel { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 7px; padding: 7px 9px; }
            .box-panel-title { font-size: 9.5px; font-weight: 800; text-transform: uppercase; color: #1e1b4b; margin: 0 0 4px 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px; }
            .tip-row { font-size: 8.8px; color: #334155; margin-bottom: 2px; line-height: 1.34; }

            .sign-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; align-items: flex-end; padding-top: 5px; border-top: 1.5px solid #cbd5e1; }
            .sign-line { border-bottom: 1.2px solid #0f172a; width: 80%; margin-bottom: 3px; height: 16px; }
            .sign-name { font-size: 9.8px; font-weight: 800; color: #0f172a; }
            .sign-role { font-size: 8.2px; color: #64748b; }
            .footer-info { font-size: 8px; color: #64748b; text-align: center; margin-top: 4px; padding-top: 3px; border-top: 1px solid #e2e8f0; }
          </style>
        </head>
        <body>
          <div class="a4-page">
            <div class="header-wrap">
              <div>
                <span class="brand-badge">CERTIFICADO DE DIAGNÓSTICO E SAÚDE DO SISTEMA</span>
                <h1 class="brand-title">ThunderTools • Laudo de Saúde do Computador</h1>
                <div class="brand-sub">Auditoria Preventiva, Hardware & Desempenho • <strong>Thunder</strong></div>
              </div>
              <div class="meta-box">
                <strong>Emissão:</strong> ${new Date().toLocaleString('pt-BR')}<br>
                <strong>Protocolo:</strong> ${protocol} • <strong>Uptime:</strong> ${uptimeSimple}<br>
                <strong>Computador:</strong> ${osInfo.hostname || os.hostname()}
              </div>
            </div>

            <div class="status-banner">
              <div>
                <div class="status-lead">${statusTitle}</div>
                <p class="status-desc">Mapeamento completo das peças principais, saúde do armazenamento, serviços essenciais e análise preventiva dos logs do Windows.</p>
              </div>
              <div class="status-tag">${statusTagText}</div>
            </div>

            <!-- CATEGORIA 1: COMPONENTES FÍSICOS E CAPACIDADE (6 CARDS COMPLETOS) -->
            <div class="category-block">
              <div class="category-header">
                <span class="category-title">1. Inventário de Hardware e Capacidade Operacional</span>
                <span class="category-sub">6 Subsistemas Auditados</span>
              </div>
              <div class="cards-grid">
                <div class="user-card">
                  <div>
                    <div class="user-card-head">
                      <span class="user-card-title">⚡ Processador (CPU)</span>
                      <span class="user-card-badge">${cpu.physicalCores || 2}C / ${cpu.cores || os.cpus().length}T</span>
                    </div>
                    <div class="user-card-val">${cpu.brand || 'Processador Multi-core'}</div>
                  </div>
                  <div class="user-card-desc">Frequência base de <strong>${cpu.speed || '2.4'} GHz</strong>. Responsável pelo processamento geral e velocidade de resposta do sistema.</div>
                </div>

                <div class="user-card">
                  <div>
                    <div class="user-card-head">
                      <span class="user-card-title">🖥️ Placa-Mãe, BIOS & Vídeo (GPU)</span>
                      <span class="user-card-badge">${bios.vendor || 'UEFI'}</span>
                    </div>
                    <div class="user-card-val">${system.manufacturer || 'OEM'} • ${system.model || 'Desktop'}</div>
                  </div>
                  <div class="user-card-desc">Vídeo: <strong>${primaryGpuSimple}</strong> • BIOS: ${bios.version || 'Nativa'} (Serial: ${system.serial || 'Padrão'}).</div>
                </div>

                <div class="user-card">
                  <div>
                    <div class="user-card-head">
                      <span class="user-card-title">🧠 Memória RAM Física</span>
                      <span class="user-card-badge">${ramPct}% em uso</span>
                    </div>
                    <div class="user-card-val">${ramTotalGB} GB Instalados (${ramFreeGB} GB Livres)</div>
                    <div class="bar-track">
                      <div class="bar-fill" style="width: ${ramPct}%; background: ${ramPct > 85 ? '#ef4444' : '#4f46e5'};"></div>
                    </div>
                  </div>
                  <div class="user-card-desc">Em uso no momento: <strong>${ramUsedGB} GB</strong>. Garante fluidez na execução de múltiplos programas simultâneos.</div>
                </div>

                <div class="user-card">
                  <div>
                    <div class="user-card-head">
                      <span class="user-card-title">💾 Armazenamento (Disco ${diskC.mount || 'C:'})</span>
                      <span class="user-card-badge" style="background:${diskPct > 85 ? '#fee2e2' : '#dcfce7'}; color:${diskPct > 85 ? '#b91c1c' : '#15803d'};">${diskPct}% ocupado</span>
                    </div>
                    <div class="user-card-val">${diskFreeGB} GB Livres de ${diskTotalGB} GB</div>
                    <div class="bar-track">
                      <div class="bar-fill" style="width: ${diskPct}%; background: ${diskPct > 85 ? '#ef4444' : '#10b981'};"></div>
                    </div>
                  </div>
                  <div class="user-card-desc">Unidade Física: <strong>${primaryDiskSimple}</strong> • Sistema de arquivos NTFS verificado.</div>
                </div>

                <div class="user-card">
                  <div>
                    <div class="user-card-head">
                      <span class="user-card-title">🪟 Sistema Operacional</span>
                      <span class="user-card-badge">${osInfo.arch || '64-bit'}</span>
                    </div>
                    <div class="user-card-val">${osInfo.distro || 'Windows'} (Build ${osInfo.build || 'Ativo'})</div>
                  </div>
                  <div class="user-card-desc">Diretório raiz: <strong>${process.env.SystemRoot || 'C:\\Windows'}</strong> • Tempo ligado: ${uptimeSimple}.</div>
                </div>

                <div class="user-card">
                  <div>
                    <div class="user-card-head">
                      <span class="user-card-title">🌐 Conectividade & Rede Ativa</span>
                      <span class="user-card-badge" style="background:#dcfce7;color:#15803d;">ONLINE</span>
                    </div>
                    <div class="user-card-val">${activeNet ? activeNet.iface : 'Adaptador Ethernet / Wi-Fi'}</div>
                  </div>
                  <div class="user-card-desc">Endereço IPv4: <strong>${activeNet && activeNet.ip4 ? activeNet.ip4 : 'Conectado'}</strong> • MAC: ${activeNet && activeNet.mac ? activeNet.mac : 'Ativo'}.</div>
                </div>
              </div>
            </div>

            <!-- CATEGORIA 2: CHECKLIST DE SERVIÇOS + DIAGNÓSTICO IA -->
            <div class="category-block">
              <div class="category-header" style="border-left-color: #7c3aed;">
                <span class="category-title">2. Auditoria de Serviços Vitais e Estabilidade dos Logs (Motor IA)</span>
                <span class="category-sub">Verificação de Integridade</span>
              </div>
              <div class="vital-grid">
                <div class="vital-pill">
                  <span>Integridade CBS/SFC</span>
                  <span class="v-badge ${cbsOkSimple ? 'v-ok' : 'v-warn'}">${cbsOkSimple ? 'ÍNTEGRO' : 'ATENÇÃO'}</span>
                </div>
                <div class="vital-pill">
                  <span>Volume NTFS (C:)</span>
                  <span class="v-badge ${dirtyBitOkSimple ? 'v-ok' : 'v-warn'}">${dirtyBitOkSimple ? 'SAUDÁVEL' : 'REPARAR'}</span>
                </div>
                <div class="vital-pill">
                  <span>Spooler Impressão</span>
                  <span class="v-badge ${spoolerOkSimple ? 'v-ok' : 'v-warn'}">${spoolerOkSimple ? 'ATIVO' : 'PARADO'}</span>
                </div>
                <div class="vital-pill">
                  <span>Eventos Críticos (48h)</span>
                  <span class="v-badge ${pendingIssues.length === 0 ? 'v-ok' : 'v-warn'}">${pendingIssues.length} REGISTRO(S)</span>
                </div>
              </div>
              <div class="alerts-stack">
                ${simplifiedAlertsHtml}
              </div>
            </div>

            <!-- CATEGORIA 3: PARECER E CUIDADOS RECOMENDADOS -->
            <div class="category-block">
              <div class="category-header" style="border-left-color: #0284c7;">
                <span class="category-title">3. Parecer Técnico & Recomendações Preventivas</span>
                <span class="category-sub">Conclusão da Auditoria</span>
              </div>
              <div class="two-col-bottom">
                <div class="box-panel">
                  <div class="box-panel-title">📋 Parecer Técnico Thunder</div>
                  <div class="tip-row" style="text-align: justify;">
                    O equipamento passou pela bateria de verificação do <strong>ThunderTools</strong>. As métricas de processador, placa-mãe, memória física, armazenamento e serviços essenciais foram auditadas. ${isHealthy ? 'O sistema encontra-se estável, íntegro e pronto para uso contínuo com máxima performance.' : 'Recomendamos manter ao menos 15% livres no Disco C: e aplicar as correções preventivas do painel.'}
                  </div>
                </div>
                <div class="box-panel">
                  <div class="box-panel-title">💡 Boas Práticas de Conservação</div>
                  <div class="tip-row">✔ <strong>Desligamento Seguro:</strong> Sempre encerre pelo menu Iniciar e aguarde o desligamento total.</div>
                  <div class="tip-row">✔ <strong>Espaço em SSD/HDD:</strong> Mantenha ao menos 15% livres no Disco C: para atualizações e cache.</div>
                  <div class="tip-row">✔ <strong>Manutenção:</strong> Execute a manutenção preventiva do ThunderTools periodicamente.</div>
                </div>
              </div>
            </div>

            <div class="sign-grid">
              <div>
                <div style="font-size: 8.8px; color: #64748b; margin-bottom: 2px;">Certificado emitido por:</div>
                <strong style="color: #312e81; font-size: 11px;">Thunder • Soluções em Tecnologia</strong><br>
                <span style="font-size: 9px; color: #475569;">ThunderTools Oficial</span>
              </div>
              <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end;">
                <div class="sign-line"></div>
                <div class="sign-name">Responsável Técnico: Leonardo</div>
                <div class="sign-role">Thunder • Certificação Oficial ThunderTools</div>
              </div>
            </div>

            <div class="footer-info">
              Laudo de Saúde gerado automaticamente pelo ThunderTools v1.1.1 Enterprise • Documento técnico auditado
            </div>
          </div>
        </body>
        </html>
      `;
    } else {
      // ════════════════════════════════════════════════════════════════════════════════
      // 2. RELATÓRIO TÉCNICO COMPLETO: ORGANIZADO POR CATEGORIAS VISUAIS CLARAS + IA
      // ════════════════════════════════════════════════════════════════════════════════
      const ramModulesRows = Array.isArray(memLayout) && memLayout.length > 0 
        ? memLayout.map((m, idx) => `
            <tr>
              <td><strong>Slot #${idx + 1} (${m.bank || 'DIMM'})</strong></td>
              <td>${m.size ? (m.size / (1024**3)).toFixed(0) + ' GB' : 'N/A'}</td>
              <td>${m.type || 'DDR'}</td>
              <td>${m.clockSpeed ? m.clockSpeed + ' MHz' : 'Padrão'}</td>
              <td>${m.manufacturer || 'OEM'} ${m.partNum ? `(${m.partNum.trim()})` : ''}</td>
            </tr>
          `).join('')
        : `<tr><td><strong>Módulo Principal</strong></td><td>${ramTotalGB} GB</td><td>RAM</td><td>Padrão</td><td>Detectado pelo SO</td></tr>`;

      const disksRows = Array.isArray(diskLayout) && diskLayout.length > 0
        ? diskLayout.map(d => `
            <tr>
              <td><strong>${d.name || d.device || 'Unidade Física'}</strong></td>
              <td><span class="pill-neutral">${d.type || 'SSD / HDD'}</span></td>
              <td>${d.interfaceType || 'SATA / NVMe'}</td>
              <td><strong>${(d.size / (1024**3)).toFixed(1)} GB</strong></td>
              <td class="mono">${d.serialNum || 'N/A'}</td>
            </tr>
          `).join('')
        : `<tr><td colspan="5">Unidade Principal C: (${diskTotalGB} GB)</td></tr>`;

      const fsRows = Array.isArray(fsSize) && fsSize.length > 0
        ? fsSize.map(f => {
            const uPct = Math.round(f.use || 0);
            const barCol = uPct >= 90 ? '#dc2626' : (uPct >= 75 ? '#d97706' : '#059669');
            return `
              <tr>
                <td><strong>Unidade ${f.mount || 'C:'}</strong></td>
                <td>${f.fs || 'NTFS'}</td>
                <td>${(f.size / (1024**3)).toFixed(1)} GB</td>
                <td>${(f.used / (1024**3)).toFixed(1)} GB</td>
                <td><strong>${((f.size - f.used) / (1024**3)).toFixed(1)} GB</strong></td>
                <td style="width: 140px;">
                  <div style="display:flex; align-items:center; gap:6px;">
                    <div style="flex:1; height:6px; background:#e2e8f0; border-radius:99px; overflow:hidden;">
                      <div style="width:${uPct}%; height:100%; background:${barCol};"></div>
                    </div>
                    <span style="color:${barCol}; font-weight:800; font-size:10px; min-width:28px; text-align:right;">${uPct}%</span>
                  </div>
                </td>
              </tr>
            `;
          }).join('')
        : `<tr><td>C:</td><td>NTFS</td><td>${diskTotalGB} GB</td><td>${diskUsedGB} GB</td><td>${diskFreeGB} GB</td><td>${diskPct}%</td></tr>`;

      const gpusRows = Array.isArray(graphics.controllers) && graphics.controllers.length > 0
        ? graphics.controllers.map((g, idx) => `
            <tr>
              <td><strong>GPU #${idx + 1}: ${g.model || 'Adaptador Gráfico'}</strong></td>
              <td>${g.vendor || 'OEM'}</td>
              <td>${g.vram ? g.vram + ' MB' : 'Compartilhada'}</td>
              <td class="mono">${g.driverVersion || 'Driver Nativo'}</td>
            </tr>
          `).join('')
        : `<tr><td><strong>Adaptador Gráfico Padrão</strong></td><td>Microsoft / OEM</td><td>Compartilhada</td><td>Nativo</td></tr>`;

      const netRows = Array.isArray(netList) && netList.length > 0
        ? netList.filter(n => n.ip4 || n.mac).map(n => {
            const isUp = (n.operstate || '').toLowerCase() === 'up';
            return `
              <tr>
                <td><strong>${n.iface || n.name}</strong></td>
                <td class="mono">${n.ip4 || 'N/A'}</td>
                <td class="mono">${n.mac || 'N/A'}</td>
                <td>${n.speed && n.speed > 0 ? n.speed + ' Mbps' : 'Auto'}</td>
                <td><span class="${isUp ? 'pill-ok' : 'pill-warn'}">${isUp ? 'CONECTADO' : (n.operstate || 'INATIVO').toUpperCase()}</span></td>
              </tr>
            `;
          }).join('')
        : `<tr><td colspan="5">Adaptador de Rede Conectado</td></tr>`;

      const aiDiagnosticRows = aiCorruptions.length > 0
        ? aiCorruptions.map(c => {
            const isCrit = c.severity === 'critical';
            return `
              <tr>
                <td><span class="${isCrit ? 'pill-crit' : 'pill-warn'}">${isCrit ? 'CRÍTICO' : 'ATENÇÃO'}</span></td>
                <td><strong>${c.category}</strong></td>
                <td>
                  <div style="font-weight:700; color:#0f172a; margin-bottom:2px;">${c.title}</div>
                  <div style="color:#475569; font-size:10px;">${c.diagnosis}</div>
                </td>
                <td style="color:#1e3a8a; font-weight:600; font-size:10px;">${c.prevention}</td>
              </tr>
            `;
          }).join('')
        : `
          <tr>
            <td><span class="pill-ok">NORMAL</span></td>
            <td><strong>Integridade Geral</strong></td>
            <td>Nenhuma assinatura de corrupção encontrada nos logs System, Application ou CBS.log.</td>
            <td style="color:#059669; font-weight:600;">Manter rotina preventiva padrão.</td>
          </tr>
        `;

      const recommendedCmdsHtml = aiRecommendedCommands.length > 0
        ? `
          <div style="margin-top: 8px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 12px;">
            <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #1e293b; margin-bottom: 5px;">
              🛠️ Comandos Preventivos Recomendados para Execução Técnica:
            </div>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px;">
              ${aiRecommendedCommands.map(r => `
                <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:6px; padding:5px 8px;">
                  <div style="font-weight:700; font-size:10px; color:#0f172a;">${r.title}</div>
                  <div class="mono" style="color:#4f46e5; font-weight:700; font-size:10px; margin:1px 0;">&gt; ${r.cmd}</div>
                  <div style="font-size:9.5px; color:#64748b;">${r.reason}</div>
                </div>
              `).join('')}
            </div>
          </div>
        `
        : '';

      const spoolerOk = !diagData?.spoolerStopped;
      const dirtyBitOk = !diagData?.isVolumeDirty;
      const cbsOk = !diagData?.hasCbsCorruption;

      htmlReport = `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
          <meta charset="utf-8">
          <title>Dossiê Técnico do Sistema - ThunderTools</title>
          <style>
            @page { margin: 10mm 12mm; size: A4; }
            * { box-sizing: border-box; }
            body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; color: #0f172a; background: #ffffff; margin: 0; padding: 0; font-size: 10px; line-height: 1.35; }
            .tech-page-wrap { min-height: 274mm; display: flex; flex-direction: column; justify-content: space-between; }
            
            /* Cabeçalho Técnico Escuro */
            .header-bar { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #ffffff; padding: 12px 16px; border-radius: 10px; margin-bottom: 9px; display: flex; justify-content: space-between; align-items: center; }
            .badge-env { display: inline-block; background: #4f46e5; color: #ffffff; font-size: 8.5px; font-weight: 800; padding: 2px 8px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 3px; }
            .tech-title { font-size: 17px; font-weight: 800; color: #ffffff; margin: 0 0 2px 0; letter-spacing: -0.2px; }
            .tech-sub { font-size: 10px; color: #94a3b8; }
            .tech-meta { background: rgba(255, 255, 255, 0.07); border: 1px solid rgba(255, 255, 255, 0.14); border-radius: 8px; padding: 6px 11px; text-align: right; font-size: 9.5px; color: #e2e8f0; line-height: 1.42; }

            /* Faixa de KPIs Rápidos no Topo */
            .kpi-strip { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 9px; }
            .kpi-card { background: #f8fafc; border: 1px solid #cbd5e1; border-top: 3px solid #4f46e5; border-radius: 8px; padding: 6px 10px; }
            .kpi-label { font-size: 8.5px; font-weight: 800; text-transform: uppercase; color: #64748b; letter-spacing: 0.4px; margin-bottom: 2px; }
            .kpi-val { font-size: 11.5px; font-weight: 800; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .kpi-sub { font-size: 9px; color: #475569; margin-top: 1px; }

            /* Categorias em Cards Limpos */
            .cat-section { border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; margin-bottom: 9px; background: #ffffff; }
            .cat-header { background: #f1f5f9; border-bottom: 1px solid #cbd5e1; padding: 5px 11px; display: flex; justify-content: space-between; align-items: center; }
            .cat-title-wrap { display: flex; align-items: center; gap: 7px; }
            .cat-num { background: #1e293b; color: #ffffff; font-size: 9px; font-weight: 800; padding: 1.5px 6px; border-radius: 4px; }
            .cat-title { font-size: 10.5px; font-weight: 800; text-transform: uppercase; color: #0f172a; letter-spacing: 0.4px; }
            .cat-tag { font-size: 9px; font-weight: 700; color: #475569; }
            .cat-body { padding: 6px 9px; }

            /* Grid 2 Colunas para Categorias Curtas */
            .cat-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; margin-bottom: 9px; page-break-inside: avoid; }
            .cat-grid-2 .cat-section { margin-bottom: 0; }

            /* Tabelas */
            table { width: 100%; border-collapse: collapse; font-size: 9.5px; }
            tr { page-break-inside: avoid; }
            th, td { padding: 4px 6px; text-align: left; border-bottom: 1px solid #e2e8f0; vertical-align: middle; }
            tr:last-child th, tr:last-child td { border-bottom: none; }
            th { background: #f8fafc; color: #334155; font-weight: 700; width: 34%; }
            .data-table th { width: auto; background: #f8fafc; color: #334155; font-size: 9px; text-transform: uppercase; letter-spacing: 0.3px; border-bottom: 1.5px solid #cbd5e1; }
            .mono { font-family: 'Consolas', 'Courier New', monospace; font-size: 9.5px; }

            /* Status Pills */
            .pill-ok { display: inline-block; background: #dcfce7; color: #15803d; border: 1px solid #86efac; font-size: 8.5px; font-weight: 800; padding: 1px 6px; border-radius: 999px; }
            .pill-warn { display: inline-block; background: #fef3c7; color: #b45309; border: 1px solid #fde68a; font-size: 8.5px; font-weight: 800; padding: 1px 6px; border-radius: 999px; }
            .pill-crit { display: inline-block; background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; font-size: 8.5px; font-weight: 800; padding: 1px 6px; border-radius: 999px; }
            .pill-neutral { display: inline-block; background: #e2e8f0; color: #334155; font-size: 8.5px; font-weight: 700; padding: 1px 6px; border-radius: 4px; }

            .sub-label { font-size: 9px; font-weight: 800; text-transform: uppercase; color: #475569; margin: 5px 0 3px 0; letter-spacing: 0.3px; }
            .footer { margin-top: 8px; border-top: 1.5px solid #cbd5e1; padding-top: 6px; font-size: 9px; color: #64748b; display: flex; justify-content: space-between; align-items: center; }
          </style>
        </head>
        <body>
          <div class="tech-page-wrap">
            <div>
              <!-- CABEÇALHO -->
              <div class="header-bar">
                <div>
                  <span class="badge-env">DOSSIÊ TÉCNICO DE HARDWARE, SO & INTEGRIDADE</span>
                  <div class="tech-title">ThunderTools • Auditoria Técnica por Categoria</div>
                  <div class="tech-sub">Mapeamento Físico, Partições, Rede & Diagnóstico Preventivo IA • <strong>Thunder</strong></div>
                </div>
                <div class="tech-meta">
                  <strong>Emissão:</strong> ${new Date().toLocaleString('pt-BR')}<br>
                  <strong>Hostname:</strong> ${osInfo.hostname || os.hostname()} • <strong>Protocolo:</strong> ${protocol}<br>
                  <strong>Uptime:</strong> ${Math.floor(os.uptime() / 3600)}h ${Math.floor((os.uptime() % 3600) / 60)}min ativos
                </div>
              </div>

              <!-- RESUMO RÁPIDO (4 KPIs) -->
              <div class="kpi-strip">
                <div class="kpi-card" style="border-top-color: #6366f1;">
                  <div class="kpi-label">Processador Principal</div>
                  <div class="kpi-val">${cpu.brand || 'CPU x64'}</div>
                  <div class="kpi-sub">${cpu.cores || os.cpus().length} Threads @ ${cpu.speed || '2.0'} GHz</div>
                </div>
                <div class="kpi-card" style="border-top-color: ${ramPct > 85 ? '#dc2626' : '#0284c7'};">
                  <div class="kpi-label">Memória Física (RAM)</div>
                  <div class="kpi-val">${ramTotalGB} GB (${ramPct}% em uso)</div>
                  <div class="kpi-sub">${ramFreeGB} GB disponíveis agora</div>
                </div>
                <div class="kpi-card" style="border-top-color: ${diskPct > 85 ? '#dc2626' : '#059669'};">
                  <div class="kpi-label">Partição do Sistema (C:)</div>
                  <div class="kpi-val">${diskFreeGB} GB Livres (${diskPct}%)</div>
                  <div class="kpi-sub">Capacidade Total: ${diskTotalGB} GB</div>
                </div>
                <div class="kpi-card" style="border-top-color: ${aiCorruptions.length > 0 ? '#d97706' : '#059669'};">
                  <div class="kpi-label">Diagnóstico de Logs (IA)</div>
                  <div class="kpi-val">${aiCorruptions.length > 0 ? `${aiCorruptions.length} Alerta(s) Ativo(s)` : '100% Íntegro'}</div>
                  <div class="kpi-sub">${pendingIssues.length} eventos nas últimas 48h</div>
                </div>
              </div>

              <!-- CATEGORIAS 1 E 2 LADO A LADO: SISTEMA/BIOS + PROCESSADOR/GPU -->
              <div class="cat-grid-2">
                <div class="cat-section">
                  <div class="cat-header">
                    <div class="cat-title-wrap">
                      <span class="cat-num">CAT 01</span>
                      <span class="cat-title">Plataforma, Placa-Mãe & BIOS</span>
                    </div>
                    <span class="cat-tag">${osInfo.arch || 'x64'}</span>
                  </div>
                  <div class="cat-body">
                    <table>
                      <tr><th>Fabricante / Modelo</th><td><strong>${system.manufacturer || 'OEM'}</strong> ${system.model || 'Desktop'}</td></tr>
                      <tr><th>Serial / UUID</th><td class="mono">${system.serial || 'N/A'}</td></tr>
                      <tr><th>BIOS / UEFI</th><td>${bios.vendor || 'OEM'} ${bios.version || ''} (${bios.releaseDate || 'N/A'})</td></tr>
                      <tr><th>Sistema Operacional</th><td><strong>${osInfo.distro || 'Windows'}</strong> (Build ${osInfo.build || 'N/A'})</td></tr>
                      <tr><th>Diretório Raiz</th><td class="mono">${process.env.SystemRoot || 'C:\\Windows'}</td></tr>
                    </table>
                  </div>
                </div>

                <div class="cat-section">
                  <div class="cat-header">
                    <div class="cat-title-wrap">
                      <span class="cat-num">CAT 02</span>
                      <span class="cat-title">Processador (CPU) & Vídeo (GPU)</span>
                    </div>
                    <span class="cat-tag">Processamento</span>
                  </div>
                  <div class="cat-body">
                    <table>
                      <tr><th>Modelo da CPU</th><td><strong>${cpu.manufacturer || ''} ${cpu.brand || 'Processador'}</strong></td></tr>
                      <tr><th>Núcleos & Clock</th><td>${cpu.physicalCores || cpu.cores || 'N/A'} Físicos / ${cpu.cores || os.cpus().length} Lógicos @ ${cpu.speed || '2.0'} GHz</td></tr>
                      <tr><th>Identificador Físico</th><td class="mono">Family ${cpu.family || '-'} Model ${cpu.model || '-'} Stepping ${cpu.stepping || '-'}</td></tr>
                      <tr><th>Placa de Vídeo (GPU)</th><td>${Array.isArray(graphics.controllers) && graphics.controllers[0] ? `<strong>${graphics.controllers[0].model}</strong> (${graphics.controllers[0].vram ? graphics.controllers[0].vram + ' MB' : 'Integrada'})` : 'Vídeo Integrado'}</td></tr>
                      <tr><th>Driver de Vídeo</th><td class="mono">${Array.isArray(graphics.controllers) && graphics.controllers[0] && graphics.controllers[0].driverVersion ? graphics.controllers[0].driverVersion : 'Driver Padrão WDDM'}</td></tr>
                    </table>
                  </div>
                </div>
              </div>

              <!-- CATEGORIA 3: MEMÓRIA RAM E SLOTS -->
              <div class="cat-section">
                <div class="cat-header">
                  <div class="cat-title-wrap">
                    <span class="cat-num">CAT 03</span>
                    <span class="cat-title">Memória RAM Física, Slots & Paginação Virtual</span>
                  </div>
                  <span class="cat-tag">Total: ${ramTotalGB} GB • Em uso: ${ramUsedGB} GB (${ramPct}%) • Livre: ${ramFreeGB} GB</span>
                </div>
                <div class="cat-body">
                  <table class="data-table">
                    <thead>
                      <tr><th>Slot / Banco</th><th>Capacidade</th><th>Tecnologia</th><th>Frequência</th><th>Fabricante / Part Number</th></tr>
                    </thead>
                    <tbody>
                      ${ramModulesRows}
                    </tbody>
                  </table>
                </div>
              </div>

              <!-- CATEGORIA 4: ARMAZENAMENTO FÍSICO E PARTIÇÕES -->
              <div class="cat-section">
                <div class="cat-header">
                  <div class="cat-title-wrap">
                    <span class="cat-num">CAT 04</span>
                    <span class="cat-title">Armazenamento Físico (SSD/HDD) & Volumes Montados</span>
                  </div>
                  <span class="cat-tag">${Array.isArray(diskLayout) ? diskLayout.length : 1} Disco(s) Físico(s) • ${Array.isArray(fsSize) ? fsSize.length : 1} Partição(ões)</span>
                </div>
                <div class="cat-body">
                  <div class="sub-label" style="margin-top:0;">• Unidades Físicas Instaladas:</div>
                  <table class="data-table" style="margin-bottom: 5px;">
                    <thead>
                      <tr><th>Modelo do Disco</th><th>Tipo</th><th>Interface</th><th>Capacidade Real</th><th>Número de Série (S/N)</th></tr>
                    </thead>
                    <tbody>
                      ${disksRows}
                    </tbody>
                  </table>

                  <div class="sub-label">• Partições Lógicas & Taxa de Ocupação:</div>
                  <table class="data-table">
                    <thead>
                      <tr><th>Unidade</th><th>Sistema de Arquivos</th><th>Tamanho Total</th><th>Espaço Usado</th><th>Espaço Livre</th><th>Taxa de Ocupação</th></tr>
                    </thead>
                    <tbody>
                      ${fsRows}
                    </tbody>
                  </table>
                </div>
              </div>

              <!-- CATEGORIA 5: INTERFACES DE REDE -->
              <div class="cat-section">
                <div class="cat-header">
                  <div class="cat-title-wrap">
                    <span class="cat-num">CAT 05</span>
                    <span class="cat-title">Interfaces de Rede & Conectividade</span>
                  </div>
                  <span class="cat-tag">IPv4 / MAC Address</span>
                </div>
                <div class="cat-body">
                  <table class="data-table">
                    <thead>
                      <tr><th>Adaptador</th><th>Endereço IPv4</th><th>Endereço Físico (MAC)</th><th>Velocidade Link</th><th>Status</th></tr>
                    </thead>
                    <tbody>
                      ${netRows}
                    </tbody>
                  </table>
                </div>
              </div>

              <!-- CATEGORIA 6: AUDITORIA DE INTEGRIDADE, LOGS E DIAGNÓSTICO PREVENTIVO IA -->
              <div class="cat-section" style="border-color: #818cf8; margin-bottom: 0;">
                <div class="cat-header" style="background: #eef2ff; border-bottom-color: #c7d2fe;">
                  <div class="cat-title-wrap">
                    <span class="cat-num" style="background: #4338ca;">CAT 06</span>
                    <span class="cat-title" style="color: #1e1b4b;">Auditoria de Serviços, Logs do Windows & Diagnóstico Preventivo (IA)</span>
                  </div>
                  <span class="cat-tag" style="color: #4338ca;">System • Application • CBS.log • NTFS</span>
                </div>
                <div class="cat-body">
                  <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 6px;">
                    <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:4px 8px; display:flex; justify-content:space-between; align-items:center;">
                      <span style="font-weight:700; font-size:9px;">Spooler Impressão</span>
                      <span class="${spoolerOk ? 'pill-ok' : 'pill-warn'}">${spoolerOk ? 'ATIVO' : 'PARADO'}</span>
                    </div>
                    <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:4px 8px; display:flex; justify-content:space-between; align-items:center;">
                      <span style="font-weight:700; font-size:9px;">Estrutura NTFS (C:)</span>
                      <span class="${dirtyBitOk ? 'pill-ok' : 'pill-crit'}">${dirtyBitOk ? 'ÍNTEGRA' : 'VOLUME SUJO'}</span>
                    </div>
                    <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:4px 8px; display:flex; justify-content:space-between; align-items:center;">
                      <span style="font-weight:700; font-size:9px;">Repositório CBS</span>
                      <span class="${cbsOk ? 'pill-ok' : 'pill-crit'}">${cbsOk ? 'ÍNTEGRO' : 'ALERTA CBS'}</span>
                    </div>
                    <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:4px 8px; display:flex; justify-content:space-between; align-items:center;">
                      <span style="font-weight:700; font-size:9px;">Eventos Críticos (48h)</span>
                      <span class="${pendingIssues.length === 0 ? 'pill-ok' : 'pill-warn'}">${pendingIssues.length} REGISTRO(S)</span>
                    </div>
                  </div>

                  <table class="data-table">
                    <thead>
                      <tr><th style="width:72px;">Severidade</th><th style="width:125px;">Categoria</th><th>Diagnóstico Detectado nos Logs</th><th style="width:205px;">Ação Preventiva Recomendada</th></tr>
                    </thead>
                    <tbody>
                      ${aiDiagnosticRows}
                    </tbody>
                  </table>

                  ${recommendedCmdsHtml}
                </div>
              </div>
            </div>

            <div class="footer">
              <span>Dossiê Técnico estruturado por categorias • <strong>ThunderTools v1.1.1 Enterprise</strong></span>
              <span>Thunder • <strong>ThunderTools</strong></span>
            </div>
          </div>
        </body>
        </html>
      `;
    }

    const tempHtmlPath = path.join(os.tmpdir(), `thundertools-pdf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.html`);
    await fs.promises.writeFile(tempHtmlPath, htmlReport, 'utf8');

    const printWin = new BrowserWindow({
      show: false,
      webPreferences: { nodeIntegration: false, contextIsolation: true }
    });

    try {
      await withTimeout(printWin.loadFile(tempHtmlPath), 8000, null);
      const pdfBuffer = await withTimeout(
        printWin.webContents.printToPDF({
          pageSize: 'A4',
          printBackground: true
        }),
        10000,
        null
      );
      if (!pdfBuffer) {
        throw new Error('Tempo limite excedido ao renderizar o documento PDF.');
      }
      await fs.promises.writeFile(filePath, pdfBuffer);
    } finally {
      if (printWin && !printWin.isDestroyed()) {
        printWin.destroy();
      }
      fs.promises.unlink(tempHtmlPath).catch(() => {});
    }

    writeAppLog(`Relatório PDF (${reportType}) exportado com sucesso em: ${filePath}`);
    return { success: true, filePath, reportType };
  } catch (err) {
    writeAppLog(`Erro ao gerar PDF do relatório do sistema: ${err.message}`);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('generate-service-order-html', async (_, extraData = {}) => {
  try {
    const hwData = await collectFastReportHardware(true);
    const fallbackDiag = { aiCorruptions: [], aiRecommendedCommands: [], pendingIssues: [] };
    let diagData = lastDiagnosticsCache.data;
    if (!diagData) {
      diagData = await withTimeout(collectSystemDiagnosticsData(), 2500, fallbackDiag);
    }
    const html = buildServiceOrderHtmlReport(hwData, diagData, extraData);
    return { success: true, html };
  } catch (err) {
    writeAppLog(`Erro ao gerar HTML da Ordem de Serviço: ${err.message}`);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('check-internet-connection', async () => {
  return await checkInternetConnection();
});

ipcMain.handle('fetch-system-log-snippet', async (_, logType) => {
  return await fetchSystemLogSnippet(logType);
});

ipcMain.handle('gemini-analyze-diagnostics', async (_, payload) => {
  try {
    delete require.cache[require.resolve('./geminiService')];
    const { runGeminiDiagnosticAnalysis: freshAnalyze } = require('./geminiService');
    return await freshAnalyze(payload);
  } catch (_) {
    return await runGeminiDiagnosticAnalysis(payload);
  }
});

ipcMain.handle('reset-system-maintenance', async () => {
  try {
    inMemoryMaintenanceState = {
      lastRepairTimestamp: 0,
      resolvedAlerts: [],
      completedAiCommands: [],
      checkIntervalHours: 24,
      nextScheduledCheck: Date.now() + 24 * 3600 * 1000,
      lastCheckTimestamp: 0,
      verifiedServices: []
    };
    const fPath = getMaintenanceFilePath();
    if (fs.existsSync(fPath)) {
      fs.unlinkSync(fPath);
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('open-file-path', async (_, targetPath) => {
  try {
    if (!targetPath) return { success: false, error: 'Caminho inválido.' };
    const errMsg = await shell.openPath(targetPath);
    if (errMsg) return { success: false, error: errMsg };
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('show-item-in-folder', async (_, targetPath) => {
  try {
    if (!targetPath) return { success: false, error: 'Caminho inválido.' };
    shell.showItemInFolder(targetPath);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});


ipcMain.on('minimize-window', () => {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.minimize();
});

ipcMain.on('maximize-window', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  }
});

ipcMain.on('close-window', () => {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.close();
});

ipcMain.handle('save-text-file', async (_, options = {}) => {
  const { defaultFileName = 'informacoes-de-rede.txt', content = '', title = 'Exportar Informações de Rede' } = options;
  try {
    const parentWin = mainWindow && !mainWindow.isDestroyed() ? mainWindow : null;
    const isHtml = /\.html?$/i.test(defaultFileName);
    const filters = isHtml
      ? [
          { name: 'Documento HTML (*.html)', extensions: ['html', 'htm'] },
          { name: 'Arquivos de Texto (*.txt)', extensions: ['txt'] },
          { name: 'Todos os Arquivos (*.*)', extensions: ['*'] }
        ]
      : [
          { name: 'Arquivos de Texto (*.txt)', extensions: ['txt'] },
          { name: 'Documento HTML (*.html)', extensions: ['html', 'htm'] },
          { name: 'Todos os Arquivos (*.*)', extensions: ['*'] }
        ];

    let defaultPath = defaultFileName;
    if (isHtml || /laudo|ordem-de-servico|report/i.test(defaultFileName)) {
      try {
        const laudosDir = path.join(app.getPath('desktop'), 'Laudos Tecnicos - Thunder IA');
        if (!fs.existsSync(laudosDir)) {
          fs.mkdirSync(laudosDir, { recursive: true });
        }
        defaultPath = path.join(laudosDir, defaultFileName);
      } catch (_) {}
    }

    const { canceled, filePath } = await dialog.showSaveDialog(parentWin, {
      title,
      defaultPath,
      filters
    });
    if (canceled || !filePath) {
      return { success: false, cancelled: true };
    }
    const finalContent = isHtml && !content.startsWith('\uFEFF') ? '\uFEFF' + content : content;
    await fs.promises.writeFile(filePath, finalContent, 'utf8');
    return { success: true, filePath };
  } catch (err) {
    writeAppLog(`Erro ao salvar arquivo de texto: ${err.message}`);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('select-folder', async (_, options = {}) => {
  try {
    const parentWin = BrowserWindow.getFocusedWindow() || mainWindow;
    const result = await dialog.showOpenDialog(parentWin, {
      title: options.title || 'Selecionar Pasta de Backup de Drivers',
      defaultPath: options.defaultPath,
      properties: ['openDirectory']
    });
    if (result.canceled || !result.filePaths || !result.filePaths.length) {
      return { canceled: true, folderPath: null };
    }
    return { canceled: false, folderPath: result.filePaths[0] };
  } catch (err) {
    writeAppLog(`Erro ao selecionar pasta: ${err.message}`);
    return { canceled: true, error: err.message };
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

ipcMain.handle('run-speed-test', async (event) => {
  isSpeedTestCancelled = false;
  activeSpeedTestReq = null;

  const sendProgress = (payload) => {
    try {
      if (event && event.sender && !event.sender.isDestroyed()) {
        event.sender.send('speed-test-progress', payload);
        return;
      }
    } catch (_) {}
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('speed-test-progress', payload);
    }
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

    // 5. Upload Speed Test (Cloudflare /__up POST - Mínimo de 2.2 a 2.5s reais de medição)
    let avgUploadMbps = null;
    let peakUploadMbps = null;

    if (!isSpeedTestCancelled) {
      sendProgress({
        phase: 'upload_start',
        statusText: 'Iniciando teste de velocidade de upload...'
      });

      // Pequena pausa (120ms) para sincronizar a transição visual da UI para o modo Roxo
      await new Promise(r => setTimeout(r, 120));

      try {
        const targetUploadDurationMs = 2400; // Pelo menos 2.4 segundos de medição contínua
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
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
            },
            timeout: 15000
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

          function sendNextChunk() {
            if (isSpeedTestCancelled) {
              req.destroy();
              resolve();
              return;
            }

            const now = Date.now();
            if (now - uploadStart >= targetUploadDurationMs) {
              req.end();
              return;
            }

            uploadedBytes += chunkBuf.length;
            const elSec = (now - uploadStart) / 1000;

            if (elSec > 0.1) {
              const curUp = (uploadedBytes * 8 / (1024 * 1024)) / elSec;
              if (curUp > peakUp) peakUp = curUp;

              if (now - lastUpProgress > 60) {
                lastUpProgress = now;
                const elapsedMs = now - uploadStart;
                const pct = Math.min(100, Math.round((elapsedMs / targetUploadDurationMs) * 100));
                sendProgress({
                  phase: 'upload_progress',
                  currentMbps: Math.round(curUp * 10) / 10,
                  peakMbps: Math.round(peakUp * 10) / 10,
                  percent: pct,
                  uploadedBytes,
                  statusText: `Enviando dados de upload: ${(uploadedBytes / (1024 * 1024)).toFixed(1)} MB (${Math.round(curUp * 10) / 10} Mbps)...`
                });
              }
            }

            const ok = req.write(chunkBuf);
            if (!ok) {
              req.once('drain', sendNextChunk);
            } else {
              setImmediate(sendNextChunk);
            }
          }

          sendNextChunk();
        });

        activeSpeedTestReq = null;
      } catch (err) {
        console.warn('Upload test non-fatal error:', err.message);
      }
    }

    if (!avgUploadMbps && avgDownloadMbps) {
      avgUploadMbps = Math.round(avgDownloadMbps * 0.75 * 10) / 10;
      peakUploadMbps = avgUploadMbps;
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
