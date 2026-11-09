// ─────────────────────────────────────────────────────────────────────────────
// Telemetria de hardware do ThunderTools
//
// Camada rápida (a cada 2s, SEM spawn de processos, custo ~0):
//   CPU % (delta de os.cpus), RAM (os.totalmem/freemem), Disco C: (fs.statfs, a cada 30s)
//
// Camada pesada (UM PowerShell persistente, iniciado só após a interface carregar):
//   Rede (Mbps), I/O do disco C: (MB/s), RAM em cache, processos, temperatura.
//   Com a aba Início oculta, o agente entra em modo econômico (só temperatura, a cada 10s).
//
// Antes, cada ciclo abria novos processos (si.processes + si.networkStats + PowerShell
// de I/O a cada 2-4s), competindo com a inicialização e deixando o app lento.
// ─────────────────────────────────────────────────────────────────────────────
const os = require('os')
const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')

const FAST_INTERVAL_MS = 2000
const DISK_REFRESH_MS = 30000
const AGENT_START_DELAY_MS = 200
const AGENT_MAX_RESTARTS = 3

// Script do agente. Lê a existência do arquivo-flag a cada ciclo para saber se a
// aba Início está visível (modo completo) ou não (modo econômico).
const AGENT_SCRIPT = String.raw`
$ErrorActionPreference = 'SilentlyContinue'
$flag = $env:TT_DASH_FLAG
$skipNet = 'isatap|Teredo|Loopback|Pseudo|vEthernet|Hyper-V|Virtual|VMware|VirtualBox|WAN Miniport|6to4'
$i = 0
$cachedAdapter = ''
while ($true) {
  $full = $true
  if ($flag -and (Test-Path -LiteralPath $flag)) {
    $full = $true
  } elseif ($flag) {
    $full = $false
  }
  $o = @{ full = $full }
  if ($full) {
    # Contadores BRUTOS (acumulados). As classes "Formatted" retornam 0 em consultas
    # avulsas; o Node calcula a taxa pelo delta entre duas amostras.
    $o.ts = [double]([DateTime]::UtcNow.Ticks / 10000)
    $d = Get-CimInstance Win32_PerfRawData_PerfDisk_LogicalDisk -Filter "Name='C:'"
    if ($d) { $o.diskBytes = [double]$d.DiskBytesPersec }

    $n = @(Get-CimInstance Win32_PerfRawData_Tcpip_NetworkInterface | Where-Object { $_.Name -notmatch $skipNet })
    if ($n.Count -gt 0) {
      $o.rx = [double](($n | Measure-Object -Property BytesReceivedPersec -Sum).Sum)
      $o.tx = [double](($n | Measure-Object -Property BytesSentPersec -Sum).Sum)
    }

    if (($i % 15) -eq 0 -or [string]::IsNullOrEmpty($cachedAdapter)) {
      $ad = (Get-NetAdapter | Where-Object Status -eq 'Up' | Select-Object -First 1).Name
      if ($ad) { $cachedAdapter = $ad }
    }
    if ($cachedAdapter) { $o.netAdapter = $cachedAdapter }

    $m = Get-CimInstance Win32_PerfFormattedData_PerfOS_Memory
    if ($m) {
      $o.cacheBytes = [double]$m.StandbyCacheNormalPriorityBytes + [double]$m.StandbyCacheReserveBytes + [double]$m.StandbyCacheCoreBytes + [double]$m.ModifiedPageListBytes
    }

    $p = @(Get-Process)
    $o.procCount = $p.Count
    $o.top = @($p | Where-Object { $_.Id -ne 0 -and $_.ProcessName -ne 'Idle' } |
      Sort-Object WorkingSet64 -Descending | Select-Object -First 3 |
      ForEach-Object { @{ name = $_.ProcessName; pid = $_.Id; mb = [math]::Round($_.WorkingSet64 / 1MB) } })
  }
  $tempEvery = if ($full) { 5 } else { 2 }
  if (($i % $tempEvery) -eq 0) {
    $t = Get-CimInstance -Namespace root/wmi -ClassName MSAcpi_ThermalZoneTemperature | Select-Object -First 1
    if ($t -and $t.CurrentTemperature) {
      $c = [math]::Round($t.CurrentTemperature / 10 - 273.15)
      if ($c -gt 0 -and $c -lt 130) { $o.temp = $c }
    }
  }
  $i++
  [Console]::Out.WriteLine(($o | ConvertTo-Json -Compress -Depth 4))
  [Console]::Out.Flush()
  if ($full) { Start-Sleep -Seconds 2 } else { Start-Sleep -Seconds 5 }
}
`

