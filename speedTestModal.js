// ─── Speed Test & Network Diagnostics Modal ──────────────────────────────
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

export function generateSpeedTestTxtReport(report) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('pt-BR');
  const timeStr = now.toLocaleTimeString('pt-BR');
  const net = report.networkInfo || {};
  const wifi = net.wifi || null;

  let text = `================================================================================
THUNDERTOOLS - RELATÓRIO DE VELOCIDADE E DIAGNÓSTICO DE REDE
Thunder (ThunderTools)
================================================================================
Data do Teste     : ${dateStr} às ${timeStr}
Status Geral      : ${report.quality === 'excellent' ? 'EXCELENTE / OTIMIZADO' : report.quality === 'warning' ? 'ATENÇÃO' : 'CRÍTICO / INSTÁVEL'}

--------------------------------------------------------------------------------
1. ADAPTADOR & CONECTIVIDADE LOCAL
--------------------------------------------------------------------------------
Placa de Rede     : ${net.adapterName || 'N/A'} (${net.adapterDesc || 'N/A'})
Tipo de Conexão   : ${net.type || 'Desconhecido'}
Endereço IPv4     : ${net.ip4 || 'N/A'}
Gateway (Roteador): ${net.gateway || 'N/A'}
Velocidade do Link: ${net.speed ? `${net.speed} Mbps` : 'N/A'}
Endereço MAC      : ${net.mac || 'N/A'}
`;

  if (wifi) {
    text += `Rede Wi-Fi (SSID) : ${wifi.ssid || 'N/A'}
Sinal Wi-Fi       : ${wifi.signal !== null ? `${wifi.signal}%` : 'N/A'}
Frequência (Banda): ${wifi.band || 'N/A'}
Canal Wi-Fi       : ${wifi.channel || 'N/A'}
Taxa de Recepção  : ${wifi.rate ? `${wifi.rate} Mbps` : 'N/A'}
`;
  }

  text += `
--------------------------------------------------------------------------------
2. VELOCIDADE DE TRANSFERÊNCIA (SPEED TEST REAL)
--------------------------------------------------------------------------------
Download Médio    : ${report.downloadMbps !== undefined ? `${report.downloadMbps} Mbps` : 'N/A'}
Download Pico     : ${report.peakMbps !== undefined ? `${report.peakMbps} Mbps` : 'N/A'}
Upload Médio      : ${report.uploadMbps !== undefined ? `${report.uploadMbps} Mbps` : 'N/A'}
Upload Pico       : ${report.peakUploadMbps !== undefined ? `${report.peakUploadMbps} Mbps` : 'N/A'}

--------------------------------------------------------------------------------
3. QUALIDADE DA ROTA & LATÊNCIA
--------------------------------------------------------------------------------
Latência Internet : ${report.internetLatency !== undefined ? `${report.internetLatency} ms` : 'N/A'}
Jitter (Variação) : ${report.internetJitter !== undefined ? `${report.internetJitter} ms` : 'N/A'}
Perda de Pacotes  : ${report.internetPacketLoss !== undefined ? `${report.internetPacketLoss}%` : '0%'}
Latência Roteador : ${report.gatewayLatency !== undefined ? `${report.gatewayLatency} ms` : 'N/A'}
Perda Roteador    : ${report.gatewayPacketLoss !== undefined ? `${report.gatewayPacketLoss}%` : '0%'}

--------------------------------------------------------------------------------
4. DIAGNÓSTICO INTELIGENTE & DICAS DO TÉCNICO
--------------------------------------------------------------------------------
`;

  if (report.tips && report.tips.length > 0) {
    report.tips.forEach((tip, idx) => {
      text += `[${idx + 1}] ${tip.title.toUpperCase()}\n`;
      text += `    Diagnóstico : ${tip.text}\n`;
      text += `    Recomendação: ${tip.tip}\n\n`;
    });
  } else {
    text += `Conexão sem gargalos detectados. Todos os parâmetros estão dentro dos padrões ideais.\n`;
  }

  text += `================================================================================
Fim do Relatório - ThunderTools v1.1.1 (Windows)
================================================================================
`;
  return text;
}

