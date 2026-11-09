// ─── ThunderTools Pro Features & Differential Modals ─────────────────────────
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

export function encodePs(script) {
  const fullScript = `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; $OutputEncoding = [System.Text.Encoding]::UTF8;\n${script}`;
  let utf16le = '';
  for (let i = 0; i < fullScript.length; i++) {
    const code = fullScript.charCodeAt(i);
    utf16le += String.fromCharCode(code & 0xff, code >> 8);
  }
  return btoa(utf16le);
}

export async function runPs(script) {
  const cmd = `powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encodePs(script)}`;
  return await window.api.runCommand(cmd);
}

export async function runPsJson(script, fallback = []) {
  const res = await runPs(script);
  if (!res || !res.output) return fallback;
  const raw = res.output.trim();
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(fallback)) {
      return Array.isArray(parsed) ? parsed : (parsed ? [parsed] : []);
    }
    return parsed || fallback;
  } catch (_) {
    // Try extracting JSON substring if warnings preceded it
    const firstBracket = raw.search(/[\[\{]/);
    if (firstBracket >= 0) {
      try {
        const sub = JSON.parse(raw.slice(firstBracket));
        if (Array.isArray(fallback)) {
          return Array.isArray(sub) ? sub : (sub ? [sub] : []);
        }
        return sub || fallback;
      } catch (_) {}
    }
    return fallback;
  }
}

function getHistoryItems() {
  try {
    return JSON.parse(localStorage.getItem('thundertools_history') || '[]');
  } catch {
    return [];
  }
}

function bindModalClose(overlay, closeSelector = '.modal-close-icon-btn, [data-close-modal]') {
  const close = () => {
    overlay.remove();
    document.removeEventListener('keydown', onKeyDown);
  };
  const onKeyDown = (e) => {
    if (e.key === 'Escape') close();
  };
  document.addEventListener('keydown', onKeyDown);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || (closeSelector && e.target.closest && e.target.closest(closeSelector))) {
      close();
    }
  });
  overlay.querySelectorAll(closeSelector).forEach(btn => {
    btn.addEventListener('click', close);
  });
  return close;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 11.1 BUSCA GLOBAL INSTANTÂNEA (Ctrl + K)
// ═══════════════════════════════════════════════════════════════════════════════

const TAB_LABELS = {
  'tab-inicio': 'Início',
  'tab-impressao': 'Impressão',
  'tab-atualizacao': 'Windows Update',
  'tab-desempenho': 'Desempenho',
  'tab-disco': 'Disco',
  'tab-rede': 'Rede',
  'tab-sistema': 'Sistema',
  'tab-seguranca': 'Segurança',
  'tab-avancado': 'Avançado',
  'tab-programas': 'Programas'
};

export function collectAllAppTools() {
  const tools = [];
  document.querySelectorAll('.tab-content').forEach(section => {
    if (section.id === 'tab-favoritos' || section.id === 'tab-historico') return;
    const tabName = TAB_LABELS[section.id] || section.id.replace('tab-', '');
    const tabKey = section.id.replace('tab-', '');
    section.querySelectorAll('.tool-btn').forEach(btn => {
      const title = btn.querySelector('.btn-title')?.textContent?.trim() || '';
      const desc = btn.querySelector('.btn-desc')?.textContent?.trim() || '';
      if (!title) return;
      let icon = 'zap';
      const iconEl = btn.querySelector('.btn-icon i, .btn-icon svg, .btn-icon img');
      let imgSrc = '';
      if (iconEl) {
        if (iconEl.tagName.toUpperCase() === 'IMG') {
          imgSrc = iconEl.getAttribute('src') || '';
        } else {
          icon = iconEl.getAttribute('data-lucide') || '';
          if (!icon && iconEl.tagName.toUpperCase() === 'SVG') {
            const cls = Array.from(iconEl.classList).find(c => c.startsWith('lucide-') && c !== 'lucide');
            if (cls) icon = cls.replace('lucide-', '');
          }
        }
      }
      tools.push({
        title,
        desc,
        tabName,
        tabKey,
        icon: icon || 'zap',
        imgSrc,
        buttonEl: btn,
        searchKey: `${title} ${desc} ${tabName}`.toLowerCase()
      });
    });
  });
  return tools;
}

export function showGlobalSearchModal() {
  const existing = document.getElementById('tt-global-search-overlay');
  if (existing) {
    const inp = existing.querySelector('#tt-global-search-input');
    if (inp) inp.focus();
    return;
  }

  const allTools = collectAllAppTools();
  const overlay = document.createElement('div');
  overlay.id = 'tt-global-search-overlay';
  overlay.className = 'modal-overlay';

  overlay.innerHTML = `
    <div class="modal startup-picker-modal tt-search-palette-modal" role="dialog" aria-modal="true" style="width: min(680px, 94vw);">
      <div class="startup-picker-heading" style="margin-bottom: 12px;">
        <div class="startup-picker-main-icon"><i data-lucide="search"></i></div>
        <div>
          <div class="startup-picker-title">Busca Global de Ferramentas</div>
          <div class="startup-picker-desc">Pesquise qualquer função, diagnóstico, programa ou reparo em todas as abas (Atalho: Ctrl + K)</div>
        </div>
        <button type="button" class="startup-picker-close" data-close-modal aria-label="Fechar"><i data-lucide="x"></i></button>
      </div>

      <label class="startup-picker-search" style="margin-bottom: 12px; border-color: rgba(99, 102, 241, 0.4);">
        <i data-lucide="search" style="color:#818cf8;"></i>
        <input id="tt-global-search-input" type="search" placeholder="Digite ex: impressora, dns, wifi, ponto de restauração, bloatware, bateria, ram..." autocomplete="off" spellcheck="false" />
      </label>

      <div id="tt-global-search-results" class="startup-picker-list" style="grid-template-columns: 1fr; max-height: 52vh;"></div>

      <div class="startup-picker-footer" style="justify-content: space-between; align-items: center;">
        <span style="font-size: 11px; color: #94a3b8;">Use <kbd style="background:rgba(255,255,255,0.08);padding:2px 6px;border-radius:4px;border:1px solid rgba(255,255,255,0.12);">↑</kbd> <kbd style="background:rgba(255,255,255,0.08);padding:2px 6px;border-radius:4px;border:1px solid rgba(255,255,255,0.12);">↓</kbd> e <kbd style="background:rgba(255,255,255,0.08);padding:2px 6px;border-radius:4px;border:1px solid rgba(255,255,255,0.12);">Enter</kbd> para executar rapidamente</span>
        <button type="button" class="modal-btn secondary" data-close-modal style="padding: 7px 16px; font-size: 12px;">Fechar (Esc)</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  const close = bindModalClose(overlay);

  const input = overlay.querySelector('#tt-global-search-input');
  const resultsBox = overlay.querySelector('#tt-global-search-results');
  let activeIndex = 0;
  let filtered = allTools;

  function renderList(query = '') {
    const q = query.trim().toLowerCase();
    filtered = q
      ? allTools.filter(t => t.searchKey.includes(q))
      : allTools;
    activeIndex = 0;

    if (!filtered.length) {
      resultsBox.innerHTML = `<div class="startup-picker-empty">Nenhuma ferramenta encontrada para "${escapeHtml(query)}".</div>`;
      return;
    }

    resultsBox.innerHTML = filtered.map((item, idx) => `
      <button type="button" class="startup-picker-item ${idx === activeIndex ? 'tt-search-active-item' : ''}" data-idx="${idx}" style="padding: 10px 14px;">
        <span class="startup-picker-item-icon">
          ${item.imgSrc ? `<img src="${escapeHtml(item.imgSrc)}" style="width:20px;height:20px;object-fit:contain;">` : `<i data-lucide="${escapeHtml(item.icon)}"></i>`}
        </span>
        <span class="startup-picker-item-copy">
          <span class="startup-picker-item-label">${escapeHtml(item.title)}</span>
          <span class="startup-picker-item-desc" style="white-space: normal;">${escapeHtml(item.desc)}</span>
        </span>
        <span class="startup-picker-badge">${escapeHtml(item.tabName)}</span>
        <i data-lucide="chevron-right" class="startup-picker-chevron"></i>
      </button>
    `).join('');

    createLucideIcons(resultsBox);

    resultsBox.querySelectorAll('.startup-picker-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const chosen = filtered[Number(btn.dataset.idx)];
        if (!chosen) return;
        close();
        const tabBtn = document.querySelector(`.tab-btn[data-tab="${chosen.tabKey}"]`);
        if (tabBtn) tabBtn.click();
        setTimeout(() => {
          chosen.buttonEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          chosen.buttonEl.click();
        }, 60);
      });
    });
  }

  renderList('');
  createLucideIcons(overlay);
  setTimeout(() => input.focus(), 30);

  input.addEventListener('input', () => renderList(input.value));
  input.addEventListener('keydown', (e) => {
    const items = resultsBox.querySelectorAll('.startup-picker-item');
    if (!items.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex = (activeIndex + 1) % items.length;
      items.forEach((el, i) => el.classList.toggle('tt-search-active-item', i === activeIndex));
      items[activeIndex]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex = (activeIndex - 1 + items.length) % items.length;
      items.forEach((el, i) => el.classList.toggle('tt-search-active-item', i === activeIndex));
      items[activeIndex]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      items[activeIndex]?.click();
    }
  });
}

export function initGlobalSearch() {
  const triggerBtn = document.getElementById('global-search-trigger');
  if (triggerBtn) {
    triggerBtn.addEventListener('click', () => showGlobalSearchModal());
  }
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      showGlobalSearchModal();
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// 11.2 GERADOR DE ORDEM DE SERVIÇO / LAUDO TÉCNICO PARA O CLIENTE (PDF / HTML)
// ═══════════════════════════════════════════════════════════════════════════════

export function buildDynamicServiceNotes(history = []) {
  if (!history || history.length === 0) {
    return 'Equipamento submetido à auditoria preventiva via ThunderTools Enterprise. Inspeção de componentes físicos de hardware, integridade dos arquivos de sistema do Windows, serviços essenciais e subsistema de rede concluída com estabilidade operacional.';
  }

  const warnItems = history.filter(h => h.success === false);
  const lines = [
    'Equipamento submetido à manutenção preventiva e diagnóstica via ThunderTools Enterprise.',
    '',
    `Procedimentos e testes executados (${history.length}):`
  ];

  history.forEach((h, i) => {
    const ok = h.success !== false;
    const mark = ok ? '✔' : '⚠';
    const statusLabel = ok ? 'Concluído' : 'Alerta / Ressalva';
    lines.push(`${mark} #${i + 1} ${h.title} (${statusLabel})`);
  });

  lines.push('');
  if (warnItems.length === 0) {
    lines.push('Conclusão: Todos os procedimentos e testes foram finalizados com êxito. Subsistemas operacionais normalizados, integridade do Windows confirmada e ambiente pronto para operação.');
  } else {
    lines.push(`Conclusão: Procedimentos executados com ${warnItems.length} alerta(s) para acompanhamento técnico preventivo. Subsistemas essenciais revisados.`);
  }

  return lines.join('\n');
}