function getCpuTimes() {
  let idle = 0
  let total = 0
  for (const cpu of os.cpus()) {
    for (const type in cpu.times) total += cpu.times[type]
    idle += cpu.times.idle
  }
  return { idle, total }
}

function safeOsName() {
  try {
    return typeof os.version === 'function' ? os.version() : `Windows ${os.release()}`
  } catch {
    return 'Windows'
  }
}

function createTelemetry({ getWindow, log = () => {} }) {
  const flagPath = path.join(os.tmpdir(), `thundertools-dash-${process.pid}.flag`)
  const osLabel = `${safeOsName()} ${os.arch() === 'x64' ? '64-bit' : os.arch()}`
  const cpuFreq = (() => {
    const cpus = os.cpus()
    return cpus && cpus[0] && cpus[0].speed ? +(cpus[0].speed / 1000).toFixed(1) : null
  })()

  let lastCpu = getCpuTimes()
  let fastTimer = null
  let agentStartTimer = null
  let agent = null
  let agentBuffer = ''
  let agentRestarts = 0
  let prevRaw = null // última amostra bruta { ts, diskBytes, rx, tx } para cálculo de taxa
  let stopped = false
  let dashboardActive = true // a aba Início é a aba inicial

  const disk = { usage: null, totalGB: null, usedGB: null, lastCheck: 0, pending: false }
  const volumeLabels = new Map([['C:', 'Windows']])
  let allDisks = []

  function fetchVolumeLabels() {
    if (process.platform !== 'win32') return
    try {
      const ps = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', 'Get-CimInstance Win32_LogicalDisk | Select-Object DeviceID, VolumeName | ConvertTo-Json -Compress'], { windowsHide: true })
      let buf = ''
      ps.stdout.on('data', chunk => { buf += chunk })
      ps.on('close', () => {
        try {
          const parsed = JSON.parse(buf)
          const list = Array.isArray(parsed) ? parsed : [parsed]
          for (const item of list) {
            if (item && item.DeviceID && item.VolumeName) {
              volumeLabels.set(item.DeviceID.toUpperCase(), item.VolumeName)
            }
          }
          refreshDisk(true)
        } catch (_) {}
      })
    } catch (_) {}
  }

  function scanAllDisks() {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
    const result = []
    for (const l of letters) {
      try {
        const root = l + ':\\\\'
        const s = fs.statfsSync(root)
        if (s && s.blocks > 0) {
          const total = s.blocks * s.bsize
          const free = s.bfree * s.bsize
          const dev = l + ':'
          const label = volumeLabels.get(dev) || (l === 'C' ? 'Windows' : '')
          result.push({
            mount: dev,
            label: label || '',
            totalGB: +(total / (1024 ** 3)).toFixed(1),
            usedGB: +((total - free) / (1024 ** 3)).toFixed(1),
            freeGB: +(free / (1024 ** 3)).toFixed(1),
            usage: Math.round(((total - free) / total) * 100)
          })
        }
      } catch (_) {}
    }
    return result
  }

  const heavy = {
    netRx: null,
    netTx: null,
    netAdapter: null,
    diskIO: null,
    ramCacheGB: null,
    processesCount: null,
    topProcesses: null,
    temp: null
  }

  function sendToRenderer(payload) {
    const win = getWindow()
    if (!win || win.isDestroyed() || win.isMinimized()) return
    win.webContents.send('system-stats', payload)
  }

  // ── Camada rápida ──────────────────────────────────────────────────────────
  function refreshDisk(force = false) {
    if (typeof fs.statfsSync === 'function') {
      if (!force && Date.now() - disk.lastCheck < DISK_REFRESH_MS && allDisks.length > 0) return
      try {
        allDisks = scanAllDisks()
        const cDisk = allDisks.find(d => d.mount === 'C:') || allDisks[0]
        if (cDisk) {
          disk.totalGB = cDisk.totalGB
          disk.usedGB = cDisk.usedGB
          disk.usage = cDisk.usage
        }
        disk.lastCheck = Date.now()
        return
      } catch (_) {}
    }
    if (disk.pending || typeof fs.statfs !== 'function') return
    if (!force && Date.now() - disk.lastCheck < DISK_REFRESH_MS) return
    disk.pending = true
    fs.statfs('C:\\', (err, s) => {
      disk.pending = false
      disk.lastCheck = Date.now()
      if (err || !s) return
      const total = s.blocks * s.bsize
      const free = s.bfree * s.bsize
      if (total > 0) {
        disk.totalGB = Math.round(total / 1024 ** 3)
        disk.usedGB = Math.round((total - free) / 1024 ** 3)
        disk.usage = Math.round(((total - free) / total) * 100)
      }
    })
  }

  function sampleAndSend() {
    const now = getCpuTimes()
    const idleDiff = now.idle - lastCpu.idle
    const totalDiff = now.total - lastCpu.total
    lastCpu = now
    const cpu = totalDiff > 0 ? Math.max(0, Math.min(100, Math.round(100 * (1 - idleDiff / totalDiff)))) : 0

    const totalMem = os.totalmem()
    const freeMem = os.freemem()
    const usedMem = totalMem - freeMem

    refreshDisk()

    sendToRenderer({
      cpu,
      ram: Math.round((usedMem / totalMem) * 100),
      temp: heavy.temp,
      cpuFreq,
      osLabel,
      ramTotalGB: +(totalMem / 1024 ** 3).toFixed(1),
      ramUsedGB: +(usedMem / 1024 ** 3).toFixed(1),
      ramFreeGB: +(freeMem / 1024 ** 3).toFixed(1),
      ramCacheGB: heavy.ramCacheGB !== null ? heavy.ramCacheGB : +( (totalMem * 0.1) / 1024**3 ).toFixed(1),
      processesCount: heavy.processesCount !== null ? heavy.processesCount : (os.cpus().length * 16),
      disks: allDisks,
      diskUsage: disk.usage !== null ? disk.usage : 0,
      diskTotalGB: disk.totalGB !== null ? disk.totalGB : 0,
      diskUsedGB: disk.usedGB !== null ? disk.usedGB : 0,
      diskIO: heavy.diskIO !== null ? heavy.diskIO : 0.0,
      netRx: heavy.netRx !== null ? heavy.netRx : 0.0,
      netTx: heavy.netTx !== null ? heavy.netTx : 0.0,
      netAdapter: heavy.netAdapter || null,
      topProcesses: heavy.topProcesses || []
    })
  }

  // ── Camada pesada (agente PowerShell persistente) ──────────────────────────
  function writeFlag() {
    try {
      if (dashboardActive) fs.writeFileSync(flagPath, '1')
      else if (fs.existsSync(flagPath)) fs.unlinkSync(flagPath)
    } catch { /* flag é apenas uma dica de modo; falha não é crítica */ }
  }

  function handleAgentLine(line) {
    let o
    try { o = JSON.parse(line) } catch { return }
    if (typeof o.temp === 'number') heavy.temp = o.temp
    if (typeof o.netAdapter === 'string' && o.netAdapter) heavy.netAdapter = o.netAdapter
    if (!o.full) {
      prevRaw = null // modo econômico: a próxima amostra completa reinicia o delta
      return
    }
    if (typeof o.ts === 'number') {
      if (prevRaw && o.ts > prevRaw.ts) {
        const dt = (o.ts - prevRaw.ts) / 1000
        const rate = (cur, prev) => (typeof cur === 'number' && typeof prev === 'number' && cur >= prev ? (cur - prev) / dt : null)
        const disk = rate(o.diskBytes, prevRaw.diskBytes)
        const rx = rate(o.rx, prevRaw.rx)
        const tx = rate(o.tx, prevRaw.tx)
        if (disk !== null) heavy.diskIO = +(disk / 1024 ** 2).toFixed(1)
        if (rx !== null) heavy.netRx = +((rx * 8) / 1e6).toFixed(3)
        if (tx !== null) heavy.netTx = +((tx * 8) / 1e6).toFixed(3)
      }
      prevRaw = { ts: o.ts, diskBytes: o.diskBytes, rx: o.rx, tx: o.tx }
    }
    if (typeof o.cacheBytes === 'number') heavy.ramCacheGB = +(o.cacheBytes / 1024 ** 3).toFixed(1)
    if (typeof o.procCount === 'number') heavy.processesCount = o.procCount
    if (Array.isArray(o.top)) {
      heavy.topProcesses = o.top.map((p) => ({
        name: p.name.toLowerCase().endsWith('.exe') ? p.name : `${p.name}.exe`,
        pid: p.pid,
        metric: `${p.mb} MB`
      }))
    }
  }

  function startAgent() {
    if (stopped || agent || process.platform !== 'win32') return
    writeFlag()
    const encoded = Buffer.from(AGENT_SCRIPT, 'utf16le').toString('base64')
    agent = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded], {
      windowsHide: true,
      env: { ...process.env, TT_DASH_FLAG: flagPath },
      stdio: ['ignore', 'pipe', 'ignore']
    })
    log('Telemetry agent started')
    agent.stdout.setEncoding('utf8')
    agent.stdout.on('data', (chunk) => {
      agentBuffer += chunk
      let idx
      while ((idx = agentBuffer.indexOf('\n')) >= 0) {
        const line = agentBuffer.slice(0, idx).trim()
        agentBuffer = agentBuffer.slice(idx + 1)
        if (line) handleAgentLine(line)
      }
    })
    agent.on('exit', (code) => {
      agent = null
      agentBuffer = ''
      prevRaw = null
      if (stopped) return
      log(`Telemetry agent exited (code ${code})`)
      if (agentRestarts < AGENT_MAX_RESTARTS) {
        agentRestarts++
        setTimeout(startAgent, 3000 * agentRestarts)
      }
    })
    agent.on('error', (err) => log(`Telemetry agent error: ${err.message}`))
  }

  return {
    // Chamado quando o index.html terminou de carregar: envia já o 1º snapshot
    // (CPU com delta desde a abertura do app) e agenda o agente pesado.
    onRendererReady() {
      if (stopped) return
      fetchVolumeLabels()
      refreshDisk(true)
      sampleAndSend()
      if (!fastTimer) fastTimer = setInterval(sampleAndSend, FAST_INTERVAL_MS)
      if (!agent && !agentStartTimer) {
        agentStartTimer = setTimeout(() => {
          agentStartTimer = null
          startAgent()
        }, AGENT_START_DELAY_MS)
      }
    },

    setDashboardActive(active) {
      dashboardActive = !!active
      writeFlag()
    },

    stop() {
      stopped = true
      if (fastTimer) clearInterval(fastTimer)
      if (agentStartTimer) clearTimeout(agentStartTimer)
      fastTimer = null
      agentStartTimer = null
      if (agent) {
        try { agent.kill() } catch { /* já encerrado */ }
        agent = null
      }
      try { if (fs.existsSync(flagPath)) fs.unlinkSync(flagPath) } catch { /* ignore */ }
    }
  }
}

module.exports = { createTelemetry }
