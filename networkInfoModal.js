// ─── Network Info Modal & TXT Export ─────────────────────────────────────────
// ThunderTools - Thunder Sistemas

const MOJIBAKE_MAP = [
  ['âšª', '⚪'], ['â”€', '─'], ['âœ”', '✔'], ['â Œ', '❌'], ['âš ', '⚠️'],
  ['DiagnÃstico', 'Diagnóstico'], ['diagnÃstico', 'diagnóstico'],
  ['EstatÃsticas', 'Estatísticas'], ['estatÃsticas', 'estatísticas'],
  ['Ã¡', 'á'], ['Ã ', 'à'], ['Ã£', 'ã'], ['Ã¢', 'â'], ['Ã¤', 'ä'],
  ['Ã©', 'é'], ['Ã¨', 'è'], ['Ãª', 'ê'], ['Ã«', 'ë'],
  ['Ã­', 'í'], ['Ã¬', 'ì'], ['Ã®', 'î'], ['Ã¯', 'ï'],
  ['Ã³', 'ó'], ['Ã²', 'ò'], ['Ãµ', 'õ'], ['Ã´', 'ô'], ['Ã¶', 'ö'],
  ['Ãº', 'ú'], ['Ã¹', 'ù'], ['Ã»', 'û'], ['Ã¼', 'ü'],
  ['Ã§', 'ç'], ['Ã±', 'ñ'],
  ['Ã ', 'Á'], ['Ã€', 'À'], ['Ãƒ', 'Ã'], ['Ã‚', 'Â'], ['Ã„', 'Ä'],
  ['Ã‰', 'É'], ['Ãˆ', 'È'], ['ÃŠ', 'Ê'], ['Ã‹', 'Ë'],
  ['Ã ', 'Í'], ['ÃŒ', 'Ì'], ['ÃŽ', 'Î'], ['Ã ', 'Ï'],
  ['Ã“', 'Ó'], ['Ã’', 'Ò'], ['Ã•', 'Õ'], ['Ã”', 'Ô'], ['Ã–', 'Ö'],
  ['Ãš', 'Ú'], ['Ã™', 'Ù'], ['Ã›', 'Û'], ['Ãœ', 'Ü'],
  ['Ã‡', 'Ç'], ['Ã‘', 'Ñ'],
  ['Â°', '°'], ['Âº', 'º'], ['Âª', 'ª'], ['Â§', '§'], ['Â±', '±']
];

function cleanMojibake(text) {
  if (!text || typeof text !== 'string') return text || '';
  let res = text;
  for (let i = 0; i < MOJIBAKE_MAP.length; i++) {
    const [broken, fixed] = MOJIBAKE_MAP[i];
    if (res.includes(broken)) {
      res = res.split(broken).join(fixed);
    }
  }
  return res;
}

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

