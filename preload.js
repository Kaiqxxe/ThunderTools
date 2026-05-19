const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  runCommand: (command) => ipcRenderer.invoke('run-command', command),
  listDeletableUsers: () => ipcRenderer.invoke('list-deletable-users'),
  deleteLocalUser: (userName) => ipcRenderer.invoke('delete-local-user', userName),
  cancelCommand: () => ipcRenderer.send('cancel-command'),
  onSystemStats: (callback) => ipcRenderer.on('system-stats', (_, data) => callback(data)),
  getBlockedLocalUsers: () => ipcRenderer.invoke('get-blocked-local-users'),
  runTrackedCommand: (command, trackingId) => ipcRenderer.invoke('run-command', command, trackingId),
  onCommandProgress: (callback) => {
    const listener = (_, data) => callback(data)
    ipcRenderer.on('command-progress', listener)
    return () => ipcRenderer.removeListener('command-progress', listener)
  }
})
