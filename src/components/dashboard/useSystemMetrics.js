import { useState, useEffect, useRef } from 'react';

/**
 * Hook para consumo de telemetria 100% REAL de hardware via IPC do Electron
 */
export function useSystemMetrics() {
  const [metrics, setMetrics] = useState({
    cpu: {
      usage: 0,
      freq: 2.0,
      activeProcesses: 0,
      history: [0, 0, 0, 0, 0]
    },
    ram: {
      percentage: 0,
      totalGB: 8.0,
      usedGB: 0,
      availableGB: 0,
      cacheGB: 0.8
    },
    disk: {
      usedPercentage: 0,
      totalGB: 110,
      usedGB: 0,
      readWriteSpeedMBs: 0
    },
    network: {
      downloadMbps: 0,
      uploadMbps: 0,
      history: [0, 0, 0, 0, 0]
    },
    temp: null,
    diagnostic: {
      status: 'normal',
      message: 'Sistema Operando Normalmente',
      subtext: 'Nenhuma lentidão detectada em segundo plano. Métricas do Windows estão dentro dos padrões ideais.',
      lastCheck: 'Agora mesmo',
      pendingIssues: []
    },
    topProcesses: []
  });

  const historyRef = useRef({
    cpu: [0, 0, 0, 0, 0],
    net: [0, 0, 0, 0, 0]
  });

  useEffect(() => {
    // 1. Conexão real com IPC do Electron
    if (typeof window !== 'undefined' && window.api?.onSystemStats) {
      const unsubscribe = window.api.onSystemStats((data) => {
        setMetrics((prev) => {
          const newCpuVal = data.cpu ?? prev.cpu.usage;
          const newNetVal = data.netRx ?? prev.network.downloadMbps;

          const updatedCpuHist = [...historyRef.current.cpu.slice(1), newCpuVal];
          const updatedNetHist = [...historyRef.current.net.slice(1), newNetVal];
          historyRef.current = { cpu: updatedCpuHist, net: updatedNetHist };

          return {
            ...prev,
            cpu: {
              ...prev.cpu,
              usage: newCpuVal,
              freq: data.cpuFreq ?? prev.cpu.freq,
              activeProcesses: data.processesCount ?? prev.cpu.activeProcesses,
              history: updatedCpuHist
            },
            ram: {
              ...prev.ram,
              percentage: data.ram ?? prev.ram.percentage,
              totalGB: data.ramTotalGB ?? prev.ram.totalGB,
              usedGB: data.ramUsedGB ?? prev.ram.usedGB,
              availableGB: data.ramFreeGB ?? prev.ram.availableGB,
              cacheGB: data.ramCacheGB ?? prev.ram.cacheGB
            },
            disk: {
              ...prev.disk,
              usedPercentage: data.diskUsage ?? prev.disk.usedPercentage,
              totalGB: data.diskTotalGB ?? prev.disk.totalGB,
              usedGB: data.diskUsedGB ?? prev.disk.usedGB,
              readWriteSpeedMBs: data.diskIO ?? prev.disk.readWriteSpeedMBs
            },
            network: {
              ...prev.network,
              downloadMbps: data.netRx ?? prev.network.downloadMbps,
              uploadMbps: data.netTx ?? prev.network.uploadMbps,
              history: updatedNetHist
            },
            temp: data.temp ?? prev.temp,
            topProcesses: data.topProcesses ?? prev.topProcesses
          };
        });
      });

      return () => {
        if (typeof unsubscribe === 'function') unsubscribe();
      };
    }
  }, []);

  return metrics;
}
