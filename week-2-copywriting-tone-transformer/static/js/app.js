/**
 * Week 2 — Copywriting & Tone Transformer
 * Marketing dashboard frontend logic
 */
'use strict';

// ─── State ───────────────────────────────────────────────────────────────────

let selectedPlatform = 'LinkedIn';
let selectedTone = 'Professional';
let isLoading = false;
let lastResults = null;

const PLATFORM_HINTS = {
  'LinkedIn':  '3 000 char limit · Professional tone recommended',
  'Instagram': '2 200 char limit · Emoji-friendly, energetic',
  'Email':     'Subject ≤ 60 chars · Persuasive body',
  'Twitter/X': '280 char limit · Every word counts',
};

// ─── Status helper (null-safe — status-dot/text may not exist in all layouts) ─
function setStatus(dotClass, text) {
  const dot = document.getElementById('status-dot');
  const txt = document.getElementById('status-text');
  if (dot) dot.className = dotClass;
  if (txt) txt.textContent = text;
}

// ─── Toast ───────────────────────────────────────────────────────────────────

function showToast(title, message = '', type = 'info', duration = 4000) {
  const container = document.getElementById('toast-container');
  const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<span class="toast-icon">${icons[type]||'ℹ'}</span>
    <div class="toast-content">
      <div class="toast-title">${esc(title)}</div>
      ${message?`<div class="toast-message">${esc(message)}</div>`:''}
    </div>`;
  container.appendChild(t);
  setTimeout(() => { t.classList.add('removing'); t.addEventListener('animationend', ()=>t.remove(),{once:true}); }, duration);
}

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── Sliders ─────────────────────────────────────────────────────────────────

function initSliders() {
  const sliders = [
    { id: 'temperature', valId: 'temp-val', decimals: 2 },
    { id: 'top-p',       valId: 'topp-val', decimals: 2 },
    { id: 'n-variations',valId: 'n-val',    decimals: 0 },
  ];

  sliders.forEach(({ id, valId, decimals }) => {
    const el = document.getElementById(id);
    const val = document.getElementById(valId);
    if (!el || !val) return;

    const update = () => {
      const v = parseFloat(el.value);
      val.textContent = decimals > 0 ? v.toFixed(decimals) : v;
      // Fill extends to thumb's right edge so entire thumb sits on the filled track
      const min = parseFloat(el.min), max = parseFloat(el.max);
      const rawRatio = (v - min) / (max - min);
      const trackW = el.offsetWidth;
      const thumbW = 16;
      const pct = trackW > thumbW
        ? ((rawRatio * (trackW - thumbW) + thumbW) / trackW) * 100
        : rawRatio * 100;
      el.style.setProperty('--progress', pct.toFixed(2) + '%');
    };

    el.addEventListener('input', update);
    update();
  });
}

// ─── Chips ───────────────────────────────────────────────────────────────────

function initChips() {
  // Platform chips
  document.querySelectorAll('#platform-chips .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('#platform-chips .chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      selectedPlatform = chip.dataset.value;
      const badge = document.getElementById('selected-platform-badge');
      if (badge) badge.textContent = selectedPlatform;
      const hint = document.getElementById('platform-hint');
      if (hint) hint.textContent = PLATFORM_HINTS[selectedPlatform] || '';
    });
  });

  // Tone chips
  document.querySelectorAll('#tone-chips .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('#tone-chips .chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      selectedTone = chip.dataset.value;
      document.getElementById('selected-tone-badge').textContent = selectedTone;
    });
  });

  // Set initial hint (element may not exist in all layout variants)
  const initialHint = document.getElementById('platform-hint');
  if (initialHint) initialHint.textContent = PLATFORM_HINTS[selectedPlatform] || '';
}

// ─── Char meter ──────────────────────────────────────────────────────────────

function buildCharMeter(charCount, limit, overBy) {
  if (!limit || limit > 5000) return ''; // Email has no real meter
  const pct = Math.min((charCount / limit) * 100, 100);
  const state = overBy > 0 ? 'over' : pct > 80 ? 'warn' : 'ok';
  const label = overBy > 0
    ? `${charCount}/${limit} (+${overBy})`
    : `${charCount}/${limit}`;
  return `<div class="char-meter ${state}">
    <span class="char-meter-count" style="font-size:0.75rem;font-family:var(--font-mono);">${label}</span>
    <div class="char-meter-bar"><div class="char-meter-fill" style="width:${pct}%"></div></div>
    ${overBy > 0 ? '<span class="badge badge-danger" style="font-size:0.65rem;padding:0.1rem 0.375rem;">Over limit</span>' : ''}
  </div>`;
}

// ─── Render variations ───────────────────────────────────────────────────────

function renderVariations(variations, platform) {
  const container = document.getElementById('variations-container');
  container.innerHTML = '';

  variations.forEach((v, i) => {
    const isEmail = !!(v.subject);
    const card = document.createElement('div');
    card.className = 'variation-card';

    const emailSubject = isEmail ? `
      <div class="email-subject">
        <strong>Subject:</strong> ${esc(v.subject)}
        ${v.over_by > 0 ? '<span class="badge badge-danger" style="font-size:0.65rem;margin-left:0.5rem;">Subject too long</span>' : ''}
      </div>` : '';

    const meter = buildCharMeter(v.char_count, /* limit */ isEmail ? 60 : null, v.over_by);

    card.innerHTML = `
      <div class="variation-header">
        <div class="flex items-center gap-2">
          <span class="badge badge-default">Variation ${i + 1}</span>
          <span class="badge badge-brand">${esc(platform)}</span>
          ${selectedTone ? `<span class="badge badge-default">${esc(selectedTone)}</span>` : ''}
        </div>
        <div class="flex gap-2">
          <button class="btn-icon copy-btn" data-text="${esc(v.text)}" title="Copy">
            <i data-lucide="copy" style="width:13px;height:13px;"></i>
          </button>
          <button class="btn-icon regen-btn" title="Regenerate this variation">
            <i data-lucide="refresh-cw" style="width:13px;height:13px;"></i>
          </button>
        </div>
      </div>
      ${emailSubject}
      <div class="variation-body">${isEmail ? esc(v.body) : esc(v.text)}</div>
      <div class="variation-footer">
        ${meter || '<span></span>'}
        <span class="text-xs text-muted">${v.char_count.toLocaleString()} chars</span>
      </div>
    `;

    container.appendChild(card);
  });

  // Attach copy buttons
  container.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      navigator.clipboard.writeText(btn.dataset.text || '').then(() => {
        showToast('Copied!', '', 'success', 2000);
      });
    });
  });

  // Attach regen buttons
  container.querySelectorAll('.regen-btn').forEach(btn => {
    btn.addEventListener('click', generate);
  });

  // Re-init icons
  if (window.lucide) lucide.createIcons();
}

// ─── Generate ────────────────────────────────────────────────────────────────

async function generate() {
  const productName = document.getElementById('product-name').value.trim();
  const description = document.getElementById('description').value.trim();
  const temperature = parseFloat(document.getElementById('temperature').value);
  const topP        = parseFloat(document.getElementById('top-p').value);
  const n           = parseInt(document.getElementById('n-variations').value, 10);

  if (!productName) { showToast('Product name required', '', 'error'); return; }
  if (!description)  { showToast('Product description required', '', 'error'); return; }
  if (isLoading) return;

  isLoading = true;
  const btn = document.getElementById('generate-btn');
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner spinner-sm"></div><span>Generating…</span>';
  setStatus('status-dot loading', 'Generating…');

  // Show skeletons
  document.getElementById('results-empty').hidden = true;
  document.getElementById('variations-container').innerHTML = Array(n).fill(0).map(() => `
    <div class="skeleton-card">
      <div class="skeleton" style="height:16px;width:60%"></div>
      <div class="skeleton" style="height:90px;"></div>
      <div class="skeleton" style="height:12px;width:40%"></div>
    </div>`).join('');

  try {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_name: productName, description, platform: selectedPlatform, tone: selectedTone, temperature, top_p: topP, n }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Generation failed');

    lastResults = data;

    // Show compiled prompt (R2)
    const inspector = document.getElementById('prompt-inspector');
    inspector.hidden = false;
    document.getElementById('compiled-prompt-text').textContent = data.compiled_prompt;

    renderVariations(data.variations, data.platform);

    // Show export bar
    document.getElementById('export-bar').hidden = false;
    document.getElementById('export-bar').style.display = 'flex';

    setStatus('status-dot online', 'Ready');

  } catch (err) {
    document.getElementById('variations-container').innerHTML = '';
    showToast('Generation failed', err.message, 'error');
    setStatus('status-dot offline', 'Error');
  } finally {
    isLoading = false;
    btn.disabled = false;
    btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4V2"/><path d="M15 16v-2"/><path d="M8 9h2"/><path d="M20 9h2"/><path d="m17.8 11.8 1.4-1.4"/><path d="M15 9h0"/><path d="m12.2 11.8-1.4-1.4"/><path d="m17.8 6.2-1.4 1.4"/><path d="m12.2 6.2 1.4 1.4"/><path d="M3 21l9-9"/></svg><span>Generate Copy</span>';
    if (window.lucide) lucide.createIcons();
  }
}

// ─── Compare temperatures (R6) ───────────────────────────────────────────────

async function runCompare() {
  const productName = document.getElementById('product-name').value.trim();
  const description = document.getElementById('description').value.trim();
  if (!productName || !description) {
    showToast('Fill in product name and description first.', '', 'warning'); return;
  }

  const modal = document.getElementById('compare-modal');
  modal.classList.add('open');

  const cols = ['compare-low', 'compare-mid', 'compare-high'];
  cols.forEach(id => {
    document.getElementById(id).innerHTML = '<div class="skeleton" style="height:80px;margin-bottom:0.5rem;"></div>';
  });

  try {
    const res = await fetch('/api/compare-temps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_name: productName, description, platform: selectedPlatform, tone: selectedTone }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed');

    data.results.forEach((r, i) => {
      const text = r.variations[0]?.text || '(no output)';
      document.getElementById(cols[i]).innerHTML = `<p style="white-space:pre-wrap;word-break:break-word;">${esc(text)}</p>`;
    });

    if (window.lucide) lucide.createIcons();
  } catch (err) {
    showToast('Compare failed', err.message, 'error');
  }
}

// ─── Export ──────────────────────────────────────────────────────────────────

function exportMarkdown() {
  if (!lastResults) return;
  const { variations, platform, tone } = lastResults;
  const productName = document.getElementById('product-name').value.trim();

  let md = `# Marketing Copy — ${productName}\n\n`;
  md += `**Platform:** ${platform} · **Tone:** ${tone}\n\n---\n\n`;
  variations.forEach((v, i) => {
    md += `## Variation ${i + 1}\n\n`;
    if (v.subject) md += `**Subject:** ${v.subject}\n\n${v.body}\n\n`;
    else md += `${v.text}\n\n`;
    md += `*${v.char_count} chars`;
    if (!v.within_limit) md += ` — ⚠ over limit by ${v.over_by}`;
    md += '*\n\n---\n\n';
  });

  const blob = new Blob([md], { type: 'text/markdown' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `copy-${platform.toLowerCase()}-${Date.now()}.md`;
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('Downloaded!', 'Markdown file saved.', 'success');
}

function copyAll() {
  if (!lastResults) return;
  const text = lastResults.variations.map((v, i) =>
    `--- Variation ${i + 1} ---\n${v.subject ? `Subject: ${v.subject}\n\n${v.body}` : v.text}`
  ).join('\n\n');
  navigator.clipboard.writeText(text).then(() => showToast('Copied all variations!', '', 'success', 2000));
}

// ─── Inspector toggle ────────────────────────────────────────────────────────

document.getElementById('inspector-toggle')?.addEventListener('click', () => {
  const body = document.getElementById('inspector-body');
  const icon = document.querySelector('#inspector-toggle .collapsible-icon');
  body.classList.toggle('open');
  if (icon) icon.style.transform = body.classList.contains('open') ? 'rotate(180deg)' : '';
});

// ─── Event listeners ─────────────────────────────────────────────────────────

document.getElementById('generate-btn')?.addEventListener('click', generate);
document.getElementById('compare-btn')?.addEventListener('click', runCompare);
document.getElementById('clear-btn')?.addEventListener('click', () => {
  document.getElementById('product-name').value = '';
  document.getElementById('description').value = '';
  document.getElementById('variations-container').innerHTML = '';
  document.getElementById('results-empty').hidden = false;
  document.getElementById('prompt-inspector').hidden = true;
  document.getElementById('export-bar').hidden = true;
  lastResults = null;
});

document.getElementById('close-compare')?.addEventListener('click', () => {
  document.getElementById('compare-modal').classList.remove('open');
});

document.getElementById('compare-modal')?.addEventListener('click', (e) => {
  if (e.target === e.currentTarget) e.currentTarget.classList.remove('open');
});

document.getElementById('download-btn')?.addEventListener('click', exportMarkdown);
document.getElementById('copy-all-btn')?.addEventListener('click', copyAll);

// Spotlight on cards
document.querySelectorAll('.card').forEach(card => {
  card.addEventListener('mousemove', e => {
    const r = card.getBoundingClientRect();
    card.style.setProperty('--mouse-x', (e.clientX - r.left) + 'px');
    card.style.setProperty('--mouse-y', (e.clientY - r.top) + 'px');
  });
});

// ─── Init ────────────────────────────────────────────────────────────────────

initSliders();
initChips();
