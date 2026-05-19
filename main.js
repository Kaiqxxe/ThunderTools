const { app, BrowserWindow, ipcMain, shell } = require('electron')
const path = require('path')
const { exec, execFile } = require('child_process')
const os = require('os')
const fs = require('fs')

app.disableHardwareAcceleration()
app.commandLine.appendSwitch('disable-gpu')
app.commandLine.appendSwitch('no-sandbox')
app.commandLine.appendSwitch('disable-software-rasterizer')

let currentProcess = null
let lastCpuStats = getSystemCpuInfo()
let mainWindow = null
let statsInterval = null
let isCancelling = false
const gotSingleInstanceLock = app.requestSingleInstanceLock()

const BLOCKED_LOCAL_USERS = [
  'Convidado',
  'Guest',
  'DefaultAccount',
  'WDAGUtilityAccount',
  'CodexSandboxOffline',
  'CodexSandboxOnline'
]

ipcMain.handle('get-blocked-local-users', () => {
  return BLOCKED_LOCAL_USERS;
});

function runPowerShellScript(script) {
  return new Promise((resolve) => {
    const normalizedScript = `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
${script}
`
    const encoded = Buffer.from(normalizedScript, 'utf16le').toString('base64')
    execFile(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded],
      { encoding: 'utf8', windowsHide: true },
      (error, stdout, stderr) => {
        if (error) {
          resolve({ success: false, output: stderr || stdout || error.message })
          return
        }

        resolve({ success: true, output: stdout || '' })
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
            font-family: Segoe UI, Arial, sans-serif;
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

function getDiskUsage() {
  return new Promise((resolve) => {
    // Consulta informações do disco C: (Espaço Livre e Total)
    exec('wmic logicaldisk where "DeviceID=\'C:\'" get FreeSpace,Size /format:list', { encoding: 'utf8' }, (err, stdout) => {
      if (err) return resolve(null)
      
      const freeSpaceMatch = stdout.match(/FreeSpace=(\d+)/)
      const sizeMatch = stdout.match(/Size=(\d+)/)
      
      if (freeSpaceMatch && sizeMatch) {
        const free = parseInt(freeSpaceMatch[1])
        const total = parseInt(sizeMatch[1])
        const usage = Math.round(((total - free) / total) * 100)
        resolve(usage)
      } else {
        resolve(null)
      }
    })
  })
}

function createWindow() {
  writeAppLog('Creating main window')
  mainWindow = new BrowserWindow({
    width: 900,
    height: 650,
    resizable: true,
    show: false,
    title: 'ThunderTools',
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true
    }
  })
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
  
  // Envia stats do sistema a cada 2 segundos
  statsInterval = setInterval(async () => {
    if (!mainWindow || mainWindow.isDestroyed()) return

    const currentCpuStats = getSystemCpuInfo()
    
    const idleDiff = currentCpuStats.idle - lastCpuStats.idle
    const totalDiff = currentCpuStats.total - lastCpuStats.total
    const cpuUsage = totalDiff > 0 ? 100 - Math.round(100 * idleDiff / totalDiff) : 0
    
    lastCpuStats = currentCpuStats

    const disk = await getDiskUsage()
    
    if (!mainWindow || mainWindow.isDestroyed()) return

    const totalMem = os.totalmem()
    const freeMem = os.freemem()
    const ramUsage = Math.round(((totalMem - freeMem) / totalMem) * 100)
    
    mainWindow.webContents.send('system-stats', {
      cpu: Math.max(0, Math.min(100, cpuUsage)),
      ram: ramUsage,
      disk: disk
    })
  }, 2000)
}

process.on('uncaughtException', (error) => {
  writeAppLog(`Uncaught exception: ${error.stack || error.message}`)
})

process.on('unhandledRejection', (reason) => {
  writeAppLog(`Unhandled rejection: ${reason?.stack || reason}`)
})

if (gotSingleInstanceLock) {
  app.whenReady().then(() => {
    writeAppLog(`App ready. Packaged: ${app.isPackaged}. App path: ${app.getAppPath()}`)
    createWindow()
  }).catch((error) => {
    writeAppLog(`App startup failed: ${error.stack || error.message}`)
  })
}
app.on('second-instance', () => {
  if (!mainWindow || mainWindow.isDestroyed()) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
})
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
      [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
      $OutputEncoding = [System.Text.Encoding]::UTF8
      # Se for apenas o comando de listagem geral, usamos PowerShell nativo para evitar erros de encoding e cabeçalho
      $trimmedCmd = "${cmdToRun.trim().toLowerCase()}"
      if ($trimmedCmd -eq "net user") {
          Get-LocalUser | Select-Object -ExpandProperty Name | Out-String
      } else {
          cmd.exe /c "chcp 65001 > nul & ${cmdToRun.replace(/"/g, '`"')}" | Out-String
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
    currentProcess = exec(`chcp 65001 > nul & ${cmdToRun}`, { shell: 'cmd.exe', encoding: 'utf8' }, (error, stdout, stderr) => {
      const cancelled = isCancelling || (error && error.killed)
      isCancelling = false
      currentProcess = null
      sendCommandProgress(trackingId, { done: true, percent: cancelled || error ? null : 100 })
      if (cancelled) resolve({ success: false, output: 'Operação cancelada pelo usuário.', cancelled: true })
      else if (error) resolve({ success: false, output: stderr || error.message })
      else resolve({ success: true, output: (stdout || '').replace(/^\ufeff/, '').replace(/\0/g, '') })
    })

    currentProcess.stdout?.on('data', chunk => {
      stdoutBuffer += chunk
      const progress = extractCommandProgress(chunk)
      sendCommandProgress(trackingId, {
        percent: progress.percent,
        message: progress.message,
        stream: 'stdout' // Removido 'output: stdoutBuffer' para evitar lag no IPC
      })
    })

    currentProcess.stderr?.on('data', chunk => {
      stderrBuffer += chunk
      const progress = extractCommandProgress(chunk)
      sendCommandProgress(trackingId, {
        percent: progress.percent,
        message: progress.message,
        stream: 'stderr' // Removido 'output: stderrBuffer'
      })
    })
  })
})

