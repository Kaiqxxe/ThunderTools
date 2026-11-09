// ─── Driver Backup & Restore Manager Modal ─────────────────────────────────
// ThunderTools - Thunder Sistemas

import { runPs, runPsJson } from './proFeatures.js';

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

const STORAGE_KEY_CUSTOM_PATHS = 'thundertools_driver_backup_custom_paths';

function getSavedCustomPaths() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CUSTOM_PATHS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function saveCustomPath(newPath) {
  if (!newPath) return;
  try {
    const existing = getSavedCustomPaths();
    const normalized = newPath.trim().toLowerCase();
    const filtered = existing.filter(p => p.trim().toLowerCase() !== normalized);
    filtered.unshift(newPath.trim());
    localStorage.setItem(STORAGE_KEY_CUSTOM_PATHS, JSON.stringify(filtered.slice(0, 15)));
  } catch (_) {}
}

export function showDriverBackupModal(ctx = {}) {
  const existing = document.getElementById('tt-driver-backup-modal-overlay');
  if (existing) existing.remove();

  const toastFn = ctx.toast || window.toast || ((type, title, msg) => console.log(`[${type}] ${title}: ${msg}`));
  const addHistoryFn = ctx.addToHistory || window.addToHistory || (() => {});

  let discoveredBackups = [];
  let isBackingUp = false;
  let isRestoring = false;

  const overlay = document.createElement('div');
  overlay.id = 'tt-driver-backup-modal-overlay';
  overlay.className = 'modal-overlay';

  overlay.innerHTML = `
    <div class="modal details-modal driver-backup-modal" role="dialog" aria-modal="true" style="width: min(880px, 95vw); max-width: 880px;">
      <!-- Header -->
      <div class="details-modal-header" style="margin-bottom: 14px;">
        <div class="details-header-lead">
          <div class="details-header-icon-box" style="color: #34d399; background: rgba(16, 185, 129, 0.16); border-color: rgba(16, 185, 129, 0.35); box-shadow: 0 0 20px rgba(16, 185, 129, 0.2);">
            <i data-lucide="hard-drive-download"></i>
          </div>
          <div>
            <div class="details-modal-title">
              <span>Central de Backup & Restauração de Drivers</span>
              <span class="details-count-pill" id="driver-status-pill" style="background: rgba(16, 185, 129, 0.16); border-color: rgba(16, 185, 129, 0.35); color: #6ee7b7;">Exportar & Restaurar (.INF)</span>
            </div>
            <div class="details-modal-desc">
              Crie cópias de segurança de todos os drivers instalados e restaure pacotes (.INF) para seus dispositivos originais no Windows.
            </div>
          </div>
        </div>
        <button class="modal-close-icon-btn" id="driver-x-close" title="Fechar (Esc)">
          <i data-lucide="x"></i>
        </button>
      </div>

      <!-- Action Banner: Criar Novo Backup -->
      <div class="driver-create-banner" style="background: linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(15, 23, 42, 0.75) 100%); border: 1px solid rgba(16, 185, 129, 0.35); border-radius: 12px; padding: 14px 18px; margin-bottom: 14px;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
          <div style="min-width: 0; flex: 1;">
            <div style="font-size: 14px; font-weight: 700; color: #ecfdf5; display: flex; align-items: center; gap: 8px;">
              <i data-lucide="folder-plus" style="width:16px;height:16px;color:#34d399"></i>
              <span>Criar Novo Backup Completo do Sistema</span>
            </div>
            <div style="font-size: 11.5px; color: #94a3b8; margin-top: 3px; line-height: 1.45;">
              Exporta todos os drivers de terceiros (vídeo, rede, som, chipset e periféricos) diretamente para uma pasta organizada.
            </div>
            <div style="display: flex; align-items: center; gap: 6px; margin-top: 6px; font-size: 11px; color: #6ee7b7; font-family: monospace;">
              <i data-lucide="folder" style="width:13px;height:13px;"></i>
              <span id="driver-target-preview">Área de Trabalho\\Backup-Drivers-[Data]</span>
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <button type="button" class="modal-btn secondary" id="btn-custom-dest" style="padding: 7px 12px; font-size: 11.5px;" title="Escolher outra pasta para salvar o backup">
              <i data-lucide="folder-search" style="width:13px;height:13px"></i> Mudar Pasta
            </button>
            <button type="button" class="modal-btn primary" id="btn-start-backup" style="padding: 8px 18px; font-size: 12.5px; background: linear-gradient(135deg, #059669 0%, #10b981 100%); border: none; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.35);">
              <i data-lucide="download" style="width:14px;height:14px"></i> Criar Backup Agora
            </button>
          </div>
        </div>

        <!-- Barra de Progresso do Backup (Oculta por padrão) -->
        <div id="driver-backup-progress-wrap" style="display: none; margin-top: 12px; padding-top: 12px; border-top: 1px dashed rgba(16, 185, 129, 0.3);">
          <div style="display: flex; align-items: center; justify-content: space-between; font-size: 12px; color: #a7f3d0; margin-bottom: 6px;">
            <span id="driver-backup-step-msg" style="display: flex; align-items: center; gap: 8px;">
              <i data-lucide="loader-2" class="spinner" style="width:14px;height:14px;color:#34d399"></i>
              Exportando drivers via Windows DISM...
            </span>
            <span style="font-size: 11px; color: #94a3b8;">Isso pode levar de 30 a 60 segundos</span>
          </div>
          <div style="height: 6px; background: rgba(0, 0, 0, 0.4); border-radius: 4px; overflow: hidden;">
            <div id="driver-backup-pbar" style="width: 25%; height: 100%; background: linear-gradient(90deg, #10b981, #38bdf8); border-radius: 4px; transition: width 0.3s;"></div>
          </div>
        </div>
      </div>

      <!-- Toolbar de Backups Existentes -->
      <div class="details-toolbar" style="margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
        <div class="details-search-box" style="flex: 1; max-width: 450px;">
          <i data-lucide="search"></i>
          <input type="text" id="driver-search-input" placeholder="Filtrar por nome de pasta, data ou caminho...">
        </div>

        <div style="display: flex; align-items: center; gap: 8px;">
          <button type="button" class="modal-btn secondary" id="btn-browse-folder" style="padding: 7px 12px; font-size: 11.5px; display: flex; align-items: center; gap: 6px;" title="Selecionar uma pasta qualquer de backup em pendrive ou disco">
            <i data-lucide="folder-search" style="width:13px;height:13px"></i> Procurar Outra Pasta...
          </button>
          <button type="button" class="modal-btn secondary" id="btn-refresh-backups" style="padding: 7px 12px; font-size: 11.5px; display: flex; align-items: center; gap: 6px;" title="Re-escanear pastas de backup">
            <i data-lucide="refresh-cw" style="width:13px;height:13px"></i> Atualizar
          </button>
        </div>
      </div>

      <!-- Viewport de Backups Disponíveis -->
      <div class="details-content-viewport" id="driver-backups-viewport" style="max-height: 48vh; min-height: 240px; overflow-y: auto;">
        <div style="background: rgba(0, 0, 0, 0.2); border: 1px dashed rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 40px 20px; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px;">
          <div style="width: 48px; height: 48px; border-radius: 12px; background: rgba(16, 185, 129, 0.14); display: flex; align-items: center; justify-content: center; color: #34d399;">
            <i data-lucide="loader-2" class="spinner" style="width: 24px; height: 24px;"></i>
          </div>
          <div style="font-size: 15px; font-weight: 700; color: #f1f5f9;">Procurando backups de drivers anteriores...</div>
          <div style="font-size: 12px; color: #94a3b8; max-width: 420px; line-height: 1.5;">
            Verificando a Área de Trabalho, diretórios do usuário e pastas padrão de exportação.
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="details-modal-footer" style="margin-top: 12px; padding-top: 10px; border-top: 1px solid rgba(255, 255, 255, 0.08); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
        <div class="details-footer-tip">
          <i data-lucide="keyboard" style="width: 13px; height: 13px; color: #64748b;"></i>
          <span>Pressione <kbd>ESC</kbd> para fechar</span>
        </div>
        <div class="details-footer-actions" style="display: flex; align-items: center; gap: 8px;">
          <button class="modal-btn secondary" id="btn-open-devmgmt" style="display: flex; align-items: center; gap: 6px; font-size: 11.5px;" title="Abrir Gerenciador de Dispositivos (devmgmt.msc)">
            <i data-lucide="cpu" style="width:13px;height:13px"></i> Gerenciador de Dispositivos
          </button>
          <button class="modal-btn primary" id="driver-close-btn" style="min-width: 90px;">Fechar</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  createLucideIcons(overlay);

  // Element references
  const statusPill = overlay.querySelector('#driver-status-pill');
  const targetPreview = overlay.querySelector('#driver-target-preview');
  const btnCustomDest = overlay.querySelector('#btn-custom-dest');
  const btnStartBackup = overlay.querySelector('#btn-start-backup');
  const backupProgressWrap = overlay.querySelector('#driver-backup-progress-wrap');
  const backupStepMsg = overlay.querySelector('#driver-backup-step-msg');
  const backupPbar = overlay.querySelector('#driver-backup-pbar');

  const searchInput = overlay.querySelector('#driver-search-input');
  const btnBrowseFolder = overlay.querySelector('#btn-browse-folder');
  const btnRefreshBackups = overlay.querySelector('#btn-refresh-backups');
  const backupsViewport = overlay.querySelector('#driver-backups-viewport');
  const btnOpenDevmgmt = overlay.querySelector('#btn-open-devmgmt');

  const closeBtn = overlay.querySelector('#driver-close-btn');
  const xCloseBtn = overlay.querySelector('#driver-x-close');

  let chosenCustomDestFolder = null;

  const closeModal = () => {
    overlay.remove();
    document.removeEventListener('keydown', onKeyDown);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape' && !isBackingUp && !isRestoring) closeModal();
  };
  document.addEventListener('keydown', onKeyDown);
  overlay.onclick = (e) => {
    if (e.target === overlay && !isBackingUp && !isRestoring) closeModal();
  };
  closeBtn.onclick = closeModal;
  xCloseBtn.onclick = closeModal;

  btnOpenDevmgmt.onclick = () => {
    window.api.runCommand('devmgmt.msc');
  };

  // Mudar Pasta de Destino do Backup
  btnCustomDest.onclick = async () => {
    if (window.api && typeof window.api.selectFolder === 'function') {
      const res = await window.api.selectFolder({ title: 'Escolha a Pasta onde Salvar o Backup de Drivers' });
      if (res && !res.canceled && res.folderPath) {
        chosenCustomDestFolder = res.folderPath;
        targetPreview.textContent = `${chosenCustomDestFolder}\\Backup-Drivers-[Data]`;
        toastFn('info', 'Destino Atualizado', `O próximo backup será criado em: ${chosenCustomDestFolder}`);
      }
    } else {
      toastFn('warning', 'Seleção de Pasta', 'Diálogo nativo indisponível.');
    }
  };

  // Procurar Outra Pasta de Backup Manualmente
  btnBrowseFolder.onclick = async () => {
    if (window.api && typeof window.api.selectFolder === 'function') {
      const res = await window.api.selectFolder({ title: 'Selecione a Pasta do Backup de Drivers para Restaurar' });
      if (res && !res.canceled && res.folderPath) {
        saveCustomPath(res.folderPath);
        toastFn('info', 'Pasta Adicionada', `Verificando drivers em: ${res.folderPath}`);
        await scanBackups();
      }
    }
  };

  btnRefreshBackups.onclick = () => {
    scanBackups();
  };

  // 1. SCAN DE BACKUPS EXISTENTES
  const scanBackups = async () => {
    statusPill.textContent = 'Procurando Backups...';
    btnRefreshBackups.disabled = true;

    backupsViewport.innerHTML = `
      <div style="background: rgba(0, 0, 0, 0.2); border: 1px dashed rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 40px 20px; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px;">
        <div style="width: 48px; height: 48px; border-radius: 12px; background: rgba(16, 185, 129, 0.14); display: flex; align-items: center; justify-content: center; color: #34d399;">
          <i data-lucide="loader-2" class="spinner" style="width: 24px; height: 24px;"></i>
        </div>
        <div style="font-size: 15px; font-weight: 700; color: #f1f5f9;">Localizando backups de drivers anteriores...</div>
        <div style="font-size: 12px; color: #94a3b8; max-width: 420px; line-height: 1.5;">
          Pesquisando na Área de Trabalho e pastas personalizadas.
        </div>
      </div>
    `;
    createLucideIcons(backupsViewport);

    const customPaths = getSavedCustomPaths();
    const customPathsJson = JSON.stringify(customPaths).replace(/"/g, '`"');

    const script = `
$desktop = [Environment]::GetFolderPath('Desktop')
$candidates = @(
  (Join-Path $desktop 'Backup-Drivers*'),
  (Join-Path $desktop 'DriversBackup*'),
  (Join-Path $env:USERPROFILE 'ThunderTools\\DriverBackups\\*'),
  'C:\\Backup-Drivers*',
  'C:\\DriversBackup*'
)

$customList = '${customPathsJson}' | ConvertFrom-Json
if ($customList) {
  foreach ($cp in $customList) {
    if ($cp -and (Test-Path $cp)) {
      $candidates += $cp
    }
  }
}

$backups = @()
$seen = @{}

foreach ($pattern in $candidates) {
  Get-Item -Path $pattern -ErrorAction SilentlyContinue | Where-Object { $_.PSIsContainer } | ForEach-Object {
    $dir = $_
    $norm = $dir.FullName.ToLower()
    if (-not $seen.ContainsKey($norm)) {
      $seen[$norm] = $true
      $infs = @(Get-ChildItem -Path $dir.FullName -Filter '*.inf' -Recurse -ErrorAction SilentlyContinue)
      if ($infs.Count -gt 0) {
        $allFiles = @(Get-ChildItem -Path $dir.FullName -Recurse -ErrorAction SilentlyContinue | Where-Object { -not $_.PSIsContainer })
        $sizeBytes = ($allFiles | Measure-Object -Property Length -Sum -ErrorAction SilentlyContinue).Sum
        $manifestFile = Join-Path $dir.FullName 'manifest.json'
        $manifestData = $null
        if (Test-Path $manifestFile) {
          try {
            $manifestData = Get-Content -Path $manifestFile -Raw -Encoding UTF8 -ErrorAction SilentlyContinue | ConvertFrom-Json
          } catch {}
        }

        $backups += [PSCustomObject]@{
          Name = $dir.Name
          Path = $dir.FullName
          CreationTime = $dir.CreationTime.ToString('dd/MM/yyyy HH:mm')
          LastWriteTime = $dir.LastWriteTime.ToString('dd/MM/yyyy HH:mm')
          InfCount = $infs.Count
          SizeMB = [math]::Round(($sizeBytes / 1MB), 1)
          Manifest = $manifestData
        }
      }
    }
  }
}

if ($backups.Count -eq 0) {
  Write-Output "[]"
} else {
  $backups | Sort-Object LastWriteTime -Descending | ConvertTo-Json -Depth 3
}
`;

    try {
      const res = await runPsJson(script, []);
      discoveredBackups = Array.isArray(res) ? res : (res ? [res] : []);
      renderBackupsList();
    } catch (err) {
      statusPill.textContent = 'Erro ao buscar';
      backupsViewport.innerHTML = `
        <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 12px; padding: 24px; text-align: center; color: #fca5a5;">
          <i data-lucide="alert-triangle" style="width:32px;height:32px;color:#ef4444;margin-bottom:8px"></i>
          <div style="font-size: 14px; font-weight: 700; color: #f87171;">Não foi possível listar pastas de backup</div>
          <div style="font-size: 12px; margin-top: 4px;">${escapeHtml(err.message || 'Erro durante a busca')}</div>
        </div>
      `;
      createLucideIcons(backupsViewport);
    } finally {
      btnRefreshBackups.disabled = false;
    }
  };

  // Renderiza os Cards de Backup
  const renderBackupsList = () => {
    statusPill.textContent = `${discoveredBackups.length} Backup${discoveredBackups.length !== 1 ? 's' : ''} Encontrado${discoveredBackups.length !== 1 ? 's' : ''}`;

    if (discoveredBackups.length === 0) {
      backupsViewport.innerHTML = `
        <div style="background: rgba(0, 0, 0, 0.2); border: 1px dashed rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 36px 20px; text-align: center; color: #94a3b8;">
          <div style="width: 44px; height: 44px; border-radius: 12px; background: rgba(148, 163, 184, 0.08); display: inline-flex; align-items: center; justify-content: center; color: #94a3b8; margin-bottom: 10px;">
            <i data-lucide="folder-x" style="width: 22px; height: 22px;"></i>
          </div>
          <div style="font-size: 14px; font-weight: 700; color: #f1f5f9;">Nenhum backup de drivers encontrado</div>
          <div style="font-size: 12px; max-width: 460px; margin: 6px auto 14px; line-height: 1.5;">
            Nenhuma pasta com drivers (.INF) foi localizada na Área de Trabalho ou locais padrão. Você pode criar um novo backup agora pelo banner acima ou selecionar uma pasta existente em outro disco/pendrive.
          </div>
          <button type="button" class="modal-btn secondary" id="btn-empty-browse" style="padding: 7px 16px; font-size: 12px; display: inline-flex; align-items: center; gap: 6px;">
            <i data-lucide="folder-search" style="width:13px;height:13px"></i> Procurar Pasta Manualmente
          </button>
        </div>
      `;
      createLucideIcons(backupsViewport);
      const btnEmptyBrowse = backupsViewport.querySelector('#btn-empty-browse');
      if (btnEmptyBrowse) {
        btnEmptyBrowse.onclick = () => btnBrowseFolder.click();
      }
      return;
    }

    const cardsHtml = discoveredBackups.map((bk, idx) => {
      const searchTerms = `${bk.Name} ${bk.Path} ${bk.CreationTime} ${bk.InfCount}inf`.toLowerCase();
      const sizeText = bk.SizeMB >= 1024 ? `${(bk.SizeMB / 1024).toFixed(2)} GB` : `${bk.SizeMB} MB`;

      return `
        <div class="details-result-card driver-backup-card" data-search="${escapeHtml(searchTerms)}" style="border-left: 3px solid #10b981; margin-bottom: 10px; background: rgba(255, 255, 255, 0.025); border: 1px solid rgba(16, 185, 129, 0.22); border-radius: 12px; padding: 14px 18px; transition: all 0.2s ease;">
          <div class="result-card-top" style="align-items: flex-start; justify-content: space-between;">
            <div style="display: flex; gap: 12px; min-width: 0; flex: 1;">
              <div class="result-card-icon-wrap" style="color: #34d399; background: rgba(16, 185, 129, 0.14); border-color: rgba(16, 185, 129, 0.35); flex-shrink: 0;">
                <i data-lucide="archive"></i>
              </div>
              <div style="min-width: 0; flex: 1;">
                <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
                  <div class="result-card-name" style="font-size: 14px; font-weight: 700; color: #f8fafc;">
                    ${escapeHtml(bk.Name)}
                  </div>
                  <span class="details-chip" style="background: rgba(16, 185, 129, 0.12); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3);">
                    <i data-lucide="check-circle-2"></i> Pronto para Restaurar
                  </span>
                </div>

                <div class="result-card-chips" style="margin-top: 6px;">
                  <span class="details-chip" style="background: rgba(99, 102, 241, 0.14); color: #c7d2fe; border: 1px solid rgba(99, 102, 241, 0.3);">
                    <i data-lucide="layers"></i> ${bk.InfCount} Pacotes (.INF)
                  </span>
                  <span class="details-chip" style="background: rgba(56, 189, 248, 0.12); color: #7dd3fc; border: 1px solid rgba(56, 189, 248, 0.25);">
                    <i data-lucide="hard-drive"></i> ${sizeText}
                  </span>
                  <span class="details-chip" style="background: rgba(148, 163, 184, 0.1); color: #94a3b8; border: 1px solid rgba(148, 163, 184, 0.2);">
                    <i data-lucide="calendar"></i> Criado em ${escapeHtml(bk.CreationTime || bk.LastWriteTime)}
                  </span>
                </div>

                <div style="margin-top: 8px; font-family: monospace; font-size: 11px; color: #64748b; background: rgba(0, 0, 0, 0.3); padding: 4px 8px; border-radius: 6px; word-break: break-all; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                  <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(bk.Path)}</span>
                  <button type="button" class="btn-copy-path" data-path="${escapeHtml(bk.Path)}" title="Copiar caminho" style="background:none; border:none; color:#94a3b8; cursor:pointer; padding:2px 4px;">
                    <i data-lucide="copy" style="width:12px;height:12px"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Ações do Card de Backup -->
          <div style="display: flex; justify-content: flex-end; align-items: center; gap: 8px; margin-top: 12px; padding-top: 10px; border-top: 1px solid rgba(255, 255, 255, 0.06); flex-wrap: wrap;">
            <button type="button" class="modal-btn secondary btn-open-folder" data-path="${escapeHtml(bk.Path)}" style="padding: 6px 12px; font-size: 11.5px; display: inline-flex; align-items: center; gap: 6px;">
              <i data-lucide="folder" style="width:13px;height:13px"></i> Abrir Pasta
            </button>
            <button type="button" class="modal-btn secondary btn-inspect-drivers" data-path="${escapeHtml(bk.Path)}" style="padding: 6px 12px; font-size: 11.5px; display: inline-flex; align-items: center; gap: 6px;">
              <i data-lucide="list" style="width:13px;height:13px"></i> Listar Drivers (.INF)
            </button>
            <button type="button" class="modal-btn primary btn-restore-backup" data-path="${escapeHtml(bk.Path)}" data-name="${escapeHtml(bk.Name)}" data-count="${bk.InfCount}" style="padding: 6px 16px; font-size: 11.5px; background: linear-gradient(135deg, #059669 0%, #10b981 100%); border: none; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3); display: inline-flex; align-items: center; gap: 6px;">
              <i data-lucide="rotate-ccw" style="width:13px;height:13px"></i> Restaurar Drivers no Windows
            </button>
          </div>
        </div>
      `;
    }).join('');

    backupsViewport.innerHTML = `<div class="driver-cards-container">${cardsHtml}</div>`;
    createLucideIcons(backupsViewport);

    // Eventos dos Cards
    backupsViewport.querySelectorAll('.btn-copy-path').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const p = btn.dataset.path;
        if (p) {
          navigator.clipboard.writeText(p);
          const orig = btn.innerHTML;
          btn.innerHTML = '<i data-lucide="check" style="width:12px;height:12px;color:#10b981"></i>';
          createLucideIcons(btn);
          setTimeout(() => {
            btn.innerHTML = orig;
            createLucideIcons(btn);
          }, 1500);
        }
      };
    });

    backupsViewport.querySelectorAll('.btn-open-folder').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const p = btn.dataset.path;
        if (p && window.api && typeof window.api.openFilePath === 'function') {
          window.api.openFilePath(p);
        } else if (p) {
          window.api.runCommand(`explorer.exe "${p}"`);
        }
      };
    });

    backupsViewport.querySelectorAll('.btn-inspect-drivers').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const p = btn.dataset.path;
        showInspectDriversModal(p);
      };
    });

    backupsViewport.querySelectorAll('.btn-restore-backup').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const path = btn.dataset.path;
        const name = btn.dataset.name;
        const count = btn.dataset.count;
        promptRestoreBackup({ path, name, count });
      };
    });
  };

  // Filtro de busca na lista de backups
  searchInput.oninput = (e) => {
    const q = e.target.value.toLowerCase().trim();
    const cards = backupsViewport.querySelectorAll('.driver-backup-card');
    let visible = 0;
    cards.forEach(card => {
      const text = (card.dataset.search || card.textContent || '').toLowerCase();
      const match = !q || text.includes(q);
      card.style.display = match ? '' : 'none';
      if (match) visible++;
    });
    statusPill.textContent = q ? `${visible} de ${cards.length}` : `${discoveredBackups.length} Backups`;
  };

  // 2. CRIAR NOVO BACKUP COMPLETO
  btnStartBackup.onclick = async () => {
    if (isBackingUp) return;
    isBackingUp = true;
    btnStartBackup.disabled = true;
    btnCustomDest.disabled = true;
    btnStartBackup.innerHTML = '<i data-lucide="loader-2" class="spinner" style="width:14px;height:14px"></i> Gerando Backup...';
    createLucideIcons(btnStartBackup);

    backupProgressWrap.style.display = 'block';
    backupPbar.style.width = '20%';
    backupStepMsg.innerHTML = '<i data-lucide="loader-2" class="spinner" style="width:14px;height:14px;color:#34d399"></i> Inicializando diretório e chamando Export-WindowsDriver...';
    createLucideIcons(backupStepMsg);

    const now = new Date();
    const dateStamp = now.toISOString().slice(0, 10) + '_' + String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0');
    const folderName = `Backup-Drivers-${dateStamp}`;

    const script = `
$destParent = '${chosenCustomDestFolder ? chosenCustomDestFolder.replace(/'/g, "''") : ''}'
if (-not $destParent -or -not (Test-Path $destParent)) {
  $destParent = [Environment]::GetFolderPath('Desktop')
}

$dest = Join-Path $destParent '${folderName}'
New-Item -ItemType Directory -Path $dest -Force | Out-Null

# Exporta todos os drivers de terceiros instalados
$exportResult = Export-WindowsDriver -Online -Destination $dest -ErrorAction SilentlyContinue

$infs = @(Get-ChildItem -Path $dest -Filter '*.inf' -Recurse -ErrorAction SilentlyContinue)
$allFiles = @(Get-ChildItem -Path $dest -Recurse -ErrorAction SilentlyContinue | Where-Object { -not $_.PSIsContainer })
$sizeBytes = ($allFiles | Measure-Object -Property Length -Sum -ErrorAction SilentlyContinue).Sum

$manifest = [PSCustomObject]@{
  Name = '${folderName}'
  Date = (Get-Date).ToString('dd/MM/yyyy HH:mm:ss')
  HostName = $env:COMPUTERNAME
  OS = (Get-CimInstance Win32_OperatingSystem).Caption
  DriverCount = $infs.Count
  SizeBytes = $sizeBytes
  App = 'ThunderTools - Thunder Sistemas'
}

$manifestJson = $manifest | ConvertTo-Json
$manifestFile = Join-Path $dest 'manifest.json'
[System.IO.File]::WriteAllText($manifestFile, $manifestJson, [System.Text.Encoding]::UTF8)

[PSCustomObject]@{
  Success = [bool]($infs.Count -gt 0)
  Path = $dest
  FolderName = '${folderName}'
  DriverCount = $infs.Count
  SizeMB = [math]::Round(($sizeBytes / 1MB), 1)
} | ConvertTo-Json
`;

    try {
      backupPbar.style.width = '55%';
      backupStepMsg.innerHTML = '<i data-lucide="loader-2" class="spinner" style="width:14px;height:14px;color:#34d399"></i> Extraindo pacotes de drivers do repositório DriverStore...';
      createLucideIcons(backupStepMsg);

      const res = await runPsJson(script, { Success: false });
      backupPbar.style.width = '100%';

      if (res && res.Success) {
        toastFn('success', 'Backup de Drivers Concluído', `Sucesso! ${res.DriverCount} drivers exportados para: ${res.FolderName}`);
        addHistoryFn(`Backup de Drivers (${res.DriverCount} drivers)`, res.Path, true, 'hard-drive-download');
        saveCustomPath(res.Path);
        await scanBackups();

        backupStepMsg.innerHTML = `<span style="color:#34d399; font-weight:700;">✔ Backup finalizado com sucesso! (${res.DriverCount} drivers salvos em ${res.FolderName})</span>`;
      } else {
        throw new Error('Nenhum driver de terceiros foi exportado ou ocorreu um erro de permissão.');
      }
    } catch (err) {
      toastFn('error', 'Erro no Backup de Drivers', err.message || 'Falha ao exportar drivers do sistema.');
      backupStepMsg.innerHTML = `<span style="color:#ef4444; font-weight:700;">❌ Falha: ${escapeHtml(err.message || 'Erro')}</span>`;
    } finally {
      isBackingUp = false;
      btnStartBackup.disabled = false;
      btnCustomDest.disabled = false;
      btnStartBackup.innerHTML = '<i data-lucide="download" style="width:14px;height:14px"></i> Criar Backup Agora';
      createLucideIcons(btnStartBackup);
    }
  };

  // 3. RESTAURAÇÃO DE DRIVERS (pnputil.exe /add-driver ... /subdirs /install)
  const promptRestoreBackup = ({ path, name, count }) => {
    const existingConfirm = document.getElementById('tt-driver-restore-confirm-overlay');
    if (existingConfirm) existingConfirm.remove();

    const confirmOverlay = document.createElement('div');
    confirmOverlay.id = 'tt-driver-restore-confirm-overlay';
    confirmOverlay.className = 'modal-overlay';
    confirmOverlay.style.zIndex = '10010';

    confirmOverlay.innerHTML = `
      <div class="modal details-modal" role="dialog" aria-modal="true" style="width: min(640px, 94vw); max-width: 640px; padding: 22px 26px;">
        <div class="details-modal-header" style="margin-bottom: 14px;">
          <div class="details-header-lead">
            <div class="details-header-icon-box" style="color: #34d399; background: rgba(16, 185, 129, 0.18); border-color: rgba(16, 185, 129, 0.4);">
              <i data-lucide="rotate-ccw"></i>
            </div>
            <div>
              <div class="details-modal-title">
                <span>Confirmar Restauração de Drivers</span>
                <span class="details-count-pill" style="color:#34d399;background:rgba(16,185,129,0.15);">${count} Pacotes (.INF)</span>
              </div>
              <div class="details-modal-desc">
                Reintegração automática ao Repositório do Windows (DriverStore) e instalação em dispositivos de hardware.
              </div>
            </div>
          </div>
        </div>

        <div style="background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 10px; padding: 14px 16px; margin-bottom: 16px; font-size: 12.5px; color: #cbd5e1; line-height: 1.5;">
          <div style="display: flex; align-items: flex-start; gap: 10px; margin-bottom: 8px;">
            <i data-lucide="shield-check" style="width:20px;height:20px;color:#34d399;flex-shrink:0;margin-top:2px;"></i>
            <div>
              Você está prestes a restaurar os drivers da pasta:<br>
              <strong style="color: #f1f5f9; font-size: 13px;">${escapeHtml(name)}</strong>
              <div style="font-family: monospace; font-size: 11px; color: #94a3b8; margin-top: 3px; word-break: break-all;">${escapeHtml(path)}</div>
            </div>
          </div>
          <div style="border-top: 1px solid rgba(255, 255, 255, 0.08); padding-top: 8px; margin-top: 8px; font-size: 11.5px; color: #94a3b8;">
            O comando nativo <code>pnputil.exe /add-driver "*.inf" /subdirs /install</code> adicionará todos os pacotes de volta à pasta do sistema e atualizará imediatamente os periféricos e componentes compatíveis para que voltem a funcionar normalmente.
          </div>
        </div>

        <div class="details-modal-footer" style="display: flex; justify-content: flex-end; gap: 8px;">
          <button type="button" class="modal-btn secondary" id="btn-cancel-restore" style="padding: 8px 18px; font-size: 12px;">Cancelar</button>
          <button type="button" class="modal-btn primary" id="btn-confirm-restore-exec" style="padding: 8px 22px; font-size: 12px; background: linear-gradient(135deg, #059669 0%, #10b981 100%); border: none; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.35);">
            <i data-lucide="check" style="width:14px;height:14px"></i> Iniciar Restauração Agora
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(confirmOverlay);
    createLucideIcons(confirmOverlay);

    const closeConfirm = () => confirmOverlay.remove();
    confirmOverlay.querySelector('#btn-cancel-restore').onclick = closeConfirm;

    confirmOverlay.querySelector('#btn-confirm-restore-exec').onclick = async () => {
      closeConfirm();
      await executeDriverRestore({ path, name, count });
    };
  };

  // Executa a Restauração via pnputil
  const executeDriverRestore = async ({ path, name, count }) => {
    isRestoring = true;

    // Janela de Progresso da Restauração
    const progressOverlay = document.createElement('div');
    progressOverlay.id = 'tt-driver-restore-progress-overlay';
    progressOverlay.className = 'modal-overlay';
    progressOverlay.style.zIndex = '10015';

    progressOverlay.innerHTML = `
      <div class="modal details-modal" role="dialog" aria-modal="true" style="width: min(680px, 94vw); max-width: 680px; padding: 24px 28px;">
        <div style="display: flex; align-items: center; gap: 14px; margin-bottom: 16px;">
          <div style="width: 44px; height: 44px; border-radius: 12px; background: rgba(16, 185, 129, 0.16); border: 1px solid rgba(16, 185, 129, 0.35); display: flex; align-items: center; justify-content: center; color: #34d399;">
            <i data-lucide="loader-2" class="spinner" style="width: 24px; height: 24px;"></i>
          </div>
          <div>
            <div style="font-size: 16px; font-weight: 800; color: #f8fafc;">Restaurando Drivers no Windows...</div>
            <div style="font-size: 12px; color: #94a3b8; margin-top: 2px;">
              Executando PnPUtil: adicionando pacotes ao DriverStore e reinstalando dispositivos compatíveis.
            </div>
          </div>
        </div>

        <div style="background: rgba(2, 6, 23, 0.65); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 10px; padding: 14px; max-height: 200px; overflow-y: auto; font-family: 'Consolas', monospace; font-size: 11.5px; color: #a7f3d0; line-height: 1.5;" id="restore-terminal-log">
          Iniciando varredura recursiva de arquivos .INF em: ${escapeHtml(path)}...
        </div>

        <div id="restore-footer-wrap" style="margin-top: 16px; display: flex; justify-content: flex-end;">
          <button type="button" class="modal-btn secondary" disabled id="btn-restore-done" style="opacity: 0.5;">Aguarde o término...</button>
        </div>
      </div>
    `;

    document.body.appendChild(progressOverlay);
    createLucideIcons(progressOverlay);

    const termLog = progressOverlay.querySelector('#restore-terminal-log');
    const footerWrap = progressOverlay.querySelector('#restore-footer-wrap');

    const cleanPath = path.replace(/'/g, "''");

    const script = `
$target = '${cleanPath}'
$rawOutput = pnputil.exe /add-driver "$target\\*.inf" /subdirs /install 2>&1 | Out-String

$added = 0
$installed = 0
foreach ($line in ($rawOutput -split "\\r?\\n")) {
  if ($line -match 'Pacote de driver adicionado|Driver package added|adicionado com sucesso') { $added++ }
  if ($line -match 'Driver instalado com sucesso|Driver successfully installed') { $installed++ }
}

[PSCustomObject]@{
  Success = $true
  AddedCount = $added
  InstalledCount = $installed
  Log = $rawOutput
} | ConvertTo-Json -Depth 3
`;

    try {
      const res = await runPsJson(script, { Success: false, Log: '', AddedCount: 0, InstalledCount: 0 });
      isRestoring = false;

      if (res && res.Success) {
        termLog.textContent = res.Log || 'Restauração finalizada sem saída detalhada.';
        termLog.scrollTop = termLog.scrollHeight;

        toastFn('success', 'Restauração Concluída', `Drivers restaurados com sucesso a partir de ${name}!`);
        addHistoryFn(`Restauração de Drivers (${name})`, `pnputil /add-driver em ${path}`, true, 'rotate-ccw');

        footerWrap.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; flex-wrap: wrap; gap: 10px;">
            <div style="display: flex; align-items: center; gap: 8px; font-size: 12px; color: #34d399; font-weight: 600;">
              <i data-lucide="check-circle-2" style="width:16px;height:16px"></i>
              <span>Operação concluída com sucesso!</span>
            </div>
            <div style="display: flex; gap: 8px;">
              <button type="button" class="modal-btn secondary" id="btn-reboot-hint" style="font-size: 11.5px;">Reiniciar se necessário</button>
              <button type="button" class="modal-btn primary" id="btn-finish-restore" style="padding: 7px 20px; font-size: 12px; background: linear-gradient(135deg, #059669, #10b981);">Concluir</button>
            </div>
          </div>
        `;
        createLucideIcons(footerWrap);

        footerWrap.querySelector('#btn-finish-restore').onclick = () => {
          progressOverlay.remove();
        };

        footerWrap.querySelector('#btn-reboot-hint').onclick = () => {
          progressOverlay.remove();
          toastFn('info', 'Reinicialização', 'Caso tenha atualizado drivers de vídeo ou chipset, reinicie o computador para carregar todos os binários.');
        };
      } else {
        throw new Error('Falha durante a execução do PnPUtil.');
      }
    } catch (err) {
      isRestoring = false;
      termLog.textContent += `\n\nErro: ${err.message || 'Falha ao executar PnPUtil'}`;
      footerWrap.innerHTML = `
        <button type="button" class="modal-btn secondary" id="btn-err-close">Fechar</button>
      `;
      footerWrap.querySelector('#btn-err-close').onclick = () => {
        progressOverlay.remove();
      };
      toastFn('error', 'Erro na Restauração', err.message || 'Falha ao restaurar drivers.');
    }
  };

  // 4. MODAL PARA INSPECIONAR OS DRIVERS (.INF) DE UM BACKUP
  const showInspectDriversModal = async (backupPath) => {
    const inspectOverlay = document.createElement('div');
    inspectOverlay.className = 'modal-overlay';
    inspectOverlay.style.zIndex = '10020';

    inspectOverlay.innerHTML = `
      <div class="modal details-modal" role="dialog" aria-modal="true" style="width: min(720px, 94vw); max-width: 720px; max-height: 85vh; display: flex; flex-direction: column;">
        <div class="details-modal-header" style="margin-bottom: 12px; flex-shrink: 0;">
          <div class="details-header-lead">
            <div class="details-header-icon-box" style="color: #818cf8; background: rgba(99, 102, 241, 0.16); border-color: rgba(99, 102, 241, 0.35);">
              <i data-lucide="list"></i>
            </div>
            <div>
              <div class="details-modal-title">
                <span>Pacotes de Drivers no Backup</span>
                <span class="details-count-pill" id="inspect-count-pill">Lendo .INF...</span>
              </div>
              <div class="details-modal-desc" style="word-break: break-all;">${escapeHtml(backupPath)}</div>
            </div>
          </div>
          <button class="modal-close-icon-btn" id="inspect-x-close"><i data-lucide="x"></i></button>
        </div>

        <div id="inspect-list-area" style="flex: 1; overflow-y: auto; background: rgba(0, 0, 0, 0.25); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 10px; padding: 12px; min-height: 200px;">
          <div style="text-align: center; padding: 40px; color: #94a3b8;">
            <i data-lucide="loader-2" class="spinner" style="width: 22px; height: 22px; color: #818cf8; margin-bottom: 8px;"></i>
            <div>Lendo arquivos de driver do backup...</div>
          </div>
        </div>

        <div class="details-modal-footer" style="margin-top: 12px; padding-top: 10px; display: flex; justify-content: flex-end; flex-shrink: 0;">
          <button type="button" class="modal-btn primary" id="btn-close-inspect">Fechar</button>
        </div>
      </div>
    `;

    document.body.appendChild(inspectOverlay);
    createLucideIcons(inspectOverlay);

    const closeInspect = () => inspectOverlay.remove();
    inspectOverlay.querySelector('#inspect-x-close').onclick = closeInspect;
    inspectOverlay.querySelector('#btn-close-inspect').onclick = closeInspect;

    const listArea = inspectOverlay.querySelector('#inspect-list-area');
    const countPill = inspectOverlay.querySelector('#inspect-count-pill');

    const cleanPath = backupPath.replace(/'/g, "''");
    const script = `
$target = '${cleanPath}'
$infs = @(Get-ChildItem -Path $target -Filter '*.inf' -Recurse -ErrorAction SilentlyContinue | Select-Object -First 100)
$list = @($infs | ForEach-Object {
  $dirName = $_.Directory.Name
  $content = Get-Content -Path $_.FullName -TotalCount 40 -ErrorAction SilentlyContinue | Out-String
  $provider = 'Fabricante OEM'
  $class = 'Dispositivo'
  if ($content -match 'Provider\\s*=\\s*"?([^"\\r\\n]+)') { $provider = $Matches[1].Trim() }
  if ($content -match 'Class\\s*=\\s*"?([^"\\r\\n]+)') { $class = $Matches[1].Trim() }

  [PSCustomObject]@{
    Name = $_.Name
    Folder = $dirName
    Provider = $provider
    Class = $class
    SizeKB = [math]::Round($_.Length / 1KB, 1)
  }
})
$list | ConvertTo-Json -Depth 2
`;

    try {
      const items = await runPsJson(script, []);
      const driverList = Array.isArray(items) ? items : (items ? [items] : []);
      countPill.textContent = `${driverList.length} Drivers`;

      if (driverList.length === 0) {
        listArea.innerHTML = '<div style="text-align:center; padding:30px; color:#94a3b8;">Nenhum arquivo .INF encontrado nesta pasta.</div>';
      } else {
        listArea.innerHTML = driverList.map(d => `
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 8px; margin-bottom: 6px; font-size: 12px; gap: 12px;">
            <div style="min-width: 0; flex: 1;">
              <div style="font-weight: 600; color: #f8fafc; font-family: monospace;">${escapeHtml(d.Name)} <span style="font-size: 10.5px; color: #818cf8;">(${escapeHtml(d.Folder)})</span></div>
              <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">Classe: <strong style="color:#7dd3fc;">${escapeHtml(d.Class)}</strong> &bull; Fornecedor: ${escapeHtml(d.Provider)}</div>
            </div>
            <span class="details-chip" style="background: rgba(148, 163, 184, 0.1); color: #cbd5e1; border: 1px solid rgba(148, 163, 184, 0.2); font-size: 10.5px;">
              ${d.SizeKB} KB
            </span>
          </div>
        `).join('');
      }
    } catch (err) {
      listArea.innerHTML = `<div style="text-align:center; padding:30px; color:#ef4444;">Falha ao inspecionar drivers: ${escapeHtml(err.message)}</div>`;
    }
  };

  // Escaneamento inicial
  scanBackups();
}
