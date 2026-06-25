'use strict';

// ─── State ───────────────────────────────────────────────────────────────────
let allPrompts      = [];
let allCategories   = [];
let lastResults     = null;

// ─── DOM ─────────────────────────────────────────────────────────────────────
const statusDot     = document.getElementById('status-dot');
const statusText    = document.getElementById('status-text');
const categoryList  = document.getElementById('category-list');
const runBtn        = document.getElementById('run-btn');
const downloadBtn   = document.getElementById('download-btn');
const resultsList   = document.getElementById('results-list');
const resultsCount  = document.getElementById('results-count');
const auditProgress = document.getElementById('audit-progress');
const progressBar   = document.getElementById('progress-bar');
const progressLabel = document.getElementById('progress-label');
const scoreRingWrap = document.getElementById('score-ring-wrap');
const summaryGrid   = document.getElementById('summary-grid');
const customPromptEl = document.getElementById('custom-prompt');
const customRunBtn  = document.getElementById('custom-run-btn');

// ─── Helpers ─────────────────────────────────────────────────────────────────
function setStatus(text, type) {
  if (statusText) statusText.textContent = text;
  if (statusDot) {
    statusDot.className = 'status-dot';
    if (type === 'online')  statusDot.classList.add('online');
    if (type === 'loading') statusDot.classList.add('loading');
    if (type === 'offline') statusDot.classList.add('offline');
  }
}

function showToast(msg, type = 'info') {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.innerHTML = `<span>${{success:'✓',error:'✕',warning:'⚠',info:'ℹ'}[type]||'ℹ'}</span> <span>${esc(msg)}</span>`;
  c.appendChild(t);
  requestAnimationFrame(() => t.classList.add('visible'));
  setTimeout(() => { t.classList.remove('visible'); setTimeout(() => t.remove(), 350); }, 3500);
}

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ─── Load prompts + categories ───────────────────────────────────────────────
async function loadPrompts() {
  try {
    const r = await fetch('/api/prompts');
    const d = await r.json();
    allPrompts    = d.prompts || [];
    allCategories = d.categories || [];

    if (!d.api_ready) {
      setStatus('No API key', 'offline');
      showToast('Add GEMINI_API_KEY to .env', 'error');
    } else {
      setStatus('Ready', 'online');
    }

    buildCategoryList();
  } catch (e) {
    setStatus('Offline', 'offline');
  }
}

const CAT_LABELS = {
  jailbreak:        { icon: '🔓', label: 'Jailbreak' },
  harmful_content:  { icon: '⚠️', label: 'Harmful Content' },
  bias:             { icon: '⚖️', label: 'Bias & Fairness' },
  pii_extraction:   { icon: '🔑', label: 'PII Extraction' },
  prompt_injection: { icon: '💉', label: 'Prompt Injection' },
  baseline:         { icon: '✅', label: 'Baseline (Safe)' },
};

function buildCategoryList() {
  categoryList.innerHTML = '';
  allCategories.forEach(cat => {
    const count = allPrompts.filter(p => p.category === cat).length;
    const { icon = '•', label = cat } = CAT_LABELS[cat] || {};
    const div = document.createElement('div');
    div.className = 'cat-checkbox';
    div.innerHTML = `
      <input type="checkbox" id="cat-${cat}" value="${cat}" checked />
      <label for="cat-${cat}" style="cursor:pointer;">${icon} ${label}</label>
      <span class="cat-badge">${count}</span>
    `;
    categoryList.appendChild(div);
  });
}

function getSelectedCategories() {
  return allCategories.filter(cat => {
    const el = document.getElementById(`cat-${cat}`);
    return el && el.checked;
  });
}

// ─── Run audit ───────────────────────────────────────────────────────────────
runBtn.addEventListener('click', runAudit);

async function runAudit() {
  const categories = getSelectedCategories();
  if (!categories.length) { showToast('Select at least one category', 'warning'); return; }

  const total = allPrompts.filter(p => categories.includes(p.category)).length;
  runBtn.disabled = true;
  setStatus('Running audit…', 'loading');
  auditProgress.classList.add('visible');
  progressLabel.textContent = `Running ${total} tests…`;
  progressBar.style.width = '5%';

  // Fake progress animation while real request runs
  let fakePct = 5;
  const fakeTimer = setInterval(() => {
    fakePct = Math.min(fakePct + 3, 85);
    progressBar.style.width = fakePct + '%';
  }, 800);

  try {
    const r = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categories }),
    });
    const d = await r.json();
    if (!r.ok) { showToast(d.error, 'error'); return; }

    lastResults = d;
    renderResults(d);
    showToast(`Audit complete — ${d.summary.safety_score}/100 safety score`, 'success');
    setStatus('Audit complete', 'online');
    downloadBtn.style.display = '';
  } catch (err) {
    showToast(err.message, 'error');
    setStatus('Error', 'offline');
  } finally {
    clearInterval(fakeTimer);
    progressBar.style.width = '100%';
    setTimeout(() => auditProgress.classList.remove('visible'), 500);
    runBtn.disabled = false;
  }
}

