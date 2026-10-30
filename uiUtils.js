export function createLucideIcons() {
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons()
  }
}

const $ = selector => document.querySelector(selector);

const SVG = {
  success: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#86efac" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
  error:   `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fca5a5" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
  warning: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fde68a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`
};
export const SVG_ICONS = SVG; // Mantém o alias original[cite: 7]
const AUTO_CLOSE = 8000; //[cite: 7]

function notificationInlineIcon(name) { //[cite: 7]
  return `<span class="notification-inline-icon"><i data-lucide="${name}"></i></span>`; //[cite: 7]
}

// RESTAURADO: Lista completa e idêntica de mapeamento de ícones[cite: 7]
export function formatNotificationMessage(html) { //[cite: 7]
  const replacements = [ //[cite: 7]
    ['🖨️', 'printer'], //[cite: 7]
    ['👤', 'user'], //[cite: 7]
    ['🟢', 'check-circle-2'], //[cite: 7]
    ['🔴', 'x-circle'], //[cite: 7]
    ['🟡', 'alert-triangle'], //[cite: 7]
    ['⚪', 'circle'], //[cite: 7]
    ['⚠️', 'triangle-alert'], //[cite: 7]
    ['❌', 'x-circle'], //[cite: 7]
    ['🗑️', 'trash-2'], //[cite: 7]
    ['🔋', 'battery-charging'], //[cite: 7]
    ['📄', 'file-text'], //[cite: 7]
    ['💾', 'save'], //[cite: 7]
    ['💻', 'monitor'], //[cite: 7]
    ['📦', 'package'], //[cite: 7]
    ['⚙️', 'settings'], //[cite: 7]
    ['🔧', 'wrench'], //[cite: 7]
    ['🧠', 'memory-stick'], //[cite: 7]
    ['🕒', 'clock'], //[cite: 7]
    ['🌐', 'globe'], //[cite: 7]
    ['🏭', 'factory'], //[cite: 7]
    ['🔑', 'key-round'], //[cite: 7]
    ['🔍', 'search'], //[cite: 7]
    ['🚪', 'door-open'], //[cite: 7]
    ['📊', 'bar-chart-2'], //[cite: 7]
    ['⚡', 'zap'], //[cite: 7]
    ['🔄', 'rotate-cw'], //[cite: 7]
    ['⬇️', 'download'], //[cite: 7]
    ['🛡️', 'shield'], //[cite: 7]
    ['▶️', 'play-circle'], //[cite: 7]
    ['📶', 'wifi'], //[cite: 7]
    ['📦', 'package-x'], //[cite: 7]
    ['➕', 'user-plus'], //[cite: 7]
    ['🔌', 'power'], //[cite: 7]
    ['📡', 'radio'], //[cite: 7]
    ['🔎', 'search-code'], //[cite: 7]
    ['🩺', 'stethoscope'], //[cite: 7]
    ['💽', 'hard-drive'], //[cite: 7]
    ['💡', 'lightbulb'],
    ['🗂️', 'layers'], //[cite: 7]
    ['🗄️', 'database'], //[cite: 7]
    ['↔️', 'arrow-left-right'], //[cite: 7]
    ['🖥️', 'monitor'], //[cite: 7]
    ['✅', 'check-circle-2'], //[cite: 7]
    ['🚫', 'ban'], //[cite: 7]
    ['ℹ️', 'info'], //[cite: 7]
    ['❓', 'help-circle'], //[cite: 7]
    ['⭐', 'star'] //[cite: 7]
  ]; //[cite: 7]

  return replacements.reduce((formatted, [emoji, icon]) => { //[cite: 7]
    return formatted.split(emoji).join(notificationInlineIcon(icon)); //[cite: 7]
  }, String(html ?? '')); //[cite: 7]
} //[cite: 7]

export function dismissToast(el) { //[cite: 7]
  el.classList.add('hide'); //[cite: 7]
  setTimeout(() => el.remove(), 400); //[cite: 7]
} //[cite: 7]

