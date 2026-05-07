const { app, BrowserWindow, ipcMain } = require('electron')
const { exec } = require('child_process')
const path = require('path')
const os = require('os')

let currentProcess = null

function createWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 650,
    resizable: false,
    title: 'ThunderTools',
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true
    }
  })
  win.setMenuBarVisibility(false)
  win.loadFile('index.html')
  
  // Envia stats do sistema a cada 2 segundos
  setInterval(() => {
    const cpuUsage = process.getCPUUsage()
    const totalMem = os.totalmem()
    const freeMem = os.freemem()
    const ramUsage = Math.round(((totalMem - freeMem) / totalMem) * 100)
    
    win.webContents.send('system-stats', {
      cpu: Math.round(cpuUsage.percentCPUUsage),
      ram: ramUsage
    })
  }, 2000)
}

app.whenReady().then(createWindow)
app.on('window-all-closed', () => app.quit())

ipcMain.handle('run-command', async (_, command) => {
  return new Promise((resolve) => {
    currentProcess = exec(`chcp 65001 > nul & ${command}`, { shell: 'cmd.exe', encoding: 'utf8' }, (error, stdout, stderr) => {
      const cancelled = error && error.killed
      currentProcess = null
      if (cancelled) resolve({ success: false, output: 'Operação cancelada pelo usuário.', cancelled: true })
      else if (error) resolve({ success: false, output: stderr || error.message })
      else resolve({ success: true, output: stdout || '' })
    })
  })
})

ipcMain.on('cancel-command', () => {
  if (currentProcess) {
    currentProcess.kill()
  }
})
