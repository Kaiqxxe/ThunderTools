// ─── Ping Tool Modal (ThunderTools Design System) ────────────────────────────
// ThunderTools - Thunder Sistemas

function escapeHtml(value) {
  if (value === undefined || value === null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function createLucideIcons(root = document) {
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    const target = (root && root.nodeType) ? root : document;
    window.lucide.createIcons({ root: target });
  }
}

function cleanTerminalText(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/\uFFFD/g, '')
    .replace(/Estat.sticas/gi, 'Estatísticas')
    .replace(/estat.sticas/gi, 'estatísticas')
    .replace(/M.nimo/gi, 'Mínimo')
    .replace(/m.nimo/gi, 'mínimo')
    .replace(/M.ximo/gi, 'Máximo')
    .replace(/m.ximo/gi, 'máximo')
    .replace(/M.dia/gi, 'Média')
    .replace(/m.dia/gi, 'média')
    .replace(/n.mero/gi, 'número')
    .replace(/tempo</gi, 'tempo < ')
    .replace(/time</gi, 'time < ');
}

export function showPingModal(ctx = {}) {
  const toastFn = ctx.toast || window.toast || (() => {});
  const addHistoryFn = ctx.addToHistory || window.addToHistory || (() => {});

  const existing = document.getElementById('ping-modal-overlay');
  if (existing) {
    existing.remove();
  }

  const overlay = document.createElement('div');
  overlay.id = 'ping-modal-overlay';
  overlay.className = 'modal-overlay';

  overlay.innerHTML = `
    <div class="modal details-modal ping-details-modal" role="dialog" aria-modal="true">
      <button class="modal-close-icon-btn" id="ping-x-close" title="Fechar (Esc)">
        <i data-lucide="x" style="width:16px;height:16px"></i>
      </button>

      <div class="details-modal-header" style="margin-bottom: 12px;">
        <div class="details-header-lead">
          <div class="details-header-icon-box" style="background: linear-gradient(135deg, rgba(99, 102, 241, 0.22) 0%, rgba(56, 189, 248, 0.18) 100%); border-color: rgba(99, 102, 241, 0.4); color: #818cf8;">
            <i data-lucide="activity" style="width:22px;height:22px"></i>
          </div>
          <div class="details-header-text">
            <div class="details-modal-title">
              <span>Ping em IP / Host Específico</span>
              <span class="details-count-pill" id="ping-phase-pill">Pronto</span>
            </div>
            <div class="details-modal-desc" id="ping-modal-desc">Diagnóstico de latência em tempo real, jitter e perda de pacotes ICMP</div>
          </div>
        </div>
      </div>

      <!-- Controls Card (Input, Presets, Mode & Trigger) -->
      <div class="ping-controls-card">
        <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
          <div class="ping-input-wrap">
            <i data-lucide="globe"></i>
            <input id="ping-target-input" type="text" placeholder="Ex: 1.1.1.1, 8.8.8.8, 192.168.1.1, google.com" value="1.1.1.1" autocomplete="off" spellcheck="false" />
          </div>

          <div class="ping-mode-group" id="ping-mode-group">
            <button type="button" class="ping-mode-btn active" data-count="4">4 Pacotes</button>
            <button type="button" class="ping-mode-btn" data-count="10">10 Pacotes</button>
            <button type="button" class="ping-mode-btn" data-count="continuous">Contínuo (-t)</button>
          </div>

          <button id="ping-action-btn" class="ping-action-trigger" type="button">
            <i data-lucide="play" style="width:14px;height:14px" id="ping-action-icon"></i>
            <span id="ping-action-text">Disparar Ping</span>
          </button>
        </div>

        <!-- Presets Row -->
        <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: 11px; color: #94a3b8;">
          <span style="font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; font-size: 10px; color: #64748b; margin-right: 2px;">Atalhos rápidos:</span>
          <button type="button" class="ping-preset-pill" data-ip="1.1.1.1">Cloudflare (1.1.1.1)</button>
          <button type="button" class="ping-preset-pill" data-ip="8.8.8.8">Google (8.8.8.8)</button>
          <button type="button" class="ping-preset-pill" data-ip="192.168.1.1">Gateway (192.168.1.1)</button>
          <button type="button" class="ping-preset-pill" data-ip="192.168.0.1">Gateway (192.168.0.1)</button>
          <button type="button" class="ping-preset-pill" data-ip="google.com">google.com</button>
        </div>
      </div>

      <!-- Stat Grid (4 Metrics) -->
      <div class="ping-stat-grid">
        <div class="ping-stat-card">
          <div class="ping-stat-label">
            <i data-lucide="clock" style="width:12px;height:12px"></i>
            Latência Média
          </div>
          <div class="ping-stat-val" id="ping-stat-avg">-</div>
          <div class="ping-stat-sub" id="ping-stat-minmax">Mín: - • Máx: -</div>
        </div>

        <div class="ping-stat-card">
          <div class="ping-stat-label">
            <i data-lucide="activity" style="width:12px;height:12px"></i>
            Jitter & Estabilidade
          </div>
          <div class="ping-stat-val" id="ping-stat-jitter">-</div>
          <div class="ping-stat-sub" id="ping-stat-quality">Aguardando início</div>
        </div>

        <div class="ping-stat-card">
          <div class="ping-stat-label">
            <i data-lucide="shield-check" style="width:12px;height:12px"></i>
            Pacotes & Perda
          </div>
          <div class="ping-stat-val" id="ping-stat-loss">0%</div>
          <div class="ping-stat-sub" id="ping-stat-packets">0 enviados • 0 recebidos</div>
        </div>

        <div class="ping-stat-card">
          <div class="ping-stat-label">
            <i data-lucide="radio" style="width:12px;height:12px"></i>
            Status da Conexão
          </div>
          <div class="ping-stat-val" style="display: flex; align-items: center; gap: 8px;">
            <span class="ping-live-dot idle" id="ping-stat-dot"></span>
            <span id="ping-stat-status" style="font-size: 17px;">Pronto</span>
          </div>
          <div class="ping-stat-sub" id="ping-stat-target-sub">Destino: 1.1.1.1</div>
        </div>
      </div>

      <!-- Packet List Section -->
      <div style="background: rgba(0, 0, 0, 0.22); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 12px; padding: 12px 14px; margin-bottom: 12px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
          <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.5px; display: inline-flex; align-items: center; gap: 6px;">
            <i data-lucide="terminal" style="width:13px;height:13px"></i>
            Respostas dos Pacotes ICMP (<span id="ping-packet-count">0</span>)
          </span>
          <button type="button" id="ping-clear-btn" style="background: transparent; border: none; font-size: 11px; color: #64748b; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; padding: 2px 6px; border-radius: 4px; transition: all 0.2s ease;">
            <i data-lucide="trash-2" style="width:12px;height:12px"></i> Limpar
          </button>
        </div>

        <div class="ping-packet-list" id="ping-packet-list">
          <div id="ping-empty-state" style="padding: 24px 12px; text-align: center; color: #64748b; font-size: 12px;">
            <i data-lucide="radio" style="width:24px;height:24px; margin: 0 auto 6px; display: block; opacity: 0.4;"></i>
            Nenhum pacote enviado ainda. Clique em <strong>Disparar Ping</strong> para testar.
          </div>
        </div>
      </div>

      <!-- Modal Footer -->
      <div class="details-modal-footer" style="margin-top: 10px;">
        <div class="details-footer-tip" style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
          <button type="button" class="modal-btn secondary" id="ping-copy-tech-btn" style="padding: 8px 14px; font-size: 12px;" title="Copiar relatório técnico detalhado com todos os pacotes">
            <i data-lucide="file-code" style="width:14px;height:14px"></i> Relatório Técnico
          </button>
          <button type="button" class="modal-btn secondary" id="ping-copy-simple-btn" style="padding: 8px 14px; font-size: 12px;" title="Copiar resumo simplificado para cliente ou WhatsApp">
            <i data-lucide="file-check" style="width:14px;height:14px"></i> Relatório Simplificado
          </button>
        </div>

        <div style="display: flex; gap: 8px;">
          <button type="button" class="modal-btn primary" id="ping-close-btn" style="padding: 8px 22px; font-size: 12px;">
            Fechar
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  createLucideIcons(overlay);

  // ── State & References ──
  let isRunning = false;
  let activeTrackingId = null;
  let unsubscribeProgress = null;
  let selectedMode = '4'; // '4', '10', 'continuous'

  const targetInput = overlay.querySelector('#ping-target-input');
  const actionBtn = overlay.querySelector('#ping-action-btn');
  const actionText = overlay.querySelector('#ping-action-text');
  const phasePill = overlay.querySelector('#ping-phase-pill');
  const statAvg = overlay.querySelector('#ping-stat-avg');
  const statMinMax = overlay.querySelector('#ping-stat-minmax');
  const statJitter = overlay.querySelector('#ping-stat-jitter');
  const statQuality = overlay.querySelector('#ping-stat-quality');
  const statLoss = overlay.querySelector('#ping-stat-loss');
  const statPackets = overlay.querySelector('#ping-stat-packets');
  const statStatus = overlay.querySelector('#ping-stat-status');
  const statDot = overlay.querySelector('#ping-stat-dot');
  const statTargetSub = overlay.querySelector('#ping-stat-target-sub');
  const packetList = overlay.querySelector('#ping-packet-list');
  const packetCount = overlay.querySelector('#ping-packet-count');
  const emptyState = overlay.querySelector('#ping-empty-state');
  const clearBtn = overlay.querySelector('#ping-clear-btn');
  const copyTechBtn = overlay.querySelector('#ping-copy-tech-btn');
  const copySimpleBtn = overlay.querySelector('#ping-copy-simple-btn');
  const closeBtn = overlay.querySelector('#ping-close-btn');
  const xCloseBtn = overlay.querySelector('#ping-x-close');
  const modeButtons = overlay.querySelectorAll('.ping-mode-btn');
  const presetPills = overlay.querySelectorAll('.ping-preset-pill');

  // Stats storage
  let sentCount = 0;
  let receivedCount = 0;
  let lostCount = 0;
  let latencies = [];
  let rawPacketRecords = [];
  let streamBuffer = '';

  // Mode Selection
  modeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      if (isRunning) return;
      modeButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedMode = btn.dataset.count;
    });
  });

  // Presets
  presetPills.forEach(pill => {
    pill.addEventListener('click', () => {
      const ip = pill.dataset.ip;
      if (ip) {
        targetInput.value = ip;
        statTargetSub.textContent = `Destino: ${ip}`;
        targetInput.focus();
      }
    });
  });

  targetInput.addEventListener('input', () => {
    const val = targetInput.value.trim();
    statTargetSub.textContent = val ? `Destino: ${val}` : 'Destino: -';
  });

  // Clear list & reset UI
  function resetStats() {
    sentCount = 0;
    receivedCount = 0;
    lostCount = 0;
    latencies = [];
    rawPacketRecords = [];
    streamBuffer = '';

    statAvg.textContent = '-';
    statMinMax.textContent = 'Mín: - • Máx: -';
    statJitter.textContent = '-';
    statQuality.textContent = 'Aguardando início';
    statLoss.textContent = '0%';
    statLoss.style.color = '';
    statPackets.textContent = '0 enviados • 0 recebidos';
    statStatus.textContent = 'Pronto';
    statDot.className = 'ping-live-dot idle';
    packetCount.textContent = '0';
    packetList.innerHTML = '';
    if (emptyState) {
      packetList.appendChild(emptyState);
    }
  }

  clearBtn.addEventListener('click', () => {
    if (isRunning) return;
    resetStats();
  });

  function updateCalculatedStats() {
    packetCount.textContent = String(rawPacketRecords.length);

    if (latencies.length > 0) {
      const sum = latencies.reduce((a, b) => a + b, 0);
      const avg = Math.round(sum / latencies.length);
      const min = Math.min(...latencies);
      const max = Math.max(...latencies);

      statAvg.textContent = `${avg} ms`;
      statMinMax.textContent = `Mín: ${min}ms • Máx: ${max}ms`;

      // Jitter: average deviation between sequential packets
      if (latencies.length > 1) {
        let diffSum = 0;
        for (let i = 1; i < latencies.length; i++) {
          diffSum += Math.abs(latencies[i] - latencies[i - 1]);
        }
        const jitter = (diffSum / (latencies.length - 1)).toFixed(1);
        statJitter.textContent = `${jitter} ms`;

        if (avg < 40 && parseFloat(jitter) < 5) {
          statQuality.textContent = 'Qualidade Excelente';
          statQuality.style.color = '#10b981';
        } else if (avg < 90 && parseFloat(jitter) < 15) {
          statQuality.textContent = 'Qualidade Boa';
          statQuality.style.color = '#38bdf8';
        } else if (avg < 150) {
          statQuality.textContent = 'Latência Moderada';
          statQuality.style.color = '#f59e0b';
        } else {
          statQuality.textContent = 'Conexão Instável';
          statQuality.style.color = '#ef4444';
        }
      } else {
        statJitter.textContent = `~0 ms`;
        statQuality.textContent = 'Amostra inicial';
      }
    }

    const total = sentCount || (receivedCount + lostCount);
    if (total > 0) {
      const lossPct = Math.round((lostCount / total) * 100);
      statLoss.textContent = `${lossPct}%`;
      statPackets.textContent = `${total} enviados • ${receivedCount} recebidos`;

      if (lossPct === 0) {
        statLoss.style.color = '#10b981';
      } else if (lossPct < 15) {
        statLoss.style.color = '#f59e0b';
      } else {
        statLoss.style.color = '#ef4444';
      }
    }
  }

  function appendPacketRow(packet) {
    if (emptyState && emptyState.parentNode) {
      emptyState.remove();
    }

    const row = document.createElement('div');
    row.className = 'ping-packet-row';

    if (packet.success) {
      let timeColor = '#10b981';
      if (packet.time >= 120) timeColor = '#ef4444';
      else if (packet.time >= 60) timeColor = '#f59e0b';

      row.innerHTML = `
        <span style="display:flex; align-items:center; gap:8px;">
          <span class="ping-live-dot active"></span>
          <span style="color:#e2e8f0; font-weight:600;">Disparo #${packet.seq}:</span>
          <span style="color:#94a3b8;">Resposta de <strong style="color:#f1f5f9">${escapeHtml(packet.from)}</strong>: bytes=${escapeHtml(packet.bytes || '32')}</span>
        </span>
        <div style="display:flex; align-items:center; gap:12px;">
          <span style="color:${timeColor}; font-weight:700;">tempo=${packet.time}ms</span>
          <span style="color:#64748b; font-size:11px;">TTL=${escapeHtml(packet.ttl || '-')}</span>
        </div>
      `;
    } else {
      row.style.borderColor = 'rgba(239, 68, 68, 0.35)';
      row.style.background = 'rgba(239, 68, 68, 0.08)';
      row.innerHTML = `
        <span style="display:flex; align-items:center; gap:8px;">
          <span class="ping-live-dot error"></span>
          <span style="color:#ef4444; font-weight:600;">Disparo #${packet.seq}:</span>
          <span style="color:#fca5a5;">${escapeHtml(packet.errorMsg || 'Esgotado o tempo limite do pedido')}</span>
        </span>
        <div style="display:flex; align-items:center; gap:12px;">
          <span style="color:#ef4444; font-weight:700;">Falha / Timeout</span>
          <span style="color:#64748b; font-size:11px;">-</span>
        </div>
      `;
    }

    packetList.appendChild(row);
    packetList.scrollTop = packetList.scrollHeight;
  }

  function parseIncomingLine(line) {
    const clean = cleanTerminalText(line.trim());
    if (!clean) return;

    // Pattern PT: "Resposta de 1.1.1.1: bytes=32 tempo=14ms TTL=57" ou "tempo<1ms"
    // Pattern EN: "Reply from 1.1.1.1: bytes=32 time=14ms TTL=57" ou "time<1ms"
    const successMatch = clean.match(/(?:Resposta de|Reply from)\s+([^:]+):\s*(?:bytes[=:](\d+))?\s*(?:tempo|time)[<=]\s*(\d+)ms\s*(?:TTL[=:](\d+))?/i);
    if (successMatch) {
      sentCount++;
      receivedCount++;
      const timeMs = parseInt(successMatch[3], 10);
      latencies.push(timeMs);

      const packet = {
        seq: sentCount,
        success: true,
        from: successMatch[1].trim(),
        bytes: successMatch[2] || '32',
        time: timeMs,
        ttl: successMatch[4] || ''
      };

      rawPacketRecords.push(packet);
      appendPacketRow(packet);
      updateCalculatedStats();

      statStatus.textContent = 'Respondendo';
      statDot.className = 'ping-live-dot active';
      return;
    }

    // Pattern Timeout / Unreachable
    if (
      /tempo limite/i.test(clean) ||
      /timed out/i.test(clean) ||
      /inacess/i.test(clean) ||
      /unreachable/i.test(clean) ||
      /falha geral/i.test(clean) ||
      /general failure/i.test(clean)
    ) {
      sentCount++;
      lostCount++;

      const packet = {
        seq: sentCount,
        success: false,
        errorMsg: clean
      };

      rawPacketRecords.push(packet);
      appendPacketRow(packet);
      updateCalculatedStats();

      statStatus.textContent = 'Sem resposta';
      statDot.className = 'ping-live-dot error';
      return;
    }

    // Ping summary statistics lines parsing
    const statPacketsMatch = clean.match(/(?:Enviados|Sent)\s*=\s*(\d+).*?(?:Recebidos|Received)\s*=\s*(\d+).*?(?:Perdidos|Lost)\s*=\s*(\d+)/i);
    if (statPacketsMatch) {
      const s = parseInt(statPacketsMatch[1], 10);
      const r = parseInt(statPacketsMatch[2], 10);
      const l = parseInt(statPacketsMatch[3], 10);
      if (!isNaN(s)) sentCount = s;
      if (!isNaN(r)) receivedCount = r;
      if (!isNaN(l)) lostCount = l;
      updateCalculatedStats();
      return;
    }

    const statTimesMatch = clean.match(/(?:M[íi]nimo|Minimum)\s*=\s*(\d+)ms.*?(?:M[áa]ximo|Maximum)\s*=\s*(\d+)ms.*?(?:M[ée]dia|Average)\s*=\s*(\d+)ms/i);
    if (statTimesMatch) {
      const min = parseInt(statTimesMatch[1], 10);
      const max = parseInt(statTimesMatch[2], 10);
      const avg = parseInt(statTimesMatch[3], 10);
      statAvg.textContent = `${avg} ms`;
      statMinMax.textContent = `Mín: ${min}ms • Máx: ${max}ms`;
    }
  }

  function handleIncomingChunk(textChunk) {
    streamBuffer += textChunk;
    const lines = streamBuffer.split(/\r?\n/);
    // Keep last partial line in buffer
    streamBuffer = lines.pop() || '';
    lines.forEach(parseIncomingLine);
  }

  async function stopPing(wasCancelled = false) {
    if (!isRunning) return;
    isRunning = false;

    if (window.api && typeof window.api.cancelCommand === 'function') {
      try {
        window.api.cancelCommand();
      } catch (e) {
        // Ignore cancel errors
      }
    }

    if (unsubscribeProgress) {
      unsubscribeProgress();
      unsubscribeProgress = null;
    }

    actionBtn.classList.remove('is-running');
    actionBtn.removeAttribute('style');
    actionBtn.disabled = false;
    actionText.textContent = 'Disparar Ping';
    const icon = actionBtn.querySelector('i');
    if (icon) icon.setAttribute('data-lucide', 'play');
    createLucideIcons(actionBtn);

    phasePill.textContent = wasCancelled ? 'Interrompido' : 'Concluído';
    phasePill.style.background = wasCancelled ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)';
    phasePill.style.color = wasCancelled ? '#f87171' : '#34d399';

    if (receivedCount > 0) {
      statStatus.textContent = 'Concluído';
      statDot.className = 'ping-live-dot active';
    } else if (lostCount > 0) {
      statStatus.textContent = 'Inacessível';
      statDot.className = 'ping-live-dot error';
    } else {
      statStatus.textContent = 'Finalizado';
      statDot.className = 'ping-live-dot idle';
    }

    targetInput.disabled = false;
    modeButtons.forEach(b => b.disabled = false);
  }

  async function startPing() {
    const rawTarget = targetInput.value.trim();
    if (!rawTarget) {
      toastFn('Por favor, informe um endereço IP ou Hostname válido.', 'warning');
      targetInput.focus();
      return;
    }

    // Sanitize host input to prevent command injection
    const target = rawTarget.replace(/[^a-zA-Z0-9.\-_]/g, '');
    if (!target) {
      toastFn('Endereço IP ou Hostname inválido.', 'error');
      return;
    }

    resetStats();
    isRunning = true;
    targetInput.disabled = true;
    modeButtons.forEach(b => b.disabled = true);

    actionBtn.classList.add('is-running');
    actionBtn.removeAttribute('style');
    actionText.textContent = 'Parar';
    const icon = actionBtn.querySelector('i');
    if (icon) icon.setAttribute('data-lucide', 'square');
    createLucideIcons(actionBtn);

    phasePill.textContent = 'Disparando...';
    phasePill.style.background = 'rgba(99, 102, 241, 0.25)';
    phasePill.style.color = '#818cf8';

    statStatus.textContent = 'Enviando...';
    statDot.className = 'ping-live-dot active';
    statTargetSub.textContent = `Destino: ${target}`;

    let pingCmd = `ping `;
    if (selectedMode === 'continuous') {
      pingCmd += `-t ${target}`;
    } else {
      const count = parseInt(selectedMode, 10) || 4;
      pingCmd += `-n ${count} ${target}`;
    }

    activeTrackingId = `ping-${Date.now()}`;

    if (window.api && typeof window.api.onCommandProgress === 'function') {
      unsubscribeProgress = window.api.onCommandProgress((data) => {
        if (data && data.chunk) {
          handleIncomingChunk(data.chunk);
        }
      });
    }

    try {
      let result;
      if (window.api && typeof window.api.runTrackedCommand === 'function') {
        result = await window.api.runTrackedCommand(pingCmd, activeTrackingId);
      } else if (window.api && typeof window.api.runCommand === 'function') {
        result = await window.api.runCommand(pingCmd);
      } else {
        result = { success: false, output: 'API de comandos não disponível.' };
      }

      // Flush remaining buffer
      if (result && result.output) {
        handleIncomingChunk(result.output);
        if (streamBuffer) {
          parseIncomingLine(streamBuffer);
          streamBuffer = '';
        }
      }

      const success = (result && result.success) || (receivedCount > 0);
      stopPing(result && result.cancelled);

      if (success) {
        toastFn(`Ping em ${target} finalizado com sucesso!`, 'success');
      } else {
        toastFn(`Falha de comunicação com ${target}.`, 'warning');
      }

      addHistoryFn('Ping em IP/Host', pingCmd, success, 'activity');
    } catch (err) {
      stopPing(false);
      toastFn(`Erro ao executar ping: ${err.message}`, 'error');
    }
  }

  actionBtn.addEventListener('click', () => {
    if (isRunning) {
      stopPing(true);
    } else {
      startPing();
    }
  });

  targetInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!isRunning) startPing();
    }
  });

  // ── 1. Copiar Relatório Técnico (Completo) ──
  if (copyTechBtn) {
    copyTechBtn.addEventListener('click', () => {
      const target = targetInput.value.trim() || 'Desconhecido';
      const now = new Date();
      const dateStr = now.toLocaleDateString('pt-BR');
      const timeStr = now.toLocaleTimeString('pt-BR');

      let text = `================================================================================\n`;
      text += `THUNDERTOOLS - RELATÓRIO TÉCNICO DE PING & LATÊNCIA DE REDE\n`;
      text += `Thunder (ThunderTools)\n`;
      text += `================================================================================\n`;
      text += `Destino Testado   : ${target}\n`;
      text += `Data da Medição   : ${dateStr} às ${timeStr}\n`;
      text += `Status da Rota    : ${statStatus.textContent}\n`;
      text += `--------------------------------------------------------------------------------\n`;
      text += `MÉTRICAS TÉCNICAS CONSOLIDADAS:\n`;
      text += `Latência Média    : ${statAvg.textContent}\n`;
      text += `Mínimo / Máximo   : ${statMinMax.textContent}\n`;
      text += `Jitter Calculado  : ${statJitter.textContent} (${statQuality.textContent})\n`;
      text += `Pacotes & Perda   : ${statLoss.textContent} (${statPackets.textContent})\n`;
      text += `--------------------------------------------------------------------------------\n`;
      text += `REGISTROS INDIVIDUAIS DOS DISPAROS ICMP:\n`;

      if (rawPacketRecords.length > 0) {
        rawPacketRecords.forEach(p => {
          if (p.success) {
            text += `[#${p.seq}] Resposta de ${p.from}: bytes=${p.bytes} tempo=${p.time}ms TTL=${p.ttl}\n`;
          } else {
            text += `[#${p.seq}] FALHA: ${p.errorMsg || 'Tempo limite esgotado'}\n`;
          }
        });
      } else {
        text += `Nenhum pacote registrado.\n`;
      }

      text += `================================================================================\n`;

      navigator.clipboard.writeText(text).then(() => {
        toastFn('Relatório Técnico copiado para a área de transferência!', 'success');
      }).catch(() => {
        toastFn('Não foi possível acessar a área de transferência.', 'error');
      });
    });
  }

  // ── 2. Copiar Relatório Simplificado (Para o Cliente) ──
  if (copySimpleBtn) {
    copySimpleBtn.addEventListener('click', () => {
      const target = targetInput.value.trim() || 'Desconhecido';
      const now = new Date();
      const dateStr = now.toLocaleDateString('pt-BR');
      const timeStr = now.toLocaleTimeString('pt-BR');
      const lossVal = statLoss.textContent.replace('%', '').trim();
      const isLossZero = lossVal === '0';

      let text = `🌐 RELATÓRIO DE CONEXÃO (PING) - THUNDERTOOLS\n`;
      text += `Thunder • Suporte em Tecnologia (ThunderTools)\n`;
      text += `--------------------------------------------------\n`;
      text += `• Destino Testado   : ${target}\n`;
      text += `• Data do Teste     : ${dateStr} às ${timeStr}\n`;
      text += `• Status da Conexão : ${isLossZero ? 'ONLINE ✅ (Conexão Estável)' : 'ATENÇÃO ⚠️ (Instabilidade Detectada)'}\n`;
      text += `• Latência Média    : ${statAvg.textContent} (${statQuality.textContent})\n`;
      text += `• Variação / Jitter : ${statJitter.textContent}\n`;
      text += `• Perda de Pacotes  : ${statLoss.textContent} (${statPackets.textContent})\n`;
      text += `--------------------------------------------------\n`;
      text += isLossZero 
        ? `👉 Parecer: Conexão operando com excelente estabilidade e sem perda de pacotes.\n`
        : `👉 Parecer: Foram registradas oscilações ou falhas intermitentes no envio de pacotes.\n`;

      navigator.clipboard.writeText(text).then(() => {
        toastFn('Relatório Simplificado copiado para a área de transferência!', 'success');
      }).catch(() => {
        toastFn('Não foi possível acessar a área de transferência.', 'error');
      });
    });
  }

  // Close Modal safely
  function closeModal() {
    if (isRunning) {
      stopPing(true);
    }
    overlay.remove();
    document.removeEventListener('keydown', onKeyDown);
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      closeModal();
    }
  }

  document.addEventListener('keydown', onKeyDown);
  closeBtn.addEventListener('click', closeModal);
  xCloseBtn.addEventListener('click', closeModal);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closeModal();
    }
  });

  // Focus target input on open
  setTimeout(() => {
    if (targetInput) targetInput.focus();
  }, 100);
}