export function showSpeedTestModal(ctx = {}) {
  const toastFn = ctx.toast || window.toast || (() => {});
  const addHistoryFn = ctx.addToHistory || window.addToHistory || (() => {});

  const existing = document.getElementById('speedtest-modal-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'speedtest-modal-overlay';
  overlay.className = 'modal-overlay';

  overlay.innerHTML = `
    <div class="modal details-modal speedtest-details-modal" role="dialog" aria-modal="true" style="width: min(840px, 95vw); max-width: 840px;">
      <button class="modal-close-icon-btn" id="st-x-close" title="Fechar (Esc)">
        <i data-lucide="x" style="width:16px;height:16px"></i>
      </button>

      <div class="details-modal-header" style="margin-bottom: 8px;">
        <div class="details-header-lead">
          <div class="details-header-icon-box" style="background: linear-gradient(135deg, rgba(56, 189, 248, 0.22) 0%, rgba(168, 85, 247, 0.18) 100%); border-color: rgba(56, 189, 248, 0.4); color: #38bdf8;">
            <i data-lucide="gauge" style="width:22px;height:22px"></i>
          </div>
          <div class="details-header-text">
            <div class="details-modal-title">
              <span>Teste de Velocidade & Diagnóstico</span>
              <span class="details-count-pill" id="st-phase-pill">Iniciando...</span>
            </div>
            <div class="details-modal-desc" id="st-modal-desc">Medição real de Download, Upload, Latência e integridade do sinal</div>
          </div>
        </div>
      </div>

      <!-- Card do Gauge / Velocímetro Digital -->
      <div class="speedtest-gauge-card">
        <!-- Badge da Conexão / Interface -->
        <div id="st-network-badge" style="display: inline-flex; align-items: center; gap: 8px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); padding: 5px 14px; border-radius: 999px; font-size: 11.5px; color: #cbd5e1; margin-bottom: 8px;">
          <i data-lucide="wifi" style="width:14px;height:14px;color:#38bdf8"></i>
          <span id="st-net-badge-text">Identificando rede...</span>
        </div>

        <!-- SVG Dial -->
        <div class="speedtest-dial-wrapper" id="st-dial-wrapper">
          <svg class="speedtest-dial-svg" viewBox="0 0 440 215">
            <defs>
              <linearGradient id="stGaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="#38bdf8" />
                <stop offset="50%" stop-color="#6366f1" />
                <stop offset="100%" stop-color="#818cf8" />
              </linearGradient>
              <linearGradient id="stGaugeGradUpload" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="#7c3aed" />
                <stop offset="50%" stop-color="#a855f7" />
                <stop offset="100%" stop-color="#c084fc" />
              </linearGradient>
            </defs>

            <!-- Trilha de fundo: Arco de 220 graus (R=140, centro 220, 200) -->
            <!-- Arco semi-circular de 180°: de (60, 200) até (380, 200) -->
            <path class="speedtest-track-arc" d="M 60,200 A 160,160 0 0,1 380,200" fill="none" stroke-width="12" stroke-linecap="round" />

            <!-- Arco Ativo: perímetro da meia-circunferência = PI * 160 = 502.65 -->
            <path id="st-active-arc" class="speedtest-active-arc" d="M 60,200 A 160,160 0 0,1 380,200" fill="none" stroke="url(#stGaugeGrad)" stroke-width="12" stroke-linecap="round" stroke-dasharray="502.65" stroke-dashoffset="502.65" style="transition: stroke-dashoffset 0.18s ease-out; filter: drop-shadow(0 0 8px rgba(56, 189, 248, 0.6));" />

            <!-- Ponteiro / Agulha -->
            <g id="st-needle-group" class="speedtest-needle-group" style="transform-origin: 220px 200px; transform: rotate(-90deg); transition: transform 0.18s cubic-bezier(0.1, 0.9, 0.2, 1);">
              <line id="st-needle-line" x1="220" y1="200" x2="220" y2="55" stroke="#38bdf8" stroke-width="3" stroke-linecap="round" style="filter: drop-shadow(0 0 6px rgba(56, 189, 248, 0.8));" />
              <circle id="st-needle-circle" cx="220" cy="200" r="7" fill="#38bdf8" style="filter: drop-shadow(0 0 4px rgba(56, 189, 248, 0.9));" />
            </g>

            <!-- Textos de Escala do Mostrador -->
            <g class="speedtest-ticks">
              <text x="50" y="222" text-anchor="middle">0</text>
              <text x="80" y="115" text-anchor="middle">25</text>
              <text x="145" y="55" text-anchor="middle">100</text>
              <text x="220" y="32" text-anchor="middle">250</text>
              <text x="295" y="55" text-anchor="middle">500</text>
              <text x="360" y="115" text-anchor="middle">750</text>
              <text x="390" y="222" text-anchor="middle">1000+</text>
            </g>

            <!-- Leitura Digital Central -->
            <text x="220" y="155" text-anchor="middle" class="speedtest-readout-val" id="st-readout-val">0.0</text>
            <text x="220" y="185" text-anchor="middle" class="speedtest-readout-unit" id="st-readout-unit" style="transition: fill 0.35s ease;">Mbps (Download)</text>
          </svg>
        </div>

        <!-- Barra de Progresso do Teste -->
        <div class="speedtest-progress-bar-track">
          <div class="speedtest-progress-bar-fill" id="st-progress-bar"></div>
        </div>
        <div id="st-status-msg" style="font-size: 12.5px; color: #94a3b8; font-weight: 500; min-height: 18px;">
          Identificando placas de rede e roteador...
        </div>

        <!-- Linha de Métricas em Tempo Real -->
        <div class="speedtest-metrics-row">
          <div class="speedtest-metric-cell" id="st-cell-down">
            <span class="speedtest-metric-label"><i data-lucide="arrow-down" style="width:12px;height:12px;color:#38bdf8"></i> Download</span>
            <span class="speedtest-metric-val" id="st-val-down" style="color:#38bdf8">0.0 <small style="font-size:10px">Mbps</small></span>
            <span style="font-size:10px; color:#64748b" id="st-peak-down">Pico: 0.0</span>
          </div>
          <div class="speedtest-metric-cell" id="st-cell-up">
            <span class="speedtest-metric-label"><i data-lucide="arrow-up" style="width:12px;height:12px;color:#a855f7"></i> Upload</span>
            <span class="speedtest-metric-val" id="st-val-up" style="color:#a855f7">0.0 <small style="font-size:10px">Mbps</small></span>
            <span style="font-size:10px; color:#64748b" id="st-peak-up">Pico: 0.0</span>
          </div>
          <div class="speedtest-metric-cell">
            <span class="speedtest-metric-label"><i data-lucide="activity" style="width:12px;height:12px;color:#22c55e"></i> Ping (Inet)</span>
            <span class="speedtest-metric-val" id="st-val-ping">- <small style="font-size:10px">ms</small></span>
            <span style="font-size:10px; color:#64748b" id="st-val-jitter">Jitter: -</span>
          </div>
          <div class="speedtest-metric-cell">
            <span class="speedtest-metric-label"><i data-lucide="alert-octagon" style="width:12px;height:12px;color:#f59e0b"></i> Perda</span>
            <span class="speedtest-metric-val" id="st-val-loss">0%</span>
            <span style="font-size:10px; color:#64748b">Pacotes</span>
          </div>
          <div class="speedtest-metric-cell">
            <span class="speedtest-metric-label"><i data-lucide="router" style="width:12px;height:12px;color:#818cf8"></i> Roteador</span>
            <span class="speedtest-metric-val" id="st-val-gw">- <small style="font-size:10px">ms</small></span>
            <span style="font-size:10px; color:#64748b" id="st-val-gw-loss">Perda: 0%</span>
          </div>
        </div>
      </div>

      <!-- Container Dinâmico de Diagnóstico e Recomendações (Aparece ao Concluir) -->
      <div id="st-tips-container" style="display: none; flex-direction: column; gap: 8px; max-height: 160px; overflow-y: auto; margin-bottom: 8px; padding-right: 4px;"></div>

      <!-- Rodapé do Modal com Ações -->
      <div class="details-modal-footer" style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.06); display: flex; align-items: center; justify-content: space-between;">
        <div class="details-footer-tip">
          <i data-lucide="shield-check" style="width:14px;height:14px;color:#22c55e"></i>
          <span id="st-footer-tip-text">Speed test com servidores de alta precisão CDN</span>
        </div>
        <div class="details-footer-actions" style="display: flex; gap: 8px;">
          <button class="modal-btn secondary" id="st-btn-cancel" style="display: flex; align-items: center; gap: 6px;">
            <i data-lucide="x-circle" style="width:14px;height:14px"></i> Cancelar
          </button>
          <button class="modal-btn secondary" id="st-btn-export" style="display: none; align-items: center; gap: 6px;">
            <i data-lucide="file-down" style="width:14px;height:14px"></i> Exportar TXT
          </button>
          <button class="modal-btn primary" id="st-btn-repeat" style="display: none; align-items: center; gap: 6px;">
            <i data-lucide="rotate-ccw" style="width:14px;height:14px"></i> Testar Novamente
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  createLucideIcons(overlay);

  // Elementos do DOM
  const phasePill = overlay.querySelector('#st-phase-pill');
  const netBadge = overlay.querySelector('#st-network-badge');
  const netBadgeText = overlay.querySelector('#st-net-badge-text');
  const dialWrapper = overlay.querySelector('#st-dial-wrapper');
  const activeArc = overlay.querySelector('#st-active-arc');
  const needleGroup = overlay.querySelector('#st-needle-group');
  const needleLine = overlay.querySelector('#st-needle-line');
  const needleCircle = overlay.querySelector('#st-needle-circle');
  const readoutVal = overlay.querySelector('#st-readout-val');
  const readoutUnit = overlay.querySelector('#st-readout-unit');
  const progressBar = overlay.querySelector('#st-progress-bar');
  const statusMsg = overlay.querySelector('#st-status-msg');

  const cellDown = overlay.querySelector('#st-cell-down');
  const cellUp = overlay.querySelector('#st-cell-up');
  const valDown = overlay.querySelector('#st-val-down');
  const peakDown = overlay.querySelector('#st-peak-down');
  const valUp = overlay.querySelector('#st-val-up');
  const peakUp = overlay.querySelector('#st-peak-up');
  const valPing = overlay.querySelector('#st-val-ping');
  const valJitter = overlay.querySelector('#st-val-jitter');
  const valLoss = overlay.querySelector('#st-val-loss');
  const valGw = overlay.querySelector('#st-val-gw');
  const valGwLoss = overlay.querySelector('#st-val-gw-loss');

  const tipsContainer = overlay.querySelector('#st-tips-container');
  const btnCancel = overlay.querySelector('#st-btn-cancel');
  const btnExport = overlay.querySelector('#st-btn-export');
  const btnRepeat = overlay.querySelector('#st-btn-repeat');
  const xClose = overlay.querySelector('#st-x-close');

  let unsubscribeProgress = null;
  let isCancelled = false;
  let currentFinalReport = null;
  let currentDialTheme = null;

  function setDialMode(mode = 'download') {
    const isUpload = String(mode).toLowerCase().includes('upload');
    const targetTheme = isUpload ? 'upload' : 'download';
    if (currentDialTheme === targetTheme) return;
    currentDialTheme = targetTheme;

    if (isUpload) {
      if (dialWrapper) dialWrapper.classList.add('is-upload-mode');
      if (activeArc) {
        activeArc.setAttribute('stroke', 'url(#stGaugeGradUpload)');
        activeArc.style.filter = 'drop-shadow(0 0 10px rgba(168, 85, 247, 0.75))';
      }
      if (needleLine) {
        needleLine.setAttribute('stroke', '#c084fc');
        needleLine.style.filter = 'drop-shadow(0 0 8px rgba(168, 85, 247, 0.95))';
      }
      if (needleCircle) {
        needleCircle.setAttribute('fill', '#c084fc');
        needleCircle.style.filter = 'drop-shadow(0 0 6px rgba(168, 85, 247, 1))';
      }
      if (readoutUnit) {
        readoutUnit.style.fill = '#c084fc';
      }
      if (phasePill && !phasePill.classList.contains('success-pulse')) {
        phasePill.textContent = 'Upload';
        phasePill.style.color = '#c084fc';
        phasePill.style.background = 'rgba(168, 85, 247, 0.16)';
        phasePill.style.borderColor = 'rgba(168, 85, 247, 0.4)';
      }
      if (cellUp) cellUp.classList.add('metric-active-dial');
      if (cellDown) cellDown.classList.remove('metric-active-dial');
    } else {
      if (dialWrapper) dialWrapper.classList.remove('is-upload-mode');
      if (activeArc) {
        activeArc.setAttribute('stroke', 'url(#stGaugeGrad)');
        activeArc.style.filter = 'drop-shadow(0 0 8px rgba(56, 189, 248, 0.6))';
      }
      if (needleLine) {
        needleLine.setAttribute('stroke', '#38bdf8');
        needleLine.style.filter = 'drop-shadow(0 0 6px rgba(56, 189, 248, 0.8))';
      }
      if (needleCircle) {
        needleCircle.setAttribute('fill', '#38bdf8');
        needleCircle.style.filter = 'drop-shadow(0 0 4px rgba(56, 189, 248, 0.9))';
      }
      if (readoutUnit) {
        readoutUnit.style.fill = '#22d3ee';
      }
      if (phasePill && !phasePill.classList.contains('success-pulse')) {
        phasePill.style.color = '';
        phasePill.style.background = '';
        phasePill.style.borderColor = '';
      }
      if (cellDown) cellDown.classList.add('metric-active-dial');
      if (cellUp) cellUp.classList.remove('metric-active-dial');
    }
  }

  // Função para converter velocidade em ângulo da agulha (-90deg a +90deg)
  function speedToAngle(mbps) {
    const val = Math.max(0, Number(mbps) || 0);
    // Escala logarítmica / segmentada:
    // 0 -> -90°
    // 25 -> -60°
    // 100 -> -30°
    // 250 -> 0° (topo)
    // 500 -> +30°
    // 750 -> +60°
    // 1000+ -> +90°
    if (val <= 0) return -90;
    if (val <= 25) return -90 + (val / 25) * 30;
    if (val <= 100) return -60 + ((val - 25) / 75) * 30;
    if (val <= 250) return -30 + ((val - 100) / 150) * 30;
    if (val <= 500) return 0 + ((val - 250) / 250) * 30;
    if (val <= 750) return 30 + ((val - 500) / 250) * 30;
    if (val <= 1000) return 60 + ((val - 750) / 250) * 30;
    return 90;
  }

  function updateDial(mbps, mode = 'Download') {
    setDialMode(mode);
    const angle = speedToAngle(mbps);
    if (needleGroup) {
      needleGroup.style.transform = `rotate(${angle}deg)`;
    }

    if (activeArc) {
      const totalLen = 502.65;
      const progressFraction = Math.min(1, Math.max(0, (angle + 90) / 180));
      const offset = totalLen - (progressFraction * totalLen);
      activeArc.style.strokeDashoffset = offset;
    }

    if (readoutVal) readoutVal.textContent = Number(mbps).toFixed(1);
    if (readoutUnit) readoutUnit.textContent = `Mbps (${mode})`;
  }

  // Listener para fechar
  const closeModal = () => {
    if (unsubscribeProgress) {
      try { unsubscribeProgress(); } catch (_) {}
      unsubscribeProgress = null;
    }
    if (!currentFinalReport && window.api?.cancelSpeedTest) {
      try { window.api.cancelSpeedTest(); } catch (_) {}
    }
    overlay.remove();
    document.removeEventListener('keydown', onKeyDown);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') closeModal();
  };

  document.addEventListener('keydown', onKeyDown);
  xClose.onclick = closeModal;
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });

  btnCancel.onclick = () => {
    isCancelled = true;
    if (window.api?.cancelSpeedTest) window.api.cancelSpeedTest();
    statusMsg.textContent = 'Teste cancelado pelo usuário.';
    phasePill.textContent = 'Cancelado';
    phasePill.style.color = '#f87171';
    btnCancel.style.display = 'none';
    btnRepeat.style.display = 'inline-flex';
  };

  // Executa o teste de velocidade
  async function startTest() {
    isCancelled = false;
    currentFinalReport = null;

    // Reseta visual
    phasePill.textContent = 'Iniciando...';
    phasePill.className = 'details-count-pill';
    phasePill.style.color = '';
    phasePill.style.background = '';
    phasePill.style.borderColor = '';
    progressBar.style.width = '5%';
    currentDialTheme = null;
    setDialMode('download');
    updateDial(0, 'Download');
    statusMsg.textContent = 'Identificando placas de rede e roteador...';

    valDown.innerHTML = `0.0 <small style="font-size:10px">Mbps</small>`;
    peakDown.textContent = 'Pico: 0.0';
    valUp.innerHTML = `0.0 <small style="font-size:10px">Mbps</small>`;
    peakUp.textContent = 'Pico: 0.0';
    valPing.innerHTML = `- <small style="font-size:10px">ms</small>`;
    valJitter.textContent = 'Jitter: -';
    valLoss.textContent = '0%';
    valGw.innerHTML = `- <small style="font-size:10px">ms</small>`;
    valGwLoss.textContent = 'Perda: 0%';

    tipsContainer.style.display = 'none';
    tipsContainer.innerHTML = '';
    btnCancel.style.display = 'inline-flex';
    btnRepeat.style.display = 'none';
    btnExport.style.display = 'none';

    // Registra listener de progresso do backend
    if (unsubscribeProgress) unsubscribeProgress();
    if (window.api?.onSpeedTestProgress) {
      unsubscribeProgress = window.api.onSpeedTestProgress((payload) => {
        if (!payload || isCancelled) return;

        if (payload.statusText) {
          statusMsg.textContent = payload.statusText;
        }

        switch (payload.phase) {
          case 'init':
            phasePill.textContent = 'Analisando Conexão';
            progressBar.style.width = '10%';
            break;

          case 'info_done': {
            progressBar.style.width = '20%';
            const net = payload.networkInfo;
            if (net && netBadgeText) {
              const wifi = net.wifi;
              let badgeInfo = `${net.type}`;
              if (wifi) {
                badgeInfo += ` • ${wifi.ssid} (${wifi.band || '2.4GHz'}, ${wifi.signal || 0}%)`;
              }
              if (net.ip4 && net.ip4 !== 'Desconhecido') {
                badgeInfo += ` • IP: ${net.ip4}`;
              }
              netBadgeText.textContent = badgeInfo;
              if (net.isWireless) {
                netBadge.querySelector('i').setAttribute('data-lucide', 'wifi');
              } else {
                netBadge.querySelector('i').setAttribute('data-lucide', 'cable');
              }
              createLucideIcons(netBadge);
            }
            break;
          }

          case 'latency_done':
            progressBar.style.width = '35%';
            phasePill.textContent = 'Testando Download';
            if (payload.internetLatency !== null && payload.internetLatency !== undefined) {
              valPing.innerHTML = `${payload.internetLatency} <small style="font-size:10px">ms</small>`;
            }
            if (payload.internetJitter !== null && payload.internetJitter !== undefined) {
              valJitter.textContent = `Jitter: ${payload.internetJitter}ms`;
            }
            if (payload.internetPacketLoss !== undefined) {
              valLoss.textContent = `${payload.internetPacketLoss}%`;
              if (payload.internetPacketLoss > 5) valLoss.style.color = '#f87171';
            }
            if (payload.gatewayLatency !== null && payload.gatewayLatency !== undefined) {
              valGw.innerHTML = `${payload.gatewayLatency} <small style="font-size:10px">ms</small>`;
            }
            if (payload.gatewayPacketLoss !== undefined) {
              valGwLoss.textContent = `Perda: ${payload.gatewayPacketLoss}%`;
            }
            break;

          case 'download_progress': {
            phasePill.textContent = 'Download';
            const curMbps = payload.currentMbps || 0;
            const peak = payload.peakMbps || 0;
            const pct = Math.min(100, Math.max(0, payload.percent || 0));
            progressBar.style.width = `${35 + (pct * 0.35)}%`; // 35% -> 70%

            updateDial(curMbps, 'Download');
            valDown.innerHTML = `${curMbps.toFixed(1)} <small style="font-size:10px">Mbps</small>`;
            peakDown.textContent = `Pico: ${peak.toFixed(1)}`;
            break;
          }

          case 'upload_start':
            setDialMode('upload');
            updateDial(0, 'Upload');
            progressBar.style.width = '70%';
            statusMsg.innerHTML = '<span style="color:#c084fc;font-weight:600;"><i data-lucide="arrow-up" style="width:13px;height:13px;display:inline-block;vertical-align:middle;margin-right:4px;"></i>Iniciando medição de Upload da rede...</span>';
            createLucideIcons(statusMsg);
            break;

          case 'upload_progress': {
            setDialMode('upload');
            const curMbps = payload.currentMbps || 0;
            const peak = payload.peakMbps || 0;
            const pct = Math.min(100, Math.max(0, payload.percent || 0));
            progressBar.style.width = `${70 + (pct * 0.28)}%`; // 70% -> 98%

            updateDial(curMbps, 'Upload');
            valUp.innerHTML = `${curMbps.toFixed(1)} <small style="font-size:10px">Mbps</small>`;
            peakUp.textContent = `Pico: ${peak.toFixed(1)}`;
            break;
          }

          case 'done':
            handleTestComplete(payload.report);
            break;
        }
      });
    }

    // Executa a IPC real
    try {
      if (window.api?.runSpeedTest) {
        const result = await window.api.runSpeedTest();
        if (result && result.cancelled) {
          statusMsg.textContent = 'Teste cancelado.';
          btnCancel.style.display = 'none';
          btnRepeat.style.display = 'inline-flex';
          return;
        }
        if (result && result.success && result.report) {
          handleTestComplete(result.report);
        } else if (result && !result.success) {
          statusMsg.textContent = `Erro no teste: ${result.error || 'Falha de conexão'}`;
          phasePill.textContent = 'Falha';
          phasePill.style.color = '#f87171';
          btnCancel.style.display = 'none';
          btnRepeat.style.display = 'inline-flex';
        }
      }
    } catch (err) {
      if (!isCancelled) {
        statusMsg.textContent = `Erro ao executar teste de rede: ${err.message}`;
        phasePill.textContent = 'Erro';
        phasePill.style.color = '#f87171';
        btnCancel.style.display = 'none';
        btnRepeat.style.display = 'inline-flex';
      }
    }
  }

  function handleTestComplete(report) {
    if (!report) return;
    currentFinalReport = report;

    progressBar.style.width = '100%';
    phasePill.textContent = 'Concluído';
    phasePill.className = 'details-count-pill success-pulse';
    phasePill.style.color = '';
    phasePill.style.background = '';
    phasePill.style.borderColor = '';
    statusMsg.innerHTML = '<span style="color:#34d399;font-weight:600;"><i data-lucide="check" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:4px;"></i>Teste de Velocidade Concluído com Sucesso!</span>';
    createLucideIcons(statusMsg);

    // Permite alternar a visualização no velocímetro clicando nos cards de métrica
    if (cellDown) {
      cellDown.style.cursor = 'pointer';
      cellDown.title = 'Clique para ver o Download no velocímetro';
      cellDown.onclick = () => {
        updateDial(report.downloadMbps || 0, 'Download Final');
      };
    }
    if (cellUp) {
      cellUp.style.cursor = 'pointer';
      cellUp.title = 'Clique para ver o Upload no velocímetro';
      cellUp.onclick = () => {
        updateDial(report.uploadMbps || 0, 'Upload Final');
      };
    }

    // Atualiza valores finais
    if (report.downloadMbps !== undefined) {
      valDown.innerHTML = `${Number(report.downloadMbps).toFixed(1)} <small style="font-size:10px">Mbps</small>`;
    }
    if (report.peakMbps !== undefined) {
      peakDown.textContent = `Pico: ${Number(report.peakMbps).toFixed(1)}`;
    }
    if (report.uploadMbps !== undefined) {
      valUp.innerHTML = `${Number(report.uploadMbps).toFixed(1)} <small style="font-size:10px">Mbps</small>`;
    }
    if (report.peakUploadMbps !== undefined) {
      peakUp.textContent = `Pico: ${Number(report.peakUploadMbps).toFixed(1)}`;
    }
    if (report.internetLatency !== undefined) {
      valPing.innerHTML = `${report.internetLatency} <small style="font-size:10px">ms</small>`;
    }
    if (report.internetJitter !== undefined) {
      valJitter.textContent = `Jitter: ${report.internetJitter}ms`;
    }
    if (report.internetPacketLoss !== undefined) {
      valLoss.textContent = `${report.internetPacketLoss}%`;
    }
    if (report.gatewayLatency !== undefined) {
      valGw.innerHTML = `${report.gatewayLatency} <small style="font-size:10px">ms</small>`;
    }

    // Exibe o Upload Final no velocímetro por 2 segundos antes de alternar para o Download Final
    if (report.uploadMbps) {
      updateDial(report.uploadMbps, 'Upload Final');
      setTimeout(() => {
        if (currentFinalReport === report) {
          updateDial(report.downloadMbps || 0, 'Download Final');
        }
      }, 2000);
    } else {
      updateDial(report.downloadMbps || 0, 'Download Final');
    }

    // Renderiza dicas inteligentes
    if (report.tips && report.tips.length > 0) {
      tipsContainer.style.display = 'flex';
      tipsContainer.innerHTML = report.tips.map(tip => `
        <div class="speedtest-tip-card ${tip.type || 'info'}">
          <div class="speedtest-tip-icon-box">
            <i data-lucide="${tip.icon || 'info'}" style="width:18px;height:18px;"></i>
          </div>
          <div style="flex: 1; min-width: 0;">
            <div class="speedtest-tip-title">
              <span>${escapeHtml(tip.title)}</span>
            </div>
            <div class="speedtest-tip-desc">${escapeHtml(tip.text)}</div>
            <div class="speedtest-tip-recommendation">
              <span class="speedtest-tip-rec-badge">
                <i data-lucide="lightbulb" style="width:13px;height:13px;"></i> Dica do Técnico:
              </span>
              <span class="speedtest-tip-rec-text">${escapeHtml(tip.tip)}</span>
            </div>
          </div>
        </div>
      `).join('');
      createLucideIcons(tipsContainer);
    }

    btnCancel.style.display = 'none';
    btnRepeat.style.display = 'inline-flex';
    btnExport.style.display = 'inline-flex';

    addHistoryFn('Testar Conexão', `Speed Test: ${report.downloadMbps} Mbps Down / ${report.uploadMbps} Mbps Up (${report.internetLatency}ms)`, true, 'gauge');
  }

  btnRepeat.onclick = () => {
    startTest();
  };

  btnExport.onclick = async () => {
    if (!currentFinalReport) return;
    const originalHtml = btnExport.innerHTML;
    btnExport.disabled = true;
    btnExport.innerHTML = '<i data-lucide="loader-2" class="spinner" style="width:14px;height:14px"></i> Exportando...';
    createLucideIcons(btnExport);

    const reportText = generateSpeedTestTxtReport(currentFinalReport);
    const dateFormatted = new Date().toISOString().slice(0, 10);
    const defaultFilename = `ThunderTools-SpeedTest-${dateFormatted}.txt`;

    let exported = false;
    let targetPath = '';

    if (window.api?.saveTextFile) {
      try {
        const res = await window.api.saveTextFile({
          defaultPath: defaultFilename,
          content: reportText,
          title: 'Exportar Relatório de Velocidade da Rede em TXT'
        });
        if (res && res.success) {
          exported = true;
          targetPath = res.filePath;
        } else if (res && res.cancelled) {
          btnExport.disabled = false;
          btnExport.innerHTML = originalHtml;
          createLucideIcons(btnExport);
          return;
        }
      } catch (err) {
        console.warn('Erro ao salvar via saveTextFile:', err);
      }
    }

    if (!exported) {
      try {
        const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = defaultFilename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        exported = true;
      } catch (err) {
        console.error('Erro no fallback de download:', err);
      }
    }

    btnExport.disabled = false;
    if (exported) {
      btnExport.innerHTML = '<i data-lucide="check" style="width:14px;height:14px"></i> Exportado!';
      createLucideIcons(btnExport);
      toastFn('success', 'Relatório de Velocidade', targetPath ? `Arquivo TXT salvo com sucesso em:<br><small style="word-break:break-all;">${escapeHtml(targetPath)}</small>` : 'Relatório TXT exportado com sucesso!');
      setTimeout(() => {
        btnExport.innerHTML = originalHtml;
        createLucideIcons(btnExport);
      }, 2500);
    } else {
      btnExport.innerHTML = originalHtml;
      createLucideIcons(btnExport);
      toastFn('error', 'Relatório de Velocidade', 'Não foi possível salvar o arquivo TXT.');
    }
  };

  // Inicia o teste imediatamente ao abrir o modal
  startTest();
}
