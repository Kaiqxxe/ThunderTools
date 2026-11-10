const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  runCommand: (command, options = {}) => ipcRenderer.invoke('run-command', command, null, options),
  listDeletableUsers: () => ipcRenderer.invoke('list-deletable-users'),
  deleteLocalUser: (userName) => ipcRenderer.invoke('delete-local-user', userName),
  cancelCommand: () => ipcRenderer.send('cancel-command'),
  onSystemStats: (callback) => ipcRenderer.on('system-stats', (_, data) => callback(data)),
  getBlockedLocalUsers: () => ipcRenderer.invoke('get-blocked-local-users'),
  runTrackedCommand: (command, trackingId, options = {}) => ipcRenderer.invoke('run-command', command, trackingId, options),
  onCommandProgress: (callback) => {
    const listener = (_, data) => callback(data);
    ipcRenderer.on('command-progress', listener);
    return () => ipcRenderer.removeListener('command-progress', listener);
  },
  runSpeedTest: () => ipcRenderer.invoke('run-speed-test'),
  cancelSpeedTest: () => ipcRenderer.send('cancel-speed-test'),
  onSpeedTestProgress: (callback) => {
    const listener = (_, data) => callback(data);
    ipcRenderer.on('speed-test-progress', listener);
    return () => ipcRenderer.removeListener('speed-test-progress', listener);
  },
  saveTextFile: (options) => ipcRenderer.invoke('save-text-file', options),
  selectFolder: (options) => ipcRenderer.invoke('select-folder', options),
  getSystemDiagnostics: (options) => ipcRenderer.invoke('get-system-diagnostics', options),
  repairSystemIssues: (issueType) => ipcRenderer.invoke('repair-system-issues', issueType),
  onRepairProgress: (callback) => {
    const listener = (_, data) => callback(data);
    ipcRenderer.on('repair-progress', listener);
    return () => ipcRenderer.removeListener('repair-progress', listener);
  },
  setDiagnosticSchedule: (intervalHours) => ipcRenderer.invoke('set-diagnostic-schedule', intervalHours),
  getDiagnosticSchedule: () => ipcRenderer.invoke('get-diagnostic-schedule'),
  recordCompletedAiCommand: (cmd) => ipcRenderer.invoke('record-completed-ai-command', cmd),
  openCleanmgr: () => ipcRenderer.invoke('open-cleanmgr'),
  openStorageSense: () => ipcRenderer.invoke('open-storagesense'),
  exportSystemReportPDF: (reportType = 'technical', extraData = {}) => ipcRenderer.invoke('export-system-report-pdf', reportType, extraData),
  generateServiceOrderHtml: (extraData = {}) => ipcRenderer.invoke('generate-service-order-html', extraData),
  openFilePath: (targetPath) => ipcRenderer.invoke('open-file-path', targetPath),
  showItemInFolder: (targetPath) => ipcRenderer.invoke('show-item-in-folder', targetPath),
  checkInternetConnection: () => ipcRenderer.invoke('check-internet-connection'),
  fetchSystemLogSnippet: (logType) => ipcRenderer.invoke('fetch-system-log-snippet', logType),
  geminiAnalyze: (options) => ipcRenderer.invoke('gemini-analyze-diagnostics', options),
  resetSystemMaintenance: () => ipcRenderer.invoke('reset-system-maintenance'),
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  maximizeWindow: () => ipcRenderer.send('maximize-window'),
  closeWindow: () => ipcRenderer.send('close-window')
})