ipcMain.handle('list-deletable-users', async () => {
  const blockedUsers = BLOCKED_LOCAL_USERS.map(user => `'${escapePowerShellSingleQuoted(user)}'`).join(',')
  const script = `
$ErrorActionPreference = 'Stop'
$currentUser = [Environment]::UserName
$blockedUsers = @(${blockedUsers})
$users = Get-LocalUser |
  Where-Object {
    $_.Enabled -eq $true -and
    $blockedUsers -notcontains $_.Name -and
    $_.Name -ine $currentUser -and
    $_.Name -notmatch '^\\$' -and
    $_.Name -notmatch '^SUPPORT_'
  } |
  Select-Object @{Name='name';Expression={$_.Name}},
                @{Name='fullName';Expression={$_.FullName}},
                @{Name='description';Expression={$_.Description}},
                @{Name='enabled';Expression={$_.Enabled}}

[pscustomobject]@{
  currentUser = $currentUser
  users = @($users)
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

ipcMain.handle('delete-local-user', async (_, userName) => {
  const target = String(userName || '').trim()
  const blockedUsers = BLOCKED_LOCAL_USERS.map(user => `'${escapePowerShellSingleQuoted(user)}'`).join(',')
  const script = `
$ErrorActionPreference = 'Stop'
$target = '${escapePowerShellSingleQuoted(target)}'
$currentUser = [Environment]::UserName
$blockedUsers = @(${blockedUsers})

if ([string]::IsNullOrWhiteSpace($target)) {
  throw 'Nenhum usuario foi selecionado.'
}

if ($blockedUsers -contains $target) {
  throw "O usuario $target e protegido e nao pode ser excluido."
}

if ($target -ieq $currentUser) {
  throw 'Nao e permitido excluir o usuario em uso no momento.'
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

ipcMain.on('cancel-command', () => {
  if (currentProcess) {
    isCancelling = true
    if (process.platform === 'win32') {
      // Mata a árvore de processos completa no Windows para garantir que comandos como SFC/DISM parem
      exec(`taskkill /pid ${currentProcess.pid} /T /F`)
    } else {
      currentProcess.kill()
    }
  }
})