export function parseIpconfigAll(rawOutput) {
  const clean = cleanMojibake(rawOutput || '');
  const lines = clean.split(/\r?\n/);
  const hostInfo = {
    hostName: '',
    primaryDnsSuffix: '',
    nodeType: '',
    ipRouting: '',
    winsProxy: ''
  };
  const adapters = [];
  let currentAdapter = null;
  let lastKey = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (/^(?:Configura[cç][aã]o de IP do Windows|Windows IP Configuration)/i.test(trimmed)) {
      currentAdapter = null;
      lastKey = null;
      continue;
    }

    const adapterMatch = line.match(/^([^\s].*?):\s*$/);
    if (adapterMatch && !line.startsWith('   ') && !line.startsWith('\t')) {
      const adapterName = adapterMatch[1].trim();
      currentAdapter = {
        name: adapterName,
        description: '',
        mac: '',
        status: 'connected',
        mediaState: '',
        ipv4: '',
        subnetMask: '',
        gateway: '',
        dhcpEnabled: '',
        dhcpServer: '',
        dnsServers: [],
        ipv6: '',
        leaseObtained: '',
        leaseExpires: '',
        type: 'ethernet',
        details: {}
      };

      const lName = adapterName.toLowerCase();
      if (/wi-fi|sem fio|wireless|wlan/i.test(lName)) {
        currentAdapter.type = 'wifi';
      } else if (/bluetooth/i.test(lName)) {
        currentAdapter.type = 'bluetooth';
      } else if (/virtual|vethernet|loopback|hyper-v|vmware|tap|vpn/i.test(lName)) {
        currentAdapter.type = 'virtual';
      } else {
        currentAdapter.type = 'ethernet';
      }

      adapters.push(currentAdapter);
      lastKey = null;
      continue;
    }

    const propMatch = line.match(/^\s+([^.:]+?)(?:\s*\.+)*\s*:\s*(.*)$/);
    if (propMatch) {
      const key = propMatch[1].trim();
      const val = propMatch[2].trim();
      lastKey = key.toLowerCase();

      if (!currentAdapter) {
        if (/nome do host|host name/i.test(lastKey)) hostInfo.hostName = val;
        else if (/sufixo dns|dns suffix/i.test(lastKey)) hostInfo.primaryDnsSuffix = val;
        else if (/tipo de n|node type/i.test(lastKey)) hostInfo.nodeType = val;
        else if (/roteamento|routing/i.test(lastKey)) hostInfo.ipRouting = val;
        else if (/wins/i.test(lastKey)) hostInfo.winsProxy = val;
      } else {
        currentAdapter.details[key] = val;
        if (/m[eé\uFFFD]dia|media state/i.test(lastKey)) {
          currentAdapter.mediaState = val;
          if (/desconectad|disconnected/i.test(val)) currentAdapter.status = 'disconnected';
        } else if (/descri/i.test(lastKey)) {
          currentAdapter.description = val;
          if (/wi-fi|wireless|802\.11/i.test(val)) currentAdapter.type = 'wifi';
          else if (/virtual|tap|vpn|hyper-v|vmware/i.test(val)) currentAdapter.type = 'virtual';
        } else if (/f[íi\uFFFD]sico|physical/i.test(lastKey) || /([0-9A-Fa-f]{2}[-:]){5}[0-9A-Fa-f]{2}/.test(val)) {
          currentAdapter.mac = val;
        } else if (/dhcp habilitado|dhcp enabled/i.test(lastKey)) {
          currentAdapter.dhcpEnabled = val;
        } else if (/ipv4/i.test(lastKey)) {
          currentAdapter.ipv4 = val.replace(/\(.*?\)/g, '').trim();
        } else if (/m[áa]scara|subnet/i.test(lastKey)) {
          currentAdapter.subnetMask = val;
        } else if (/gateway/i.test(lastKey)) {
          if (val) currentAdapter.gateway = val;
        } else if (/servidor dhcp|dhcp server/i.test(lastKey)) {
          currentAdapter.dhcpServer = val;
        } else if (/dns/i.test(lastKey)) {
          if (val && !currentAdapter.dnsServers.includes(val)) currentAdapter.dnsServers.push(val);
        } else if (/ipv6/i.test(lastKey)) {
          if (!currentAdapter.ipv6) currentAdapter.ipv6 = val.replace(/\(.*?\)/g, '').trim();
        } else if (/concess.*obt|lease.*obtain/i.test(lastKey)) {
          currentAdapter.leaseObtained = val;
        } else if (/concess.*exp|lease.*expir/i.test(lastKey)) {
          currentAdapter.leaseExpires = val;
        }
      }
    } else if (lastKey && currentAdapter && /^\s{4,}([0-9a-f.:]+)\s*$/i.test(line)) {
      const contVal = line.trim();
      if (/dns/i.test(lastKey) && !currentAdapter.dnsServers.includes(contVal)) {
        currentAdapter.dnsServers.push(contVal);
      } else if (/gateway/i.test(lastKey) && !currentAdapter.gateway) {
        currentAdapter.gateway = contVal;
      }
    }
  }

  adapters.forEach(ad => {
    if (ad.mediaState && /desconectad|disconnected/i.test(ad.mediaState)) {
      ad.status = 'disconnected';
    } else if (!ad.ipv4 && !ad.ipv6) {
      ad.status = 'disconnected';
    } else {
      ad.status = 'connected';
    }
  });

  return { hostInfo, adapters };
}