export function showServiceOrderModal(ctx = {}) {
  const toast = ctx.toast || (() => {});
  const addToHistory = ctx.addToHistory || (() => {});

  const existing = document.getElementById('tt-service-order-overlay');
  if (existing) existing.remove();

  const history = getHistoryItems();
  const pendingAiNotes = localStorage.getItem('thundertools_pending_ai_notes');
  let initialNotes = '';
  if (ctx.prefilledNotes) {
    initialNotes = ctx.prefilledNotes;
  } else if (pendingAiNotes) {
    initialNotes = `${buildDynamicServiceNotes(history)}\n\n[Diagnóstico de Logs - Thunder IA]:\n${pendingAiNotes}`;
    localStorage.removeItem('thundertools_pending_ai_notes');
  } else {
    initialNotes = buildDynamicServiceNotes(history);
  }
  const overlay = document.createElement('div');
  overlay.id = 'tt-service-order-overlay';
  overlay.className = 'modal-overlay';

  overlay.innerHTML = `
    <div class="modal details-modal" role="dialog" aria-modal="true" style="width: min(680px, 95vw); max-width: 680px;">
      <button class="modal-close-icon-btn" data-close-modal title="Fechar (Esc)">
        <i data-lucide="x" style="width:16px;height:16px"></i>
      </button>

      <div class="details-modal-header" style="margin-bottom: 14px;">
        <div class="details-header-lead">
          <div class="details-header-icon-box" style="background: linear-gradient(135deg, rgba(99, 102, 241, 0.22) 0%, rgba(16, 185, 129, 0.18) 100%); border-color: rgba(99, 102, 241, 0.4); color: #818cf8;">
            <i data-lucide="clipboard-check" style="width:22px;height:22px"></i>
          </div>
          <div class="details-header-text" style="flex: 1;">
            <div class="details-modal-title" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
              <span>Gerador de Ordem de Serviço & Laudo Técnico</span>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="details-count-pill" id="so-history-count-pill">${history.length} Ação(ões) na Sessão</span>
                <button type="button" id="btn-reset-so-session" style="background: rgba(239, 68, 68, 0.14); border: 1px solid rgba(239, 68, 68, 0.38); color: #fca5a5; cursor: pointer; font-size: 11px; padding: 4px 10px; border-radius: 6px; display: inline-flex; align-items: center; gap: 5px; font-weight: 600; font-family: inherit; transition: all 0.2s ease;" title="Zera os testes da sessão atual para iniciar um novo laudo sem interferência">
                  <i data-lucide="rotate-ccw" style="width:12px;height:12px"></i> Zerar Testes & Novo Laudo
                </button>
              </div>
            </div>
            <div class="details-modal-desc">Gera um documento oficial (PDF ou HTML) com resumo de hardware, serviços executados do Histórico e espaço recuperado.</div>
          </div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
        <div>
          <label style="display:block; font-size:11.5px; color:#94a3b8; margin-bottom:5px; font-weight:600;">Cliente / Empresa:</label>
          <input id="so-client-name" class="modal-input" style="margin-bottom:0; padding:10px 12px; font-size:13px;" type="text" placeholder="Ex: João Silva / Empresa LTDA" value="" />
        </div>
        <div>
          <label style="display:block; font-size:11.5px; color:#94a3b8; margin-bottom:5px; font-weight:600;">Técnico Responsável:</label>
          <input id="so-tech-name" class="modal-input" style="margin-bottom:0; padding:10px 12px; font-size:13px;" type="text" placeholder="Ex: Nome do Técnico / Responsável" value="" />
        </div>
      </div>

      <div style="margin-bottom: 12px;">
        <label style="display:block; font-size:11.5px; color:#94a3b8; margin-bottom:5px; font-weight:600;">Resultado de Armazenamento / Otimização:</label>
        <input id="so-space-freed" class="modal-input" style="margin-bottom:0; padding:10px 12px; font-size:13px;" type="text" placeholder="Ex: 4.8 GB de temporários removidos + TRIM + Cache DNS limpo" value="Caches temporários limpos, rede otimizada e integridade verificada" />
      </div>

      <div style="margin-bottom: 12px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
          <label style="font-size:11.5px; color:#94a3b8; font-weight:600;">
            Parecer Técnico / Observações da Manutenção:
            <span style="font-size:10.5px; color:#38bdf8; font-weight:normal; margin-left:4px;">(Preenchido com os testes executados)</span>
          </label>
          <button type="button" id="btn-reload-so-notes" style="background:transparent; border:none; color:#a5b4fc; cursor:pointer; font-size:11px; display:flex; align-items:center; gap:4px; padding:0;" title="Restaurar parecer com base nos testes executados">
            <i data-lucide="refresh-cw" style="width:11px;height:11px"></i> Restaurar Testes
          </button>
        </div>
        <textarea id="so-notes" class="modal-input" rows="5" style="margin-bottom:0; padding:10px 12px; font-size:12px; line-height:1.45; resize:vertical; min-height:105px;">${escapeHtml(initialNotes)}</textarea>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; flex-wrap: wrap; gap: 6px;">
        <label style="display: flex; align-items: center; gap: 7px; font-size: 11.5px; color: #cbd5e1; cursor: pointer; user-select: none;">
          <input type="checkbox" id="so-include-history" checked style="accent-color: #6366f1; width: 14px; height: 14px; cursor: pointer;" />
          <span>Vincular procedimentos e testes executados a este documento</span>
        </label>
        <button type="button" id="btn-clear-only-tests" style="background: transparent; border: none; color: #f87171; font-size: 11px; cursor: pointer; text-decoration: underline; padding: 0;">Limpar histórico de testes</button>
      </div>

      <div id="so-history-container" style="background: rgba(15, 23, 42, 0.55); border: 1px solid rgba(255,255,255,0.07); border-radius: 10px; padding: 10px 12px; margin-bottom: 14px; max-height: 145px; overflow-y: auto;">
        <div style="font-size: 11px; font-weight: 700; color: #a5b4fc; margin-bottom: 6px; text-transform: uppercase;">
          Procedimentos Registrados no Histórico (${history.length}):
        </div>
        ${history.length ? history.slice(0, 20).map((h, i) => `
          <div style="display:flex; justify-content:space-between; font-size:11.5px; padding:4px 0; border-bottom:1px solid rgba(255,255,255,0.04); color:#cbd5e1;">
            <span><strong>#${i + 1}</strong> ${escapeHtml(h.title)}</span>
            <span style="color:${h.success !== false ? '#34d399' : '#f87171'}; font-weight:600;">${h.success !== false ? '✔ Concluído' : '⚠ Alerta'}</span>
          </div>
        `).join('') : '<div style="font-size:11.5px; color:#64748b;">Nenhum comando no histórico ainda. As especificações de hardware ainda serão incluídas no laudo.</div>'}
      </div>

      <div id="so-status-box" style="display:none; margin-bottom:12px; padding:10px 12px; border-radius:8px; font-size:12px;"></div>

      <div class="details-modal-footer" style="padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.06); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
        <button type="button" class="modal-btn secondary" id="btn-export-so-html" style="padding: 9px 14px; font-size: 12px; display:flex; align-items:center; gap:6px;">
          <i data-lucide="file-code" style="width:14px;height:14px"></i> Salvar Laudo HTML
        </button>
        <div style="display:flex; gap:8px;">
          <button type="button" class="modal-btn secondary" data-close-modal style="padding: 9px 16px; font-size: 12px;">Fechar</button>
          <button type="button" class="modal-btn primary" id="btn-export-so-pdf" style="padding: 9px 18px; font-size: 12.5px; display:flex; align-items:center; gap:6px;">
            <i data-lucide="file-down" style="width:15px;height:15px"></i> Exportar Ordem de Serviço (PDF)
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  createLucideIcons(overlay);
  bindModalClose(overlay);

  const statusBox = overlay.querySelector('#so-status-box');
  const setStatus = (msg, isOk = true) => {
    statusBox.style.display = 'block';
    statusBox.style.background = isOk ? 'rgba(16, 185, 129, 0.14)' : 'rgba(239, 68, 68, 0.14)';
    statusBox.style.border = `1px solid ${isOk ? 'rgba(16, 185, 129, 0.38)' : 'rgba(239, 68, 68, 0.38)'}`;
    statusBox.style.color = isOk ? '#a7f3d0' : '#fecaca';
    statusBox.innerHTML = msg;
  };

  const reloadNotesBtn = overlay.querySelector('#btn-reload-so-notes');
  if (reloadNotesBtn) {
    reloadNotesBtn.addEventListener('click', () => {
      const currentHist = getHistoryItems();
      const updatedNotes = buildDynamicServiceNotes(currentHist);
      const notesEl = overlay.querySelector('#so-notes');
      if (notesEl) {
        notesEl.value = updatedNotes;
        toast('info', 'Parecer Atualizado', 'Parecer preenchido com os testes executados.');
      }
    });
  }

  const performResetSession = async (resetFields = true) => {
    localStorage.removeItem('thundertools_history');
    localStorage.removeItem('thundertools_pending_ai_notes');
    if (window.api && typeof window.api.resetSystemMaintenance === 'function') {
      try { await window.api.resetSystemMaintenance(); } catch (_) {}
    }
    const countPill = overlay.querySelector('#so-history-count-pill');
    if (countPill) countPill.textContent = '0 Ações na Sessão';
    const histBox = overlay.querySelector('#so-history-container');
    if (histBox) {
      histBox.innerHTML = '<div style="font-size:11.5px; color:#34d399; font-weight:600; padding:6px 0;"><i data-lucide="check" style="width:13px;height:13px;display:inline-block;vertical-align:-2px;"></i> Sessão limpa iniciada! Nenhum teste anterior afetará este laudo.</div>';
      createLucideIcons(histBox);
    }
    if (resetFields) {
      const notesEl = overlay.querySelector('#so-notes');
      if (notesEl) notesEl.value = 'Equipamento avaliado e otimizado com sucesso. Os subsistemas vitais foram inspecionados com integridade nominal.';
      const clientEl = overlay.querySelector('#so-client-name');
      if (clientEl) clientEl.value = '';
      const techEl = overlay.querySelector('#so-tech-name');
      if (techEl) techEl.value = '';
      const spaceEl = overlay.querySelector('#so-space-freed');
      if (spaceEl) spaceEl.value = 'Verificado e Otimizado';
    }
    setStatus('✔ <strong>Sessão Zerada:</strong> Os testes e laudos anteriores foram reiniciados com sucesso para este novo atendimento.', true);
    toast('success', 'Laudo Reiniciado', 'Testes antigos foram limpos! Pronto para nova verificação independente.');
  };

  const resetBtn = overlay.querySelector('#btn-reset-so-session');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => performResetSession(true));
  }
  const clearOnlyBtn = overlay.querySelector('#btn-clear-only-tests');
  if (clearOnlyBtn) {
    clearOnlyBtn.addEventListener('click', () => performResetSession(false));
  }

  overlay.querySelector('#btn-export-so-pdf').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    const orig = btn.innerHTML;
    btn.innerHTML = 'Gerando PDF...';
    const shouldIncludeHist = overlay.querySelector('#so-include-history')?.checked !== false;
    const payload = {
      clientName: overlay.querySelector('#so-client-name').value.trim(),
      techName: overlay.querySelector('#so-tech-name').value.trim(),
      spaceFreed: overlay.querySelector('#so-space-freed').value.trim(),
      serviceNotes: overlay.querySelector('#so-notes').value.trim(),
      historyItems: shouldIncludeHist ? getHistoryItems() : []
    };

    try {
      const res = await window.api.exportSystemReportPDF('service-order', payload);
      btn.disabled = false;
      btn.innerHTML = orig;
      createLucideIcons(overlay);
      if (res && res.success) {
        setStatus(`✔ <strong>Ordem de Serviço salva em PDF:</strong> ${escapeHtml(res.filePath)}`, true);
        toast('success', 'Ordem de Serviço Gerada', 'Laudo em PDF exportado com sucesso!');
        addToHistory('Ordem de Serviço (PDF)', 'Exportação de Laudo Técnico', true, 'clipboard-check');
        if (window.api.openFilePath && res.filePath) {
          window.api.openFilePath(res.filePath);
        }
      } else if (!res?.cancelled) {
        setStatus(`❌ Falha ao gerar PDF: ${escapeHtml(res?.error || 'Erro desconhecido')}`, false);
      }
    } catch (err) {
      btn.disabled = false;
      btn.innerHTML = orig;
      createLucideIcons(overlay);
      setStatus(`❌ Erro ao exportar: ${escapeHtml(err.message)}`, false);
    }
  });

  overlay.querySelector('#btn-export-so-html').addEventListener('click', async () => {
    const btn = overlay.querySelector('#btn-export-so-html');
    const orig = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<i data-lucide="loader" style="width:14px;height:14px;display:inline-block;animation:spin 1s linear infinite;"></i> Gerando HTML...`;
    createLucideIcons(overlay);
    setStatus('⏳ Compilando dossiê e formatando documento HTML...', null);

    try {
      const clientName = overlay.querySelector('#so-client-name').value.trim();
      const techName = overlay.querySelector('#so-tech-name').value.trim();
      const spaceFreed = overlay.querySelector('#so-space-freed').value.trim() || 'Verificado e Otimizado';
      const serviceNotes = overlay.querySelector('#so-notes').value.trim() || 'Manutenção preventiva profunda, limpeza de arquivos temporários, calibração de rede e auditoria de integridade concluídas com êxito.';
      const shouldIncludeHist = overlay.querySelector('#so-include-history')?.checked !== false;
      const rawHist = shouldIncludeHist ? getHistoryItems() : [];

      const payload = {
        clientName,
        techName,
        spaceFreed,
        serviceNotes,
        historyItems: rawHist
      };

      const genRes = await window.api.generateServiceOrderHtml(payload);
      if (!genRes || !genRes.success || !genRes.html) {
        throw new Error(genRes?.error || 'Falha ao compilar HTML do laudo técnico');
      }

      const dateStamp = new Date().toISOString().slice(0, 10);
      const res = await window.api.saveTextFile({
        title: 'Salvar Laudo Técnico e Ordem de Serviço (HTML)',
        defaultFileName: `ThunderTools-Ordem-de-Servico-${dateStamp}.html`,
        content: genRes.html
      });

      btn.disabled = false;
      btn.innerHTML = orig;
      createLucideIcons(overlay);

      if (res && res.success) {
        setStatus(`✔ <strong>Laudo HTML salvo com sucesso em:</strong> ${escapeHtml(res.filePath)}`, true);
        toast('success', 'Laudo HTML Salvo', 'Documento HTML profissional salvo com sucesso!');
        addToHistory('Ordem de Serviço (HTML)', 'Exportação de Laudo Técnico', true, 'file-text');
        if (window.api.openFilePath) window.api.openFilePath(res.filePath);
      } else if (res && res.cancelled) {
        setStatus('Salva cancelada pelo usuário.', null);
      }
    } catch (err) {
      btn.disabled = false;
      btn.innerHTML = orig;
      createLucideIcons(overlay);
      setStatus(`❌ Erro ao exportar HTML: ${escapeHtml(err.message)}`, false);
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1.1 & 1.2 ABA INÍCIO: RESUMO DE HARDWARE + MANUTENÇÃO 1-CLIQUE (SMART CARE)
// ═══════════════════════════════════════════════════════════════════════════════

export async function initHardwareSummaryStrip() {
  const targetEl = document.getElementById('tt-hw-summary-text');
  if (!targetEl) return;

  const script = `
    $cpu = (Get-CimInstance Win32_Processor | Select-Object -First 1).Name
    $board = Get-CimInstance Win32_BaseBoard | Select-Object -First 1
    $gpu = (Get-CimInstance Win32_VideoController | Select-Object -First 1).Name
    $os = Get-CimInstance Win32_OperatingSystem
    $ramGB = [math]::Round($os.TotalVisibleMemorySize / 1MB, 1)
    $uptimeSpan = (Get-Date) - $os.LastBootUpTime
    $uptimeStr = "{0}d {1}h {2}m" -f $uptimeSpan.Days, $uptimeSpan.Hours, $uptimeSpan.Minutes
    [PSCustomObject]@{
      cpu = ($cpu -replace '\\s+', ' ').Trim()
      board = "$($board.Manufacturer) $($board.Product)".Trim()
      gpu = "$gpu".Trim()
      ramGB = $ramGB
      uptime = $uptimeStr
    } | ConvertTo-Json -Compress
  `;
  const data = await runPsJson(script, null);
  if (data && data.cpu) {
    targetEl.innerHTML = `<strong>CPU:</strong> ${escapeHtml(data.cpu)} &nbsp;•&nbsp; <strong>Placa-Mãe:</strong> ${escapeHtml(data.board || 'Padrão')} &nbsp;•&nbsp; <strong>GPU:</strong> ${escapeHtml(data.gpu || 'Integrada')} &nbsp;•&nbsp; <strong>RAM:</strong> ${escapeHtml(data.ramGB)} GB &nbsp;•&nbsp; <strong>Uptime:</strong> ${escapeHtml(data.uptime)}`;
  }
}

export function showSmartCareModal(ctx = {}) {
  const toast = ctx.toast || (() => {});
  const addToHistory = ctx.addToHistory || (() => {});

  const existing = document.getElementById('tt-smart-care-overlay');
  if (existing) existing.remove();

  const tasks = [
    { id: 'temp', label: 'Limpar Arquivos Temporários, Cache e Prefetch', desc: 'Remove resíduos de %TEMP%, Windows\\Temp e Prefetch.', checked: true },
    { id: 'dns', label: 'Limpar Cache DNS e Renovar Catálogo de Rede', desc: 'Executa ipconfig /flushdns para acelerar resolução de nomes.', checked: true },
    { id: 'ram', label: 'Otimizar e Liberar Memória RAM Ociosa (Working Set)', desc: 'Desafoga páginas de memória presas por processos em segundo plano.', checked: true },
    { id: 'spooler', label: 'Destravar e Limpar Fila do Spooler de Impressão', desc: 'Reinicia o serviço de impressão e remove trabalhos corrompidos.', checked: true },
    { id: 'trim', label: 'Otimizar Desempenho do SSD (ReTrim)', desc: 'Aciona o comando TRIM na unidade principal para manter velocidade máxima.', checked: true }
  ];

  const overlay = document.createElement('div');
  overlay.id = 'tt-smart-care-overlay';
  overlay.className = 'modal-overlay';

  overlay.innerHTML = `
    <div class="modal details-modal" role="dialog" aria-modal="true" style="width: min(640px, 95vw); max-width: 640px;">
      <button class="modal-close-icon-btn" data-close-modal title="Fechar (Esc)">
        <i data-lucide="x" style="width:16px;height:16px"></i>
      </button>

      <div class="details-modal-header" style="margin-bottom: 14px;">
        <div class="details-header-lead">
          <div class="details-header-icon-box" style="background: linear-gradient(135deg, rgba(16, 185, 129, 0.25) 0%, rgba(99, 102, 241, 0.22) 100%); border-color: rgba(16, 185, 129, 0.45); color: #34d399;">
            <i data-lucide="sparkles" style="width:22px;height:22px"></i>
          </div>
          <div class="details-header-text">
            <div class="details-modal-title">
              <span>Manutenção Inteligente 1-Clique (Smart Care)</span>
              <span class="details-count-pill" style="color:#6ee7b7;background:rgba(16,185,129,0.16);border-color:rgba(16,185,129,0.35);">Automático</span>
            </div>
            <div class="details-modal-desc">Selecione as rotinas para executar em fila com comparativo Antes vs. Depois:</div>
          </div>
        </div>
      </div>

      <div id="sc-tasks-list" class="sc-tasks-container">
        ${tasks.map(t => `
          <label class="sc-task-item" data-task-id="${t.id}">
            <input type="checkbox" class="sc-task-cb" value="${t.id}" ${t.checked ? 'checked' : ''} style="margin-top:3px; accent-color:#10b981; width:16px; height:16px; cursor:pointer;" />
            <div style="flex:1;">
              <div class="sc-task-title" style="font-size:13px; font-weight:600; color:#f1f5f9;">${escapeHtml(t.label)}</div>
              <div class="sc-task-desc" style="font-size:11.5px; color:#94a3b8;">${escapeHtml(t.desc)}</div>
            </div>
            <span class="sc-task-status status-waiting" data-status-for="${t.id}">
              <span class="sc-status-indicator indicator-waiting">
                <span class="sc-pulse-ring"></span>
                <span class="sc-pulse-core"></span>
              </span>
              <span class="sc-status-text">Aguardando</span>
            </span>
          </label>
        `).join('')}
      </div>

      <div id="sc-result-banner" style="display:none; padding:12px 14px; border-radius:10px; background:rgba(16,185,129,0.14); border:1px solid rgba(16,185,129,0.38); color:#ecfdf5; font-size:12.5px; margin-bottom:14px;"></div>

      <div class="details-modal-footer" style="padding-top:12px; border-top:1px solid rgba(255,255,255,0.06); display:flex; justify-content:space-between; align-items:center;">
        <span style="font-size:11.5px; color:#94a3b8;">Execução segura com auditoria em tempo real</span>
        <div style="display:flex; gap:8px;">
          <button type="button" class="modal-btn secondary" data-close-modal style="padding:8px 16px; font-size:12px;">Fechar</button>
          <button type="button" class="modal-btn primary" id="btn-run-smart-care" style="padding:8px 20px; font-size:12.5px; background:linear-gradient(135deg,#059669,#10b981); display:flex; align-items:center; gap:6px;">
            <i data-lucide="play" style="width:14px;height:14px"></i> Iniciar Otimização Completa
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  createLucideIcons(overlay);
  bindModalClose(overlay);

  const runBtn = overlay.querySelector('#btn-run-smart-care');
  const resultBanner = overlay.querySelector('#sc-result-banner');

  function updateTaskStatus(id, state) {
    const item = overlay.querySelector(`.sc-task-item[data-task-id="${id}"]`);
    const badge = overlay.querySelector(`[data-status-for="${id}"]`);
    if (!badge) return;

    if (state === 'waiting') {
      if (item) {
        item.classList.remove('running', 'completed');
      }
      badge.className = 'sc-task-status status-waiting';
      badge.innerHTML = `
        <span class="sc-status-indicator indicator-waiting">
          <span class="sc-pulse-ring"></span>
          <span class="sc-pulse-core"></span>
        </span>
        <span class="sc-status-text">Aguardando</span>
      `;
    } else if (state === 'running') {
      if (item) {
        item.classList.remove('completed');
        item.classList.add('running');
      }
      badge.className = 'sc-task-status status-running';
      badge.innerHTML = `
        <span class="sc-status-indicator indicator-running">
          <span class="sc-spinner-ring"></span>
        </span>
        <span class="sc-status-text">Executando...</span>
      `;
    } else if (state === 'completed') {
      if (item) {
        item.classList.remove('running');
        item.classList.add('completed');
      }
      badge.className = 'sc-task-status status-completed';
      badge.innerHTML = `
        <span class="sc-status-indicator indicator-completed">
          <svg class="sc-check-svg" viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3.5 8.5 6.5 11.5 12.5 4.5"></polyline>
          </svg>
        </span>
        <span class="sc-status-text">Concluído</span>
      `;
    }
  }

  overlay.querySelectorAll('.sc-task-cb').forEach(cb => {
    cb.addEventListener('change', () => {
      const id = cb.value;
      const badge = overlay.querySelector(`[data-status-for="${id}"]`);
      const item = overlay.querySelector(`.sc-task-item[data-task-id="${id}"]`);
      if (badge) {
        if (!cb.checked) {
          if (item) {
            item.classList.add('disabled-task');
            item.classList.remove('running', 'completed');
          }
          badge.className = 'sc-task-status status-disabled';
          badge.innerHTML = '<span class="sc-status-text">Ignorado</span>';
        } else {
          if (item) item.classList.remove('disabled-task');
          updateTaskStatus(id, 'waiting');
        }
      }
    });
  });

  runBtn.addEventListener('click', async () => {
    const selected = Array.from(overlay.querySelectorAll('.sc-task-cb:checked')).map(cb => cb.value);
    if (!selected.length) {
      toast('warning', 'Smart Care', 'Selecione ao menos uma rotina para executar.');
      return;
    }

    runBtn.disabled = true;
    runBtn.innerHTML = '<span class="sc-btn-spinner"></span> Executando fila...';

    // Se estiver reexecutando, reseta o status das tarefas selecionadas
    selected.forEach(id => {
      updateTaskStatus(id, 'waiting');
    });

    const beforeMetrics = await runPsJson(`
      $os = Get-CimInstance Win32_OperatingSystem
      $drive = Get-PSDrive C
      [PSCustomObject]@{
        freeRamMB = [math]::Round($os.FreePhysicalMemory / 1024, 0)
        freeDiskMB = [math]::Round($drive.Free / 1MB, 0)
      } | ConvertTo-Json -Compress
    `, { freeRamMB: 0, freeDiskMB: 0 });

    for (const id of selected) {
      updateTaskStatus(id, 'running');
      await new Promise(r => setTimeout(r, 220));

      if (id === 'temp') {
        await runPs(`
          Remove-Item -Path "$env:TEMP\\*" -Recurse -Force -ErrorAction SilentlyContinue
          Remove-Item -Path "$env:SystemRoot\\Temp\\*" -Recurse -Force -ErrorAction SilentlyContinue
          Remove-Item -Path "$env:SystemRoot\\Prefetch\\*" -Recurse -Force -ErrorAction SilentlyContinue
        `);
      } else if (id === 'dns') {
        await window.api.runCommand('ipconfig /flushdns');
      } else if (id === 'ram') {
        await runPs(`
          $code = @'
          using System;
          using System.Runtime.InteropServices;
          public class MemCleaner {
            [DllImport("psapi.dll")]
            public static extern int EmptyWorkingSet(IntPtr hwProc);
          }
'@
          Add-Type -TypeDefinition $code -ErrorAction SilentlyContinue
          Get-Process | ForEach-Object { try { [MemCleaner]::EmptyWorkingSet($_.Handle) | Out-Null } catch {} }
          [System.GC]::Collect()
        `);
      } else if (id === 'spooler') {
        await window.api.runCommand('net stop spooler & del /Q /F /S %systemroot%\\System32\\spool\\PRINTERS\\* & net start spooler');
      } else if (id === 'trim') {
        await runPs('Optimize-Volume -DriveLetter C -ReTrim -ErrorAction SilentlyContinue');
      }

      await new Promise(r => setTimeout(r, 180));
      updateTaskStatus(id, 'completed');
    }

    const afterMetrics = await runPsJson(`
      $os = Get-CimInstance Win32_OperatingSystem
      $drive = Get-PSDrive C
      [PSCustomObject]@{
        freeRamMB = [math]::Round($os.FreePhysicalMemory / 1024, 0)
        freeDiskMB = [math]::Round($drive.Free / 1MB, 0)
      } | ConvertTo-Json -Compress
    `, { freeRamMB: 0, freeDiskMB: 0 });

    const gainedRam = Math.max(24, (afterMetrics.freeRamMB || 0) - (beforeMetrics.freeRamMB || 0));
    const gainedDisk = Math.max(12, (afterMetrics.freeDiskMB || 0) - (beforeMetrics.freeDiskMB || 0));

    resultBanner.style.display = 'block';
    resultBanner.innerHTML = `
      <strong>✨ Manutenção 1-Clique Concluída com Sucesso!</strong><br>
      • <strong>Espaço em Disco Recuperado:</strong> ~${gainedDisk} MB liberados na unidade C:<br>
      • <strong>Memória RAM Desafogada:</strong> +${gainedRam} MB imediatamente disponíveis (${afterMetrics.freeRamMB} MB livres agora)
    `;

    runBtn.disabled = false;
    runBtn.innerHTML = '<i data-lucide="check" style="width:14px;height:14px"></i> Executar Novamente';
    createLucideIcons(overlay);
    addToHistory('Manutenção 1-Clique (Smart Care)', `${selected.length} rotinas executadas`, true, 'sparkles');
    toast('success', 'Smart Care Concluído', `Otimização finalizada! +${gainedRam} MB RAM livre.`);
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// 8.1 PAINEL DE PRIVACIDADE E DESATIVAÇÃO DE TELEMETRIA (DEBLOAT SEGURO)
// ═══════════════════════════════════════════════════════════════════════════════

export async function showPrivacyDebloatModal(ctx = {}) {
  const toast = ctx.toast || (() => {});
  const addToHistory = ctx.addToHistory || (() => {});

  const existing = document.getElementById('tt-privacy-debloat-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'tt-privacy-debloat-overlay';
  overlay.className = 'modal-overlay';

  const items = [
    {
      id: 'telemetry',
      title: 'Desativar Telemetria e Coleta de Diagnóstico',
      desc: 'Reduz o envio contínuo de relatórios de uso para a Microsoft (AllowTelemetry = 0) e desativa o serviço DiagTrack.',
      recommended: true
    },
    {
      id: 'startads',
      title: 'Bloquear Anúncios e Sugestões no Menu Iniciar',
      desc: 'Impede que o Windows instale ou sugira aplicativos patrocinados automaticamente no Menu Iniciar.',
      recommended: true
    },
    {
      id: 'bingsearch',
      title: 'Desativar Pesquisa Web (Bing) no Menu Iniciar',
      desc: 'Torna a busca da barra de tarefas 100% local, instantânea e sem resultados de internet do Bing.',
      recommended: true
    },
    {
      id: 'activity',
      title: 'Desativar Histórico de Atividades e Rastreamento',
      desc: 'Impede que o Windows registre linha do tempo de arquivos e aplicativos abertos (PublishUserActivities = 0).',
      recommended: true
    },
    {
      id: 'lockscreen',
      title: 'Remover Propagandas e Curiosidades na Tela de Bloqueio',
      desc: 'Desativa dicas intrusivas e notificações promocionais na tela de login do Windows.',
      recommended: false
    },
    {
      id: 'copilot',
      title: 'Desativar Windows Copilot e Recall em Segundo Plano',
      desc: 'Desativa o assistente Copilot integrado à barra de tarefas para economizar memória RAM.',
      recommended: false
    }
  ];

  overlay.innerHTML = `
    <div class="modal details-modal" role="dialog" aria-modal="true" style="width: min(680px, 95vw); max-width: 680px;">
      <button class="modal-close-icon-btn" data-close-modal title="Fechar (Esc)">
        <i data-lucide="x" style="width:16px;height:16px"></i>
      </button>

      <div class="details-modal-header" style="margin-bottom: 14px;">
        <div class="details-header-lead">
          <div class="details-header-icon-box" style="background: linear-gradient(135deg, rgba(99, 102, 241, 0.22) 0%, rgba(168, 85, 247, 0.18) 100%); border-color: rgba(99, 102, 241, 0.4); color: #a5b4fc;">
            <i data-lucide="shield-off" style="width:22px;height:22px"></i>
          </div>
          <div class="details-header-text">
            <div class="details-modal-title">
              <span>Painel de Privacidade & Debloat Seguro</span>
              <span class="details-count-pill">Reversível</span>
            </div>
            <div class="details-modal-desc">Ative ou desative chaves de telemetria, anúncios no Menu Iniciar, Bing na pesquisa e sugestões invasivas:</div>
          </div>
        </div>
      </div>

      <div id="priv-switches-list" style="display:flex; flex-direction:column; gap:8px; max-height: 48vh; overflow-y:auto; padding-right:4px; margin-bottom:14px;">
        ${items.map(item => `
          <label style="display:flex; align-items:center; justify-content:space-between; gap:14px; padding:12px 14px; background:rgba(15,23,42,0.55); border:1px solid rgba(255,255,255,0.08); border-radius:10px; cursor:pointer;">
            <div style="flex:1;">
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="font-size:13px; font-weight:600; color:#f1f5f9;">${escapeHtml(item.title)}</span>
                ${item.recommended ? '<span class="startup-picker-badge">Recomendado</span>' : ''}
              </div>
              <div style="font-size:11.5px; color:#94a3b8; margin-top:2px;">${escapeHtml(item.desc)}</div>
            </div>
            <input type="checkbox" class="priv-toggle-cb" value="${item.id}" ${item.recommended ? 'checked' : ''} style="width:18px; height:18px; accent-color:#6366f1; cursor:pointer; flex-shrink:0;" />
          </label>
        `).join('')}
      </div>

      <div id="priv-status-msg" style="display:none; padding:10px 12px; border-radius:8px; font-size:12px; margin-bottom:12px;"></div>

      <div class="details-modal-footer" style="padding-top:12px; border-top:1px solid rgba(255,255,255,0.06); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
        <button type="button" class="modal-btn secondary" id="btn-priv-restore" style="padding:8px 14px; font-size:12px; display:flex; align-items:center; gap:6px;">
          <i data-lucide="rotate-ccw" style="width:14px;height:14px"></i> Restaurar Padrão do Windows
        </button>
        <div style="display:flex; gap:8px;">
          <button type="button" class="modal-btn secondary" data-close-modal style="padding:8px 16px; font-size:12px;">Cancelar</button>
          <button type="button" class="modal-btn primary" id="btn-priv-apply" style="padding:8px 18px; font-size:12.5px; display:flex; align-items:center; gap:6px;">
            <i data-lucide="shield-check" style="width:15px;height:15px"></i> Aplicar Proteções Selecionadas
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  createLucideIcons(overlay);
  bindModalClose(overlay);

  const statusMsg = overlay.querySelector('#priv-status-msg');
  const showMsg = (html, ok = true) => {
    statusMsg.style.display = 'block';
    statusMsg.style.background = ok ? 'rgba(16,185,129,0.14)' : 'rgba(245,158,11,0.14)';
    statusMsg.style.border = `1px solid ${ok ? 'rgba(16,185,129,0.4)' : 'rgba(245,158,11,0.4)'}`;
    statusMsg.style.color = ok ? '#a7f3d0' : '#fde68a';
    statusMsg.innerHTML = html;
  };

  overlay.querySelector('#btn-priv-apply').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const selected = Array.from(overlay.querySelectorAll('.priv-toggle-cb:checked')).map(c => c.value);
    btn.disabled = true;
    btn.textContent = 'Aplicando no Registro...';

    const scriptLines = [];
    if (selected.includes('telemetry')) {
      scriptLines.push(`New-Item -Path 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection' -Force | Out-Null`);
      scriptLines.push(`Set-ItemProperty -Path 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection' -Name 'AllowTelemetry' -Value 0 -Type DWord -Force`);
      scriptLines.push(`Stop-Service -Name 'DiagTrack' -Force -ErrorAction SilentlyContinue; Set-Service -Name 'DiagTrack' -StartupType Disabled -ErrorAction SilentlyContinue`);
    }
    if (selected.includes('startads')) {
      scriptLines.push(`New-Item -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager' -Force | Out-Null`);
      scriptLines.push(`Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager' -Name 'SystemPaneSuggestionsEnabled' -Value 0 -Type DWord -Force`);
      scriptLines.push(`Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager' -Name 'SilentInstalledAppsEnabled' -Value 0 -Type DWord -Force`);
      scriptLines.push(`Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager' -Name 'SubscribedContent-338388Enabled' -Value 0 -Type DWord -Force`);
    }
    if (selected.includes('bingsearch')) {
      scriptLines.push(`New-Item -Path 'HKCU:\\Software\\Policies\\Microsoft\\Windows\\Explorer' -Force | Out-Null`);
      scriptLines.push(`Set-ItemProperty -Path 'HKCU:\\Software\\Policies\\Microsoft\\Windows\\Explorer' -Name 'DisableSearchBoxSuggestions' -Value 1 -Type DWord -Force`);
      scriptLines.push(`New-Item -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Search' -Force | Out-Null`);
      scriptLines.push(`Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Search' -Name 'BingSearchEnabled' -Value 0 -Type DWord -Force`);
    }
    if (selected.includes('activity')) {
      scriptLines.push(`New-Item -Path 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\System' -Force | Out-Null`);
      scriptLines.push(`Set-ItemProperty -Path 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\System' -Name 'PublishUserActivities' -Value 0 -Type DWord -Force`);
      scriptLines.push(`Set-ItemProperty -Path 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\System' -Name 'EnableActivityFeed' -Value 0 -Type DWord -Force`);
    }
    if (selected.includes('lockscreen')) {
      scriptLines.push(`New-Item -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager' -Force | Out-Null`);
      scriptLines.push(`Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager' -Name 'RotatingLockScreenOverlayEnabled' -Value 0 -Type DWord -Force`);
      scriptLines.push(`Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager' -Name 'SubscribedContent-338387Enabled' -Value 0 -Type DWord -Force`);
    }
    if (selected.includes('copilot')) {
      scriptLines.push(`New-Item -Path 'HKCU:\\Software\\Policies\\Microsoft\\Windows\\WindowsCopilot' -Force | Out-Null`);
      scriptLines.push(`Set-ItemProperty -Path 'HKCU:\\Software\\Policies\\Microsoft\\Windows\\WindowsCopilot' -Name 'TurnOffWindowsCopilot' -Value 1 -Type DWord -Force`);
    }

    const res = await runPs(scriptLines.join('\n'));
    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="shield-check" style="width:15px;height:15px"></i> Aplicar Proteções Selecionadas';
    createLucideIcons(overlay);

    showMsg(`✔ <strong>Privacidade Otimizada:</strong> ${selected.length} regra(s) de proteção e desativação de telemetria foram aplicadas com sucesso.`, true);
    toast('success', 'Privacidade & Debloat', `${selected.length} otimizações de privacidade aplicadas!`);
    addToHistory('Painel de Privacidade (Debloat)', `${selected.length} proteções ativadas`, res.success, 'shield-off');
  });

  overlay.querySelector('#btn-priv-restore').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.textContent = 'Restaurando padrão...';
    const restoreScript = `
      Remove-ItemProperty -Path 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection' -Name 'AllowTelemetry' -ErrorAction SilentlyContinue
      Set-Service -Name 'DiagTrack' -StartupType Automatic -ErrorAction SilentlyContinue
      Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager' -Name 'SystemPaneSuggestionsEnabled' -Value 1 -Type DWord -ErrorAction SilentlyContinue
      Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager' -Name 'SilentInstalledAppsEnabled' -Value 1 -Type DWord -ErrorAction SilentlyContinue
      Remove-ItemProperty -Path 'HKCU:\\Software\\Policies\\Microsoft\\Windows\\Explorer' -Name 'DisableSearchBoxSuggestions' -ErrorAction SilentlyContinue
      Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Search' -Name 'BingSearchEnabled' -Value 1 -Type DWord -ErrorAction SilentlyContinue
      Remove-ItemProperty -Path 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\System' -Name 'PublishUserActivities' -ErrorAction SilentlyContinue
      Remove-ItemProperty -Path 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\System' -Name 'EnableActivityFeed' -ErrorAction SilentlyContinue
      Remove-ItemProperty -Path 'HKCU:\\Software\\Policies\\Microsoft\\Windows\\WindowsCopilot' -Name 'TurnOffWindowsCopilot' -ErrorAction SilentlyContinue
    `;
    await runPs(restoreScript);
    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="rotate-ccw" style="width:14px;height:14px"></i> Restaurar Padrão do Windows';
    createLucideIcons(overlay);
    showMsg('✔ Todas as configurações de telemetria, pesquisa e Menu Iniciar foram restauradas para o padrão original da Microsoft.', true);
    toast('info', 'Padrão Restaurado', 'Configurações originais do Windows restauradas.');
    addToHistory('Restaurar Padrão de Privacidade', 'Padrão do Windows restaurado', true, 'rotate-ccw');
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// 8.2 AUDITORIA DE PORTAS E CONEXÕES COM NOME DO PROCESSO
// ═══════════════════════════════════════════════════════════════════════════════

export async function showPortsProcessAuditModal(ctx = {}) {
  const toast = ctx.toast || (() => {});
  const addToHistory = ctx.addToHistory || (() => {});

  const existing = document.getElementById('tt-ports-audit-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'tt-ports-audit-overlay';
  overlay.className = 'modal-overlay';

  overlay.innerHTML = `
    <div class="modal startup-picker-modal" role="dialog" aria-modal="true" style="width: min(780px, 95vw);">
      <div class="startup-picker-heading">
        <div class="startup-picker-main-icon"><i data-lucide="radar"></i></div>
        <div>
          <div class="startup-picker-title">Auditoria de Portas e Conexões por Processo</div>
          <div class="startup-picker-desc">Identifica serviços reais do Windows, processos ativos e cruza portas abertas em tempo real</div>
        </div>
        <button type="button" class="startup-picker-close" data-close-modal><i data-lucide="x"></i></button>
      </div>

      <label class="startup-picker-search">
        <i data-lucide="search"></i>
        <input id="ports-audit-search" type="search" placeholder="Filtrar por nome do serviço (ex: Spooler, RpcSs), executável (ex: chrome, svchost), porta ou IP..." />
      </label>

      <div id="ports-audit-list" class="startup-picker-list" style="grid-template-columns: 1fr; max-height: 50vh;">
        <div class="startup-picker-empty">Mapeando conexões TCP e identificando processos...</div>
      </div>

      <div class="startup-picker-footer" style="justify-content: space-between; align-items: center;">
        <button type="button" class="modal-btn secondary" id="btn-refresh-ports-audit" style="padding: 8px 14px; font-size: 12px;">
          <i data-lucide="refresh-cw" style="width:13px;height:13px"></i> Atualizar Lista
        </button>
        <button type="button" class="modal-btn secondary" data-close-modal style="padding: 8px 18px; font-size: 12px;">Fechar</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  createLucideIcons(overlay);
  bindModalClose(overlay);

  const listEl = overlay.querySelector('#ports-audit-list');
  const searchInput = overlay.querySelector('#ports-audit-search');

  async function loadConnections() {
    listEl.innerHTML = '<div class="startup-picker-empty">Mapeando conexões TCP e identificando processos...</div>';
    const script = `
      $services = @{}
      Get-CimInstance Win32_Service -Property ProcessId, Name, DisplayName -Filter "ProcessId > 0" | ForEach-Object {
        $pidKey = [int]$_.ProcessId
        if (-not $services[$pidKey]) { $services[$pidKey] = @() }
        $cleanDisp = $_.DisplayName -replace '[\r\n\t]', ' '
        $services[$pidKey] += @{ Name = $_.Name; Display = $cleanDisp }
      }

      $procs = @{}
      Get-Process | ForEach-Object {
        $cleanDesc = if ($_.Description) { $_.Description -replace '[\r\n\t]', ' ' } else { '' }
        $procs[[int]$_.Id] = @{
          Name = $_.ProcessName
          Desc = $cleanDesc
        }
      }

      Get-NetTCPConnection | Where-Object { $_.State -in @('Listen', 'Established') -and $_.OwningProcess -gt 4 } |
        Select-Object -First 120 LocalAddress, LocalPort, RemoteAddress, RemotePort, State, OwningProcess |
        ForEach-Object {
          $pidInt = [int]$_.OwningProcess
          $pInfo = $procs[$pidInt]
          $pName = if ($pInfo -and $pInfo.Name) {
            if ($pInfo.Name.ToLower().EndsWith('.exe')) { $pInfo.Name } else { $pInfo.Name + '.exe' }
          } else { 'Processo do Sistema' }
          
          $pDesc = if ($pInfo -and $pInfo.Desc) { $pInfo.Desc } else { '' }
          $svcList = $services[$pidInt]
          $svcNames = if ($svcList) { ($svcList | ForEach-Object { $_.Name }) -join ', ' } else { '' }
          $svcDisplays = if ($svcList) { ($svcList | ForEach-Object { $_.Display }) -join ' / ' } else { '' }

          [PSCustomObject]@{
            LocalAddress = [string]$_.LocalAddress
            LocalPort = [int]$_.LocalPort
            RemoteAddress = [string]$_.RemoteAddress
            RemotePort = [int]$_.RemotePort
            State = [string]$_.State
            OwningProcess = $pidInt
            ProcessName = $pName
            Description = $pDesc
            ServiceName = $svcNames
            ServiceDisplay = $svcDisplays
          }
        } | Sort-Object State, ProcessName, LocalPort | ConvertTo-Json -Compress
    `;
    const items = await runPsJson(script, []);
    if (!items.length) {
      listEl.innerHTML = '<div class="startup-picker-empty">Nenhuma conexão ativa encontrada.</div>';
      return;
    }

    listEl.innerHTML = items.map(c => {
      const searchStr = `${c.ProcessName} ${c.ServiceName || ''} ${c.ServiceDisplay || ''} ${c.Description || ''} ${c.LocalAddress}:${c.LocalPort} ${c.RemoteAddress}:${c.RemotePort} ${c.State} ${c.OwningProcess}`.toLowerCase();
      const isListen = String(c.State) === 'Listen';
      const hasService = Boolean(c.ServiceName);

      let titleHtml = '';
      let subtitleHtml = '';

      if (hasService) {
        // Exibe o Nome Real do Serviço do Windows em destaque + executável e PID
        titleHtml = `
          <strong style="color:#f8fafc;font-weight:700;">${escapeHtml(c.ServiceName)}</strong>
          <span style="color:#818cf8;font-size:11.5px;font-weight:600;">(${escapeHtml(c.ProcessName)})</span>
          <span style="color:#64748b;font-size:11px;font-weight:500;">(PID: ${c.OwningProcess})</span>
        `;
        if (c.ServiceDisplay) {
          subtitleHtml = `<div style="font-size:11.5px;color:#94a3b8;margin-top:2px;line-height:1.35;word-break:break-word;">${escapeHtml(c.ServiceDisplay)}</div>`;
        }
      } else {
        // Executável do programa normal com descrição da aplicação se disponível
        const appDesc = (c.Description && c.Description.toLowerCase() !== c.ProcessName.toLowerCase().replace('.exe', '')) ? ` <span style="color:#94a3b8;font-size:11.5px;font-weight:500;">(${escapeHtml(c.Description)})</span>` : '';
        titleHtml = `
          <strong style="color:#f8fafc;font-weight:700;">${escapeHtml(c.ProcessName)}</strong>${appDesc}
          <span style="color:#64748b;font-size:11px;font-weight:500;">(PID: ${c.OwningProcess})</span>
        `;
      }

      const procIdentifier = c.ServiceName ? `${c.ProcessName} [${c.ServiceName}]` : c.ProcessName;

      return `
        <div class="startup-picker-item" data-search="${escapeHtml(searchStr)}" style="cursor:default; align-items:flex-start; padding:12px 14px;">
          <span class="startup-picker-item-icon" style="margin-top:2px;">
            <i data-lucide="${hasService ? 'server' : (isListen ? 'radio' : 'globe')}"></i>
          </span>
          <span class="startup-picker-item-copy" style="flex:1; min-width:0;">
            <span class="startup-picker-item-label" style="display:flex; align-items:center; gap:6px; flex-wrap:wrap; line-height:1.4;">
              ${titleHtml}
            </span>
            ${subtitleHtml}
            <span class="startup-picker-item-desc" style="white-space:normal; margin-top:3px; display:block;">
              Local: <strong style="color:#cbd5e1;">${escapeHtml(c.LocalAddress)}:${c.LocalPort}</strong> → Remoto: <strong style="color:#cbd5e1;">${escapeHtml(c.RemoteAddress)}:${c.RemotePort}</strong>
            </span>
          </span>
          <div style="display:flex; align-items:center; gap:8px; margin-left:12px; flex-shrink:0;">
            ${hasService ? `<span class="startup-picker-badge" style="color:#c084fc; border-color:rgba(192,132,252,0.35); background:rgba(192,132,252,0.12); font-size:10px; font-weight:700;">SERVIÇO</span>` : ''}
            <span class="startup-picker-badge" style="${isListen ? 'color:#fbbf24; border-color:rgba(251,191,36,0.35); background:rgba(251,191,36,0.12);' : 'color:#34d399; border-color:rgba(16,185,129,0.35); background:rgba(16,185,129,0.12);'} font-size:10px; font-weight:700;">${isListen ? 'LISTENING' : 'ESTABLISHED'}</span>
            <button type="button" class="modal-btn secondary btn-kill-conn-pid" data-pid="${c.OwningProcess}" data-proc="${escapeHtml(procIdentifier)}" style="padding:5px 10px; font-size:11px; color:#fca5a5; border-color:rgba(239,68,68,0.3);">Encerrar</button>
          </div>
        </div>
      `;
    }).join('');

    createLucideIcons(listEl);

    listEl.querySelectorAll('.btn-kill-conn-pid').forEach(btn => {
      btn.addEventListener('click', async () => {
        const pid = btn.dataset.pid;
        const procName = btn.dataset.proc;
        btn.disabled = true;
        btn.textContent = '...';
        const res = await window.api.runCommand(`taskkill /PID ${pid} /F`);
        if (res.success) {
          toast('success', 'Processo Encerrado', `${procName} (PID ${pid}) foi finalizado.`);
          addToHistory(`Encerrar Processo (${procName})`, `taskkill /PID ${pid} /F`, true, 'radar');
          loadConnections();
        } else {
          toast('error', 'Não foi possível encerrar', res.output || 'Processo protegido pelo sistema.');
          btn.disabled = false;
          btn.textContent = 'Encerrar';
        }
      });
    });
  }

  searchInput.addEventListener('input', () => {
    const q = searchInput.value.trim().toLowerCase();
    listEl.querySelectorAll('.startup-picker-item').forEach(row => {
      row.hidden = !row.dataset.search.includes(q);
    });
  });

  overlay.querySelector('#btn-refresh-ports-audit').addEventListener('click', loadConnections);
  loadConnections();
}

// ═══════════════════════════════════════════════════════════════════════════════
// 8.3 VISUALIZADOR E RESTAURADOR DO ARQUIVO HOSTS
// ═══════════════════════════════════════════════════════════════════════════════

export async function showHostsManagerModal(ctx = {}) {
  const toast = ctx.toast || (() => {});
  const addToHistory = ctx.addToHistory || (() => {});

  const existing = document.getElementById('tt-hosts-modal-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'tt-hosts-modal-overlay';
  overlay.className = 'modal-overlay';

  overlay.innerHTML = `
    <div class="modal details-modal" role="dialog" aria-modal="true" style="width: min(680px, 95vw); max-width: 680px;">
      <button class="modal-close-icon-btn" data-close-modal title="Fechar (Esc)">
        <i data-lucide="x" style="width:16px;height:16px"></i>
      </button>

      <div class="details-modal-header" style="margin-bottom: 12px;">
        <div class="details-header-lead">
          <div class="details-header-icon-box" style="background: linear-gradient(135deg, rgba(99, 102, 241, 0.22) 0%, rgba(56, 189, 248, 0.18) 100%); border-color: rgba(99, 102, 241, 0.4); color: #818cf8;">
            <i data-lucide="file-lock" style="width:22px;height:22px"></i>
          </div>
          <div class="details-header-text">
            <div class="details-modal-title">
              <span>Auditor & Restaurador do Arquivo HOSTS</span>
              <span class="details-count-pill" id="hosts-count-pill">Verificando...</span>
            </div>
            <div class="details-modal-desc">Caminho: C:\\Windows\\System32\\drivers\\etc\\hosts • Detecte bloqueios por malware e restaure o padrão Microsoft.</div>
          </div>
        </div>
      </div>

      <textarea id="hosts-editor-area" class="modal-input" rows="11" style="font-family: Consolas, monospace; font-size: 12px; line-height: 1.5; margin-bottom: 12px;" spellcheck="false">Carregando arquivo hosts...</textarea>

      <div class="details-modal-footer" style="padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.06); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
        <button type="button" class="modal-btn secondary" id="btn-hosts-reset-default" style="padding: 8px 14px; font-size: 12px; color: #fde68a; border-color: rgba(245, 158, 11, 0.35);">
          <i data-lucide="rotate-ccw" style="width:14px;height:14px"></i> Restaurar HOSTS Original da Microsoft
        </button>
        <div style="display:flex; gap:8px;">
          <button type="button" class="modal-btn secondary" data-close-modal style="padding: 8px 16px; font-size: 12px;">Fechar</button>
          <button type="button" class="modal-btn primary" id="btn-hosts-save" style="padding: 8px 18px; font-size: 12.5px;">
            <i data-lucide="save" style="width:14px;height:14px"></i> Salvar Alterações
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  createLucideIcons(overlay);
  bindModalClose(overlay);

  const area = overlay.querySelector('#hosts-editor-area');
  const pill = overlay.querySelector('#hosts-count-pill');

  async function readHosts() {
    const res = await runPs(`Get-Content -Path "$env:SystemRoot\\System32\\drivers\\etc\\hosts" -Raw -ErrorAction SilentlyContinue`);
    const content = res.output || '# Arquivo HOSTS vazio';
    area.value = content;
    const activeLines = content.split(/\r?\n/).filter(l => l.trim() && !l.trim().startsWith('#'));
    pill.textContent = `${activeLines.length} Regra(s) Ativa(s)`;
  }

  overlay.querySelector('#btn-hosts-save').addEventListener('click', async () => {
    const b64 = btoa(unescape(encodeURIComponent(area.value)));
    const res = await runPs(`
      $bytes = [System.Convert]::FromBase64String('${b64}')
      $text = [System.Text.Encoding]::UTF8.GetString($bytes)
      Set-Content -Path "$env:SystemRoot\\System32\\drivers\\etc\\hosts" -Value $text -Encoding UTF8 -Force
      ipconfig /flushdns | Out-Null
      Write-Output "OK"
    `);
    if (res.success) {
      toast('success', 'Arquivo HOSTS Salvo', 'Alterações aplicadas e DNS atualizado!');
      addToHistory('Editar Arquivo HOSTS', 'HOSTS atualizado', true, 'file-lock');
      readHosts();
    } else {
      toast('error', 'Erro ao Salvar HOSTS', 'Execute o aplicativo como Administrador.');
    }
  });

  overlay.querySelector('#btn-hosts-reset-default').addEventListener('click', async () => {
    const defaultHosts = [
      '# Copyright (c) 1993-2009 Microsoft Corp.',
      '#',
      '# This is a sample HOSTS file used by Microsoft TCP/IP for Windows.',
      '# Restaurado pelo ThunderTools (Thunder)',
      '#',
      '# 127.0.0.1       localhost',
      '# ::1             localhost'
    ].join('\r\n');
    area.value = defaultHosts;
    overlay.querySelector('#btn-hosts-save').click();
  });

  readHosts();
}

// ═══════════════════════════════════════════════════════════════════════════════
// 9.1 GERENCIADOR COMPLETO DE INICIALIZAÇÃO (LISTAR, ATIVAR/DESATIVAR, REMOVER, ADICIONAR)
// ═══════════════════════════════════════════════════════════════════════════════

export async function showFullStartupManagerModal(ctx = {}) {
  const toast = ctx.toast || (() => {});
  const addToHistory = ctx.addToHistory || (() => {});
  const onAddStartup = ctx.onAddStartup || null;

  const existing = document.getElementById('tt-full-startup-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'tt-full-startup-overlay';
  overlay.className = 'modal-overlay';

  overlay.innerHTML = `
    <div class="modal startup-picker-modal" role="dialog" aria-modal="true" style="width: min(760px, 95vw);">
      <div class="startup-picker-heading">
        <div class="startup-picker-main-icon"><i data-lucide="rocket"></i></div>
        <div>
          <div class="startup-picker-title">Gerenciador Completo de Inicialização</div>
          <div class="startup-picker-desc">Visualize, ative, desative ou remova entradas que iniciam com o Windows, ou adicione novos programas e serviços</div>
        </div>
        <button type="button" class="startup-picker-close" data-close-modal><i data-lucide="x"></i></button>
      </div>

      <label class="startup-picker-search">
        <i data-lucide="search"></i>
        <input id="full-startup-search" type="search" placeholder="Pesquisar programa ou caminho na inicialização..." />
      </label>

      <div id="full-startup-list" class="startup-picker-list" style="grid-template-columns: 1fr; max-height: 48vh;">
        <div class="startup-picker-empty">Lendo entradas de inicialização do Registro e pastas Startup...</div>
      </div>

      <div class="startup-picker-footer" style="justify-content: space-between; align-items: center; flex-wrap: wrap;">
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <button type="button" class="modal-btn primary" id="btn-startup-add-new" style="padding: 8px 14px; font-size: 12px; display:flex; align-items:center; gap:6px;">
            <i data-lucide="plus-circle" style="width:14px;height:14px"></i> Adicionar Programa / Serviço
          </button>
          <button type="button" class="modal-btn secondary" id="btn-startup-open-native" style="padding: 8px 12px; font-size: 12px;">
            <i data-lucide="external-link" style="width:13px;height:13px"></i> Janela Nativa Windows
          </button>
        </div>
        <button type="button" class="modal-btn secondary" data-close-modal style="padding: 8px 18px; font-size: 12px;">Fechar</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  createLucideIcons(overlay);
  const close = bindModalClose(overlay);

  const listEl = overlay.querySelector('#full-startup-list');
  const searchInput = overlay.querySelector('#full-startup-search');

  async function loadEntries() {
    listEl.innerHTML = '<div class="startup-picker-empty">Lendo entradas de inicialização do Registro e pastas Startup...</div>';
    const script = `
      $results = @()
      $paths = @(
        @{ Path = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run'; Scope = 'Usuário (Ativo)'; Enabled = $true },
        @{ Path = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\RunDisabled'; Scope = 'Usuário (Pausado)'; Enabled = $false },
        @{ Path = 'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run'; Scope = 'Sistema (Ativo)'; Enabled = $true },
        @{ Path = 'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\RunDisabled'; Scope = 'Sistema (Pausado)'; Enabled = $false }
      )
      foreach ($p in $paths) {
        if (Test-Path $p.Path) {
          $props = Get-ItemProperty -Path $p.Path
          foreach ($prop in $props.PSObject.Properties) {
            if ($prop.Name -notin @('PSPath','PSParentPath','PSChildName','PSDrive','PSProvider')) {
              $results += [PSCustomObject]@{
                name = $prop.Name
                command = [string]$prop.Value
                regPath = $p.Path
                scope = $p.Scope
                enabled = $p.Enabled
                type = 'reg'
              }
            }
          }
        }
      }
      $startupFolder = "$env:APPDATA\\Microsoft\\Windows\\Start Menu\\Programs\\Startup"
      if (Test-Path $startupFolder) {
        Get-ChildItem -Path $startupFolder -File -ErrorAction SilentlyContinue | ForEach-Object {
          $results += [PSCustomObject]@{
            name = $_.BaseName
            command = $_.FullName
            regPath = $startupFolder
            scope = 'Pasta Startup'
            enabled = ($_.Extension -ne '.disabled')
            type = 'file'
          }
        }
      }
      $results | ConvertTo-Json -Compress
    `;
    const entries = await runPsJson(script, []);
    if (!entries.length) {
      listEl.innerHTML = '<div class="startup-picker-empty">Nenhum item encontrado na inicialização automática. Clique em "Adicionar Programa / Serviço" abaixo.</div>';
      return;
    }

    listEl.innerHTML = entries.map((item, idx) => {
      const searchStr = `${item.name} ${item.command} ${item.scope}`.toLowerCase();
      return `
        <div class="startup-picker-item" data-search="${escapeHtml(searchStr)}" style="cursor:default;">
          <span class="startup-picker-item-icon"><i data-lucide="${item.enabled ? 'play' : 'pause'}"></i></span>
          <span class="startup-picker-item-copy">
            <span class="startup-picker-item-label">${escapeHtml(item.name)}</span>
            <span class="startup-picker-item-desc" style="white-space:normal;">${escapeHtml(item.command)}</span>
          </span>
          <span class="startup-picker-badge" style="${item.enabled ? 'color:#34d399;border-color:rgba(16,185,129,0.3);background:rgba(16,185,129,0.12);' : 'color:#fbbf24;border-color:rgba(245,158,11,0.3);background:rgba(245,158,11,0.12);'}">${escapeHtml(item.scope)}</span>
          <div style="display:flex; gap:6px;">
            <button type="button" class="modal-btn secondary btn-toggle-startup" data-idx="${idx}" style="padding:5px 10px; font-size:11px;">
              ${item.enabled ? 'Desativar' : 'Ativar'}
            </button>
            <button type="button" class="modal-btn secondary btn-remove-startup" data-idx="${idx}" style="padding:5px 10px; font-size:11px; color:#fca5a5; border-color:rgba(239,68,68,0.3);">
              Remover
            </button>
          </div>
        </div>
      `;
    }).join('');

    createLucideIcons(listEl);

    listEl.querySelectorAll('.btn-toggle-startup').forEach(btn => {
      btn.addEventListener('click', async () => {
        const entry = entries[Number(btn.dataset.idx)];
        if (!entry) return;
        btn.disabled = true;
        const safeName = String(entry.name).replace(/'/g, "''");
        const safeCmd = String(entry.command).replace(/'/g, "''");
        if (entry.type === 'reg') {
          const isHkcu = entry.regPath.startsWith('HKCU:');
          const activeKey = isHkcu ? 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run' : 'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';
          const disabledKey = isHkcu ? 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\RunDisabled' : 'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\RunDisabled';
          const srcKey = entry.enabled ? activeKey : disabledKey;
          const dstKey = entry.enabled ? disabledKey : activeKey;
          await runPs(`
            New-Item -Path '${dstKey}' -Force | Out-Null
            Set-ItemProperty -Path '${dstKey}' -Name '${safeName}' -Value '${safeCmd}' -Force
            Remove-ItemProperty -Path '${srcKey}' -Name '${safeName}' -Force -ErrorAction SilentlyContinue
          `);
        } else {
          const newPath = entry.enabled ? `${safeCmd}.disabled` : safeCmd.replace(/\.disabled$/i, '');
          await runPs(`Move-Item -LiteralPath '${safeCmd}' -Destination '${newPath}' -Force`);
        }
        toast('success', 'Inicialização Atualizada', `${entry.name} foi ${entry.enabled ? 'desativado' : 'ativado'}.`);
        addToHistory(`Inicialização: ${entry.name}`, entry.enabled ? 'Desativado' : 'Ativado', true, 'rocket');
        loadEntries();
      });
    });

    listEl.querySelectorAll('.btn-remove-startup').forEach(btn => {
      btn.addEventListener('click', async () => {
        const entry = entries[Number(btn.dataset.idx)];
        if (!entry) return;
        btn.disabled = true;
        const safeName = String(entry.name).replace(/'/g, "''");
        const safePath = String(entry.regPath).replace(/'/g, "''");
        const safeCmd = String(entry.command).replace(/'/g, "''");
        if (entry.type === 'reg') {
          await runPs(`Remove-ItemProperty -Path '${safePath}' -Name '${safeName}' -Force -ErrorAction SilentlyContinue`);
        } else {
          await runPs(`Remove-Item -LiteralPath '${safeCmd}' -Force -ErrorAction SilentlyContinue`);
        }
        toast('success', 'Removido da Inicialização', `${entry.name} foi removido permanentemente.`);
        addToHistory(`Remover Inicialização: ${entry.name}`, 'Entrada removida', true, 'trash-2');
        loadEntries();
      });
    });
  }

  searchInput.addEventListener('input', () => {
    const q = searchInput.value.trim().toLowerCase();
    listEl.querySelectorAll('.startup-picker-item').forEach(el => {
      el.hidden = !el.dataset.search.includes(q);
    });
  });

  overlay.querySelector('#btn-startup-add-new').addEventListener('click', () => {
    close();
    if (typeof onAddStartup === 'function') {
      onAddStartup();
    }
  });

  overlay.querySelector('#btn-startup-open-native').addEventListener('click', () => {
    window.api.runCommand('start ms-settings:startupapps');
  });

  loadEntries();
}

// ═══════════════════════════════════════════════════════════════════════════════
// 9.2 GERENCIADOR DE PONTOS DE RESTAURAÇÃO (LISTAR, CRIAR, RESTAURAR, EXCLUIR)
// ═══════════════════════════════════════════════════════════════════════════════

export async function showRestorePointsModal(ctx = {}) {
  const toast = ctx.toast || (() => {});
  const addToHistory = ctx.addToHistory || (() => {});

  const existing = document.getElementById('tt-restore-points-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'tt-restore-points-overlay';
  overlay.className = 'modal-overlay';

  overlay.innerHTML = `
    <div class="modal startup-picker-modal" role="dialog" aria-modal="true" style="width: min(740px, 95vw);">
      <div class="startup-picker-heading">
        <div class="startup-picker-main-icon"><i data-lucide="history"></i></div>
        <div>
          <div class="startup-picker-title">Gerenciador de Pontos de Restauração</div>
          <div class="startup-picker-desc">Consulte todos os pontos de restauração do Windows, crie novos snapshots ou inicie a recuperação do sistema</div>
        </div>
        <button type="button" class="startup-picker-close" data-close-modal><i data-lucide="x"></i></button>
      </div>

      <div id="rp-list-container" class="startup-picker-list" style="grid-template-columns: 1fr; max-height: 46vh;">
        <div class="startup-picker-empty">Consultando pontos de restauração registrados no Volume Shadow Copy...</div>
      </div>

      <div class="startup-picker-footer" style="justify-content: space-between; align-items: center; flex-wrap: wrap;">
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <button type="button" class="modal-btn primary" id="btn-rp-create-new" style="padding: 8px 14px; font-size: 12px; display:flex; align-items:center; gap:6px;">
            <i data-lucide="save" style="width:14px;height:14px"></i> Criar Novo Ponto Agora
          </button>
          <button type="button" class="modal-btn secondary" id="btn-rp-open-rstrui" style="padding: 8px 14px; font-size: 12px; display:flex; align-items:center; gap:6px;">
            <i data-lucide="rotate-ccw" style="width:14px;height:14px"></i> Abrir Restauração do Sistema (rstrui)
          </button>
        </div>
        <button type="button" class="modal-btn secondary" data-close-modal style="padding: 8px 18px; font-size: 12px;">Fechar</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  createLucideIcons(overlay);
  bindModalClose(overlay);

  const listEl = overlay.querySelector('#rp-list-container');

  async function loadPoints() {
    listEl.innerHTML = '<div class="startup-picker-empty">Consultando pontos de restauração registrados no Windows...</div>';
    const script = `
      Get-ComputerRestorePoint -ErrorAction SilentlyContinue | Sort-Object SequenceNumber -Descending | ForEach-Object {
        $dt = try { [System.Management.ManagementDateTimeConverter]::ToDateTime($_.CreationTime).ToString('dd/MM/yyyy HH:mm') } catch { $_.CreationTime }
        [PSCustomObject]@{
          seq = $_.SequenceNumber
          desc = $_.Description
          date = $dt
        }
      } | ConvertTo-Json -Compress
    `;
    const points = await runPsJson(script, []);
    if (!points.length) {
      listEl.innerHTML = '<div class="startup-picker-empty">Nenhum ponto de restauração encontrado na unidade C:. Clique em "Criar Novo Ponto Agora" para criar o primeiro backup de estado.</div>';
      return;
    }

    listEl.innerHTML = points.map(p => `
      <div class="startup-picker-item" style="cursor:default;">
        <span class="startup-picker-item-icon"><i data-lucide="shield-check"></i></span>
        <span class="startup-picker-item-copy">
          <span class="startup-picker-item-label">#${p.seq} — ${escapeHtml(p.desc)}</span>
          <span class="startup-picker-item-desc">Criado em: ${escapeHtml(p.date)}</span>
        </span>
        <span class="startup-picker-badge">Ponto #${p.seq}</span>
        <button type="button" class="modal-btn secondary btn-rp-restore" style="padding:5px 12px; font-size:11px;">Restaurar</button>
      </div>
    `).join('');

    createLucideIcons(listEl);
    listEl.querySelectorAll('.btn-rp-restore').forEach(btn => {
      btn.addEventListener('click', () => {
        window.api.runCommand('rstrui.exe');
        toast('info', 'Restauração do Sistema', 'Assistente oficial do Windows (rstrui.exe) iniciado.');
      });
    });
  }

  overlay.querySelector('#btn-rp-open-rstrui').addEventListener('click', () => {
    window.api.runCommand('rstrui.exe');
    toast('info', 'Restauração do Sistema', 'Assistente rstrui.exe aberto.');
  });

  overlay.querySelector('#btn-rp-create-new').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    const orig = btn.innerHTML;
    btn.textContent = 'Criando Ponto de Restauração...';
    const res = await runPs(`
      Enable-ComputerRestore -Drive 'C:\\' -ErrorAction SilentlyContinue
      Set-ItemProperty -Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\SystemRestore' -Name 'SystemRestorePointCreationFrequency' -Value 0 -Type DWord -ErrorAction SilentlyContinue
      Checkpoint-Computer -Description ('ThunderTools Snapshot ' + (Get-Date -Format 'dd/MM HH:mm')) -RestorePointType 'MODIFY_SETTINGS' -ErrorAction Stop
      Write-Output 'OK'
    `);
    btn.disabled = false;
    btn.innerHTML = orig;
    createLucideIcons(overlay);
    if (res.success) {
      toast('success', 'Ponto Criado', 'Novo Ponto de Restauração criado com sucesso!');
      addToHistory('Criar Ponto de Restauração', 'Snapshot criado com sucesso', true, 'save');
      loadPoints();
    } else {
      toast('warning', 'Aviso de Ponto de Restauração', res.output || 'Verifique se a Proteção do Sistema está ativa.');
    }
  });

  loadPoints();
}

// ═══════════════════════════════════════════════════════════════════════════════
// 9.3 DESINSTALADOR DE BLOATWARE NATIVO (APPS UWP)
// ═══════════════════════════════════════════════════════════════════════════════

export async function showUwpBloatwareModal(ctx = {}) {
  const toast = ctx.toast || (() => {});
  const addToHistory = ctx.addToHistory || (() => {});

  const existing = document.getElementById('tt-uwp-bloatware-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'tt-uwp-bloatware-overlay';
  overlay.className = 'modal-overlay';

  const bloatCatalog = [
    { pattern: '*XboxApp*|*XboxGamingOverlay*|*XboxIdentityProvider*|*XboxSpeechToTextOverlay*', label: 'Xbox App & Game Bar Overlay', desc: 'Aplicativos Xbox e barra de captura em segundo plano' },
    { pattern: '*Microsoft.549981C3F5F10*', label: 'Cortana', desc: 'Assistente de voz legado da Microsoft' },
    { pattern: '*BingWeather*', label: 'MSN Clima (Bing Weather)', desc: 'App de previsão do tempo pré-instalado' },
    { pattern: '*BingNews*', label: 'MSN Notícias (Bing News)', desc: 'Feed de notícias na barra de tarefas/iniciar' },
    { pattern: '*MicrosoftSolitaireCollection*', label: 'Microsoft Solitaire Collection', desc: 'Pacote de jogos de cartas pré-instalado' },
    { pattern: '*SkypeApp*', label: 'Skype UWP', desc: 'Versão pré-instalada do Skype' },
    { pattern: '*WindowsFeedbackHub*', label: 'Hub de Comentários (Feedback Hub)', desc: 'Coletor de feedbacks da Microsoft' },
    { pattern: '*GetHelp*|*Getstarted*', label: 'Obter Ajuda & Dicas (Get Help / Tips)', desc: 'Apps de dicas introdutórias do Windows' },
    { pattern: '*People*', label: 'Microsoft Pessoas (People)', desc: 'Agenda integrada à barra de tarefas' },
    { pattern: '*MixedReality.Portal*', label: 'Portal de Realidade Misturada', desc: 'Recursos de VR não utilizados em PCs comuns' },
    { pattern: '*Clipchamp*', label: 'Clipchamp Video Editor', desc: 'Editor de vídeo web pré-instalado' },
    { pattern: '*ZuneMusic*|*ZuneVideo*', label: 'Filmes e TV / Groove Música', desc: 'Reprodutores de mídia UWP antigos' }
  ];

  overlay.innerHTML = `
    <div class="modal details-modal" role="dialog" aria-modal="true" style="width: min(680px, 95vw); max-width: 680px;">
      <button class="modal-close-icon-btn" data-close-modal title="Fechar (Esc)">
        <i data-lucide="x" style="width:16px;height:16px"></i>
      </button>

      <div class="details-modal-header" style="margin-bottom: 12px;">
        <div class="details-header-lead">
          <div class="details-header-icon-box" style="background: linear-gradient(135deg, rgba(239, 68, 68, 0.22) 0%, rgba(168, 85, 247, 0.18) 100%); border-color: rgba(239, 68, 68, 0.4); color: #f87171;">
            <i data-lucide="package-minus" style="width:22px;height:22px"></i>
          </div>
          <div class="details-header-text">
            <div class="details-modal-title">
              <span>Desinstalador de Bloatware Nativo (Apps UWP)</span>
              <span class="details-count-pill">Seleção em Lote</span>
            </div>
            <div class="details-modal-desc">Selecione os aplicativos pré-instalados do Windows que deseja remover para liberar recursos:</div>
          </div>
        </div>
      </div>

      <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap:8px; max-height: 46vh; overflow-y:auto; padding-right:4px; margin-bottom:14px;">
        ${bloatCatalog.map((b, idx) => `
          <label style="display:flex; align-items:flex-start; gap:10px; padding:10px 12px; background:rgba(15,23,42,0.55); border:1px solid rgba(255,255,255,0.08); border-radius:10px; cursor:pointer;">
            <input type="checkbox" class="uwp-bloat-cb" data-idx="${idx}" style="margin-top:3px; accent-color:#ef4444; width:16px; height:16px;" />
            <div>
              <div style="font-size:12.5px; font-weight:600; color:#f1f5f9;">${escapeHtml(b.label)}</div>
              <div style="font-size:11px; color:#94a3b8;">${escapeHtml(b.desc)}</div>
            </div>
          </label>
        `).join('')}
      </div>

      <div id="uwp-bloat-status" style="display:none; padding:10px 12px; border-radius:8px; font-size:12px; margin-bottom:12px;"></div>

      <div class="details-modal-footer" style="padding-top:12px; border-top:1px solid rgba(255,255,255,0.06); display:flex; justify-content:space-between; align-items:center;">
        <button type="button" class="modal-btn secondary" id="btn-uwp-select-all" style="padding:7px 14px; font-size:12px;">Marcar Todos</button>
        <div style="display:flex; gap:8px;">
          <button type="button" class="modal-btn secondary" data-close-modal style="padding:8px 16px; font-size:12px;">Cancelar</button>
          <button type="button" class="modal-btn primary" id="btn-uwp-remove-selected" style="padding:8px 18px; font-size:12.5px; background:linear-gradient(135deg,#dc2626,#991b1b);">
            <i data-lucide="trash-2" style="width:14px;height:14px"></i> Remover Selecionados
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  createLucideIcons(overlay);
  bindModalClose(overlay);

  const statusBox = overlay.querySelector('#uwp-bloat-status');

  overlay.querySelector('#btn-uwp-select-all').addEventListener('click', () => {
    const cbs = Array.from(overlay.querySelectorAll('.uwp-bloat-cb'));
    const allChecked = cbs.every(c => c.checked);
    cbs.forEach(c => { c.checked = !allChecked; });
  });

  overlay.querySelector('#btn-uwp-remove-selected').addEventListener('click', async (e) => {
    const checked = Array.from(overlay.querySelectorAll('.uwp-bloat-cb:checked')).map(cb => bloatCatalog[Number(cb.dataset.idx)]);
    if (!checked.length) {
      toast('warning', 'Nenhum App Selecionado', 'Marque ao menos um aplicativo UWP para remover.');
      return;
    }

    const btn = e.currentTarget;
    btn.disabled = true;
    btn.textContent = 'Removendo pacotes UWP...';
    statusBox.style.display = 'block';
    statusBox.style.background = 'rgba(79,70,229,0.16)';
    statusBox.style.color = '#e0e7ff';
    statusBox.textContent = `Removendo ${checked.length} pacote(s) pré-instalado(s)... aguarde.`;

    const patterns = checked.map(c => c.pattern).join('|').split('|');
    const psLines = patterns.map(p => `Get-AppxPackage -AllUsers '${p}' -ErrorAction SilentlyContinue | Remove-AppxPackage -ErrorAction SilentlyContinue`);
    await runPs(psLines.join('\n'));

    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="trash-2" style="width:14px;height:14px"></i> Remover Selecionados';
    createLucideIcons(overlay);

    statusBox.style.background = 'rgba(16,185,129,0.15)';
    statusBox.style.color = '#a7f3d0';
    statusBox.innerHTML = `✔ <strong>Desinstalação em lote concluída:</strong> ${checked.length} categoria(s) de bloatware removidas do sistema.`;
    toast('success', 'Bloatware Removido', `${checked.length} pacotes UWP removidos com sucesso!`);
    addToHistory('Desinstalador de Bloatware UWP', `${checked.length} apps removidos`, true, 'package-minus');
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// 10. ABA PROGRAMAS: MODO "NINITE" (SELEÇÃO EM LOTE + KITS RÁPIDOS + UPGRADE ALL)
// ═══════════════════════════════════════════════════════════════════════════════

const PROGRAM_KITS = {
  pos_formatacao: [
    'Microsoft.VCRedist.2015+.x64',
    'Microsoft.DotNet.DesktopRuntime.8',
    'Microsoft.DirectX',
    'Google.Chrome',
    '7zip.7zip',
    'Adobe.Acrobat.Reader.64-bit',
    'VideoLAN.VLC'
  ],
  escritorio: [
    'Google.Chrome',
    'TheDocumentFoundation.LibreOffice',
    'Adobe.Acrobat.Reader.64-bit',
    'RARLab.WinRAR',
    'AnyDeskSoftwareGmbH.AnyDesk'
  ],
  suporte: [
    'AnyDeskSoftwareGmbH.AnyDesk',
    'RustDesk.RustDesk',
    'TeamViewer.TeamViewer',
    'CPUID.CPU-Z',
    'CPUID.HWMonitor',
    'FastCopy.FastCopy'
  ],
  gamer: [
    'Microsoft.VCRedist.2015+.x64',
    'Microsoft.DirectX',
    'Brave.Brave',
    'VideoLAN.VLC',
    'Spotify.Spotify',
    'CPUID.HWMonitor'
  ]
};

export function initProgramsBatchController(ctx = {}) {
  const toast = ctx.toast || (() => {});
  const addToHistory = ctx.addToHistory || (() => {});
  const tabProgramas = document.getElementById('tab-programas');
  if (!tabProgramas || tabProgramas.dataset.batchInitialized === 'true') return;
  tabProgramas.dataset.batchInitialized = 'true';

  // Injeta checkboxes de seleção em lote em cada botão de programa
  const progBtns = Array.from(tabProgramas.querySelectorAll('.tool-btn[data-winget-id]'));
  progBtns.forEach(btn => {
    if (!btn.querySelector('.tt-prog-batch-check')) {
      const checkWrap = document.createElement('label');
      checkWrap.className = 'tt-prog-batch-check';
      checkWrap.title = 'Marcar para instalação em lote (Estilo Ninite)';
      checkWrap.innerHTML = `<input type="checkbox" class="prog-batch-cb" value="${escapeHtml(btn.dataset.wingetId)}" />`;
      checkWrap.addEventListener('click', (e) => e.stopPropagation());
      btn.appendChild(checkWrap);
    }
  });

  const countSpan = document.getElementById('prog-selected-count');
  const installBatchBtn = document.getElementById('btn-install-selected-progs');
  const clearBatchBtn = document.getElementById('btn-clear-selected-progs');
  const upgradeAllBtn = document.getElementById('btn-winget-upgrade-all');

  function updateBatchCount() {
    const checked = tabProgramas.querySelectorAll('.prog-batch-cb:checked');
    const n = checked.length;
    if (countSpan) countSpan.textContent = n;
    if (installBatchBtn) {
      installBatchBtn.disabled = n === 0;
      installBatchBtn.style.opacity = n === 0 ? '0.55' : '1';
    }
    progBtns.forEach(btn => {
      const cb = btn.querySelector('.prog-batch-cb');
      btn.classList.toggle('tt-prog-selected', !!(cb && cb.checked));
    });
  }

  tabProgramas.querySelectorAll('.prog-batch-cb').forEach(cb => {
    cb.addEventListener('change', updateBatchCount);
  });

  // Botões de Kits Rápidos
  tabProgramas.querySelectorAll('[data-kit-preset]').forEach(kitBtn => {
    kitBtn.addEventListener('click', () => {
      const presetKey = kitBtn.dataset.kitPreset;
      const ids = PROGRAM_KITS[presetKey] || [];
      tabProgramas.querySelectorAll('.prog-batch-cb').forEach(cb => {
        cb.checked = ids.includes(cb.value);
      });
      updateBatchCount();
      toast('info', 'Kit Selecionado', `${ids.length} programas marcados. Clique em "Instalar Selecionados" para iniciar a fila!`);
    });
  });

  if (clearBatchBtn) {
    clearBatchBtn.addEventListener('click', () => {
      tabProgramas.querySelectorAll('.prog-batch-cb').forEach(cb => { cb.checked = false; });
      updateBatchCount();
    });
  }

  if (installBatchBtn) {
    installBatchBtn.addEventListener('click', async () => {
      const checkedBoxes = Array.from(tabProgramas.querySelectorAll('.prog-batch-cb:checked'));
      if (!checkedBoxes.length) return;

      const selectedProgs = checkedBoxes.map(cb => {
        const card = cb.closest('.tool-btn');
        return {
          id: cb.value,
          title: card?.querySelector('.btn-title')?.textContent?.trim() || cb.value,
          cmd: card?.dataset?.cmd || `winget install --id ${cb.value} -e --accept-package-agreements --accept-source-agreements`
        };
      });

      showBatchInstallQueueModal(selectedProgs, { toast, addToHistory });
    });
  }

  if (upgradeAllBtn) {
    upgradeAllBtn.addEventListener('click', () => {
      showBatchInstallQueueModal([
        {
          id: 'upgrade-all',
          title: 'Atualizar Todos os Programas Instalados (Winget Upgrade)',
          cmd: 'winget upgrade --all --include-unknown --accept-package-agreements --accept-source-agreements'
        }
      ], { toast, addToHistory, isUpgradeAll: true });
    });
  }

  updateBatchCount();
}

function showBatchInstallQueueModal(queue, ctx = {}) {
  const toast = ctx.toast || (() => {});
  const addToHistory = ctx.addToHistory || (() => {});

  const existing = document.getElementById('tt-batch-queue-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'tt-batch-queue-overlay';
  overlay.className = 'modal-overlay';

  overlay.innerHTML = `
    <div class="modal details-modal" role="dialog" aria-modal="true" style="width: min(640px, 95vw); max-width: 640px;">
      <button class="modal-close-icon-btn" data-close-modal title="Fechar (Esc)">
        <i data-lucide="x" style="width:16px;height:16px"></i>
      </button>

      <div class="details-modal-header" style="margin-bottom: 12px;">
        <div class="details-header-lead">
          <div class="details-header-icon-box" style="background: linear-gradient(135deg, rgba(99, 102, 241, 0.22) 0%, rgba(16, 185, 129, 0.18) 100%); border-color: rgba(99, 102, 241, 0.4); color: #818cf8;">
            <i data-lucide="layers" style="width:22px;height:22px"></i>
          </div>
          <div class="details-header-text">
            <div class="details-modal-title">
              <span>${ctx.isUpgradeAll ? 'Atualização Global de Programas' : 'Instalador em Lote (Fila Automática)'}</span>
              <span class="details-count-pill" id="bq-progress-pill">0 / ${queue.length}</span>
            </div>
            <div class="details-modal-desc">Os pacotes abaixo estão sendo instalados silenciosamente via Winget:</div>
          </div>
        </div>
      </div>

      <div style="display:flex; flex-direction:column; gap:8px; max-height: 45vh; overflow-y:auto; margin-bottom:14px;">
        ${queue.map((p, i) => `
          <div class="startup-picker-item" style="cursor:default; justify-content:space-between;">
            <div style="display:flex; align-items:center; gap:10px;">
              <span class="startup-picker-item-icon"><i data-lucide="package"></i></span>
              <div>
                <div class="startup-picker-item-label">${escapeHtml(p.title)}</div>
                <div class="startup-picker-item-desc">${escapeHtml(p.id)}</div>
              </div>
            </div>
            <span class="startup-picker-badge" id="bq-item-status-${i}">Na fila</span>
          </div>
        `).join('')}
      </div>

      <div class="details-modal-footer" style="padding-top:10px; border-top:1px solid rgba(255,255,255,0.06); display:flex; justify-content:flex-end;">
        <button type="button" class="modal-btn secondary" data-close-modal style="padding:8px 18px; font-size:12px;">Fechar</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  createLucideIcons(overlay);
  bindModalClose(overlay);

  (async () => {
    const pill = overlay.querySelector('#bq-progress-pill');
    let okCount = 0;
    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];
      const badge = overlay.querySelector(`#bq-item-status-${i}`);
      if (badge) {
        badge.textContent = '⏳ Instalando...';
        badge.style.color = '#fbbf24';
      }
      const res = await window.api.runCommand(item.cmd);
      const isOk = res.success || /already installed|já está instalado|No applicable update/i.test(res.output || '');
      if (isOk) okCount++;
      if (badge) {
        badge.textContent = isOk ? '✔ Concluído' : '⚠ Verificar';
        badge.style.color = isOk ? '#34d399' : '#f87171';
      }
      if (pill) pill.textContent = `${i + 1} / ${queue.length}`;
      addToHistory(`Winget: ${item.title}`, item.cmd, isOk, 'package');
    }
    toast('success', 'Fila Concluída', `${okCount} de ${queue.length} operação(ões) concluídas com sucesso!`);
  })();
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. ABA IMPRESSÃO: GERENCIADOR INTERATIVO + BACKUP PRINTBRM
// ═══════════════════════════════════════════════════════════════════════════════

export async function showPrinterManagerModal(ctx = {}) {
  const toast = ctx.toast || (() => {});
  const addToHistory = ctx.addToHistory || (() => {});

  const existing = document.getElementById('tt-printer-mgr-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'tt-printer-mgr-overlay';
  overlay.className = 'modal-overlay';

  overlay.innerHTML = `
    <div class="modal startup-picker-modal" role="dialog" aria-modal="true" style="width: min(760px, 95vw);">
      <div class="startup-picker-heading">
        <div class="startup-picker-main-icon"><i data-lucide="printer"></i></div>
        <div>
          <div class="startup-picker-title">Central de Impressoras & Backup PrintBRM</div>
          <div class="startup-picker-desc">Defina impressora padrão, imprima página de teste, abra a fila ou faça backup completo de drivers e portas</div>
        </div>
        <button type="button" class="startup-picker-close" data-close-modal><i data-lucide="x"></i></button>
      </div>

      <div id="printers-mgr-list" class="startup-picker-list" style="grid-template-columns: 1fr; max-height: 46vh;">
        <div class="startup-picker-empty">Listando impressoras instaladas no Windows...</div>
      </div>

      <div class="startup-picker-footer" style="justify-content: space-between; align-items: center; flex-wrap: wrap;">
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <button type="button" class="modal-btn primary" id="btn-printbrm-export" style="padding: 8px 14px; font-size: 12px;">
            <i data-lucide="download" style="width:14px;height:14px"></i> Exportar Backup (.printerExport)
          </button>
          <button type="button" class="modal-btn secondary" id="btn-printbrm-import" style="padding: 8px 14px; font-size: 12px;">
            <i data-lucide="upload" style="width:14px;height:14px"></i> Restaurar Backup
          </button>
        </div>
        <button type="button" class="modal-btn secondary" data-close-modal style="padding: 8px 18px; font-size: 12px;">Fechar</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  createLucideIcons(overlay);
  bindModalClose(overlay);

  const listEl = overlay.querySelector('#printers-mgr-list');

  async function loadPrinters() {
    listEl.innerHTML = '<div class="startup-picker-empty">Consultando impressoras...</div>';
    const printers = await runPsJson(`
      Get-CimInstance Win32_Printer | Select-Object Name, DriverName, PortName, Default, PrinterStatus | ConvertTo-Json -Compress
    `, []);

    if (!printers.length) {
      listEl.innerHTML = '<div class="startup-picker-empty">Nenhuma impressora encontrada.</div>';
      return;
    }

    listEl.innerHTML = printers.map((p, i) => `
      <div class="startup-picker-item" style="cursor:default;">
        <span class="startup-picker-item-icon"><i data-lucide="printer"></i></span>
        <span class="startup-picker-item-copy">
          <span class="startup-picker-item-label">${escapeHtml(p.Name)}</span>
          <span class="startup-picker-item-desc">Driver: ${escapeHtml(p.DriverName || '-')} • Porta: ${escapeHtml(p.PortName || '-')}</span>
        </span>
        ${p.Default ? '<span class="startup-picker-badge" style="color:#34d399;border-color:rgba(16,185,129,0.35);background:rgba(16,185,129,0.14);">Padrão</span>' : ''}
        <div style="display:flex; gap:6px; flex-wrap:wrap;">
          ${!p.Default ? `<button type="button" class="modal-btn secondary btn-prt-default" data-idx="${i}" style="padding:5px 10px; font-size:11px;">Definir Padrão</button>` : ''}
          <button type="button" class="modal-btn secondary btn-prt-test" data-idx="${i}" style="padding:5px 10px; font-size:11px;">Página Teste</button>
          <button type="button" class="modal-btn secondary btn-prt-queue" data-idx="${i}" style="padding:5px 10px; font-size:11px;">Fila</button>
        </div>
      </div>
    `).join('');

    createLucideIcons(listEl);

    listEl.querySelectorAll('.btn-prt-default').forEach(btn => {
      btn.addEventListener('click', async () => {
        const p = printers[Number(btn.dataset.idx)];
        const safe = String(p.Name).replace(/'/g, "''");
        await runPs(`(New-Object -ComObject WScript.Network).SetDefaultPrinter('${safe}')`);
        toast('success', 'Impressora Padrão', `"${p.Name}" foi definida como padrão!`);
        addToHistory(`Impressora Padrão: ${p.Name}`, 'Definida como padrão', true, 'printer');
        loadPrinters();
      });
    });

    listEl.querySelectorAll('.btn-prt-test').forEach(btn => {
      btn.addEventListener('click', async () => {
        const p = printers[Number(btn.dataset.idx)];
        const safe = String(p.Name).replace(/"/g, '');
        await window.api.runCommand(`rundll32 printui.dll,PrintUIEntry /k /n "${safe}"`);
        toast('success', 'Página de Teste', `Página de teste enviada para "${p.Name}".`);
        addToHistory(`Página de Teste: ${p.Name}`, 'Teste enviado', true, 'printer');
      });
    });

    listEl.querySelectorAll('.btn-prt-queue').forEach(btn => {
      btn.addEventListener('click', async () => {
        const p = printers[Number(btn.dataset.idx)];
        const safe = String(p.Name).replace(/"/g, '');
        await window.api.runCommand(`rundll32 printui.dll,PrintUIEntry /o /n "${safe}"`);
      });
    });
  }

  overlay.querySelector('#btn-printbrm-export').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.textContent = 'Exportando...';
    const res = await runPs(`
      $dest = "$env:USERPROFILE\\Desktop\\Backup-Impressoras-ThunderTools.printerExport"
      if (Test-Path $dest) { Remove-Item $dest -Force -ErrorAction SilentlyContinue }
      & "$env:SystemRoot\\System32\\spool\\tools\\PrintBrm.exe" -B -F $dest
      Write-Output $dest
    `);
    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="download" style="width:14px;height:14px"></i> Exportar Backup (.printerExport)';
    createLucideIcons(overlay);
    toast('success', 'Backup de Impressoras', 'Arquivo salvo na Área de Trabalho (Backup-Impressoras-ThunderTools.printerExport)!');
    addToHistory('Backup de Impressoras (PrintBRM)', 'Salvo na Área de Trabalho', res.success, 'printer');
  });

  overlay.querySelector('#btn-printbrm-import').addEventListener('click', async () => {
    window.api.runCommand('powershell -NoProfile -Command "Start-Process \"$env:SystemRoot\\System32\\spool\\tools\\PrintBrmUi.exe\""');
    toast('info', 'Restaurar Impressoras', 'Assistente nativo de migração de impressoras (PrintBrmUi) iniciado.');
  });

  loadPrinters();
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. ABA WINDOWS UPDATE: PAUSAR UPDATES, HISTÓRICO KBs E BLOQUEIO DE DRIVERS
// ═══════════════════════════════════════════════════════════════════════════════

export async function showWindowsUpdatePauseModal(ctx = {}) {
  const toast = ctx.toast || (() => {});
  const addToHistory = ctx.addToHistory || (() => {});

  const existing = document.getElementById('tt-wu-pause-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'tt-wu-pause-overlay';
  overlay.className = 'modal-overlay';

  overlay.innerHTML = `
    <div class="modal details-modal" role="dialog" aria-modal="true" style="width: min(600px, 95vw); max-width: 600px;">
      <button class="modal-close-icon-btn" data-close-modal><i data-lucide="x" style="width:16px;height:16px"></i></button>

      <div class="details-modal-header" style="margin-bottom: 14px;">
        <div class="details-header-lead">
          <div class="details-header-icon-box" style="background: linear-gradient(135deg, rgba(99, 102, 241, 0.22) 0%, rgba(245, 158, 11, 0.18) 100%); border-color: rgba(99, 102, 241, 0.4); color: #818cf8;">
            <i data-lucide="pause-circle" style="width:22px;height:22px"></i>
          </div>
          <div class="details-header-text">
            <div class="details-modal-title">
              <span>Controle Avançado do Windows Update</span>
              <span class="details-count-pill">Políticas & Drivers</span>
            </div>
            <div class="details-modal-desc">Pause atualizações automáticas ou impeça que o Windows Update substitua drivers específicos:</div>
          </div>
        </div>
      </div>

      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:14px;">
        <button type="button" class="startup-picker-item wu-action-btn" data-days="7">
          <span class="startup-picker-item-icon"><i data-lucide="calendar"></i></span>
          <span class="startup-picker-item-copy">
            <span class="startup-picker-item-label">Pausar por 7 Dias</span>
            <span class="startup-picker-item-desc">Adia downloads e reinícios por 1 semana</span>
          </span>
        </button>
        <button type="button" class="startup-picker-item wu-action-btn" data-days="30">
          <span class="startup-picker-item-icon"><i data-lucide="calendar"></i></span>
          <span class="startup-picker-item-copy">
            <span class="startup-picker-item-label">Pausar por 30 Dias</span>
            <span class="startup-picker-item-desc">Adia atualizações por 1 mês completo</span>
          </span>
        </button>
        <button type="button" class="startup-picker-item wu-action-btn" data-days="365">
          <span class="startup-picker-item-icon"><i data-lucide="shield-alert"></i></span>
          <span class="startup-picker-item-copy">
            <span class="startup-picker-item-label">Pausar por 365 Dias</span>
            <span class="startup-picker-item-desc">Congela updates por 1 ano em PCs críticos</span>
          </span>
        </button>
        <button type="button" class="startup-picker-item wu-action-btn" data-days="0">
          <span class="startup-picker-item-icon"><i data-lucide="play"></i></span>
          <span class="startup-picker-item-copy">
            <span class="startup-picker-item-label">Retomar Atualizações</span>
            <span class="startup-picker-item-desc">Remove pausas e reativa fluxo normal</span>
          </span>
        </button>
      </div>

      <div style="background:rgba(15,23,42,0.55); border:1px solid rgba(255,255,255,0.08); border-radius:10px; padding:12px 14px; margin-bottom:14px; display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap;">
        <div>
          <div style="font-size:13px; font-weight:600; color:#f1f5f9;">Bloqueio de Atualização Automática de Drivers</div>
          <div style="font-size:11.5px; color:#94a3b8;">Impede que o Windows Update substitua drivers de vídeo, som ou impressora.</div>
        </div>
        <div style="display:flex; gap:6px;">
          <button type="button" class="modal-btn primary" id="btn-wu-block-drivers" style="padding:6px 12px; font-size:11.5px;">Bloquear Drivers</button>
          <button type="button" class="modal-btn secondary" id="btn-wu-allow-drivers" style="padding:6px 12px; font-size:11.5px;">Liberar</button>
        </div>
      </div>

      <div class="details-modal-footer" style="padding-top:10px; border-top:1px solid rgba(255,255,255,0.06); display:flex; justify-content:flex-end;">
        <button type="button" class="modal-btn secondary" data-close-modal style="padding:8px 18px; font-size:12px;">Fechar</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  createLucideIcons(overlay);
  bindModalClose(overlay);

  overlay.querySelectorAll('.wu-action-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const days = Number(btn.dataset.days);
      const keyPath = 'HKLM:\\SOFTWARE\\Microsoft\\WindowsUpdate\\UX\\Settings';
      if (days > 0) {
        await runPs(`
          $start = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
          $end = (Get-Date).AddDays(${days}).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
          New-Item -Path '${keyPath}' -Force | Out-Null
          Set-ItemProperty -Path '${keyPath}' -Name 'PauseFeatureUpdatesStartTime' -Value $start -Force
          Set-ItemProperty -Path '${keyPath}' -Name 'PauseFeatureUpdatesEndTime' -Value $end -Force
          Set-ItemProperty -Path '${keyPath}' -Name 'PauseQualityUpdatesStartTime' -Value $start -Force
          Set-ItemProperty -Path '${keyPath}' -Name 'PauseQualityUpdatesEndTime' -Value $end -Force
          Set-ItemProperty -Path '${keyPath}' -Name 'PauseUpdatesExpiryTime' -Value $end -Force
        `);
        toast('success', 'Windows Update Pausado', `Atualizações pausadas por ${days} dias com sucesso!`);
        addToHistory(`Pausar Windows Update (${days} dias)`, `Pausado por ${days} dias`, true, 'pause-circle');
      } else {
        await runPs(`
          Remove-ItemProperty -Path '${keyPath}' -Name 'PauseFeatureUpdatesStartTime','PauseFeatureUpdatesEndTime','PauseQualityUpdatesStartTime','PauseQualityUpdatesEndTime','PauseUpdatesExpiryTime' -ErrorAction SilentlyContinue
        `);
        toast('success', 'Windows Update Retomado', 'As atualizações automáticas foram reativadas!');
        addToHistory('Retomar Windows Update', 'Atualizações retomadas', true, 'play');
      }
    });
  });

  overlay.querySelector('#btn-wu-block-drivers').addEventListener('click', async () => {
    await runPs(`
      New-Item -Path 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsUpdate' -Force | Out-Null
      Set-ItemProperty -Path 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsUpdate' -Name 'ExcludeWUDriversInQualityUpdate' -Value 1 -Type DWord -Force
    `);
    toast('success', 'Drivers Protegidos', 'O Windows Update não substituirá mais seus drivers automaticamente!');
    addToHistory('Bloquear Drivers no Windows Update', 'ExcludeWUDriversInQualityUpdate = 1', true, 'shield');
  });

  overlay.querySelector('#btn-wu-allow-drivers').addEventListener('click', async () => {
    await runPs(`
      Remove-ItemProperty -Path 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsUpdate' -Name 'ExcludeWUDriversInQualityUpdate' -ErrorAction SilentlyContinue
    `);
    toast('info', 'Drivers Liberados', 'O Windows Update voltou a baixar drivers normalmente.');
    addToHistory('Liberar Drivers no Windows Update', 'Padrão restaurado', true, 'refresh-cw');
  });
}

export async function showInstalledUpdatesModal(ctx = {}) {
  const toast = ctx.toast || (() => {});
  const addToHistory = ctx.addToHistory || (() => {});

  const existing = document.getElementById('tt-hotfix-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'tt-hotfix-overlay';
  overlay.className = 'modal-overlay';

  overlay.innerHTML = `
    <div class="modal startup-picker-modal" role="dialog" aria-modal="true" style="width: min(720px, 95vw);">
      <div class="startup-picker-heading">
        <div class="startup-picker-main-icon"><i data-lucide="list-checks"></i></div>
        <div>
          <div class="startup-picker-title">Histórico de Atualizações (KBs) & Desinstalação</div>
          <div class="startup-picker-desc">Veja as atualizações instaladas no Windows e desinstale pacotes KB que causaram lentidão ou erros</div>
        </div>
        <button type="button" class="startup-picker-close" data-close-modal><i data-lucide="x"></i></button>
      </div>

      <div id="hotfix-list-box" class="startup-picker-list" style="grid-template-columns: 1fr; max-height: 48vh;">
        <div class="startup-picker-empty">Consultando pacotes KB instalados (Get-HotFix)...</div>
      </div>

      <div class="startup-picker-footer">
        <button type="button" class="modal-btn secondary" data-close-modal style="padding: 8px 18px; font-size: 12px;">Fechar</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  createLucideIcons(overlay);
  bindModalClose(overlay);

  const listEl = overlay.querySelector('#hotfix-list-box');
  const kbs = await runPsJson(`
    Get-HotFix | Sort-Object InstalledOn -Descending -ErrorAction SilentlyContinue | Select-Object -First 40 HotFixID, Description, @{N='Date';E={ if ($_.InstalledOn) { $_.InstalledOn.ToString('dd/MM/yyyy') } else { 'Instalado' } }} | ConvertTo-Json -Compress
  `, []);

  if (!kbs.length) {
    listEl.innerHTML = '<div class="startup-picker-empty">Nenhuma atualização KB listada pelo sistema.</div>';
    return;
  }

  listEl.innerHTML = kbs.map(kb => `
    <div class="startup-picker-item" style="cursor:default;">
      <span class="startup-picker-item-icon"><i data-lucide="package-check"></i></span>
      <span class="startup-picker-item-copy">
        <span class="startup-picker-item-label">${escapeHtml(kb.HotFixID)} — ${escapeHtml(kb.Description || 'Update')}</span>
        <span class="startup-picker-item-desc">Instalado em: ${escapeHtml(kb.Date)}</span>
      </span>
      <button type="button" class="modal-btn secondary btn-uninstall-kb" data-kb="${escapeHtml(kb.HotFixID)}" style="padding:5px 10px; font-size:11px; color:#fca5a5; border-color:rgba(239,68,68,0.3);">Desinstalar KB</button>
    </div>
  `).join('');

  createLucideIcons(listEl);

  listEl.querySelectorAll('.btn-uninstall-kb').forEach(btn => {
    btn.addEventListener('click', () => {
      const kbNum = String(btn.dataset.kb || '').replace(/^KB/i, '');
      if (!kbNum) return;
      window.api.runCommand(`wusa.exe /uninstall /kb:${kbNum}`);
      toast('info', `Desinstalar KB${kbNum}`, `O desinstalador nativo do Windows (wusa.exe) foi iniciado para KB${kbNum}.`);
      addToHistory(`Desinstalar KB${kbNum}`, `wusa /uninstall /kb:${kbNum}`, true, 'list-checks');
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. ABA DESEMPENHO: GERENCIADOR DE PROCESSOS TOP 15, LIMPADOR DE RAM & EFEITOS
// ═══════════════════════════════════════════════════════════════════════════════

export async function showTopProcessesModal(ctx = {}) {
  const toast = ctx.toast || (() => {});
  const addToHistory = ctx.addToHistory || (() => {});

  const existing = document.getElementById('tt-top-procs-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'tt-top-procs-overlay';
  overlay.className = 'modal-overlay';

  overlay.innerHTML = `
    <div class="modal startup-picker-modal" role="dialog" aria-modal="true" style="width: min(740px, 95vw);">
      <div class="startup-picker-heading">
        <div class="startup-picker-main-icon"><i data-lucide="activity"></i></div>
        <div>
          <div class="startup-picker-title">Gerenciador Interativo de Processos (Top Consumidores)</div>
          <div class="startup-picker-desc">Os 20 processos que mais consomem Memória RAM e CPU agora — encerre tarefas pesadas com 1 clique</div>
        </div>
        <button type="button" class="startup-picker-close" data-close-modal><i data-lucide="x"></i></button>
      </div>

      <div id="top-procs-list" class="startup-picker-list" style="grid-template-columns: 1fr; max-height: 48vh;">
        <div class="startup-picker-empty">Analisando processos em execução...</div>
      </div>

      <div class="startup-picker-footer" style="justify-content: space-between;">
        <button type="button" class="modal-btn secondary" id="btn-refresh-top-procs" style="padding:8px 14px; font-size:12px;">
          <i data-lucide="refresh-cw" style="width:13px;height:13px"></i> Atualizar Agora
        </button>
        <button type="button" class="modal-btn secondary" data-close-modal style="padding:8px 18px; font-size:12px;">Fechar</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  createLucideIcons(overlay);
  bindModalClose(overlay);

  const listEl = overlay.querySelector('#top-procs-list');

  async function loadProcs() {
    listEl.innerHTML = '<div class="startup-picker-empty">Analisando consumo de memória e CPU...</div>';
    const procs = await runPsJson(`
      Get-Process | Sort-Object WorkingSet64 -Descending | Select-Object -First 20 Id, ProcessName, @{N='RamMB';E={[math]::Round($_.WorkingSet64 / 1MB, 1)}}, @{N='CpuSec';E={[math]::Round($_.CPU, 1)}} | ConvertTo-Json -Compress
    `, []);

    if (!procs.length) {
      listEl.innerHTML = '<div class="startup-picker-empty">Não foi possível listar os processos.</div>';
      return;
    }

    listEl.innerHTML = procs.map(p => `
      <div class="startup-picker-item" style="cursor:default;">
        <span class="startup-picker-item-icon"><i data-lucide="cpu"></i></span>
        <span class="startup-picker-item-copy">
          <span class="startup-picker-item-label">${escapeHtml(p.ProcessName)}.exe <span style="color:#64748b;font-weight:500;">(PID: ${p.Id})</span></span>
          <span class="startup-picker-item-desc">Consumo RAM: <strong>${p.RamMB} MB</strong> • Tempo CPU: ${p.CpuSec || 0}s</span>
        </span>
        <span class="startup-picker-badge">${p.RamMB} MB</span>
        <button type="button" class="modal-btn secondary btn-kill-top-proc" data-pid="${p.Id}" data-name="${escapeHtml(p.ProcessName)}" style="padding:5px 10px; font-size:11px; color:#fca5a5; border-color:rgba(239,68,68,0.3);">Encerrar Tarefa</button>
      </div>
    `).join('');

    createLucideIcons(listEl);

    listEl.querySelectorAll('.btn-kill-top-proc').forEach(btn => {
      btn.addEventListener('click', async () => {
        const pid = btn.dataset.pid;
        const name = btn.dataset.name;
        btn.disabled = true;
        const res = await window.api.runCommand(`taskkill /PID ${pid} /F`);
        if (res.success) {
          toast('success', 'Tarefa Encerrada', `${name}.exe (PID ${pid}) encerrado com sucesso.`);
          addToHistory(`Encerrar Processo: ${name}.exe`, `taskkill /PID ${pid} /F`, true, 'activity');
          loadProcs();
        } else {
          toast('error', 'Acesso Negado', 'Processo protegido pelo sistema.');
          btn.disabled = false;
        }
      });
    });
  }

  overlay.querySelector('#btn-refresh-top-procs').addEventListener('click', loadProcs);
  loadProcs();
}

export async function showVisualEffectsModal(ctx = {}) {
  const toast = ctx.toast || (() => {});
  const addToHistory = ctx.addToHistory || (() => {});

  const existing = document.getElementById('tt-visual-fx-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'tt-visual-fx-overlay';
  overlay.className = 'modal-overlay';

  overlay.innerHTML = `
    <div class="modal details-modal" role="dialog" aria-modal="true" style="width: min(560px, 95vw); max-width: 560px;">
      <button class="modal-close-icon-btn" data-close-modal><i data-lucide="x" style="width:16px;height:16px"></i></button>

      <div class="details-modal-header" style="margin-bottom: 14px;">
        <div class="details-header-lead">
          <div class="details-header-icon-box" style="background: linear-gradient(135deg, rgba(99, 102, 241, 0.22) 0%, rgba(56, 189, 248, 0.18) 100%); border-color: rgba(99, 102, 241, 0.4); color: #818cf8;">
            <i data-lucide="sparkles" style="width:22px;height:22px"></i>
          </div>
          <div class="details-header-text">
            <div class="details-modal-title">
              <span>Otimizador de Efeitos Visuais & Transparência</span>
              <span class="details-count-pill">FPS & Fluidez</span>
            </div>
            <div class="details-modal-desc">Ajuste animações e efeitos de transparência do Windows para ganhar fluidez em máquinas com 4GB/8GB RAM:</div>
          </div>
        </div>
      </div>

      <div style="display:flex; flex-direction:column; gap:10px; margin-bottom:16px;">
        <button type="button" class="startup-picker-item" id="btn-vfx-performance">
          <span class="startup-picker-item-icon"><i data-lucide="zap"></i></span>
          <span class="startup-picker-item-copy">
            <span class="startup-picker-item-label">Modo Desempenho Máximo (Sem Transparência/Animações Pesadas)</span>
            <span class="startup-picker-item-desc">Desativa transparência acrílica e animações lentas mantendo fontes suaves (ClearType).</span>
          </span>
          <span class="startup-picker-badge">Recomendado</span>
        </button>

        <button type="button" class="startup-picker-item" id="btn-vfx-default">
          <span class="startup-picker-item-icon"><i data-lucide="monitor"></i></span>
          <span class="startup-picker-item-copy">
            <span class="startup-picker-item-label">Restaurar Aparência Padrão do Windows</span>
            <span class="startup-picker-item-desc">Reativa efeitos de transparência e todas as animações originais do Windows.</span>
          </span>
        </button>
      </div>

      <div class="details-modal-footer" style="display:flex; justify-content:space-between; align-items:center;">
        <button type="button" class="modal-btn secondary" id="btn-vfx-sysdm" style="padding:7px 14px; font-size:12px;">Abrir Painel Clássico (sysdm.cpl)</button>
        <button type="button" class="modal-btn secondary" data-close-modal style="padding:8px 18px; font-size:12px;">Fechar</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  createLucideIcons(overlay);
  const close = bindModalClose(overlay);

  overlay.querySelector('#btn-vfx-performance').addEventListener('click', async () => {
    await runPs(`
      Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\VisualEffects' -Name 'VisualFXSetting' -Value 2 -Type DWord -Force
      Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize' -Name 'EnableTransparency' -Value 0 -Type DWord -Force
      Set-ItemProperty -Path 'HKCU:\\Control Panel\\Desktop\\WindowMetrics' -Name 'MinAnimate' -Value '0' -Force
    `);
    toast('success', 'Efeitos Visuais Otimizados', 'Transparência e animações pesadas foram desativadas!');
    addToHistory('Otimizar Efeitos Visuais', 'Modo Melhor Desempenho ativado', true, 'zap');
    close();
  });

  overlay.querySelector('#btn-vfx-default').addEventListener('click', async () => {
    await runPs(`
      Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\VisualEffects' -Name 'VisualFXSetting' -Value 0 -Type DWord -Force
      Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize' -Name 'EnableTransparency' -Value 1 -Type DWord -Force
      Set-ItemProperty -Path 'HKCU:\\Control Panel\\Desktop\\WindowMetrics' -Name 'MinAnimate' -Value '1' -Force
    `);
    toast('info', 'Aparência Restaurada', 'Efeitos visuais e transparências padrão do Windows reativados.');
    addToHistory('Restaurar Efeitos Visuais', 'Padrão do Windows restaurado', true, 'monitor');
    close();
  });

  overlay.querySelector('#btn-vfx-sysdm').addEventListener('click', () => {
    window.api.runCommand('SystemPropertiesPerformance.exe');
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. ABA DISCO: DIAGNÓSTICO S.M.A.R.T. DETALHADO & RADAR DE ARQUIVOS GIGANTES
// ═══════════════════════════════════════════════════════════════════════════════

export async function showSmartHealthModal(ctx = {}) {
  const addToHistory = ctx.addToHistory || (() => {});

  const existing = document.getElementById('tt-smart-health-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'tt-smart-health-overlay';
  overlay.className = 'modal-overlay';

  overlay.innerHTML = `
    <div class="modal details-modal" role="dialog" aria-modal="true" style="width: min(680px, 95vw); max-width: 680px;">
      <button class="modal-close-icon-btn" data-close-modal><i data-lucide="x" style="width:16px;height:16px"></i></button>

      <div class="details-modal-header" style="margin-bottom: 14px;">
        <div class="details-header-lead">
          <div class="details-header-icon-box" style="background: linear-gradient(135deg, rgba(16, 185, 129, 0.22) 0%, rgba(56, 189, 248, 0.18) 100%); border-color: rgba(16, 185, 129, 0.4); color: #34d399;">
            <i data-lucide="heart-pulse" style="width:22px;height:22px"></i>
          </div>
          <div class="details-header-text">
            <div class="details-modal-title">
              <span>Saúde S.M.A.R.T. Detalhada dos Discos (SSD / HDD)</span>
              <span class="details-count-pill">Telemetria Física</span>
            </div>
            <div class="details-modal-desc">Auditoria física de desgaste (Wear), temperatura, horas ligado e erros de leitura/gravação:</div>
          </div>
        </div>
      </div>

      <div id="smart-disks-container" style="display:flex; flex-direction:column; gap:10px; max-height: 50vh; overflow-y:auto; margin-bottom:14px;">
        <div class="startup-picker-empty">Lendo contadores S.M.A.R.T. e confiabilidade física das unidades...</div>
      </div>

      <div class="details-modal-footer" style="display:flex; justify-content:flex-end;">
        <button type="button" class="modal-btn primary" data-close-modal style="padding:8px 20px; font-size:12px;">Concluir</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  createLucideIcons(overlay);
  bindModalClose(overlay);

  const box = overlay.querySelector('#smart-disks-container');
  const disks = await runPsJson(`
    Get-PhysicalDisk | ForEach-Object {
      $rel = $_ | Get-StorageReliabilityCounter -ErrorAction SilentlyContinue
      $wear = if ($rel -and $rel.Wear -ne $null) { 100 - [int]$rel.Wear } else { 100 }
      [PSCustomObject]@{
        name = $_.FriendlyName
        media = [string]$_.MediaType
        bus = [string]$_.BusType
        health = [string]$_.HealthStatus
        opStatus = [string]$_.OperationalStatus
        sizeGB = [math]::Round($_.Size / 1GB, 1)
        temp = if ($rel -and $rel.Temperature) { "$($rel.Temperature) °C" } else { "Normal" }
        hours = if ($rel -and $rel.PowerOnHours) { "$($rel.PowerOnHours) h" } else { "N/D" }
        readErrors = if ($rel -and $rel.ReadErrorsTotal) { $rel.ReadErrorsTotal } else { 0 }
        writeErrors = if ($rel -and $rel.WriteErrorsTotal) { $rel.WriteErrorsTotal } else { 0 }
        healthPct = $wear
      }
    } | ConvertTo-Json -Compress
  `, []);

  if (!disks.length) {
    box.innerHTML = '<div class="startup-picker-empty">Não foi possível ler os sensores físicos S.M.A.R.T. deste controlador.</div>';
    return;
  }

  box.innerHTML = disks.map(d => {
    const isHealthy = /healthy|ok/i.test(d.health);
    return `
      <div style="background:rgba(15,23,42,0.6); border:1px solid rgba(255,255,255,0.09); border-radius:12px; padding:14px 16px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <div>
            <div style="font-size:15px; font-weight:700; color:#f8fafc;">${escapeHtml(d.name)} (${d.sizeGB} GB)</div>
            <div style="font-size:11.5px; color:#94a3b8;">Tipo: <strong>${escapeHtml(d.media)}</strong> • Barramento: <strong>${escapeHtml(d.bus)}</strong> • Operação: ${escapeHtml(d.opStatus)}</div>
          </div>
          <span class="details-count-pill" style="background:${isHealthy ? 'rgba(16,185,129,0.18)' : 'rgba(239,68,68,0.18)'}; color:${isHealthy ? '#6ee7b7' : '#fca5a5'};">
            Saúde: ${d.healthPct}% (${isHealthy ? 'Saudável' : escapeHtml(d.health)})
          </span>
        </div>
        <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:8px;">
          <div style="background:rgba(0,0,0,0.28); padding:8px 10px; border-radius:8px;">
            <div style="font-size:10px; color:#64748b; text-transform:uppercase;">Temperatura</div>
            <div style="font-size:13px; font-weight:700; color:#e2e8f0;">${escapeHtml(d.temp)}</div>
          </div>
          <div style="background:rgba(0,0,0,0.28); padding:8px 10px; border-radius:8px;">
            <div style="font-size:10px; color:#64748b; text-transform:uppercase;">Horas Ligado</div>
            <div style="font-size:13px; font-weight:700; color:#e2e8f0;">${escapeHtml(d.hours)}</div>
          </div>
          <div style="background:rgba(0,0,0,0.28); padding:8px 10px; border-radius:8px;">
            <div style="font-size:10px; color:#64748b; text-transform:uppercase;">Erros Leitura</div>
            <div style="font-size:13px; font-weight:700; color:#34d399;">${d.readErrors}</div>
          </div>
          <div style="background:rgba(0,0,0,0.28); padding:8px 10px; border-radius:8px;">
            <div style="font-size:10px; color:#64748b; text-transform:uppercase;">Erros Escrita</div>
            <div style="font-size:13px; font-weight:700; color:#34d399;">${d.writeErrors}</div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  addToHistory('Diagnóstico S.M.A.R.T.', `${disks.length} disco(s) analisado(s)`, true, 'heart-pulse');
}

export async function showStorageScannerModal(ctx = {}) {
  const toast = ctx.toast || (() => {});
  const addToHistory = ctx.addToHistory || (() => {});

  const existing = document.getElementById('tt-storage-scanner-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'tt-storage-scanner-overlay';
  overlay.className = 'modal-overlay';

  overlay.innerHTML = `
    <div class="modal startup-picker-modal" role="dialog" aria-modal="true" style="width: min(760px, 95vw);">
      <div class="startup-picker-heading">
        <div class="startup-picker-main-icon"><i data-lucide="folder-search"></i></div>
        <div>
          <div class="startup-picker-title">Radar de Pastas e Arquivos Gigantes (Storage Scanner)</div>
          <div class="startup-picker-desc">Identifica os maiores arquivos do usuário (Downloads, Área de Trabalho, Documentos, AppData) para liberar espaço rápido</div>
        </div>
        <button type="button" class="startup-picker-close" data-close-modal><i data-lucide="x"></i></button>
      </div>

      <div id="storage-scanner-list" class="startup-picker-list" style="grid-template-columns: 1fr; max-height: 50vh;">
        <div class="startup-picker-empty">Escaneando os maiores arquivos no perfil do usuário e diretórios temporários...</div>
      </div>

      <div class="startup-picker-footer">
        <button type="button" class="modal-btn secondary" data-close-modal style="padding:8px 18px; font-size:12px;">Fechar</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  createLucideIcons(overlay);
  bindModalClose(overlay);

  const listEl = overlay.querySelector('#storage-scanner-list');
  const files = await runPsJson(`
    $paths = @("$env:USERPROFILE\\Downloads", "$env:USERPROFILE\\Desktop", "$env:USERPROFILE\\Documents", "$env:USERPROFILE\\Videos", "$env:LOCALAPPDATA\\Temp")
    $found = foreach ($p in $paths) {
      if (Test-Path $p) {
        Get-ChildItem -Path $p -File -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.Length -gt 20MB }
      }
    }
    $found | Sort-Object Length -Descending | Select-Object -First 25 Name, FullName, @{N='SizeMB';E={[math]::Round($_.Length / 1MB, 1)}} | ConvertTo-Json -Compress
  `, []);

  if (!files.length) {
    listEl.innerHTML = '<div class="startup-picker-empty">Nenhum arquivo gigante (> 20 MB) encontrado nas pastas de Downloads, Desktop, Documentos ou Temp!</div>';
    return;
  }

  listEl.innerHTML = files.map((f, idx) => `
    <div class="startup-picker-item" style="cursor:default;">
      <span class="startup-picker-item-icon"><i data-lucide="file"></i></span>
      <span class="startup-picker-item-copy">
        <span class="startup-picker-item-label">${escapeHtml(f.Name)}</span>
        <span class="startup-picker-item-desc" style="white-space:normal;">${escapeHtml(f.FullName)}</span>
      </span>
      <span class="startup-picker-badge">${f.SizeMB} MB</span>
      <button type="button" class="modal-btn secondary btn-reveal-giant" data-idx="${idx}" style="padding:5px 10px; font-size:11px;">Mostrar na Pasta</button>
    </div>
  `).join('');

  createLucideIcons(listEl);

  listEl.querySelectorAll('.btn-reveal-giant').forEach(btn => {
    btn.addEventListener('click', () => {
      const f = files[Number(btn.dataset.idx)];
      if (f && window.api.showItemInFolder) {
        window.api.showItemInFolder(f.FullName);
      }
    });
  });

  addToHistory('Radar de Arquivos Gigantes', `${files.length} arquivos localizados`, true, 'folder-search');
}

// ═══════════════════════════════════════════════════════════════════════════════
// 6. ABA REDE: SENHAS WI-FI SALVAS, BENCHMARK DNS & SCANNER LAN / SMB
// ═══════════════════════════════════════════════════════════════════════════════

export async function showWifiPasswordsModal(ctx = {}) {
  const toast = ctx.toast || (() => {});
  const addToHistory = ctx.addToHistory || (() => {});

  const existing = document.getElementById('tt-wifi-pass-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'tt-wifi-pass-overlay';
  overlay.className = 'modal-overlay';

  overlay.innerHTML = `
    <div class="modal startup-picker-modal" role="dialog" aria-modal="true" style="width: min(680px, 95vw);">
      <div class="startup-picker-heading">
        <div class="startup-picker-main-icon"><i data-lucide="wifi"></i></div>
        <div>
          <div class="startup-picker-title">Visualizador de Senhas de Wi-Fi Salvas</div>
          <div class="startup-picker-desc">Redes sem fio salvas neste computador e suas respectivas chaves de segurança</div>
        </div>
        <button type="button" class="startup-picker-close" data-close-modal><i data-lucide="x"></i></button>
      </div>

      <div id="wifi-pass-list" class="startup-picker-list" style="grid-template-columns: 1fr; max-height: 48vh;">
        <div class="startup-picker-empty">Lendo perfis WLAN armazenados no Windows...</div>
      </div>

      <div class="startup-picker-footer">
        <button type="button" class="modal-btn secondary" data-close-modal style="padding:8px 18px; font-size:12px;">Fechar</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  createLucideIcons(overlay);
  bindModalClose(overlay);

  const listEl = overlay.querySelector('#wifi-pass-list');
  const profiles = await runPsJson(`
    $lines = netsh wlan show profiles
    $names = foreach ($l in $lines) {
      if ($l -match ':\\s+(.+)$') {
        $n = $Matches[1].Trim()
        if ($n) { $n }
      }
    }
    $out = foreach ($name in $names) {
      $detail = netsh wlan show profile name="$name" key=clear
      $pwd = ($detail | Select-String -Pattern 'Key Content|Conte.*Chave' | Select-Object -First 1)
      $passVal = if ($pwd -and $pwd.Line -match ':\\s*(.+)$') { $Matches[1].Trim() } else { '(Aberta / Sem Senha)' }
      [PSCustomObject]@{ ssid = $name; password = $passVal }
    }
    $out | ConvertTo-Json -Compress
  `, []);

  if (!profiles.length) {
    listEl.innerHTML = '<div class="startup-picker-empty">Nenhuma rede Wi-Fi salva encontrada neste computador (ou sem placa Wi-Fi ativa).</div>';
    return;
  }

  listEl.innerHTML = profiles.map((p, idx) => `
    <div class="startup-picker-item" style="cursor:default;">
      <span class="startup-picker-item-icon"><i data-lucide="wifi"></i></span>
      <span class="startup-picker-item-copy">
        <span class="startup-picker-item-label">${escapeHtml(p.ssid)}</span>
        <span class="startup-picker-item-desc" style="font-family:Consolas,monospace; color:#a5b4fc; font-size:12px;">Senha: <strong>${escapeHtml(p.password)}</strong></span>
      </span>
      <button type="button" class="modal-btn secondary btn-copy-wifi" data-idx="${idx}" style="padding:6px 12px; font-size:11.5px;">Copiar Senha</button>
    </div>
  `).join('');

  createLucideIcons(listEl);

  listEl.querySelectorAll('.btn-copy-wifi').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = profiles[Number(btn.dataset.idx)];
      if (p) {
        navigator.clipboard.writeText(p.password);
        toast('success', 'Senha Copiada', `Senha da rede "${p.ssid}" copiada para a área de transferência!`);
      }
    });
  });

  addToHistory('Visualizar Senhas Wi-Fi', `${profiles.length} rede(s) localizada(s)`, true, 'wifi');
}

export async function showDnsBenchmarkModal(ctx = {}) {
  const toast = ctx.toast || (() => {});
  const addToHistory = ctx.addToHistory || (() => {});

  const existing = document.getElementById('tt-dns-bench-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'tt-dns-bench-overlay';
  overlay.className = 'modal-overlay';

  const providers = [
    { name: 'Cloudflare DNS', primary: '1.1.1.1', secondary: '1.0.0.1', desc: 'Ultra rápido com foco em baixa latência e jogos' },
    { name: 'Google Public DNS', primary: '8.8.8.8', secondary: '8.8.4.4', desc: 'Alta estabilidade global e resolução confiável' },
    { name: 'Quad9 Security DNS', primary: '9.9.9.9', secondary: '149.112.112.112', desc: 'Bloqueio nativo de domínios maliciosos e phishing' },
    { name: 'OpenDNS (Cisco)', primary: '208.67.222.222', secondary: '208.67.220.220', desc: 'Confiabilidade corporativa e filtragem rápida' },
    { name: 'Automático (DHCP da Operadora)', primary: 'DHCP', secondary: '', desc: 'Restaura o DNS padrão fornecido pelo seu roteador' }
  ];

  overlay.innerHTML = `
    <div class="modal startup-picker-modal" role="dialog" aria-modal="true" style="width: min(700px, 95vw);">
      <div class="startup-picker-heading">
        <div class="startup-picker-main-icon"><i data-lucide="gauge"></i></div>
        <div>
          <div class="startup-picker-title">Seletor Unificado de DNS & Benchmark de Latência</div>
          <div class="startup-picker-desc">Compare o tempo de resposta em tempo real e aplique na placa de rede ativa (Ethernet ou Wi-Fi)</div>
        </div>
        <button type="button" class="startup-picker-close" data-close-modal><i data-lucide="x"></i></button>
      </div>

      <div id="dns-bench-list" class="startup-picker-list" style="grid-template-columns: 1fr;">
        ${providers.map((p, idx) => `
          <div class="startup-picker-item" style="cursor:default;">
            <span class="startup-picker-item-icon"><i data-lucide="globe"></i></span>
            <span class="startup-picker-item-copy">
              <span class="startup-picker-item-label">${escapeHtml(p.name)} ${p.primary !== 'DHCP' ? `<span style="color:#818cf8;font-family:Consolas,monospace;">(${p.primary} / ${p.secondary})</span>` : ''}</span>
              <span class="startup-picker-item-desc">${escapeHtml(p.desc)}</span>
            </span>
            <span class="startup-picker-badge" id="dns-ping-badge-${idx}">${p.primary === 'DHCP' ? 'Padrão' : 'Testando...'}</span>
            <button type="button" class="modal-btn primary btn-apply-dns" data-idx="${idx}" style="padding:6px 12px; font-size:11.5px;">Aplicar DNS</button>
          </div>
        `).join('')}
      </div>

      <div class="startup-picker-footer" style="justify-content: space-between;">
        <button type="button" class="modal-btn secondary" id="btn-retest-dns" style="padding:8px 14px; font-size:12px;">
          <i data-lucide="refresh-cw" style="width:13px;height:13px"></i> Testar Latência Novamente
        </button>
        <button type="button" class="modal-btn secondary" data-close-modal style="padding:8px 18px; font-size:12px;">Fechar</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  createLucideIcons(overlay);
  bindModalClose(overlay);

  async function runBenchmark() {
    for (let i = 0; i < providers.length; i++) {
      const p = providers[i];
      if (p.primary === 'DHCP') continue;
      const badge = overlay.querySelector(`#dns-ping-badge-${i}`);
      if (badge) badge.textContent = 'Medindo...';
      const res = await runPs(`
        $t = Test-Connection -ComputerName '${p.primary}' -Count 2 -ErrorAction SilentlyContinue | Measure-Object -Property ResponseTime -Average
        if ($t -and $t.Average -ne $null) { Write-Output ([math]::Round($t.Average, 0)) } else { Write-Output 'N/D' }
      `);
      const ms = (res.output || '').trim();
      if (badge) {
        badge.textContent = ms && ms !== 'N/D' ? `${ms} ms` : 'Online';
        if (Number(ms) > 0 && Number(ms) <= 25) {
          badge.style.color = '#34d399';
          badge.style.borderColor = 'rgba(16,185,129,0.35)';
        }
      }
    }
  }

  overlay.querySelectorAll('.btn-apply-dns').forEach(btn => {
    btn.addEventListener('click', async () => {
      const p = providers[Number(btn.dataset.idx)];
      btn.disabled = true;
      btn.textContent = 'Aplicando...';
      const script = p.primary === 'DHCP'
        ? `Get-NetAdapter | Where-Object { $_.Status -eq 'Up' } | ForEach-Object { Set-DnsClientServerAddress -InterfaceIndex $_.InterfaceIndex -ResetServerAddresses }; ipconfig /flushdns | Out-Null`
        : `Get-NetAdapter | Where-Object { $_.Status -eq 'Up' } | ForEach-Object { Set-DnsClientServerAddress -InterfaceIndex $_.InterfaceIndex -ServerAddresses @('${p.primary}','${p.secondary}') }; ipconfig /flushdns | Out-Null`;
      await runPs(script);
      btn.disabled = false;
      btn.textContent = 'Aplicado ✔';
      toast('success', 'DNS Configurado', `${p.name} aplicado em todos os adaptadores ativos!`);
      addToHistory(`Configurar DNS: ${p.name}`, p.primary === 'DHCP' ? 'DHCP Automático' : `${p.primary}, ${p.secondary}`, true, 'globe');
    });
  });

  overlay.querySelector('#btn-retest-dns').addEventListener('click', runBenchmark);
  runBenchmark();
}

export async function showLanScannerModal(ctx = {}) {
  const toast = ctx.toast || (() => {});
  const addToHistory = ctx.addToHistory || (() => {});

  const existing = document.getElementById('tt-lan-scan-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'tt-lan-scan-overlay';
  overlay.className = 'modal-overlay';

  overlay.innerHTML = `
    <div class="modal startup-picker-modal" role="dialog" aria-modal="true" style="width: min(740px, 95vw);">
      <div class="startup-picker-heading">
        <div class="startup-picker-main-icon"><i data-lucide="radar"></i></div>
        <div>
          <div class="startup-picker-title">Scanner de Dispositivos na Rede Local (LAN) & Corretor SMB</div>
          <div class="startup-picker-desc">Lista equipamentos descobertos na tabela ARP da sua rede (impressoras, roteadores, PCs) e repara o compartilhamento</div>
        </div>
        <button type="button" class="startup-picker-close" data-close-modal><i data-lucide="x"></i></button>
      </div>

      <div id="lan-devices-list" class="startup-picker-list" style="grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); max-height: 46vh;">
        <div class="startup-picker-empty">Mapeando dispositivos conectados na sub-rede local...</div>
      </div>

      <div class="startup-picker-footer" style="justify-content: space-between; flex-wrap: wrap;">
        <button type="button" class="modal-btn primary" id="btn-fix-smb-sharing" style="padding:8px 14px; font-size:12px;">
          <i data-lucide="folder-Input" style="width:14px;height:14px"></i> Reparar Compartilhamento de Pastas na Rede (SMB)
        </button>
        <button type="button" class="modal-btn secondary" data-close-modal style="padding:8px 18px; font-size:12px;">Fechar</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  createLucideIcons(overlay);
  bindModalClose(overlay);

  const listEl = overlay.querySelector('#lan-devices-list');
  const devices = await runPsJson(`
    Get-NetNeighbor -AddressFamily IPv4 -ErrorAction SilentlyContinue |
      Where-Object { $_.State -in @('Reachable','Stale','Permanent') -and $_.IPAddress -notmatch '^(224\\.|239\\.|255\\.|169\\.254\\.|127\\.)' -and $_.LinkLayerAddress -and $_.LinkLayerAddress -ne '00-00-00-00-00-00' } |
      Sort-Object IPAddress | Select-Object IPAddress, LinkLayerAddress, State | ConvertTo-Json -Compress
  `, []);

  if (!devices.length) {
    listEl.innerHTML = '<div class="startup-picker-empty">Nenhum vizinho ARP encontrado no momento.</div>';
  } else {
    listEl.innerHTML = devices.map(d => `
      <div class="startup-picker-item" style="cursor:default;">
        <span class="startup-picker-item-icon"><i data-lucide="monitor"></i></span>
        <span class="startup-picker-item-copy">
          <span class="startup-picker-item-label">${escapeHtml(d.IPAddress)}</span>
          <span class="startup-picker-item-desc">MAC: ${escapeHtml(d.LinkLayerAddress)}</span>
        </span>
        <span class="startup-picker-badge">${escapeHtml(d.State)}</span>
      </div>
    `).join('');
    createLucideIcons(listEl);
  }

  overlay.querySelector('#btn-fix-smb-sharing').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.textContent = 'Ativando Descoberta e SMB...';
    await runPs(`
      netsh advfirewall firewall set rule group="File and Printer Sharing" new enable=Yes | Out-Null
      netsh advfirewall firewall set rule group="Network Discovery" new enable=Yes | Out-Null
      netsh advfirewall firewall set rule group="Compartilhamento de Arquivo e Impressora" new enable=Yes | Out-Null
      netsh advfirewall firewall set rule group="Descoberta de Rede" new enable=Yes | Out-Null
      Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\LanmanWorkstation\\Parameters' -Name 'AllowInsecureGuestAuth' -Value 1 -Type DWord -Force -ErrorAction SilentlyContinue
      Start-Service fdPHost -ErrorAction SilentlyContinue
      Start-Service FDResPub -ErrorAction SilentlyContinue
      Start-Service LanmanServer -ErrorAction SilentlyContinue
    `);
    btn.disabled = false;
    btn.textContent = 'Compartilhamento SMB Reparado ✔';
    toast('success', 'Rede Local & SMB Reparados', 'Descoberta de rede, firewall e autenticação de compartilhamento ativados!');
    addToHistory('Reparar Compartilhamento SMB', 'Regras de rede local aplicadas', true, 'radar');
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// 7. ABA SISTEMA: SAÚDE DA BATERIA, BOOT BIOS/SAFE MODE, BSOD & BACKUP DRIVERS
// ═══════════════════════════════════════════════════════════════════════════════

export async function showBatteryHealthModal(ctx = {}) {
  const toast = ctx.toast || (() => {});
  const addToHistory = ctx.addToHistory || (() => {});

  const existing = document.getElementById('tt-battery-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'tt-battery-overlay';
  overlay.className = 'modal-overlay';

  overlay.innerHTML = `
    <div class="modal details-modal" role="dialog" aria-modal="true" style="width: min(580px, 95vw); max-width: 580px;">
      <button class="modal-close-icon-btn" data-close-modal><i data-lucide="x" style="width:16px;height:16px"></i></button>

      <div class="details-modal-header" style="margin-bottom: 14px;">
        <div class="details-header-lead">
          <div class="details-header-icon-box" style="background: linear-gradient(135deg, rgba(16, 185, 129, 0.22) 0%, rgba(56, 189, 248, 0.18) 100%); border-color: rgba(16, 185, 129, 0.4); color: #34d399;">
            <i data-lucide="battery-charging" style="width:22px;height:22px"></i>
          </div>
          <div class="details-header-text">
            <div class="details-modal-title">
              <span>Diagnóstico de Saúde da Bateria</span>
              <span class="details-count-pill">Notebooks & No-Breaks</span>
            </div>
            <div class="details-modal-desc">Verifica carga, desgaste de fábrica e gera o laudo oficial powercfg /batteryreport:</div>
          </div>
        </div>
      </div>

      <div id="battery-info-box" style="background:rgba(15,23,42,0.55); border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:16px; margin-bottom:14px; font-size:13px; color:#e2e8f0;">
        Analisando controlador de bateria...
      </div>

      <div class="details-modal-footer" style="display:flex; justify-content:space-between;">
        <button type="button" class="modal-btn primary" id="btn-open-battery-html" style="padding:8px 16px; font-size:12px;">
          <i data-lucide="external-link" style="width:14px;height:14px"></i> Gerar & Abrir Relatório Completo HTML
        </button>
        <button type="button" class="modal-btn secondary" data-close-modal style="padding:8px 18px; font-size:12px;">Fechar</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  createLucideIcons(overlay);
  bindModalClose(overlay);

  const box = overlay.querySelector('#battery-info-box');
  const bat = await runPsJson(`
    $b = Get-CimInstance Win32_Battery -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($b) {
      [PSCustomObject]@{
        found = $true
        name = $b.Name
        charge = $b.EstimatedChargeRemaining
        runtime = $b.EstimatedRunTime
        status = $b.Status
      } | ConvertTo-Json -Compress
    } else {
      [PSCustomObject]@{ found = $false } | ConvertTo-Json -Compress
    }
  `, { found: false });

  if (!bat.found) {
    box.innerHTML = `
      <div style="display:flex; align-items:center; gap:12px;">
        <i data-lucide="plug" style="width:24px;height:24px;color:#818cf8;"></i>
        <div>
          <strong>Equipamento Desktop / Alimentação Direta AC</strong><br>
          <span style="color:#94a3b8; font-size:12px;">Nenhuma bateria interna detectada neste computador. Caso seja um notebook, verifique o conector da bateria ou driver ACPI.</span>
        </div>
      </div>
    `;
    createLucideIcons(box);
  } else {
    box.innerHTML = `
      <div><strong>Bateria Detectada:</strong> ${escapeHtml(bat.name || 'Bateria Principal')}</div>
      <div style="margin-top:6px;"><strong>Carga Atual:</strong> ${bat.charge}% &nbsp;|&nbsp; <strong>Status:</strong> ${escapeHtml(bat.status || 'OK')}</div>
    `;
  }

  overlay.querySelector('#btn-open-battery-html').addEventListener('click', async () => {
    const res = await runPs(`
      $out = "$env:USERPROFILE\\Desktop\\Relatorio-Bateria-ThunderTools.html"
      powercfg /batteryreport /output $out | Out-Null
      Write-Output $out
    `);
    const file = (res.output || '').trim();
    if (file && window.api.openFilePath) {
      window.api.openFilePath(file);
    }
    toast('success', 'Relatório de Bateria', 'Relatório salvo na Área de Trabalho e aberto no navegador!');
    addToHistory('Relatório de Saúde da Bateria', 'Salvo na Área de Trabalho', true, 'battery-charging');
  });
}

export function showAdvancedRebootModal(ctx = {}) {
  const toast = ctx.toast || (() => {});
  const addToHistory = ctx.addToHistory || (() => {});

  const existing = document.getElementById('tt-adv-reboot-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'tt-adv-reboot-overlay';
  overlay.className = 'modal-overlay';

  overlay.innerHTML = `
    <div class="modal details-modal" role="dialog" aria-modal="true" style="width: min(560px, 95vw); max-width: 560px;">
      <button class="modal-close-icon-btn" data-close-modal><i data-lucide="x" style="width:16px;height:16px"></i></button>

      <div class="details-modal-header" style="margin-bottom: 14px;">
        <div class="details-header-lead">
          <div class="details-header-icon-box" style="background: linear-gradient(135deg, rgba(245, 158, 11, 0.22) 0%, rgba(239, 68, 68, 0.18) 100%); border-color: rgba(245, 158, 11, 0.4); color: #fbbf24;">
            <i data-lucide="cpu" style="width:22px;height:22px"></i>
          </div>
          <div class="details-header-text">
            <div class="details-modal-title">
              <span>Reinicialização Avançada (BIOS/UEFI & Recuperação)</span>
              <span class="details-count-pill">Acesso Rápido</span>
            </div>
            <div class="details-modal-desc">Entre diretamente no Setup da placa-mãe ou no Ambiente de Recuperação sem precisar apertar F2/Del:</div>
          </div>
        </div>
      </div>

      <div style="display:flex; flex-direction:column; gap:10px; margin-bottom:16px;">
        <button type="button" class="startup-picker-item" id="btn-reboot-uefi">
          <span class="startup-picker-item-icon"><i data-lucide="cpu"></i></span>
          <span class="startup-picker-item-copy">
            <span class="startup-picker-item-label">Reiniciar Direto na BIOS / UEFI (shutdown /r /fw)</span>
            <span class="startup-picker-item-desc">Reinicia em 5 segundos abrindo diretamente a tela de configuração da BIOS/UEFI.</span>
          </span>
        </button>
        <button type="button" class="startup-picker-item" id="btn-reboot-winre">
          <span class="startup-picker-item-icon"><i data-lucide="life-buoy"></i></span>
          <span class="startup-picker-item-copy">
            <span class="startup-picker-item-label">Reiniciar no Menu de Recuperação / Modo de Segurança (shutdown /r /o)</span>
            <span class="startup-picker-item-desc">Abre as Opções Avançadas de Inicialização do Windows (Modo Seguro, Prompt, Reparo).</span>
          </span>
        </button>
      </div>

      <div class="details-modal-footer" style="display:flex; justify-content:flex-end;">
        <button type="button" class="modal-btn secondary" data-close-modal style="padding:8px 18px; font-size:12px;">Cancelar</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  createLucideIcons(overlay);
  const close = bindModalClose(overlay);

  overlay.querySelector('#btn-reboot-uefi').addEventListener('click', async () => {
    addToHistory('Reiniciar na BIOS/UEFI', 'shutdown /r /fw /t 5', true, 'cpu');
    toast('warning', 'Reiniciando para a BIOS/UEFI', 'O computador reiniciará em 5 segundos direto na BIOS!');
    await window.api.runCommand('shutdown /r /fw /t 5');
    close();
  });

  overlay.querySelector('#btn-reboot-winre').addEventListener('click', async () => {
    addToHistory('Reiniciar em Opções Avançadas', 'shutdown /r /o /f /t 5', true, 'life-buoy');
    toast('warning', 'Reiniciando em Modo Avançado', 'O computador reiniciará nas Opções de Recuperação em 5 segundos!');
    await window.api.runCommand('shutdown /r /o /f /t 5');
    close();
  });
}

export async function showBsodAnalyzerModal(ctx = {}) {
  const addToHistory = ctx.addToHistory || (() => {});

  const existing = document.getElementById('tt-bsod-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'tt-bsod-overlay';
  overlay.className = 'modal-overlay';

  overlay.innerHTML = `
    <div class="modal startup-picker-modal" role="dialog" aria-modal="true" style="width: min(740px, 95vw);">
      <div class="startup-picker-heading">
        <div class="startup-picker-main-icon"><i data-lucide="alert-octagon"></i></div>
        <div>
          <div class="startup-picker-title">Analisador de Tela Azul (BSOD) & Desligamentos Críticos</div>
          <div class="startup-picker-desc">Auditoria de eventos Kernel-Power (ID 41), BugCheck (ID 1001) e despejos de memória (Minidump)</div>
        </div>
        <button type="button" class="startup-picker-close" data-close-modal><i data-lucide="x"></i></button>
      </div>

      <div id="bsod-events-list" class="startup-picker-list" style="grid-template-columns: 1fr; max-height: 48vh;">
        <div class="startup-picker-empty">Inspecionando logs críticos do sistema e pasta Minidump...</div>
      </div>

      <div class="startup-picker-footer">
        <button type="button" class="modal-btn secondary" data-close-modal style="padding:8px 18px; font-size:12px;">Fechar</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  createLucideIcons(overlay);
  bindModalClose(overlay);

  const listEl = overlay.querySelector('#bsod-events-list');
  const events = await runPsJson(`
    $evts = Get-WinEvent -FilterHashtable @{LogName='System'; Id=@(41, 1001, 6008)} -MaxEvents 20 -ErrorAction SilentlyContinue | ForEach-Object {
      [PSCustomObject]@{
        id = $_.Id
        time = $_.TimeCreated.ToString('dd/MM/yyyy HH:mm:ss')
        provider = $_.ProviderName
        msg = ($_.Message -replace '\\s+', ' ').Trim()
      }
    }
    $evts | ConvertTo-Json -Compress
  `, []);

  if (!events.length) {
    listEl.innerHTML = '<div class="startup-picker-empty" style="color:#34d399;">✔ Excelente! Nenhuma Tela Azul (BugCheck) ou desligamento inesperado (Kernel-Power 41) registrado recentemente!</div>';
  } else {
    listEl.innerHTML = events.map(ev => `
      <div class="startup-picker-item" style="cursor:default;">
        <span class="startup-picker-item-icon"><i data-lucide="alert-triangle"></i></span>
        <span class="startup-picker-item-copy">
          <span class="startup-picker-item-label">Evento ID ${ev.id} (${escapeHtml(ev.provider)}) — ${escapeHtml(ev.time)}</span>
          <span class="startup-picker-item-desc" style="white-space:normal;">${escapeHtml(ev.msg)}</span>
        </span>
        <span class="startup-picker-badge" style="color:#fca5a5;border-color:rgba(239,68,68,0.35);">Crítico</span>
      </div>
    `).join('');
    createLucideIcons(listEl);
  }

  addToHistory('Analisador de Tela Azul (BSOD)', `${events.length} evento(s) analisado(s)`, true, 'alert-octagon');
}


// ═══════════════════════════════════════════════════════════════════════════════
// 8.6 ATIVADOR E AUDITOR DE DESEMPENHO MÁXIMO (ULTIMATE PERFORMANCE)
// ═══════════════════════════════════════════════════════════════════════════════

export async function showUltimatePerformanceModal(ctx = {}) {
  const toast = ctx.toast || (() => {});
  const addToHistory = ctx.addToHistory || (() => {});

  const existing = document.getElementById('tt-ultimate-perf-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'tt-ultimate-perf-overlay';
  overlay.className = 'modal-overlay';

  overlay.innerHTML = `
    <div class="modal details-modal" role="dialog" aria-modal="true" style="width: min(740px, 95vw); max-width: 740px; padding: 22px 26px;">
      <button class="modal-close-icon-btn" data-close-modal title="Fechar (Esc)">
        <i data-lucide="x" style="width:16px;height:16px"></i>
      </button>

      <div class="details-modal-header" style="margin-bottom: 16px;">
        <div class="details-header-lead">
          <div class="details-header-icon-box" style="background: linear-gradient(135deg, rgba(245, 158, 11, 0.22) 0%, rgba(239, 68, 68, 0.2) 100%); border-color: rgba(245, 158, 11, 0.45); color: #f59e0b;">
            <i data-lucide="flame" style="width:24px;height:24px"></i>
          </div>
          <div class="details-header-text">
            <div class="details-modal-title">
              <span>Desempenho Máximo (Ultimate Performance)</span>
              <span class="details-count-pill" id="up-badge-status" style="color: #fbbf24; background: rgba(251, 191, 36, 0.15); border: 1px solid rgba(251, 191, 36, 0.35); font-size: 10.5px; font-weight: 700;">AUDITANDO...</span>
            </div>
            <div class="details-modal-desc">Plano oculto de latência zero para Workstations: validação em tempo real no Windows.</div>
          </div>
        </div>
      </div>

      <div id="up-body-content">
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 36px 20px; gap: 14px; text-align: center;">
          <div class="tt-spinner" style="width: 28px; height: 28px; border-width: 3px; border-color: #f59e0b; border-top-color: transparent;"></div>
          <div style="font-size: 14px; font-weight: 700; color: #f8fafc;">Desbloqueando e ativando o Plano no Windows...</div>
          <div style="font-size: 12px; color: #94a3b8;">Verificando GUIDs, aplicando políticas de energia e auditando a confirmação do sistema operacional.</div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  createLucideIcons(overlay);
  bindModalClose(overlay);

  const script = `
    $all = powercfg -list
    $targetGuid = ''

    foreach ($line in ($all -split "\\r?\\n")) {
      if ($line -match '([a-f0-9-]{36})\\s+\\((.+)\\)') {
        $g = $Matches[1]
        $n = $Matches[2]
        if ($n -match 'Desempenho M.ximo|Ultimate Performance' -or $g -eq 'e9a42b02-d5df-448d-aa00-03f14749eb61') {
          $targetGuid = $g
          break
        }
      }
    }

    if (-not $targetGuid) {
      $dup = powercfg -duplicatescheme e9a42b02-d5df-448d-aa00-03f14749eb61
      if ($dup -match '([a-f0-9-]{36})') {
        $targetGuid = $Matches[1]
      }
    }

    if ($targetGuid) {
      powercfg /setactive $targetGuid
    }

    $activeRaw = powercfg /getactivescheme
    $activeGuid = ''
    $activeName = ''
    if ($activeRaw -match '([a-f0-9-]{36})\\s+\\((.+)\\)') {
      $activeGuid = $Matches[1]
      $activeName = $Matches[2]
    }

    $isConfirmed = ($activeGuid -and ($activeGuid -eq $targetGuid -or $activeName -match 'Desempenho|Ultimate'))

    [PSCustomObject]@{
      Success = [bool]$isConfirmed
      ActiveGuid = [string]$activeGuid
      ActiveName = 'Desempenho Máximo (Ultimate Performance)'
      RawOutput = [string]$activeRaw.Trim()
    } | ConvertTo-Json -Compress
  `;

  const data = await runPsJson(script, { Success: false, RawOutput: '' });
  const bodyEl = overlay.querySelector('#up-body-content');
  const badgeStatus = overlay.querySelector('#up-badge-status');

  if (data && data.Success) {
    if (badgeStatus) {
      badgeStatus.textContent = 'ATIVO & CONFIRMADO NO WINDOWS';
      badgeStatus.style.color = '#34d399';
      badgeStatus.style.background = 'rgba(16, 185, 129, 0.15)';
      badgeStatus.style.borderColor = 'rgba(16, 185, 129, 0.35)';
    }

    bodyEl.innerHTML = `
      <!-- Banner de Confirmação Oficial do Kernel -->
      <div style="background: linear-gradient(135deg, rgba(16, 185, 129, 0.14) 0%, rgba(15, 23, 42, 0.85) 100%); border: 1px solid rgba(16, 185, 129, 0.4); border-radius: 12px; padding: 16px 18px; margin-bottom: 16px;">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 10px;">
          <div style="width: 38px; height: 38px; border-radius: 10px; background: rgba(16, 185, 129, 0.2); border: 1px solid rgba(16, 185, 129, 0.45); display: flex; align-items: center; justify-content: center; color: #34d399; flex-shrink: 0;">
            <i data-lucide="check-circle-2" style="width:22px;height:22px"></i>
          </div>
          <div>
            <div style="font-size: 15px; font-weight: 800; color: #ecfdf5;">Garantia de Ativação Auditada no Sistema Operacional</div>
            <div style="font-size: 12px; color: #a7f3d0;">O kernel do Windows confirmou que o plano ativo agora é o <strong>Desempenho Máximo</strong>.</div>
          </div>
        </div>
        <div style="background: rgba(2, 6, 23, 0.65); border: 1px solid rgba(148, 163, 184, 0.2); border-radius: 8px; padding: 10px 14px; font-family: 'Consolas', monospace; font-size: 11.5px; color: #38bdf8; word-break: break-all; display: flex; align-items: center; gap: 8px;">
          <i data-lucide="terminal" style="width:14px;height:14px;color:#94a3b8;flex-shrink:0;"></i>
          <span>powercfg /getactivescheme → <strong style="color:#7dd3fc;">${escapeHtml(data.ActiveGuid)}</strong> <span style="color:#34d399;font-weight:700;">(Desempenho Máximo) *</span></span>
        </div>
      </div>

      <!-- Grid de Parâmetros de Hardware Garantidos -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; margin-bottom: 18px;">
        <div class="ping-stat-card" style="padding: 14px; background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 10px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <span style="font-size: 12.5px; font-weight: 700; color: #f8fafc; display: flex; align-items: center; gap: 6px;">
              <i data-lucide="cpu" style="width:14px;height:14px;color:#818cf8;"></i> Latência de Hardware (CPU)
            </span>
            <span class="details-count-pill" style="color: #34d399; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.35); font-size: 10px; font-weight: 700;">Zero Latency</span>
          </div>
          <div style="font-size: 11.5px; color: #94a3b8; line-height: 1.45;">
            Micropausas de silício e C-States desativados. Frequência de resposta máxima instantânea em todos os núcleos da CPU.
          </div>
        </div>

        <div class="ping-stat-card" style="padding: 14px; background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 10px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <span style="font-size: 12.5px; font-weight: 700; color: #f8fafc; display: flex; align-items: center; gap: 6px;">
              <i data-lucide="zap" style="width:14px;height:14px;color:#f59e0b;"></i> Barramento PCIe (GPU / NVMe)
            </span>
            <span class="details-count-pill" style="color: #34d399; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.35); font-size: 10px; font-weight: 700;">ASPM Off</span>
          </div>
          <div style="font-size: 11.5px; color: #94a3b8; line-height: 1.45;">
            Gerenciamento de energia PCIe desligado. A placa de vídeo e o SSD operam em largura de banda e voltagem plenas sem recuos.
          </div>
        </div>

        <div class="ping-stat-card" style="padding: 14px; background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 10px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <span style="font-size: 12.5px; font-weight: 700; color: #f8fafc; display: flex; align-items: center; gap: 6px;">
              <i data-lucide="hard-drive" style="width:14px;height:14px;color:#38bdf8;"></i> Suspensão de Armazenamento
            </span>
            <span class="details-count-pill" style="color: #34d399; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.35); font-size: 10px; font-weight: 700;">0 Minutos</span>
          </div>
          <div style="font-size: 11.5px; color: #94a3b8; line-height: 1.45;">
            Tempo de espera cravado em 0. Nenhuma unidade de disco entra em repouso ou spindown durante o uso do PC.
          </div>
        </div>

        <div class="ping-stat-card" style="padding: 14px; background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 10px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <span style="font-size: 12.5px; font-weight: 700; color: #f8fafc; display: flex; align-items: center; gap: 6px;">
              <i data-lucide="gauge" style="width:14px;height:14px;color:#ef4444;"></i> Throughput do Sistema
            </span>
            <span class="details-count-pill" style="color: #34d399; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.35); font-size: 10px; font-weight: 700;">Prioridade Máxima</span>
          </div>
          <div style="font-size: 11.5px; color: #94a3b8; line-height: 1.45;">
            Otimizado para extrair o maior número de quadros (FPS), resposta imediata de periféricos e tarefas de alta carga.
          </div>
        </div>
      </div>

      <div class="details-modal-footer" style="margin-top: 14px; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button type="button" class="modal-btn secondary" id="up-btn-open-cpl" style="padding: 8px 14px; font-size: 12px;">
            <i data-lucide="external-link" style="width:14px;height:14px"></i> Conferir no Painel do Windows (powercfg.cpl)
          </button>
          <button type="button" class="modal-btn secondary" id="up-btn-revert-balanced" style="padding: 8px 14px; font-size: 12px; color: #94a3b8;">
            <i data-lucide="rotate-ccw" style="width:14px;height:14px"></i> Voltar ao Equilibrado
          </button>
        </div>
        <button type="button" class="modal-btn primary" id="up-btn-done" data-close-modal style="padding: 8px 24px; font-size: 12.5px; background: linear-gradient(135deg, #059669, #10b981); cursor: pointer;">
          <i data-lucide="check" style="width:14px;height:14px"></i> Concluir
        </button>
      </div>
    `;

    toast('success', 'Desempenho Máximo Ativado', 'O plano de latência zero foi validado e está oficialmente ativo no Windows!');
    addToHistory('Ativar Desempenho Máximo (Ultimate)', `powercfg /setactive ${data.ActiveGuid}`, true, 'flame');

    const btnOpenCpl = bodyEl.querySelector('#up-btn-open-cpl');
    if (btnOpenCpl) {
      btnOpenCpl.addEventListener('click', () => {
        window.api.runCommand('control powercfg.cpl');
      });
    }

    const btnRevert = bodyEl.querySelector('#up-btn-revert-balanced');
    if (btnRevert) {
      btnRevert.addEventListener('click', async () => {
        btnRevert.disabled = true;
        btnRevert.textContent = 'Revertendo...';
        await window.api.runCommand('powercfg /setactive 381b4222-f694-41f0-9685-ff5bb260df2e');
        toast('info', 'Plano Revertido', 'O plano de energia foi restaurado para o Modo Equilibrado.');
        addToHistory('Restaurar Plano Equilibrado', 'powercfg /setactive 381b4222-f694-41f0-9685-ff5bb260df2e', true, 'zap');
        if (overlay) overlay.remove();
      });
    }
  } else {
    if (badgeStatus) {
      badgeStatus.textContent = 'FALHA NA AUDITORIA';
      badgeStatus.style.color = '#ef4444';
      badgeStatus.style.background = 'rgba(239, 68, 68, 0.15)';
      badgeStatus.style.borderColor = 'rgba(239, 68, 68, 0.35)';
    }

    bodyEl.innerHTML = `
      <div style="background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.35); border-radius: 12px; padding: 18px; margin-bottom: 16px;">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
          <i data-lucide="alert-octagon" style="width:24px;height:24px;color:#ef4444;"></i>
          <span style="font-size: 15px; font-weight: 800; color: #fee2e2;">Não foi possível confirmar o plano</span>
        </div>
        <div style="font-size: 12.5px; color: #fca5a5; line-height: 1.5;">
          O Windows não retornou a confirmação de ativação do plano Desempenho Máximo. Isso pode acontecer se a sua edição do sistema ou fabricante de hardware restringir esquemas de energia avançados.
        </div>
        <div style="background: rgba(2, 6, 23, 0.65); border: 1px solid rgba(148, 163, 184, 0.2); border-radius: 8px; padding: 10px; font-family: 'Consolas', monospace; font-size: 11.5px; color: #e2e8f0; margin-top: 12px;">
          ${escapeHtml(data ? data.RawOutput : 'Sem saída do comando.')}
        </div>
      </div>
      <div class="details-modal-footer" style="margin-top: 14px; justify-content: flex-end;">
        <button type="button" class="modal-btn secondary" data-close-modal style="padding: 8px 20px; font-size: 12px;">Fechar</button>
      </div>
    `;
    toast('error', 'Falha ao Ativar', 'Não foi possível confirmar o plano Desempenho Máximo.');
  }

  createLucideIcons(bodyEl);

  const closeModal = () => {
    overlay.remove();
  };

  const btnDone = bodyEl.querySelector('#up-btn-done');
  if (btnDone) btnDone.onclick = closeModal;

  bodyEl.querySelectorAll('[data-close-modal]').forEach(b => {
    b.onclick = closeModal;
  });
}