// ─── Render results ───────────────────────────────────────────────────────────
function renderResults(data) {
  const { results, summary } = data;

  // Score ring
  scoreRingWrap.style.display = '';
  summaryGrid.style.display   = '';

  const score = summary.safety_score;
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444';
  const ring  = document.getElementById('score-ring-fill');
  const circumference = 251.2;
  ring.style.strokeDashoffset = circumference - (score / 100) * circumference;
  ring.style.stroke = color;

  const numEl = document.getElementById('score-number');
  numEl.style.color = color;
  let cur = 0;
  const step = Math.ceil(score / 40);
  const timer = setInterval(() => {
    cur = Math.min(cur + step, score);
    numEl.textContent = cur;
    if (cur >= score) clearInterval(timer);
  }, 25);

  document.getElementById('cnt-safe').textContent    = summary.safe;
  document.getElementById('cnt-unsafe').textContent  = summary.unsafe;
  document.getElementById('cnt-partial').textContent = summary.partial;
  document.getElementById('cnt-sev').textContent     = summary.avg_severity + '/10';

  // Cards
  resultsList.innerHTML = '';
  resultsCount.textContent = `${results.length} tests run`;

  results.forEach(r => renderResultCard(r));
}

function renderResultCard(r) {
  const verdictIcon = { SAFE:'✅', UNSAFE:'❌', PARTIAL:'⚠️', UNKNOWN:'❓' }[r.verdict] || '❓';
  const sevColor    = r.severity >= 7 ? '#ef4444' : r.severity >= 4 ? '#f59e0b' : '#22c55e';
  const sevPct      = Math.min((r.severity / 10) * 100, 100);

  const card = document.createElement('div');
  card.className = 'result-card';
  card.innerHTML = `
    <div class="result-card-header">
      <span class="verdict-icon">${verdictIcon}</span>
      <span class="result-label">${esc(r.label)}</span>
      <span class="result-id">${r.id}</span>
      <span class="badge" style="font-size:0.65rem;">${r.category}</span>
      <div class="severity-bar-wrap">
        <div class="severity-bar">
          <div class="severity-fill" style="width:${sevPct}%;background:${sevColor};"></div>
        </div>
        <span class="sev-num">${r.severity < 0 ? '?' : r.severity}/10</span>
      </div>
    </div>
    <div class="result-card-body">
      <div style="margin-bottom:0.5rem;">
        <span class="text-xs text-muted">Reason:</span>
        <span style="font-size:0.8125rem;margin-left:0.375rem;">${esc(r.reason)}</span>
      </div>
      ${r.flags && r.flags.length ? `
      <div class="result-flags">
        ${r.flags.map(f => `<span class="flag-chip">${esc(f)}</span>`).join('')}
      </div>` : ''}
      <div style="margin-top:0.75rem;">
        <div class="text-xs text-muted" style="margin-bottom:0.25rem;">Prompt sent:</div>
        <div class="result-prompt">${esc(r.prompt)}</div>
      </div>
      <div style="margin-top:0.625rem;">
        <div class="text-xs text-muted" style="margin-bottom:0.25rem;">AI response:</div>
        <div class="result-response">${esc(r.response)}</div>
      </div>
    </div>
  `;
  card.querySelector('.result-card-header').addEventListener('click', () => card.classList.toggle('open'));
  resultsList.appendChild(card);
}

// ─── Download report ─────────────────────────────────────────────────────────
downloadBtn.addEventListener('click', () => {
  const a = document.createElement('a');
  a.href = '/api/report';
  a.download = '';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast('Report downloading…', 'success');
});

// ─── Custom prompt tester ────────────────────────────────────────────────────
customRunBtn.addEventListener('click', async () => {
  const prompt = customPromptEl.value.trim();
  if (!prompt) { showToast('Enter a prompt to test', 'warning'); return; }

  customRunBtn.disabled = true;
  setStatus('Testing…', 'loading');

  try {
    const r = await fetch('/api/run-one', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, category: 'custom' }),
    });
    const d = await r.json();
    if (!r.ok) { showToast(d.error, 'error'); return; }

    // Prepend to results
    if (!resultsList.querySelector('.result-card')) resultsList.innerHTML = '';
    const header = document.createElement('div');
    header.style.cssText = 'font-size:0.75rem;color:var(--text-muted);margin-bottom:0.25rem;';
    header.textContent   = '— Custom test result —';
    resultsList.prepend(header);
    const tempList = document.createElement('div');
    renderResultCard(d);
    // Move last card to top
    const cards = resultsList.querySelectorAll('.result-card');
    if (cards.length > 0) {
      const last = cards[cards.length - 1];
      resultsList.prepend(last);
      last.classList.add('open');
    }

    showToast(`Custom test: ${d.verdict} (severity ${d.severity}/10)`,
      d.verdict === 'SAFE' ? 'success' : d.verdict === 'UNSAFE' ? 'error' : 'warning');
    setStatus('Ready', 'online');
  } catch (err) {
    showToast(err.message, 'error');
    setStatus('Error', 'offline');
  } finally {
    customRunBtn.disabled = false;
  }
});

// ─── Init ─────────────────────────────────────────────────────────────────────
loadPrompts();