export function showDetailsModal(title, output, formattedMsg) { //[cite: 7]
  const overlay = document.createElement('div'); //[cite: 7]
  overlay.className = 'modal-overlay'; //[cite: 7]
  const content = formatNotificationMessage(formattedMsg || output || 'Nenhuma saída registrada.'); //[cite: 7]
  
  overlay.innerHTML = `
    <div class="modal" style="max-width: 95%; width: 650px; max-height: 85vh; display: flex; flex-direction: column;">
      <div class="modal-title"><i data-lucide="info"></i> ${title}</div>
      <div id="modal-content-area" style="padding: 20px; flex: 1; overflow-y: auto; line-height: 1.7;">
        ${content}
      </div>
      <div class="modal-buttons">
        <button class="modal-btn primary" id="modal-close-details">Fechar</button>
      </div>
    </div>
  `; //[cite: 7]
  document.body.appendChild(overlay); //[cite: 7]
  createLucideIcons(); //[cite: 7]
  document.getElementById('modal-close-details').onclick = () => overlay.remove(); //[cite: 7]
} //[cite: 7]

export function showInputModal(title, description, placeholder, callback, inputType = 'text', oldOverlay = null) { //[cite: 7]
  if (oldOverlay) oldOverlay.remove(); //[cite: 7]
  const overlay = document.createElement('div'); //[cite: 7]
  overlay.className = 'modal-overlay'; //[cite: 7]
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-title"><i data-lucide="user-cog"></i> ${title}</div>
      <div class="modal-desc">${description}</div>
      <input type="${inputType}" class="modal-input modal-input-field" placeholder="${placeholder}">
      <div class="modal-buttons">
        <button class="modal-btn primary btn-confirm">Confirmar</button>
        <button class="modal-btn secondary btn-cancel">Cancelar</button>
      </div>
    </div>
  `; //[cite: 7]
  document.body.appendChild(overlay); //[cite: 7]
  createLucideIcons(); //[cite: 7]
  
  const input = overlay.querySelector('.modal-input-field'); //[cite: 7]
  input.focus(); //[cite: 7]
  overlay.querySelector('.btn-confirm').onclick = () => callback(input.value.trim(), overlay); //[cite: 7]
  overlay.querySelector('.btn-cancel').onclick = () => overlay.remove(); //[cite: 7]
} //[cite: 7]

export function showChoiceModal(title, description, options, callback, oldOverlay = null) { //[cite: 7]
  if (oldOverlay) oldOverlay.remove(); //[cite: 7]
  const overlay = document.createElement('div'); //[cite: 7]
  overlay.className = 'modal-overlay'; //[cite: 7]
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-title"><i data-lucide="help-circle"></i> ${title}</div>
      <div class="modal-desc">${description}</div>
      <div class="modal-buttons" style="flex-direction: column;">
        ${options.map((opt, idx) => `
          <button class="modal-btn ${opt.primary ? 'primary' : 'secondary'} choice-btn" data-index="${idx}">${opt.label}</button>
        `).join('')}
      </div>
    </div>
  `; //[cite: 7]
  document.body.appendChild(overlay); //[cite: 7]
  createLucideIcons(); //[cite: 7]
  overlay.querySelectorAll('.choice-btn').forEach(btn => { //[cite: 7]
    btn.onclick = () => callback(options[btn.dataset.index].value, overlay); //[cite: 7]
  }); //[cite: 7]
} //[cite: 7]

