/**
 * app.js — AI Image Generation Studio (Week 3)
 * Handles: generation loop, gallery, lightbox, history, zip export
 */
'use strict';

// ─── State ──────────────────────────────────────────────────────────────────
const state = {
  generating:    false,
  selectedStyle: 'None',
  selectedRatio: '1:1',
  generatedFiles: [],   // all filenames for zip export
};

// ─── DOM refs ────────────────────────────────────────────────────────────────
const promptEl       = document.getElementById('prompt');
const countEl        = document.getElementById('count');
const countValEl     = document.getElementById('count-val');
const guidanceEl     = document.getElementById('guidance');
const guidanceValEl  = document.getElementById('guidance-val');
const stepsEl        = document.getElementById('steps');
const stepsValEl     = document.getElementById('steps-val');
const seedEl         = document.getElementById('seed');
const negativeEl     = document.getElementById('negative');
const generateBtn    = document.getElementById('generate-btn');
const galleryEmpty   = document.getElementById('gallery-empty');
const galleryGrid    = document.getElementById('gallery-grid');
const statusPill     = document.getElementById('status-pill');
const statusDot      = document.getElementById('status-dot');
const statusText     = document.getElementById('status-text');
const relStatus      = document.getElementById('reliability-status');
const relText        = document.getElementById('reliability-text');
const downloadAllBtn = document.getElementById('download-all-btn');
const historyList    = document.getElementById('history-list');
const zipBtn         = document.getElementById('zip-btn');
const lightbox       = document.getElementById('lightbox');
const lightboxImg    = document.getElementById('lightbox-img');
const lightboxClose  = document.getElementById('lightbox-close');

// ─── Init ────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initSliders();
  initStyleChips();
  initAspectRatios();
  initCollapsible();
  initSpotlight();
  initBlurFade();
  bindGenerate();
  bindLightbox();
  bindDownloadAll();
  loadHistory();

  // Icon rerender if lucide loaded
  if (window.lucide) lucide.createIcons();
});

// ─── Sliders ─────────────────────────────────────────────────────────────────
function initSliders() {
  const sliders = [
    { el: countEl,    val: countValEl,    fmt: v => v },
    { el: guidanceEl, val: guidanceValEl, fmt: v => parseFloat(v).toFixed(1) },
    { el: stepsEl,    val: stepsValEl,    fmt: v => v },
  ];

  sliders.forEach(({ el, val, fmt }) => {
    if (!el) return;
    const update = () => {
      val.textContent = fmt(el.value);
      const pct = ((el.value - el.min) / (el.max - el.min)) * 100;
      el.style.setProperty('--progress', `${pct}%`);
    };
    update();
    el.addEventListener('input', update);
  });
}

// ─── Style chips ─────────────────────────────────────────────────────────────
function initStyleChips() {
  const container = document.getElementById('style-chips');
  if (!container) return;
  container.addEventListener('click', e => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    container.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    state.selectedStyle = chip.dataset.value;
  });
}

// ─── Aspect ratio ─────────────────────────────────────────────────────────────
function initAspectRatios() {
  const options = document.querySelectorAll('.aspect-option');
  options.forEach(opt => {
    opt.addEventListener('click', () => {
      options.forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      state.selectedRatio = opt.dataset.ratio;
    });
  });
}

// ─── Collapsible advanced ────────────────────────────────────────────────────
function initCollapsible() {
  const toggle = document.getElementById('adv-toggle');
  const body   = document.getElementById('adv-body');
  if (!toggle || !body) return;

  // Closed by default
  body.style.maxHeight = '0';
  body.style.overflow  = 'hidden';
  body.style.transition = 'max-height 0.3s ease';
  let open = false;

  toggle.addEventListener('click', () => {
    open = !open;
    body.style.maxHeight = open ? body.scrollHeight + 'px' : '0';
    const icon = toggle.querySelector('[data-lucide="chevron-down"]');
    if (icon) icon.style.transform = open ? 'rotate(180deg)' : '';
  });
}