export function generateNetworkInfoTxtReport(hostInfo, adapters, rawOutput) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('pt-BR');
  const timeStr = now.toLocaleTimeString('pt-BR');
  const connectedAdapters = adapters.filter(a => a.status === 'connected');
  const disconnectedAdapters = adapters.filter(a => a.status !== 'connected');

  const activeAdapter = connectedAdapters.find(a => a.ipv4 && a.gateway && a.type !== 'virtual') ||
                        connectedAdapters.find(a => a.ipv4 && a.gateway) ||
                        connectedAdapters.find(a => a.ipv4) ||
                        connectedAdapters[0] || null;

  let report = '';
  report += '================================================================================\r\n';
  report += '               THUNDERTOOLS - RELATÓRIO DE INFORMAÇÕES DE REDE                  \r\n';
  report += '================================================================================\r\n';
  report += `Data de Geração       : ${dateStr} às ${timeStr}\r\n`;
  report += `Nome do Computador    : ${hostInfo.hostName || 'Computador Local'}\r\n`;
  report += `Status Geral          : ${connectedAdapters.length > 0 ? 'Conectado à Rede' : 'Sem Conexão Ativa'}\r\n`;
  report += `Total de Adaptadores  : ${adapters.length} (${connectedAdapters.length} conectado(s), ${disconnectedAdapters.length} desconectado(s))\r\n`;
  report += '--------------------------------------------------------------------------------\r\n';
  report += '1. RESUMO DA CONEXÃO PRINCIPAL\r\n';
  report += '--------------------------------------------------------------------------------\r\n';
  if (activeAdapter) {
    report += `Adaptador Ativo       : ${activeAdapter.name}\r\n`;
    report += `Tipo de Conexão       : ${activeAdapter.type.toUpperCase()}\r\n`;
    report += `Descrição da Placa    : ${activeAdapter.description || 'N/A'}\r\n`;
    report += `Endereço IPv4         : ${activeAdapter.ipv4 || 'Não atribuído'}\r\n`;
    report += `Máscara de Sub-rede   : ${activeAdapter.subnetMask || 'Não atribuída'}\r\n`;
    report += `Gateway Padrão        : ${activeAdapter.gateway || 'Não configurado'}\r\n`;
    report += `Servidor(es) DNS      : ${activeAdapter.dnsServers.length ? activeAdapter.dnsServers.join(', ') : 'Não configurado'}\r\n`;
    report += `Servidor DHCP         : ${activeAdapter.dhcpServer || 'N/A'} (DHCP Habilitado: ${activeAdapter.dhcpEnabled || 'N/A'})\r\n`;
    report += `Endereço Físico (MAC) : ${activeAdapter.mac || 'N/A'}\r\n`;
    if (activeAdapter.ipv6) report += `Endereço IPv6         : ${activeAdapter.ipv6}\r\n`;
    if (activeAdapter.leaseObtained) report += `Concessão Obtida      : ${activeAdapter.leaseObtained}\r\n`;
    if (activeAdapter.leaseExpires) report += `Concessão Expira      : ${activeAdapter.leaseExpires}\r\n`;
  } else {
    report += 'Nenhum adaptador de rede ativo ou conectado no momento.\r\n';
  }
  report += '--------------------------------------------------------------------------------\r\n';
  report += '2. CONFIGURAÇÃO DO SISTEMA (WINDOWS IP CONFIGURATION)\r\n';
  report += '--------------------------------------------------------------------------------\r\n';
  report += `Nome do Host          : ${hostInfo.hostName || 'N/A'}\r\n`;
  report += `Sufixo DNS Primário   : ${hostInfo.primaryDnsSuffix || '(Nenhum)'}\r\n`;
  report += `Tipo de Nó            : ${hostInfo.nodeType || 'N/A'}\r\n`;
  report += `Roteamento de IP      : ${hostInfo.ipRouting || 'Não'}\r\n`;
  report += `Proxy WINS            : ${hostInfo.winsProxy || 'Não'}\r\n`;
  report += '--------------------------------------------------------------------------------\r\n';
  report += '3. DETALHAMENTO DE TODOS OS ADAPTADORES\r\n';
  report += '--------------------------------------------------------------------------------\r\n';

  adapters.forEach((ad, idx) => {
    report += `[${idx + 1}] ${ad.name}\r\n`;
    report += `    Tipo              : ${ad.type.toUpperCase()}\r\n`;
    report += `    Status            : ${ad.status === 'connected' ? 'CONECTADO / ATIVO' : 'DESCONECTADO'}\r\n`;
    if (ad.mediaState) report += `    Estado da Mídia   : ${ad.mediaState}\r\n`;
    if (ad.description) report += `    Descrição         : ${ad.description}\r\n`;
    if (ad.mac) report += `    Endereço Físico   : ${ad.mac}\r\n`;
    if (ad.ipv4) report += `    Endereço IPv4     : ${ad.ipv4}\r\n`;
    if (ad.subnetMask) report += `    Máscara de Rede   : ${ad.subnetMask}\r\n`;
    if (ad.gateway) report += `    Gateway Padrão    : ${ad.gateway}\r\n`;
    if (ad.dhcpEnabled) report += `    DHCP Habilitado   : ${ad.dhcpEnabled}\r\n`;
    if (ad.dhcpServer) report += `    Servidor DHCP     : ${ad.dhcpServer}\r\n`;
    if (ad.dnsServers.length) report += `    Servidores DNS    : ${ad.dnsServers.join(', ')}\r\n`;
    if (ad.ipv6) report += `    Endereço IPv6     : ${ad.ipv6}\r\n`;
    if (ad.leaseObtained) report += `    Concessão Obtida  : ${ad.leaseObtained}\r\n`;
    if (ad.leaseExpires) report += `    Concessão Expira  : ${ad.leaseExpires}\r\n`;
    report += '\r\n';
  });

  report += '================================================================================\r\n';
  report += '4. SAÍDA COMPLETA DO TERMINAL (IPCONFIG /ALL)\r\n';
  report += '================================================================================\r\n';
  report += (cleanMojibake(rawOutput || '')).trim() + '\r\n';
  report += '================================================================================\r\n';
  report += 'Relatório emitido por ThunderTools • Thunder\r\n';
  report += '================================================================================\r\n';

  return report;
}

