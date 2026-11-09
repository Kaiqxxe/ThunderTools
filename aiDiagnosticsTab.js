/**
 * ThunderTools - Controlador da Aba Thunder IA
 * Desenvolvido por Thunder (ThunderTools)
 */

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function createLucideIcons(target) {
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons({ root: target || document });
  }
}

export function initAiDiagnosticsTab(ctx = {}) {
  const tabEl = document.getElementById('tab-ia-diagnostico');
  if (!tabEl || tabEl.dataset.initialized === 'true') return;
  tabEl.dataset.initialized = 'true';

  const toast = ctx.toast || ((type, title, msg) => console.log(`[${type}] ${title}: ${msg}`));
  const addToHistory = ctx.addToHistory || (() => {});
  const showServiceOrderModal = ctx.showServiceOrderModal || (() => {});

  // Elementos da Interface
  const netBadge = document.getElementById('ai-net-status');
  const keyConfigPanel = document.getElementById('ai-key-config-panel');
  const toggleKeyBtn = document.getElementById('btn-toggle-key-panel');
  const apiKeyInput = document.getElementById('ai-api-key-input');
  const saveKeyBtn = document.getElementById('btn-save-gemini-key');
  const testKeyBtn = document.getElementById('btn-test-gemini-key');
  const toggleKeyVisBtn = document.getElementById('btn-toggle-key-vis');
  const keyStatusPill = document.getElementById('ai-key-status-pill');

  const btnAutoScan = document.getElementById('btn-ai-auto-scan');
  const customLogInput = document.getElementById('ai-custom-log-text');
  const btnAnalyzeCustom = document.getElementById('btn-ai-analyze-custom');

  const loadingCard = document.getElementById('ai-loading-card');
  const loadingStatusText = document.getElementById('ai-loading-status-text');
  const emptyStateCard = document.getElementById('ai-empty-state-card');
  const dashboardContainer = document.getElementById('ai-dashboard-results');

  // 1. Carregar Chave Salva (Opcional - Chave Padrão do Sistema já inclusa)
  const getStoredKey = () => (localStorage.getItem('thundertools_gemini_api_key') || '').trim();
  const updateKeyStatus = () => {
    const key = getStoredKey();
    if (apiKeyInput) apiKeyInput.value = key;
    if (keyStatusPill) {
      if (key) {
        keyStatusPill.className = 'ai-key-pill active';
        keyStatusPill.innerHTML = '<i data-lucide="shield-check" style="width:12px;height:12px"></i> Chave Própria Ativa';
      } else {
        keyStatusPill.className = 'ai-key-pill active';
        keyStatusPill.innerHTML = '<i data-lucide="sparkles" style="width:12px;height:12px"></i> Chave Integrada Ativa';
      }
      createLucideIcons(keyStatusPill);
    }
  };
  updateKeyStatus();

  // 2. Monitorar Conectividade com a Internet
  const checkNet = async () => {
    if (!window.api || !window.api.checkInternetConnection) return;
    try {
      const res = await window.api.checkInternetConnection();
      if (netBadge) {
        if (res.online) {
          netBadge.className = 'ai-status-pill online';
          netBadge.innerHTML = '<span class="status-dot"></span> Internet Conectada';
        } else {
          netBadge.className = 'ai-status-pill offline';
          netBadge.innerHTML = '<span class="status-dot"></span> Sem Internet (Offline)';
        }
      }
    } catch (_) {
      if (netBadge) {
        netBadge.className = 'ai-status-pill offline';
        netBadge.innerHTML = '<span class="status-dot"></span> Verificação de Conexão Falhou';
      }
    }
  };
  checkNet();

  // Atualiza status de rede sempre que a aba for clicada
  const iaTabBtn = document.getElementById('nav-btn-ia');
  if (iaTabBtn) {
    iaTabBtn.addEventListener('click', () => {
      checkNet();
      updateKeyStatus();
    });
  }

  // 3. Ações do Painel de Chave de API
  if (toggleKeyBtn && keyConfigPanel) {
    toggleKeyBtn.addEventListener('click', () => {
      const isHidden = keyConfigPanel.style.display === 'none';
      keyConfigPanel.style.display = isHidden ? 'block' : 'none';
      toggleKeyBtn.classList.toggle('active', isHidden);
      createLucideIcons(keyConfigPanel);
    });
  }

  if (toggleKeyVisBtn && apiKeyInput) {
    toggleKeyVisBtn.addEventListener('click', () => {
      const isPass = apiKeyInput.type === 'password';
      apiKeyInput.type = isPass ? 'text' : 'password';
      toggleKeyVisBtn.innerHTML = isPass ? '<i data-lucide="eye-off" style="width:14px;height:14px"></i>' : '<i data-lucide="eye" style="width:14px;height:14px"></i>';
      createLucideIcons(toggleKeyVisBtn);
    });
  }

  if (saveKeyBtn && apiKeyInput) {
    saveKeyBtn.addEventListener('click', () => {
      const key = apiKeyInput.value.trim();
      localStorage.setItem('thundertools_gemini_api_key', key);
      updateKeyStatus();
      toast('success', 'Chave Atualizada', key ? 'Chave personalizada salva! O app priorizará sua chave.' : 'Chave removida. O ThunderTools agora usará a chave oficial integrada do sistema.');
    });
  }

  if (testKeyBtn) {
    testKeyBtn.addEventListener('click', async () => {
      const key = (apiKeyInput ? apiKeyInput.value.trim() : '') || getStoredKey();
      testKeyBtn.disabled = true;
      const orig = testKeyBtn.innerHTML;
      testKeyBtn.innerHTML = '<i data-lucide="loader" style="width:13px;height:13px;animation:spin 1s linear infinite"></i> Testando...';
      createLucideIcons(testKeyBtn);

      try {
        const testRes = await window.api.geminiAnalyze({
          apiKey: key, // Se vazio, o backend usará a chave oficial integrada
          logType: 'custom',
          customSnippet: 'Teste de validação de conectividade do ThunderTools com a Thunder IA.'
        });

        testKeyBtn.disabled = false;
        testKeyBtn.innerHTML = orig;
        createLucideIcons(testKeyBtn);

        if (testRes.success) {
          if (key) {
            localStorage.setItem('thundertools_gemini_api_key', key);
          }
          updateKeyStatus();
          toast('success', 'Thunder IA Online', key ? 'Chave personalizada validada com sucesso! A IA está pronta.' : 'Conexão validada com sucesso! A chave integrada da Thunder IA está ativa e operando.');
        } else {
          toast('error', 'Falha no Teste', testRes.error || 'Não foi possível validar a chave.');
        }
      } catch (err) {
        testKeyBtn.disabled = false;
        testKeyBtn.innerHTML = orig;
        createLucideIcons(testKeyBtn);
        toast('error', 'Erro no Teste', err.message);
      }
    });
  }

  // 4. Execução de Diagnóstico (Dispatcher Central)
  const runDiagnostic = async (logType, customSnippet = '') => {
    const key = getStoredKey(); // Se vazio, o backend usará automaticamente a chave integrada do aplicativo

    // Exibe loading
    if (emptyStateCard) emptyStateCard.style.display = 'none';
    if (dashboardContainer) dashboardContainer.style.display = 'none';
    if (loadingCard) loadingCard.style.display = 'flex';
    if (loadingStatusText) loadingStatusText.textContent = 'Coletando e higienizando registros de diagnóstico...';
    createLucideIcons(loadingCard);

    const progressSteps = [
      'Verificando integridade e filtrando dados sensíveis...',
      'Transmitindo parâmetros ao modelo neural da Thunder IA...',
      'Mapeando causa raiz e correlacionando códigos de erro...',
      'Estruturando plano de ação corretivo e scripts de reparo...'
    ];
    let stepIdx = 0;
    const progressInterval = setInterval(() => {
      stepIdx = (stepIdx + 1) % progressSteps.length;
      if (loadingStatusText) loadingStatusText.textContent = progressSteps[stepIdx];
    }, 1800);

    try {
      const res = await window.api.geminiAnalyze({
        apiKey: key,
        logType,
        customSnippet
      });

      clearInterval(progressInterval);
      if (loadingCard) loadingCard.style.display = 'none';

      if (!res.success) {
        if (emptyStateCard) emptyStateCard.style.display = 'block';
        toast('error', 'Falha no Diagnóstico IA', res.error || 'Erro desconhecido ao processar com a IA.');
        return;
      }

      renderAiDashboard(res);
      toast('success', 'Diagnóstico Concluído', 'Avaliação neural da Thunder IA concluída com sucesso!');
      addToHistory(`Thunder IA: ${res.diagnosis.titulo || 'Auditoria de Logs'}`, 'Diagnóstico Neural Thunder IA', true, 'sparkles');
    } catch (err) {
      clearInterval(progressInterval);
      if (loadingCard) loadingCard.style.display = 'none';
      if (emptyStateCard) emptyStateCard.style.display = 'block';
      toast('error', 'Erro Inesperado', err.message);
    }
  };

  // Botão: Varredura Automática do Sistema
  if (btnAutoScan) {
    btnAutoScan.addEventListener('click', () => runDiagnostic('system-auto'));
  }

  // Botões de Logs Rápidos
  tabEl.querySelectorAll('.btn-quick-log').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.logType;
      if (type) runDiagnostic(type);
    });
  });

  // Botão: Analisar Texto Customizado
  if (btnAnalyzeCustom && customLogInput) {
    btnAnalyzeCustom.addEventListener('click', () => {
      const val = customLogInput.value.trim();
      if (!val) {
        toast('warning', 'Campo Vazio', 'Cole o texto do log ou código de erro para analisar.');
        customLogInput.focus();
        return;
      }
      runDiagnostic('custom', val);
    });
  }

  // 5. Renderização do Dashboard Rico de Resultados
  function renderAiDashboard(result) {
    if (!dashboardContainer) return;
    const diag = result.diagnosis || {};

    const statusMap = {
      'CRÍTICO': { cls: 'sev-critical', icon: 'alert-triangle', label: 'CRÍTICO' },
      'ALERTA': { cls: 'sev-alert', icon: 'alert-circle', label: 'ALERTA TÉCNICO' },
      'MODERADO': { cls: 'sev-moderate', icon: 'info', label: 'MODERADO' },
      'SAUDÁVEL': { cls: 'sev-healthy', icon: 'check-circle-2', label: 'SAUDÁVEL' }
    };
    const currentSev = statusMap[diag.statusGeral] || statusMap['MODERADO'];

    const comandos = Array.isArray(diag.comandosSugeridos) ? diag.comandosSugeridos : [];
    const orientacoes = Array.isArray(diag.orientacoesManuais) ? diag.orientacoesManuais : [];

    dashboardContainer.innerHTML = `
      <!-- 0. BARRA SUPERIOR DE AÇÕES: NOVO DIAGNÓSTICO / RESET -->
      <div class="ai-dashboard-top-bar" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; padding:8px 12px; background:rgba(15,23,42,0.45); border:1px solid rgba(255,255,255,0.08); border-radius:10px;">
        <span style="font-size:12px; color:#94a3b8; display:flex; align-items:center; gap:6px;">
          <i data-lucide="sparkles" style="width:14px;height:14px;color:#818cf8;"></i> Diagnóstico Ativo gerado por <strong>Thunder IA</strong>
        </span>
        <div style="display:flex; gap:8px;">
          <button type="button" class="ai-btn-reset-view" id="btn-ai-clear-and-new" style="background:rgba(239,68,68,0.12); border:1px solid rgba(239,68,68,0.3); color:#fca5a5; border-radius:6px; padding:5px 12px; font-size:11.5px; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; gap:6px; transition:all 0.2s;" title="Limpa o diagnóstico atual da tela para iniciar uma nova análise limpa">
            <i data-lucide="rotate-ccw" style="width:12px;height:12px"></i> Nova Verificação Limpa
          </button>
        </div>
      </div>

      <!-- 1. BANNER PRINCIPAL DE CAUSA RAIZ & STATUS -->
      <div class="ai-result-banner ${currentSev.cls}">
        <div class="ai-banner-left">
          <div class="ai-sev-badge">
            <i data-lucide="${currentSev.icon}" style="width:16px;height:16px"></i>
            <span>${currentSev.label}</span>
          </div>
          <div class="ai-diag-title">${escapeHtml(diag.titulo || 'Diagnóstico de Logs')}</div>
          <div class="ai-diag-rootcause">
            <strong>Causa Raiz:</strong> ${escapeHtml(diag.causaRaiz || 'Nenhuma falha crítica detectada.')}
          </div>
        </div>
        <div class="ai-banner-right">
          <div class="ai-kpi-chip">
            <span class="kpi-tag">Código / ID:</span>
            <span class="kpi-val mono">${escapeHtml(diag.codigoErro || 'N/A')}</span>
          </div>
          <div class="ai-kpi-chip">
            <span class="kpi-tag">Reinicialização:</span>
            <span class="kpi-val">${diag.requerReinicializacao ? '⚠ Recomendada' : '✔ Não necessária'}</span>
          </div>
          <div class="ai-kpi-chip">
            <span class="kpi-tag">Fonte Auditada:</span>
            <span class="kpi-val">${escapeHtml(result.logTitle || result.logType)}</span>
          </div>
        </div>
      </div>

      <!-- 2. GRID: EXPLICAÇÃO TÉCNICA + IMPACTO -->
      <div class="ai-details-grid">
        <div class="ai-info-card">
          <div class="ai-card-title">
            <i data-lucide="cpu" style="width:15px;height:15px;color:#818cf8"></i>
            Detalhamento Técnico do Subsistema
          </div>
          <div class="ai-card-body">
            ${escapeHtml(diag.explicacaoTecnica || 'Subsistema operando com integridade nominal.')}
          </div>
        </div>

        <div class="ai-info-card">
          <div class="ai-card-title">
            <i data-lucide="activity" style="width:15px;height:15px;color:#f59e0b"></i>
            Impacto no Desempenho e Estabilidade
          </div>
          <div class="ai-card-body">
            ${escapeHtml(diag.impactoSistema || 'Nenhum impacto adverso observado.')}
          </div>
        </div>
      </div>

      <!-- 3. PLANO DE AÇÃO: COMANDOS RECOMENDADOS EXECUTÁVEIS -->
      <div class="ai-action-plan-card">
        <div class="ai-plan-header">
          <div>
            <div class="ai-plan-title">
              <i data-lucide="terminal" style="width:17px;height:17px;color:#34d399"></i>
              Plano de Correção Automatizado
            </div>
            <div class="ai-plan-sub">Comandos gerados sob medida para sanar as inconsistências identificadas</div>
          </div>
          ${comandos.length > 1 ? `
            <button type="button" class="ai-btn-batch-exec" id="btn-ai-exec-all">
              <i data-lucide="zap" style="width:14px;height:14px"></i> Executar Todos os Comandos em Sequência
            </button>
          ` : ''}
        </div>

        <div class="ai-commands-list">
          ${comandos.length ? comandos.map((cmdObj, i) => `
            <div class="ai-cmd-row" data-cmd="${escapeHtml(cmdObj.comando)}">
              <div class="ai-cmd-meta">
                <span class="ai-cmd-num">#${i + 1}</span>
                <span class="ai-cmd-desc">${escapeHtml(cmdObj.descricao || 'Comando de Reparo')}</span>
                <span class="ai-cmd-type-tag">${escapeHtml(cmdObj.tipo || 'cmd').toUpperCase()}</span>
              </div>
              <div class="ai-cmd-code-box">
                <code>${escapeHtml(cmdObj.comando)}</code>
                <div class="ai-cmd-actions">
                  <button type="button" class="ai-cmd-btn btn-copy" title="Copiar Comando">
                    <i data-lucide="copy" style="width:13px;height:13px"></i> Copiar
                  </button>
                  <button type="button" class="ai-cmd-btn btn-exec" title="Executar este comando no ThunderTools">
                    <i data-lucide="play" style="width:13px;height:13px"></i> Executar
                  </button>
                </div>
              </div>
            </div>
          `).join('') : `
            <div style="font-size:12.5px;color:#94a3b8;padding:12px;text-align:center;">
              ✔ Nenhuma intervenção por linha de comando necessária. Os subsistemas inspecionados estão operacionais.
            </div>
          `}
        </div>
      </div>

      <!-- 4. ORIENTAÇÕES MANUAIS (SE HOUVER) -->
      ${orientacoes.length ? `
        <div class="ai-guidelines-card">
          <div class="ai-card-title" style="color:#38bdf8">
            <i data-lucide="check-square" style="width:15px;height:15px"></i>
            Orientações Práticas de Acompanhamento
          </div>
          <div class="ai-guidelines-list">
            ${orientacoes.map(o => `
              <div class="ai-guide-item">
                <i data-lucide="arrow-right" style="width:12px;height:12px;color:#38bdf8;flex-shrink:0"></i>
                <span>${escapeHtml(o)}</span>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <!-- 5. CARD DE SÍNTESE PARA O LAUDO TÉCNICO & ORDEM DE SERVIÇO -->
      <div class="ai-laudo-card">
        <div class="ai-laudo-header">
          <div>
            <div class="ai-laudo-title">
              <i data-lucide="file-text" style="width:16px;height:16px;color:#c084fc"></i>
              Síntese Formatada para a Ordem de Serviço
            </div>
            <div class="ai-laudo-sub">Texto técnico profissional formulado para o cliente e pronto para anexar ao Laudo Oficial</div>
          </div>
          <div style="display:flex; gap:8px;">
            <button type="button" class="ai-btn-laudo secondary" id="btn-copy-laudo-text">
              <i data-lucide="copy" style="width:13px;height:13px"></i> Copiar Texto
            </button>
            <button type="button" class="ai-btn-laudo primary" id="btn-send-to-so">
              <i data-lucide="clipboard-check" style="width:13px;height:13px"></i> Inserir no Laudo Técnico
            </button>
          </div>
        </div>
        <div class="ai-laudo-content" id="ai-laudo-text-content">
          ${escapeHtml(diag.textoParaLaudo || 'Equipamento auditado via Thunder IA no ThunderTools. Não foram encontradas corrupções nos arquivos de sistema.')}
        </div>
      </div>
    `;

    dashboardContainer.style.display = 'flex';
    createLucideIcons(dashboardContainer);

    // Botão de Nova Verificação Limpa (Zerar Dashboard)
    const btnClearNew = dashboardContainer.querySelector('#btn-ai-clear-and-new');
    if (btnClearNew) {
      btnClearNew.addEventListener('click', () => {
        dashboardContainer.style.display = 'none';
        if (emptyStateCard) emptyStateCard.style.display = 'block';
        if (customLogInput) customLogInput.value = '';
        localStorage.removeItem('thundertools_pending_ai_notes');
        toast('info', 'Verificação Reiniciada', 'Tela de diagnóstico da Thunder IA resetada. Pronto para novos testes.');
      });
    }

    // Eventos dos Comandos Individuais
    dashboardContainer.querySelectorAll('.ai-cmd-row').forEach(row => {
      const cmd = row.dataset.cmd;
      const copyBtn = row.querySelector('.btn-copy');
      const execBtn = row.querySelector('.btn-exec');

      if (copyBtn) {
        copyBtn.addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(cmd);
            const orig = copyBtn.innerHTML;
            copyBtn.innerHTML = '<i data-lucide="check" style="width:13px;height:13px;color:#34d399"></i> Copiado!';
            createLucideIcons(copyBtn);
            setTimeout(() => { copyBtn.innerHTML = orig; createLucideIcons(copyBtn); }, 2000);
          } catch (_) {}
        });
      }

      if (execBtn) {
        execBtn.addEventListener('click', async () => {
          execBtn.disabled = true;
          const orig = execBtn.innerHTML;
          execBtn.innerHTML = '<i data-lucide="loader" style="width:13px;height:13px;animation:spin 1s linear infinite"></i> Executando...';
          createLucideIcons(execBtn);

          try {
            const runRes = await window.api.runCommand(cmd);
            execBtn.disabled = false;
            if (runRes && runRes.success) {
              execBtn.innerHTML = '<i data-lucide="check-circle-2" style="width:13px;height:13px;color:#34d399"></i> Concluído';
              createLucideIcons(execBtn);
              toast('success', 'Comando Executado', `Executado com êxito: ${cmd}`);
              addToHistory(`Thunder IA: ${cmd.slice(0, 45)}`, cmd, true, 'terminal');
            } else {
              execBtn.innerHTML = '<i data-lucide="alert-triangle" style="width:13px;height:13px;color:#f87171"></i> Falhou';
              createLucideIcons(execBtn);
              toast('error', 'Falha no Comando', runRes?.output || 'Erro na execução.');
              addToHistory(`Thunder IA (Falha): ${cmd.slice(0, 45)}`, cmd, false, 'terminal');
            }
          } catch (err) {
            execBtn.disabled = false;
            execBtn.innerHTML = orig;
            createLucideIcons(execBtn);
            toast('error', 'Erro', err.message);
          }
        });
      }
    });

    // Executar Todos os Comandos em Lote
    const batchExecBtn = dashboardContainer.querySelector('#btn-ai-exec-all');
    if (batchExecBtn && comandos.length) {
      batchExecBtn.addEventListener('click', async () => {
        batchExecBtn.disabled = true;
        const orig = batchExecBtn.innerHTML;
        batchExecBtn.innerHTML = '<i data-lucide="loader" style="width:14px;height:14px;animation:spin 1s linear infinite"></i> Executando Plano de Ação...';
        createLucideIcons(batchExecBtn);

        let successCount = 0;
        for (let i = 0; i < comandos.length; i++) {
          const item = comandos[i];
          toast('info', `Executando [${i + 1}/${comandos.length}]`, item.descricao || item.comando);
          try {
            const r = await window.api.runCommand(item.comando);
            if (r && r.success) {
              successCount++;
              addToHistory(`Thunder IA (#${i + 1}): ${item.comando.slice(0, 45)}`, item.comando, true, 'terminal');
            } else {
              addToHistory(`Thunder IA (#${i + 1} Falha): ${item.comando.slice(0, 45)}`, item.comando, false, 'terminal');
            }
          } catch (_) {}
        }

        batchExecBtn.disabled = false;
        batchExecBtn.innerHTML = '<i data-lucide="check-check" style="width:14px;height:14px;color:#34d399"></i> Todos Concluídos';
        createLucideIcons(batchExecBtn);
        toast('success', 'Plano Concluído', `${successCount} de ${comandos.length} comando(s) executado(s) com sucesso.`);
      });
    }

    // Copiar Texto para Laudo
    const copyLaudoBtn = dashboardContainer.querySelector('#btn-copy-laudo-text');
    const laudoContentEl = dashboardContainer.querySelector('#ai-laudo-text-content');
    if (copyLaudoBtn && laudoContentEl) {
      copyLaudoBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(laudoContentEl.textContent.trim());
          const orig = copyLaudoBtn.innerHTML;
          copyLaudoBtn.innerHTML = '<i data-lucide="check" style="width:13px;height:13px;color:#34d399"></i> Copiado!';
          createLucideIcons(copyLaudoBtn);
          setTimeout(() => { copyLaudoBtn.innerHTML = orig; createLucideIcons(copyLaudoBtn); }, 2000);
          toast('success', 'Texto Copiado', 'Parecer técnico copiado para a área de transferência.');
        } catch (_) {}
      });
    }

    // Enviar Diretamente para a Ordem de Serviço
    const sendToSoBtn = dashboardContainer.querySelector('#btn-send-to-so');
    if (sendToSoBtn && laudoContentEl) {
      sendToSoBtn.addEventListener('click', () => {
        const text = laudoContentEl.textContent.trim();
        localStorage.setItem('thundertools_pending_ai_notes', text);
        toast('success', 'Enviado para o Laudo', 'Parecer inserido! Abrindo gerador de Ordem de Serviço...');
        showServiceOrderModal({
          prefilledNotes: text
        });
      });
    }
  }
}