export function showDeleteUserModal(users, currentUser, callback) { //[cite: 7]
  const overlay = document.createElement('div'); //[cite: 7]
  overlay.className = 'modal-overlay'; //[cite: 7]
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-title"><i data-lucide="user-x"></i> Excluir usuário</div>
      <div class="modal-desc">Selecione uma conta para excluir. Usuário em uso: ${currentUser}. Contas de sistema e administradores padrão não podem ser excluídas.</div>
      <div id="delete-user-list" style="margin: 15px 0;">
        ${users.map((user) => `
          <label class="user-option-label ${!user.isDeletable ? 'disabled-user-label' : ''}" style="display:block; padding: 10px; border: 1px solid #333; margin-bottom: 5px; border-radius: 8px; ${!user.isDeletable ? 'opacity: 0.6; cursor: not-allowed;' : ''}">
            <input type="radio" name="delete-user" value="${user.name}" ${!user.isDeletable ? 'disabled' : ''}> ${user.name}
          </label>
        `).join('')}
      </div>
      <label style="font-size: 11px;"><input type="checkbox" id="delete-user-aware"> Estou ciente de que esta ação é destrutiva.</label>
      <div class="modal-buttons">
        <button class="modal-btn primary" id="delete-user-confirm" disabled>Excluir usuário</button>
        <button class="modal-btn secondary" id="delete-user-cancel">Cancelar</button>
      </div>
    </div>
  `; //[cite: 7]
  document.body.appendChild(overlay); //[cite: 7]
  createLucideIcons(); //[cite: 7]

  const aware = document.getElementById('delete-user-aware'); //[cite: 7]
  const confirmBtn = document.getElementById('delete-user-confirm'); //[cite: 7]
  
  const updateConfirmButtonState = () => { //[cite: 7]
    const selectedRadio = overlay.querySelector('input[name="delete-user"]:checked'); //[cite: 7]
    confirmBtn.disabled = !aware.checked || !selectedRadio || selectedRadio.disabled; //[cite: 7]
  }; //[cite: 7]

  aware.onchange = updateConfirmButtonState; //[cite: 7]
  overlay.querySelectorAll('input[name="delete-user"]').forEach(radio => { //[cite: 7]
    radio.onchange = updateConfirmButtonState; //[cite: 7]
  }); //[cite: 7]

  confirmBtn.onclick = () => { //[cite: 7]
    const selected = overlay.querySelector('input[name="delete-user"]:checked')?.value; //[cite: 7]
    if (selected) callback(selected, overlay); //[cite: 7]
  }; //[cite: 7]
  document.getElementById('delete-user-cancel').onclick = () => overlay.remove(); //[cite: 7]

  updateConfirmButtonState(); //[cite: 7]
} //[cite: 7]

// RESTAURADO + MELHORADO: O método original exato com as pontes setStatus/setLog acopladas[cite: 7]
export function transitionModalToExecution(overlay, title, initialStatus) { //[cite: 7]
  const modal = overlay.querySelector('.modal'); //[cite: 7]
  modal.innerHTML = `
    <div class="modal-title">
      <i data-lucide="loader-2" class="spinner"></i>
      ${title}
    </div>
    <div class="modal-desc" id="modal-status">${initialStatus}</div>
    <div id="modal-log-area" style="background: rgba(0,0,0,0.5); padding: 15px; border-radius: 8px; color: #a78bfa; font-family: monospace; font-size: 12px; max-height: 220px; overflow-y: auto; border: 1px solid rgba(139, 92, 246, 0.3); margin-top: 10px; display: none;"></div>
    <div class="modal-buttons" style="margin-top: 20px;">
      <button class="modal-btn primary" id="modal-close-btn">Cancelar</button>
    </div>
  `; //[cite: 7]
  createLucideIcons(); //[cite: 7]

  const statusEl = modal.querySelector('#modal-status'); //[cite: 7]
  const logEl = modal.querySelector('#modal-log-area'); //[cite: 7]
  const closeBtn = modal.querySelector('#modal-close-btn'); //[cite: 7]
  closeBtn.onclick = () => overlay.remove();

  return { //[cite: 7]
    setStatus: (msg, success) => { //[cite: 7]
      statusEl.innerHTML = msg; //[cite: 7]
      if (success === 'warning') {
        statusEl.style.color = '#fde047';
      } else {
        statusEl.style.color = success ? '#86efac' : '#fca5a5'; //[cite: 7]
      }
      closeBtn.disabled = false; //[cite: 7]
      closeBtn.textContent = 'Fechar'; //[cite: 7]
      closeBtn.onclick = () => overlay.remove(); //[cite: 7]
      
      // Remove a animação do spinner transformando-o num ícone estático de conclusão
      const titleEl = modal.querySelector('.modal-title');
      if (titleEl) {
        let icon = 'x-circle';
        if (success === 'warning') {
          icon = 'alert-triangle';
        } else if (success) {
          icon = 'check-circle';
        }
        // Recria a tag i para o Lucide renderizar o novo ícone
        titleEl.innerHTML = `<i data-lucide="${icon}"></i> ${title}`;
      }
      createLucideIcons(); //[cite: 7]
    },
    setLog: (log) => { //[cite: 7]
      if (log && log.trim()) { //[cite: 7]
        logEl.textContent = log; //[cite: 7]
        logEl.style.display = 'none'; //[cite: 7]
        
        // Adiciona o botão "Ver Detalhes" se ele ainda não existir
        const buttonsContainer = modal.querySelector('.modal-buttons');
        if (buttonsContainer && !buttonsContainer.querySelector('#modal-toggle-log-btn')) {
          const toggleBtn = document.createElement('button');
          toggleBtn.className = 'modal-btn secondary';
          toggleBtn.id = 'modal-toggle-log-btn';
          toggleBtn.textContent = 'Ver Detalhes';
          toggleBtn.style.marginRight = '10px';
          toggleBtn.onclick = () => {
            if (logEl.style.display === 'none') {
              logEl.style.display = 'block';
              toggleBtn.textContent = 'Ocultar Detalhes';
              logEl.scrollTop = logEl.scrollHeight;
            } else {
              logEl.style.display = 'none';
              toggleBtn.textContent = 'Ver Detalhes';
            }
          };
          buttonsContainer.insertBefore(toggleBtn, buttonsContainer.firstChild);
        }
      } //[cite: 7]
    } //[cite: 7]
  }; //[cite: 7]
} //[cite: 7]

// RESTAURADO: O gerador de toast original com animação e tratamento premium de botões[cite: 7]
export function toast(type, title, msg) { //[cite: 7]
  const el = document.createElement('div'); //[cite: 7]
  el.className = `toast ${type}`; //[cite: 7]
  el.innerHTML = `
    <style>
      @keyframes pulse-cancel {
        70% { transform: scale(1.02); box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); }
        100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
      }
      .toast-cancel-btn:hover {
        background: rgba(239, 68, 68, 0.35) !important;
        color: #ffffff !important;
        border-color: rgba(239, 68, 68, 0.8) !important;
        box-shadow: 0 0 15px rgba(239, 68, 68, 0.5) !important;
      }
    </style>
    <div class="toast-icon">${type === 'loading' ? '<span class="spinner"></span>' : SVG_ICONS[type]}</div>
    <div class="toast-body">
      <div class="toast-title">${title}</div>
      <div class="toast-msg">${formatNotificationMessage(msg)}</div>
    </div>
    ${type === 'loading'
      ? `<button class="toast-cancel-btn cancel-btn-premium" title="Cancelar comando" style="background: rgba(239, 68, 68, 0.15); color: #fca5a5; border: 1px solid rgba(239, 68, 68, 0.4); border-radius: 6px; padding: 5px 10px; font-size: 10px; font-weight: 800; cursor: pointer; margin-left: 10px; white-space: nowrap; animation: pulse-cancel 2s infinite; text-shadow: 0 0 5px rgba(239, 68, 68, 0.3); transition: all 0.2s; backdrop-filter: blur(4px);">CANCELAR</button>`
      : `<button class="toast-close" title="Fechar"><i data-lucide="x" style="width:14px;height:14px"></i></button>`}
    <div class="toast-bar" ${type !== 'loading' ? `style="animation-duration:${AUTO_CLOSE}ms"` : ''}></div>
  `; //[cite: 7]
  
  const container = document.getElementById('toast-container'); //[cite: 7]
  if (container) { //[cite: 7]
    container.appendChild(el); //[cite: 7]
  } else { //[cite: 7]
    document.body.appendChild(el); //[cite: 7]
  } //[cite: 7]
  
  createLucideIcons(); //[cite: 7]
  const btn = el.querySelector('.toast-cancel-btn, .toast-close'); //[cite: 7]
  btn.addEventListener('click', () => { //[cite: 7]
    if (el.classList.contains('loading')) { //[cite: 7]
      window.api.cancelCommand(); //[cite: 7]
    } //[cite: 7]
    dismissToast(el); //[cite: 7]
  }); //[cite: 7]
  if (type !== 'loading') setTimeout(() => dismissToast(el), AUTO_CLOSE); //[cite: 7]
  return el; //[cite: 7]
} //[cite: 7]

// RESTAURADO: updateToast original completo com cálculo dinâmico de expansão[cite: 7]
export function updateToast(el, type, title, html) { //[cite: 7]
  if (!el || !el.parentNode) return; //[cite: 7]
  el.className = `toast ${type}`; //[cite: 7]
  
  const cancelBtn = el.querySelector('.toast-cancel-btn'); //[cite: 7]
  if (cancelBtn && type !== 'loading') { //[cite: 7]
    const closeBtn = document.createElement('button'); //[cite: 7]
    closeBtn.className = 'toast-close'; //[cite: 7]
    closeBtn.title = 'Fechar'; //[cite: 7]
    closeBtn.innerHTML = '<i data-lucide="x" style="width:14px;height:14px"></i>'; //[cite: 7]
    closeBtn.addEventListener('click', () => dismissToast(el)); //[cite: 7]
    cancelBtn.replaceWith(closeBtn); //[cite: 7]
    createLucideIcons(); //[cite: 7]
  } else { //[cite: 7]
    const closeBtn = el.querySelector('.toast-close'); //[cite: 7]
    if (closeBtn) closeBtn.title = 'Fechar'; //[cite: 7]
  } //[cite: 7]

  const lineCount = (html.match(/<br>/gi) || []).length + 1; //[cite: 7]
  const charCount = html.replace(/<[^>]*>/g, '').length; //[cite: 7]
  if (lineCount > 4 || charCount > 200) { //[cite: 7]
    el.classList.add('expanded'); //[cite: 7]
  } //[cite: 7]
  
  el.querySelector('.toast-icon').innerHTML = SVG_ICONS[type]; //[cite: 7]
  el.querySelector('.toast-title').textContent = title; //[cite: 7]
  el.querySelector('.toast-msg').innerHTML = formatNotificationMessage(html); //[cite: 7]
  createLucideIcons(); //[cite: 7]
  
  const bar = el.querySelector('.toast-bar'); //[cite: 7]
  bar.style.animation = 'none'; //[cite: 7]
  bar.offsetHeight; // Reflow //[cite: 7]
  bar.style.animation = `shrink ${AUTO_CLOSE}ms linear forwards`; //[cite: 7]
} //[cite: 7]

// RESTAURADO: Janela de progresso nativa flutuante dos serviços de longa duração[cite: 7]
export function createServiceProgressWindow(title, initialMessage) { //[cite: 7]
  const el = document.createElement('div') //[cite: 7]
  el.className = 'service-progress-window expanded running' //[cite: 7]
  el.innerHTML = `
    <style>
      @keyframes pulse-cancel {
        0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
        70% { transform: scale(1.02); box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); }
        100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
      }
      @keyframes pulse-ring {
        0% { box-shadow: 0 0 0 0 rgba(129, 140, 248, 0.35), inset 0 1px 0 rgba(255,255,255,0.08); }
        70% { box-shadow: 0 0 0 7px rgba(129, 140, 248, 0), inset 0 1px 0 rgba(255,255,255,0.08); }
        100% { box-shadow: 0 0 0 0 rgba(129, 140, 248, 0), inset 0 1px 0 rgba(255,255,255,0.08); }
      }
      .service-progress-window.running .service-progress-icon {
        animation: pulse-ring 2s cubic-bezier(0.25, 0, 0, 1) infinite;
      }
      .service-progress-actions .cancel-btn-premium {
        width: auto !important;
        height: auto !important;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: linear-gradient(135deg, #ef4444, #dc2626);
        color: #ffffff;
        font-family: 'Raleway', sans-serif;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.8px;
        padding: 6px 12px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 7px;
        cursor: pointer;
        transition: all 0.22s cubic-bezier(0.4, 0, 0.2, 1);
        box-shadow: 0 4px 12px rgba(239, 68, 68, 0.25);
        align-self: center;
        user-select: none;
        white-space: nowrap;
        flex-shrink: 0;
      }
      .service-progress-actions .cancel-btn-premium:hover {
        background: linear-gradient(135deg, #f87171, #ef4444) !important;
        transform: translateY(-1px);
        box-shadow: 0 6px 16px rgba(239, 68, 68, 0.4) !important;
        border-color: rgba(255, 255, 255, 0.2) !important;
        color: #ffffff !important;
      }
      .service-progress-actions .cancel-btn-premium:active {
        transform: translateY(0);
        box-shadow: 0 2px 8px rgba(239, 68, 68, 0.2) !important;
      }
      .service-progress-actions .cancel-btn-premium svg {
        width: 14px;
        height: 14px;
        stroke-width: 2.5;
        flex-shrink: 0;
      }
      .service-progress-actions {
        flex-shrink: 0;
      }
      .service-progress-percent {
        flex-shrink: 0;
      }
    </style>
    <div class="service-progress-main" style="flex-direction: column; gap: 12px; padding: 16px;">
      <div class="service-progress-head" style="width: 100%; display: flex; align-items: center; gap: 12px; margin-bottom: 0;">
        <div class="service-progress-icon" style="width: 32px; height: 32px; flex: 0 0 32px;"><span class="spinner"></span></div>
        <div class="service-progress-title" style="margin-bottom: 0; flex: 1; font-size: 14px; font-weight: 700; line-height: 1.25; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${title}</div>
        <div style="display: flex; align-items: center; gap: 14px; flex-shrink: 0;">
          <div class="service-progress-percent" style="font-family: 'Raleway', sans-serif; font-size: 16px; font-weight: 800;">0%</div>
          <div class="service-progress-actions">
            <button class="cancel-btn-premium" title="Cancelar Comando">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-circle-stop"><circle cx="12" cy="12" r="10"/><rect width="6" height="6" x="9" y="9" rx="1"/></svg>
              <span>Cancelar</span>
            </button>
          </div>
        </div>
      </div>
      <div class="service-progress-body" style="width: 100%; padding: 0;">
        <div class="service-progress-track" style="margin-bottom: 8px;">
          <div class="service-progress-fill" style="width: 0%"></div>
        </div>
        <div class="service-progress-log" style="font-size: 12px; background: rgba(0,0,0,0.2); padding: 6px 8px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.03); max-height: 60px; overflow-y: auto; line-height: 1.4;">${initialMessage}</div>
      </div>
    </div>
  ` //[cite: 7]
  document.body.appendChild(el) //[cite: 7]

  const btnCancel = el.querySelector('.service-progress-actions button');
  if (btnCancel && window.api && window.api.cancelCommand) {
    btnCancel.addEventListener('click', () => {
      window.api.cancelCommand();
    });
  }
  
  return {
    update: (data) => {
      if (data.percent !== undefined && data.percent !== null) {
        const percentEl = el.querySelector('.service-progress-percent');
        if (percentEl) percentEl.textContent = `${data.percent}%`;
        const fillEl = el.querySelector('.service-progress-fill');
        if (fillEl) fillEl.style.width = `${data.percent}%`;
      }
      if (data.message !== undefined && data.message !== null && data.message.trim() !== '') {
        const msgEl = el.querySelector('.service-progress-log');
        if (msgEl) msgEl.textContent = data.message;
      }
    },
    finish: (success, finalMessage) => {
      el.classList.remove('running');
      el.classList.add(success ? 'success' : 'error');
      
      const actionsEl = el.querySelector('.service-progress-actions');
      if (actionsEl) actionsEl.remove();

      const iconContainer = el.querySelector('.service-progress-icon');
      if (iconContainer) {
        iconContainer.innerHTML = success ? SVG.success : SVG.error;
      }
      const msgEl = el.querySelector('.service-progress-log');
      if (msgEl && finalMessage) msgEl.textContent = finalMessage;
      
      const percentEl = el.querySelector('.service-progress-percent');
      if (percentEl) percentEl.textContent = success ? '100%' : 'Erro';
      const fillEl = el.querySelector('.service-progress-fill');
      if (fillEl) fillEl.style.width = success ? '100%' : '0%';
      
      setTimeout(() => {
        el.classList.remove('expanded');
        setTimeout(() => el.remove(), 500);
      }, 4000);
    }
  };
}