export function showNetworkInfoModal(ctx = {}) {
  const toastFn = ctx.toast || window.toast || (() => {});
  const addHistoryFn = ctx.addToHistory || window.addToHistory || (() => {});

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  let rawOutput = '';
  let hostInfo = { hostName: '' };
  let adapters = [];

  overlay.innerHTML = `
    <div class="modal details-modal netinfo-details-modal">
      <button class="modal-close-icon-btn" id="netinfo-x-close" title="Fechar (Esc)">
        <i data-lucide="x" style="width:16px;height:16px"></i>
      </button>

      <div class="details-modal-header">
        <div class="details-header-lead">
          <div class="details-header-icon-box" style="background: linear-gradient(135deg, rgba(56, 189, 248, 0.22) 0%, rgba(99, 102, 241, 0.18) 100%); border-color: rgba(56, 189, 248, 0.4); color: #38bdf8;">
            <i data-lucide="network"></i>
          </div>
          <div class="details-header-text">
            <div class="details-modal-title">
              <span>Informações de Rede</span>
              <span class="details-count-pill" id="netinfo-status-pill">Coletando...</span>
            </div>
            <div class="details-modal-desc" id="netinfo-modal-desc">Diagnóstico completo de conexões, adaptadores, IP, DNS e servidores</div>
          </div>
        </div>
      </div>

      <!-- Quick Summary HUD Card -->
      <div class="netinfo-summary-card" id="netinfo-summary-card" style="display: none;">
        <div class="netinfo-summary-cell">
          <div class="netinfo-summary-label"><i data-lucide="globe"></i> IPv4 Local</div>
          <div class="netinfo-summary-val" id="netinfo-hud-ip">-</div>
        </div>
        <div class="netinfo-summary-cell">
          <div class="netinfo-summary-label"><i data-lucide="router"></i> Gateway</div>
          <div class="netinfo-summary-val" id="netinfo-hud-gateway">-</div>
        </div>
        <div class="netinfo-summary-cell">
          <div class="netinfo-summary-label"><i data-lucide="search"></i> DNS</div>
          <div class="netinfo-summary-val" id="netinfo-hud-dns">-</div>
        </div>
        <div class="netinfo-summary-cell">
          <div class="netinfo-summary-label"><i data-lucide="cpu"></i> Adaptador Ativo</div>
          <div class="netinfo-summary-val" id="netinfo-hud-adapter">-</div>
        </div>
      </div>

      <!-- Toolbar -->
      <div class="details-toolbar">
        <div class="details-search-box">
          <i data-lucide="search"></i>
          <input type="text" id="netinfo-search-input" placeholder="Filtrar por adaptador, IP, status ou MAC...">
        </div>
        <div class="details-view-toggles">
          <button class="details-toggle-btn active" id="netinfo-toggle-cards" type="button">
            <i data-lucide="layout-grid" style="width:13px;height:13px"></i> Formatado
          </button>
          <button class="details-toggle-btn" id="netinfo-toggle-raw" type="button">
            <i data-lucide="terminal" style="width:13px;height:13px"></i> Terminal
          </button>
        </div>
      </div>

      <!-- Viewports -->
      <div class="details-content-viewport" id="netinfo-viewport-formatted">
        <div style="background: rgba(0, 0, 0, 0.2); border: 1px dashed rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 40px 20px; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px;">
          <div style="width: 48px; height: 48px; border-radius: 12px; background: rgba(56, 189, 248, 0.12); display: flex; align-items: center; justify-content: center; color: #38bdf8;">
            <i data-lucide="loader-2" class="spinner" style="width: 24px; height: 24px;"></i>
          </div>
          <div style="font-size: 15px; font-weight: 700; color: #f1f5f9;">Coletando configurações de rede...</div>
          <div style="font-size: 12px; color: #94a3b8; max-width: 420px; line-height: 1.5;">
            Consultando adaptadores de rede, endereços IP, gateways e configurações do Windows.
          </div>
        </div>
      </div>

      <div class="details-content-viewport" id="netinfo-viewport-raw" style="display: none;">
        <div class="details-terminal-box" id="netinfo-raw-box">Carregando saída do terminal...</div>
      </div>

      <!-- Footer -->
      <div class="details-modal-footer">
        <div class="details-footer-tip">
          <i data-lucide="keyboard" style="width: 13px; height: 13px; color: #64748b;"></i>
          <span>Pressione <kbd>ESC</kbd> para fechar</span>
        </div>
        <div class="details-footer-actions">
          <button class="modal-btn secondary" id="netinfo-export-btn" style="display: flex; align-items: center; gap: 8px;">
            <i data-lucide="file-down" style="width:14px;height:14px"></i> Exportar TXT
          </button>
          <button class="modal-btn secondary" id="netinfo-copy-btn" style="display: flex; align-items: center; gap: 8px;">
            <i data-lucide="copy" style="width:14px;height:14px"></i> Copiar
          </button>
          <button class="modal-btn secondary" id="netinfo-refresh-btn" style="display: flex; align-items: center; gap: 8px;" title="Atualizar dados">
            <i data-lucide="refresh-cw" style="width:14px;height:14px"></i> Atualizar
          </button>
          <button class="modal-btn primary" id="netinfo-close-btn">Fechar</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  createLucideIcons(overlay);

  const statusPill = overlay.querySelector('#netinfo-status-pill');
  const modalDesc = overlay.querySelector('#netinfo-modal-desc');
  const summaryCard = overlay.querySelector('#netinfo-summary-card');
  const hudIp = overlay.querySelector('#netinfo-hud-ip');
  const hudGateway = overlay.querySelector('#netinfo-hud-gateway');
  const hudDns = overlay.querySelector('#netinfo-hud-dns');
  const hudAdapter = overlay.querySelector('#netinfo-hud-adapter');
  const searchInput = overlay.querySelector('#netinfo-search-input');
  const toggleCards = overlay.querySelector('#netinfo-toggle-cards');
  const toggleRaw = overlay.querySelector('#netinfo-toggle-raw');
  const viewportFormatted = overlay.querySelector('#netinfo-viewport-formatted');
  const viewportRaw = overlay.querySelector('#netinfo-viewport-raw');
  const rawBox = overlay.querySelector('#netinfo-raw-box');
  const exportBtn = overlay.querySelector('#netinfo-export-btn');
  const copyBtn = overlay.querySelector('#netinfo-copy-btn');
  const refreshBtn = overlay.querySelector('#netinfo-refresh-btn');
  const closeBtn = overlay.querySelector('#netinfo-close-btn');
  const xCloseBtn = overlay.querySelector('#netinfo-x-close');

  toggleCards.onclick = () => {
    toggleCards.classList.add('active');
    toggleRaw.classList.remove('active');
    viewportFormatted.style.display = 'block';
    viewportRaw.style.display = 'none';
    createLucideIcons(viewportFormatted);
  };

  toggleRaw.onclick = () => {
    toggleRaw.classList.add('active');
    toggleCards.classList.remove('active');
    viewportFormatted.style.display = 'none';
    viewportRaw.style.display = 'block';
  };

  const renderUI = () => {
    const connectedAdapters = adapters.filter(a => a.status === 'connected');
    const disconnectedAdapters = adapters.filter(a => a.status !== 'connected');

    const activeAdapter = connectedAdapters.find(a => a.ipv4 && a.gateway && a.type !== 'virtual') ||
                          connectedAdapters.find(a => a.ipv4 && a.gateway) ||
                          connectedAdapters.find(a => a.ipv4) ||
                          connectedAdapters[0] || null;

    statusPill.textContent = `${adapters.length} Adaptadores (${connectedAdapters.length} Ativo${connectedAdapters.length !== 1 ? 's' : ''})`;
    modalDesc.textContent = `Host: ${hostInfo.hostName || 'Computador Local'} • Diagnóstico completo de conexões, IP, DNS e adaptadores`;

    if (activeAdapter) {
      hudIp.textContent = activeAdapter.ipv4 || 'Não atribuído';
      hudGateway.textContent = activeAdapter.gateway || 'Não configurado';
      hudDns.textContent = activeAdapter.dnsServers.length ? activeAdapter.dnsServers[0] : 'Não configurado';
      hudAdapter.textContent = activeAdapter.name.replace(/^Adaptador\s+(?:de\s+Rede\s+sem\s+Fio\s+|Ethernet\s+)?/i, '') || activeAdapter.name;
      hudAdapter.title = activeAdapter.name;
      summaryCard.style.display = 'grid';
    } else {
      hudIp.textContent = 'Sem IP';
      hudGateway.textContent = 'Sem Gateway';
      hudDns.textContent = 'Sem DNS';
      hudAdapter.textContent = 'Nenhum ativo';
      summaryCard.style.display = 'grid';
    }

    const sortedAdapters = [...connectedAdapters, ...disconnectedAdapters];

    if (sortedAdapters.length === 0) {
      viewportFormatted.innerHTML = `
        <div style="background: rgba(0, 0, 0, 0.2); border: 1px dashed rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 40px 20px; text-align: center; color: #94a3b8;">
          <i data-lucide="alert-circle" style="width:32px;height:32px;color:#f59e0b;margin-bottom:8px"></i>
          <div style="font-size: 15px; font-weight: 700; color: #f1f5f9;">Nenhum adaptador encontrado</div>
          <div style="font-size: 12px; margin-top: 4px;">Não foi possível listar adaptadores de rede neste dispositivo.</div>
        </div>
      `;
      createLucideIcons(viewportFormatted);
      return;
    }

    const cardsHtml = sortedAdapters.map((ad) => {
      const isConnected = ad.status === 'connected';
      let typeIcon = 'network';
      let typeLabel = 'Rede Local';

      if (ad.type === 'wifi') {
        typeIcon = 'wifi';
        typeLabel = 'Wi-Fi';
      } else if (ad.type === 'bluetooth') {
        typeIcon = 'bluetooth';
        typeLabel = 'Bluetooth';
      } else if (ad.type === 'virtual') {
        typeIcon = 'box';
        typeLabel = 'Virtual / VPN';
      } else {
        typeIcon = 'cable';
        typeLabel = 'Ethernet (Cabo)';
      }

      const searchTerms = [
        ad.name,
        ad.description,
        ad.ipv4,
        ad.ipv6,
        ad.gateway,
        ad.mac,
        typeLabel,
        isConnected ? 'conectado ativo' : 'desconectado'
      ].filter(Boolean).join(' ').toLowerCase();

      return `
        <div class="details-result-card ${isConnected ? 'netinfo-card-active' : 'netinfo-card-inactive'}" data-search="${escapeHtml(searchTerms)}">
          <div class="result-card-top">
            <div class="result-card-icon-wrap" style="${isConnected ? 'color: #38bdf8; background: rgba(56, 189, 248, 0.14); border-color: rgba(56, 189, 248, 0.35);' : 'color: #94a3b8; background: rgba(148, 163, 184, 0.08); border-color: rgba(148, 163, 184, 0.18);'}">
              <i data-lucide="${typeIcon}"></i>
            </div>
            <div class="result-card-info">
              <div class="result-card-name">${escapeHtml(ad.name)}</div>
              <div class="result-card-chips">
                <span class="details-chip ${isConnected ? 'status-ready' : ''}" style="${!isConnected ? 'background: rgba(148, 163, 184, 0.12); color: #94a3b8; border: 1px solid rgba(148, 163, 184, 0.2);' : ''}">
                  <i data-lucide="${isConnected ? 'check-circle-2' : 'power-off'}"></i>
                  ${isConnected ? 'Conectado' : (ad.mediaState || 'Desconectado')}
                </span>
                <span class="details-chip network">
                  <i data-lucide="${typeIcon}"></i> ${typeLabel}
                </span>
                ${ad.dhcpEnabled ? `
                  <span class="details-chip" style="background: rgba(99,102,241,0.12); color:#c7d2fe; border:1px solid rgba(99,102,241,0.25);">
                    <i data-lucide="server"></i> DHCP ${escapeHtml(ad.dhcpEnabled)}
                  </span>
                ` : ''}
              </div>
            </div>
          </div>

          ${ad.description ? `
            <div style="font-size: 11px; color: #94a3b8; line-height: 1.4; padding: 2px 0 4px; border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
              <span style="color: #64748b; font-weight: 600;">Controlador:</span> ${escapeHtml(ad.description)}
            </div>
          ` : ''}

          <div class="result-card-meta-grid">
            ${ad.ipv4 ? `
              <div class="result-meta-item">
                <span class="meta-field-label">ENDEREÇO IPV4</span>
                <span class="meta-field-value" style="font-weight: 700; color: #38bdf8;">${escapeHtml(ad.ipv4)}</span>
              </div>
            ` : ''}
            ${ad.subnetMask ? `
              <div class="result-meta-item">
                <span class="meta-field-label">MÁSCARA DE REDE</span>
                <span class="meta-field-value">${escapeHtml(ad.subnetMask)}</span>
              </div>
            ` : ''}
            ${ad.gateway ? `
              <div class="result-meta-item">
                <span class="meta-field-label">GATEWAY PADRÃO</span>
                <span class="meta-field-value" style="font-weight: 600;">${escapeHtml(ad.gateway)}</span>
              </div>
            ` : ''}
            ${ad.dnsServers && ad.dnsServers.length ? `
              <div class="result-meta-item">
                <span class="meta-field-label">SERVIDORES DNS</span>
                <span class="meta-field-value">${escapeHtml(ad.dnsServers.join(', '))}</span>
              </div>
            ` : ''}
            ${ad.mac ? `
              <div class="result-meta-item">
                <span class="meta-field-label">ENDEREÇO FÍSICO (MAC)</span>
                <span class="meta-field-value" style="font-family: monospace; letter-spacing: 0.5px;">
                  ${escapeHtml(ad.mac)}
                  <button type="button" class="netinfo-mac-copy-btn" data-mac="${escapeHtml(ad.mac)}" title="Copiar MAC">
                    <i data-lucide="copy"></i>
                  </button>
                </span>
              </div>
            ` : ''}
            ${ad.dhcpServer ? `
              <div class="result-meta-item">
                <span class="meta-field-label">SERVIDOR DHCP</span>
                <span class="meta-field-value">${escapeHtml(ad.dhcpServer)}</span>
              </div>
            ` : ''}
            ${ad.ipv6 ? `
              <div class="result-meta-item" style="grid-column: 1 / -1;">
                <span class="meta-field-label">ENDEREÇO IPV6</span>
                <span class="meta-field-value" style="font-size: 11px; word-break: break-all;">${escapeHtml(ad.ipv6)}</span>
              </div>
            ` : ''}
            ${ad.leaseExpires ? `
              <div class="result-meta-item" style="grid-column: 1 / -1;">
                <span class="meta-field-label">VALIDADE DA CONCESSÃO</span>
                <span class="meta-field-value" style="font-size: 11px;">${escapeHtml(ad.leaseExpires)}</span>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');

    viewportFormatted.innerHTML = `<div class="details-cards-grid">${cardsHtml}</div>`;
    rawBox.textContent = rawOutput || 'Sem saída de texto registrada.';
    createLucideIcons(viewportFormatted);

    viewportFormatted.querySelectorAll('.netinfo-mac-copy-btn').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const mac = btn.dataset.mac;
        if (mac) {
          navigator.clipboard.writeText(mac);
          const originalInner = btn.innerHTML;
          btn.innerHTML = '<i data-lucide="check" style="width:12px;height:12px;color:#10b981"></i>';
          createLucideIcons(btn);
          setTimeout(() => {
            btn.innerHTML = originalInner;
            createLucideIcons(btn);
          }, 1500);
        }
      };
    });
  };

  const loadData = async () => {
    statusPill.textContent = 'Coletando...';
    refreshBtn.disabled = true;
    viewportFormatted.innerHTML = `
      <div style="background: rgba(0, 0, 0, 0.2); border: 1px dashed rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 40px 20px; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px;">
        <div style="width: 48px; height: 48px; border-radius: 12px; background: rgba(56, 189, 248, 0.12); display: flex; align-items: center; justify-content: center; color: #38bdf8;">
          <i data-lucide="loader-2" class="spinner" style="width: 24px; height: 24px;"></i>
        </div>
        <div style="font-size: 15px; font-weight: 700; color: #f1f5f9;">Coletando configurações de rede...</div>
        <div style="font-size: 12px; color: #94a3b8; max-width: 420px; line-height: 1.5;">
          Executando diagnóstico de adaptadores e parâmetros TCP/IP...
        </div>
      </div>
    `;
    createLucideIcons(viewportFormatted);

    try {
      const res = await window.api.runCommand('ipconfig /all');
      rawOutput = cleanMojibake((res && res.output) ? res.output : '');
      const parsed = parseIpconfigAll(rawOutput);
      hostInfo = parsed.hostInfo;
      adapters = parsed.adapters;
      renderUI();
      addHistoryFn('Info de Rede', 'ipconfig /all', true, 'network');
    } catch (err) {
      statusPill.textContent = 'Erro';
      viewportFormatted.innerHTML = `
        <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 12px; padding: 30px; text-align: center; color: #fca5a5;">
          <i data-lucide="alert-triangle" style="width:36px;height:36px;color:#ef4444;margin-bottom:8px"></i>
          <div style="font-size: 15px; font-weight: 700; color: #f87171;">Erro ao coletar informações de rede</div>
          <div style="font-size: 12px; margin-top: 6px;">${escapeHtml(err.message || 'Falha ao executar o comando de rede')}</div>
        </div>
      `;
      createLucideIcons(viewportFormatted);
    } finally {
      refreshBtn.disabled = false;
    }
  };

  searchInput.oninput = (e) => {
    const q = e.target.value.toLowerCase().trim();
    const cards = viewportFormatted.querySelectorAll('.details-result-card');
    let visibleCount = 0;
    cards.forEach(card => {
      const text = (card.dataset.search || card.textContent || '').toLowerCase();
      const match = !q || text.includes(q);
      card.style.display = match ? '' : 'none';
      if (match) visibleCount++;
    });
    statusPill.textContent = q ? `${visibleCount} de ${cards.length}` : `${adapters.length} Adaptadores`;
  };

  exportBtn.onclick = async () => {
    const originalHtml = exportBtn.innerHTML;
    exportBtn.disabled = true;
    exportBtn.innerHTML = '<i data-lucide="loader-2" class="spinner" style="width:14px;height:14px"></i> Exportando...';
    createLucideIcons(exportBtn);

    const cleanHost = (hostInfo.hostName || 'computador').replace(/[^a-zA-Z0-9_-]/g, '');
    const dateStamp = new Date().toISOString().slice(0, 10);
    const defaultFileName = `relatorio-rede-${cleanHost}-${dateStamp}.txt`;
    const reportText = generateNetworkInfoTxtReport(hostInfo, adapters, rawOutput);

    let exported = false;
    let targetPath = '';

    if (window.api && typeof window.api.saveTextFile === 'function') {
      const res = await window.api.saveTextFile({
        defaultFileName,
        content: reportText,
        title: 'Exportar Informações de Rede em TXT'
      });
      if (res && res.success) {
        exported = true;
        targetPath = res.filePath;
      } else if (res && res.cancelled) {
        exportBtn.disabled = false;
        exportBtn.innerHTML = originalHtml;
        createLucideIcons(exportBtn);
        return;
      }
    }

    if (!exported) {
      try {
        const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = defaultFileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        exported = true;
      } catch (err) {
        console.error('Erro ao exportar TXT:', err);
      }
    }

    exportBtn.disabled = false;
    if (exported) {
      exportBtn.innerHTML = '<i data-lucide="check" style="width:14px;height:14px"></i> Exportado!';
      createLucideIcons(exportBtn);
      toastFn('success', 'Informações de Rede', targetPath ? `Relatório TXT salvo com sucesso em:<br><small style="word-break:break-all;">${escapeHtml(targetPath)}</small>` : 'Relatório TXT exportado com sucesso!');
      setTimeout(() => {
        exportBtn.innerHTML = originalHtml;
        createLucideIcons(exportBtn);
      }, 2500);
    } else {
      exportBtn.innerHTML = originalHtml;
      createLucideIcons(exportBtn);
      toastFn('error', 'Informações de Rede', 'Não foi possível salvar o arquivo TXT.');
    }
  };

  copyBtn.onclick = () => {
    const isRawActive = toggleRaw.classList.contains('active');
    const textToCopy = isRawActive ? rawOutput : generateNetworkInfoTxtReport(hostInfo, adapters, rawOutput);
    navigator.clipboard.writeText(textToCopy);
    const originalHtml = copyBtn.innerHTML;
    copyBtn.innerHTML = '<i data-lucide="check" style="width:14px;height:14px"></i> Copiado!';
    createLucideIcons(copyBtn);
    setTimeout(() => {
      copyBtn.innerHTML = originalHtml;
      createLucideIcons(copyBtn);
    }, 2000);
  };

  refreshBtn.onclick = () => {
    loadData();
  };

  const closeModal = () => {
    document.removeEventListener('keydown', onKeyDown);
    overlay.remove();
  };

  const onKeyDown = (e) => {
    const overlays = document.querySelectorAll('body > .modal-overlay');
    if ((e.key === 'Escape' || e.key === 'Esc') && overlays[overlays.length - 1] === overlay) {
      closeModal();
    }
  };
  document.addEventListener('keydown', onKeyDown);

  closeBtn.onclick = closeModal;
  xCloseBtn.onclick = closeModal;
  overlay.onclick = (e) => {
    if (e.target === overlay) closeModal();
  };

  loadData();
}