// ─── Spotlight hover ──────────────────────────────────────────────────────────
function initSpotlight() {
  document.querySelectorAll('.card').forEach(card => {
    card.addEventListener('mousemove', e => {
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
      card.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
    });
  });
}

// ─── Blur-fade reveal ────────────────────────────────────────────────────────
function initBlurFade() {
  if (!window.IntersectionObserver) return;
  const observer = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('revealed'); observer.unobserve(e.target); }
    });
  }, { threshold: 0.1 });
  document.querySelectorAll('.blur-fade').forEach(el => observer.observe(el));
}

// ─── Generate ────────────────────────────────────────────────────────────────
function bindGenerate() {
  generateBtn.addEventListener('click', handleGenerate);
  promptEl.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleGenerate();
  });
}

async function handleGenerate() {
  const prompt = promptEl.value.trim();
  if (!prompt) {
    showToast('Enter a prompt first', 'error');
    promptEl.focus();
    return;
  }

  const count = parseInt(countEl.value, 10);
  if (state.generating) return;

  state.generating = true;
  generateBtn.disabled = true;
  generateBtn.innerHTML = '<span class="spinner" style="width:14px;height:14px;border-width:2px;"></span> Generating…';

  setStatus('Generating…', 'loading');
  hideEmpty();
  hideRelStatus();

  // Build shared params
  const params = {
    prompt,
    aspect_ratio: state.selectedRatio,
    style:        state.selectedStyle,
    negative:     negativeEl.value.trim(),
    guidance:     parseFloat(guidanceEl.value),
    steps:        parseInt(stepsEl.value, 10),
    seed:         seedEl.value ? parseInt(seedEl.value, 10) : undefined,
  };

  // Insert skeleton tiles for all images upfront
  const skeletonIds = [];
  for (let i = 0; i < count; i++) {
    const id = insertSkeletonTile(i + 1, count);
    skeletonIds.push(id);
  }

  // Sequential generation loop (per PDF: one request per image)
  let anySuccess = false;
  let lastStatus = 'ok';
  for (let i = 0; i < count; i++) {
    updateSkeletonProgress(skeletonIds[i], i + 1, count);
    const perParams = { ...params };
    // Different seed per image if not locked
    if (!seedEl.value) perParams.seed = undefined;

    try {
      const result = await generateOne(perParams);
      if (result.error) {
        replaceSkeletonWithError(skeletonIds[i], result.error);
        showToast(`Image ${i + 1}: ${result.error}`, 'error');
      } else {
        replaceSkeletonWithImage(skeletonIds[i], result);
        anySuccess = true;
        lastStatus = result.status || 'ok';
        state.generatedFiles.push(result.filename);
      }
    } catch (err) {
      replaceSkeletonWithError(skeletonIds[i], err.message);
      showToast(`Image ${i + 1} failed: ${err.message}`, 'error');
    }
  }

  // UI cleanup
  state.generating = false;
  generateBtn.disabled = false;
  generateBtn.innerHTML = '<i data-lucide="image" style="width:16px;height:16px;"></i> Generate';
  if (window.lucide) lucide.createIcons();

  if (anySuccess) {
    setStatus('Ready', 'online');
    if (lastStatus && lastStatus !== 'ok') showRelStatus(lastStatus);
    if (state.generatedFiles.length > 0) downloadAllBtn.hidden = false;
    loadHistory();
    showToast(`${count} image${count > 1 ? 's' : ''} generated!`, 'success');
  } else {
    setStatus('Error', 'error');
  }
}

async function generateOne(params) {
  const res = await fetch('/api/generate', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) return { error: data.error || `HTTP ${res.status}` };
  return data;
}

