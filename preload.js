const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  runCommand: (command) => ipcRenderer.invoke('run-command', command),
  cancelCommand: () => ipcRenderer.send('cancel-command'),
  onSystemStats: (callback) => ipcRenderer.on('system-stats', (_, data) => callback(data))
})
