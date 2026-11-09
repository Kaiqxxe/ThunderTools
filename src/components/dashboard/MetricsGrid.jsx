import React from 'react';
import { CPUGraphCard } from './CPUGraphCard';
import { RAMDonutCard } from './RAMDonutCard';
import { DiskStorageCard } from './DiskStorageCard';
import { NetworkMonitorCard } from './NetworkMonitorCard';
import { TopProcessesCard } from './TopProcessesCard';

export function MetricsGrid({ metrics }) {
  return (
    <section>
      <div className="tt-section-header">
        <h3 className="tt-section-title">Dashboards em Tempo Real</h3>
      </div>

      <div className="tt-metrics-grid" style={{ marginTop: '14px' }}>
        {/* Card 1: CPU Line Chart */}
        <CPUGraphCard
          usage={metrics.cpu.usage}
          freq={metrics.cpu.freq}
          activeProcesses={metrics.cpu.activeProcesses}
          history={metrics.cpu.history}
        />

        {/* Card 2: Memória RAM Donut */}
        <RAMDonutCard
          percentage={metrics.ram.percentage}
          totalGB={metrics.ram.totalGB}
          availableGB={metrics.ram.availableGB}
          cacheGB={metrics.ram.cacheGB}
        />

        {/* Card 3: Disco (C:) Gauge Speedometer */}
        <DiskStorageCard
          driveLetter="C:"
          variant="gauge"
          usedPercentage={metrics.disk.usedPercentage}
          totalGB={metrics.disk.totalGB}
          readWriteSpeedMBs={metrics.disk.readWriteSpeedMBs}
        />

        {/* Card 4: Disco (C:) Linear Bar */}
        <DiskStorageCard
          driveLetter="C:"
          variant="linear"
          usedPercentage={metrics.disk.usedPercentage}
          totalGB={metrics.disk.totalGB}
          readWriteSpeedMBs={metrics.disk.readWriteSpeedMBs}
        />

        {/* Card 5: Rede Monitor */}
        <NetworkMonitorCard
          downloadMbps={metrics.network.downloadMbps}
          uploadMbps={metrics.network.uploadMbps}
          history={metrics.network.history}
        />

        {/* Card 6: Processos em Destaque */}
        <TopProcessesCard
          processes={metrics.topProcesses}
        />
      </div>
    </section>
  );
}