// ─── Skeleton tiles ──────────────────────────────────────────────────────────
function insertSkeletonTile(n, total) {
  const id = `sk-${Date.now()}-${n}`;
  const div = document.createElement('div');
  div.id = id;
  div.className = 'skeleton-tile';

  const aspectRatioMap = { '1:1': '100%', '16:9': '56.25%', '9:16': '177.78%' };
  const paddingTop = aspectRatioMap[state.selectedRatio] || '100%';

  div.innerHTML = `
    <div class="skeleton" style="width:100%;padding-top:${paddingTop};"></div>
    <div class="gen-status">
      <span class="spinner" style="width:12px;height:12px;border-width:2px;display:inline-block;vertical-align:middle;margin-right:6px;"></span>
      Generating ${n} of ${total}…
    </div>
  `;

  galleryGrid.prepend(div);
  return id;
}

function updateSkeletonProgress(id, n, total) {
  const el = document.getElementById(id);
  if (!el) return;
  const status = el.querySelector('.gen-status');
  if (status) status.innerHTML = `
    <span class="spinner" style="width:12px;height:12px;border-width:2px;display:inline-block;vertical-align:middle;margin-right:6px;"></span>
    Generating ${n} of ${total}…
  `;
}

function replaceSkeletonWithImage(id, data) {
  const el = document.getElementById(id);
  if (!el) return;
  el.className = 'image-tile blur-fade';
  el.innerHTML = `
    <div style="overflow:hidden;">
      <img src="${data.url}" alt="Generated image" loading="lazy" data-src="${data.url}" />
    </div>
    <div class="tile-overlay">
      <span class="badge ${data.valid ? 'badge-success' : 'badge-warning'}">
        ${data.valid ? '✓ Valid' : '⚠ QC'}
      </span>
      <div class="flex gap-1">
        <button class="btn-icon" title="Download" data-action="download" data-url="${data.url}" data-filename="${data.filename}">
          <i data-lucide="download" style="width:12px;height:12px;"></i>
        </button>
        <button class="btn-icon" title="Regenerate" data-action="regen" data-url="${data.url}">
          <i data-lucide="refresh-cw" style="width:12px;height:12px;"></i>
        </button>
      </div>
    </div>
    <div class="tile-footer">
      <span class="tile-dims">${data.width}×${data.height} · seed ${data.seed}</span>
      <span class="badge" style="font-size:0.6rem;">${state.selectedRatio}</span>
    </div>
  `;

  // Click image → lightbox
  el.querySelector('img').addEventListener('click', () => openLightbox(data.url));

  // Download button
  el.querySelector('[data-action="download"]').addEventListener('click', e => {
    e.stopPropagation();
    downloadFile(data.url, data.filename);
  });

  // Regenerate button
  el.querySelector('[data-action="regen"]').addEventListener('click', async e => {
    e.stopPropagation();
    if (state.generating) return;
    const currentPrompt = promptEl.value.trim();
    if (!currentPrompt) { showToast('Add a prompt first', 'error'); return; }
    showToast('Regenerating…', 'info');
    setStatus('Regenerating…', 'loading');
    try {
      const params = {
        prompt:       currentPrompt,
        aspect_ratio: state.selectedRatio,
        style:        state.selectedStyle,
        negative:     negativeEl.value.trim(),
        guidance:     parseFloat(guidanceEl.value),
        steps:        parseInt(stepsEl.value, 10),
      };
      const result = await generateOne(params);
      if (result.error) { showToast(result.error, 'error'); setStatus('Error', 'error'); }
      else {
        replaceSkeletonWithImage(id, result);
        state.generatedFiles.push(result.filename);
        setStatus('Ready', 'online');
        showToast('Regenerated!', 'success');
      }
    } catch (err) {
      showToast(err.message, 'error');
      setStatus('Error', 'error');
    }
  });

  // Blur-fade reveal
  if (window.IntersectionObserver) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('revealed'); observer.unobserve(e.target); }});
    }, { threshold: 0.1 });
    observer.observe(el);
  } else {
    el.classList.add('revealed');
  }

  if (window.lucide) lucide.createIcons();
}

function replaceSkeletonWithError(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.className = 'skeleton-tile';
  el.style.borderColor = 'rgba(239,68,68,0.3)';
  el.innerHTML = `
    <div style="padding:1.5rem 1rem;text-align:center;color:var(--error,#ef4444);font-size:0.8125rem;">
      <div style="font-size:1.5rem;margin-bottom:0.5rem;">⚠</div>
      ${escHtml(msg)}
    </div>
  `;
}

// ─── Lightbox ────────────────────────────────────────────────────────────────
function bindLightbox() {
  lightboxClose.addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', e => { if (e.target === lightbox) closeLightbox(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLightbox(); });
}

function openLightbox(url) {
  lightboxImg.src = url;
  lightbox.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  lightbox.classList.remove('open');
  lightboxImg.src = '';
  document.body.style.overflow = '';
}

// ─── Download all ────────────────────────────────────────────────────────────
function bindDownloadAll() {
  downloadAllBtn.addEventListener('click', () => triggerZipDownload(state.generatedFiles));
  if (zipBtn) zipBtn.addEventListener('click', () => triggerZipDownload(state.generatedFiles));
}

async function triggerZipDownload(filenames) {
  if (!filenames.length) { showToast('No images to download', 'error'); return; }
  showToast('Preparing zip…', 'info');
  try {
    const res = await fetch('/api/download-zip', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ filenames }),
    });
    if (!res.ok) { showToast('Zip failed', 'error'); return; }
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'generated-images.zip'; a.click();
    URL.revokeObjectURL(url);
    showToast('Zip downloaded!', 'success');
  } catch {
    showToast('Failed to create zip', 'error');
  }
}

// ─── History sidebar ─────────────────────────────────────────────────────────
async function loadHistory() {
  try {
    const res  = await fetch('/api/history');
    const data = await res.json();
    const items = (data.items || []).slice().reverse();

    if (!historyList) return;
    historyList.innerHTML = '';

    if (!items.length) {
      historyList.innerHTML = '<div style="font-size:0.75rem;color:var(--text-muted);text-align:center;padding:1rem 0;">No history yet</div>';
      return;
    }

    items.forEach(item => {
      const div = document.createElement('div');
      div.className = 'history-item';
      div.innerHTML = `
        ${item.url ? `<img class="history-thumb" src="${item.url}" alt="thumb" loading="lazy" />` : ''}
        <div class="history-prompt">${escHtml(item.prompt || '—')}</div>
      `;
      div.title = item.prompt || '';
      div.addEventListener('click', () => {
        if (item.url) openLightbox(item.url);
      });
      historyList.appendChild(div);
    });

    // Update zip list from history too
    const historicFiles = items.filter(i => i.filename).map(i => i.filename);
    if (historicFiles.length > 0) {
      state.generatedFiles = [...new Set([...state.generatedFiles, ...historicFiles])];
      if (zipBtn) zipBtn.hidden = false;
      downloadAllBtn.hidden = false;
    }
  } catch {/* silent */}
}

// ─── Status helpers ───────────────────────────────────────────────────────────
function setStatus(text, type) {
  if (!statusText) return;
  statusText.textContent = text;
  if (statusDot) {
    statusDot.className = 'status-dot';
    statusDot.classList.add(type === 'online' ? 'online' : type === 'loading' ? 'loading' : 'offline');
  }
}

function showRelStatus(msg) {
  if (!relStatus) return;
  relText.textContent = msg;
  relStatus.hidden = false;
}

function hideRelStatus() {
  if (relStatus) relStatus.hidden = true;
}

function hideEmpty() {
  if (galleryEmpty) galleryEmpty.hidden = true;
}

// ─── Inline download helper ───────────────────────────────────────────────────
function downloadFile(url, filename) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ─── Toast system ─────────────────────────────────────────────────────────────
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  const icon = { success:'✓', error:'✕', warning:'⚠', info:'ℹ' }[type] || 'ℹ';
  toast.innerHTML = `<span style="opacity:0.8;">${icon}</span> <span>${escHtml(message)}</span>`;
  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('visible'));
  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 350);
  }, 3500);
}

// ─── Utils ────────────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
