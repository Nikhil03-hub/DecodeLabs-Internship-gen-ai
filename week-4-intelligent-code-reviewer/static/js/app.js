/**
 * app.js — AI Code Reviewer (Week 4 Flagship)
 * Monaco Editor + Score Ring + Bug Cards + Diff View + Export
 */
'use strict';

// ─── State ──────────────────────────────────────────────────────────────────
const state = {
  monacoEditor:     null,
  fixedEditor:      null,
  diffEditor:       null,
  activeTab:        'paste',    // paste | upload
  activeResultTab:  'issues',   // issues | fixed | diff
  selectedLang:     'auto',
  uploadedFile:     null,
  uploadedFilename: '',
  lastResult:       null,
  activeFilter:     'all',
  originalCode:     '',
};

// ─── DOM refs ────────────────────────────────────────────────────────────────
const analyzeBtn       = document.getElementById('analyze-btn');
const resultsEmpty     = document.getElementById('results-empty');
const resultsContent   = document.getElementById('results-content');
const analyzingOverlay = document.getElementById('analyzing-overlay');
const analyzingStep    = document.getElementById('analyzing-step');
const statusDot        = document.getElementById('status-dot');
const statusText       = document.getElementById('status-text');
const bugsList         = document.getElementById('bugs-list');
const scoreNumber      = document.getElementById('score-number');
const scoreRing        = document.getElementById('score-ring');
const scoreSummary     = document.getElementById('score-summary');
const langBadge        = document.getElementById('lang-badge');
const filenameBadge    = document.getElementById('filename-badge');
const perfNotes        = document.getElementById('perf-notes');
const perfNotesText    = document.getElementById('perf-notes-text');
const dropZone         = document.getElementById('drop-zone');
const fileInput        = document.getElementById('file-input');
const dropFileName     = document.getElementById('drop-file-name');

// ─── Monaco init ─────────────────────────────────────────────────────────────
window.addEventListener('load', () => {
  if (typeof require === 'undefined') {
    showToast('Monaco editor failed to load. Code preview disabled.', 'warning');
    return;
  }

  require(['vs/editor/editor.main'], () => {
    // Shared Monaco theme
    monaco.editor.defineTheme('decodelabs-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.background':        '#141A24',
        'editor.foreground':        '#e2e8f0',
        'editorLineNumber.foreground': '#4a5568',
        'editor.lineHighlightBackground': '#1C2430',
        'editorGutter.background':  '#141A24',
        'editor.selectionBackground': '#6366F130',
        'scrollbarSlider.background': '#2d3748',
      },
    });

    // Main editor (paste pane)
    state.monacoEditor = monaco.editor.create(
      document.getElementById('monaco-editor'), {
        value:         '// Paste your code here, or load a sample below\n',
        language:      'plaintext',
        theme:         'decodelabs-dark',
        fontSize:      13,
        fontFamily:    '"JetBrains Mono", "Fira Code", monospace',
        minimap:       { enabled: false },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        lineNumbers:   'on',
        renderLineHighlight: 'line',
        wordWrap:      'on',
        padding:       { top: 12, bottom: 12 },
        renderWhitespace: 'none',
        contextmenu:   true,
        smoothScrolling: true,
      }
    );

    // Wire up Ctrl+Enter → analyze
    state.monacoEditor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
      handleAnalyze
    );

    if (window.lucide) lucide.createIcons();
  });
});

// ─── Input tabs ──────────────────────────────────────────────────────────────
document.querySelectorAll('[data-tab]').forEach(tab => {
  tab.addEventListener('click', () => {
    const target = tab.dataset.tab;
    document.querySelectorAll('[data-tab]').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    document.getElementById(`pane-${target}`).classList.add('active');
    state.activeTab = target;
  });
});

// ─── Result tabs ─────────────────────────────────────────────────────────────
document.querySelectorAll('[data-result-tab]').forEach(tab => {
  tab.addEventListener('click', () => {
    const target = tab.dataset.resultTab;
    document.querySelectorAll('[data-result-tab]').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    document.getElementById('bugs-list').style.display    = target === 'issues' ? '' : 'none';
    document.getElementById('panel-fixed').classList.toggle('active', target === 'fixed');
    document.getElementById('panel-diff').classList.toggle('active', target === 'diff');

    state.activeResultTab = target;

    // Lazy-init Monaco diff editor
    if (target === 'diff' && !state.diffEditor && state.lastResult) {
      initDiffEditor(state.originalCode, state.lastResult.refactored_code || '');
    }

    // Lazy-init fixed code editor
    if (target === 'fixed' && !state.fixedEditor && state.lastResult) {
      initFixedEditor(state.lastResult.refactored_code || '', state.lastResult.language);
    }

    if (window.lucide) lucide.createIcons();
  });
});

// ─── Language chips ───────────────────────────────────────────────────────────
document.getElementById('lang-chips').addEventListener('click', e => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  document.querySelectorAll('#lang-chips .chip').forEach(c => c.classList.remove('active'));
  chip.classList.add('active');
  state.selectedLang = chip.dataset.lang;

  // Update Monaco language
  if (state.monacoEditor && state.selectedLang !== 'auto') {
    const monacoLang = _langToMonaco(state.selectedLang);
    monaco.editor.setModelLanguage(state.monacoEditor.getModel(), monacoLang);
  }
});

// ─── Load sample buttons ─────────────────────────────────────────────────────
document.querySelectorAll('[data-sample]').forEach(btn => {
  btn.addEventListener('click', async () => {
    const sample = btn.dataset.sample;
    try {
      const res = await fetch(`/static/samples/${sample}`);
      if (!res.ok) {
        // Try from root
        const res2 = await fetch(`/samples/${sample}`);
        if (!res2.ok) throw new Error('Sample not found');
        const text = await res2.text();
        loadCodeIntoEditor(text, sample);
        return;
      }
      const text = await res.text();
      loadCodeIntoEditor(text, sample);
    } catch {
      // Fallback: load via API
      loadCodeIntoEditor(_getSampleFallback(sample), sample);
    }
  });
});

function loadCodeIntoEditor(code, filename) {
  if (state.monacoEditor) {
    const lang = _extToMonacoLang(filename);
    const model = monaco.editor.createModel(code, lang);
    state.monacoEditor.setModel(model);
  }
  // Switch to paste tab
  document.querySelector('[data-tab="paste"]').click();
  state.uploadedFilename = filename;
  showToast(`Loaded ${filename}`, 'success');
}

// ─── Drag & Drop ─────────────────────────────────────────────────────────────
if (dropZone && fileInput) {
  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) setUploadedFile(file);
  });
  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) setUploadedFile(fileInput.files[0]);
  });
}

function setUploadedFile(file) {
  state.uploadedFile     = file;
  state.uploadedFilename = file.name;
  if (dropFileName) {
    dropFileName.textContent = `✓ ${file.name} (${Math.round(file.size / 1024)} KB)`;
    dropFileName.hidden = false;
  }
  showToast(`Ready: ${file.name}`, 'success');
}

// ─── Analyze ─────────────────────────────────────────────────────────────────
analyzeBtn.addEventListener('click', handleAnalyze);

async function handleAnalyze() {
  let code = '', filename = 'pasted_code';
  const lang = state.selectedLang === 'auto' ? null : state.selectedLang;

  if (state.activeTab === 'upload') {
    if (!state.uploadedFile) { showToast('No file selected', 'error'); return; }
    return handleFileAnalyze();
  }

  // Paste mode
  if (state.monacoEditor) {
    code = state.monacoEditor.getValue();
  }

  if (!code.trim()) { showToast('Paste some code first', 'error'); return; }
  if (state.uploadedFilename) filename = state.uploadedFilename;

  state.originalCode = code;
  showAnalyzing('Reviewing your code…');

  try {
    const res = await fetch('/api/review-text', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ code, language: lang, filename }),
    });
    const data = await res.json();
    hideAnalyzing();

    if (!res.ok || data.error) {
      showToast(data.error || `HTTP ${res.status}`, 'error');
      setStatus('Error', 'offline');
      return;
    }
    renderResults(data, filename);
  } catch (err) {
    hideAnalyzing();
    showToast(err.message, 'error');
    setStatus('Error', 'offline');
  }
}

async function handleFileAnalyze() {
  const formData = new FormData();
  formData.append('file', state.uploadedFile);

  state.originalCode = '';
  showAnalyzing('Reading file…');

  // Read for diff
  const reader = new FileReader();
  reader.onload = e => { state.originalCode = e.target.result; };
  reader.readAsText(state.uploadedFile);

  try {
    updateAnalyzingStep('Analyzing your file…');
    const res = await fetch('/api/review', { method: 'POST', body: formData });
    const data = await res.json();
    hideAnalyzing();

    if (!res.ok || data.error) {
      showToast(data.error || `HTTP ${res.status}`, 'error');
      setStatus('Error', 'offline');
      return;
    }
    renderResults(data, state.uploadedFilename);
  } catch (err) {
    hideAnalyzing();
    showToast(err.message, 'error');
    setStatus('Error', 'offline');
  }
}

// ─── Render Results ───────────────────────────────────────────────────────────
function renderResults(data, filename) {
  state.lastResult = data;
  state.fixedEditor = null;
  state.diffEditor  = null;

  // Show results section
  resultsEmpty.hidden = true;
  resultsContent.hidden = false;

  // Reset to issues tab
  document.querySelector('[data-result-tab="issues"]').click();

  // Score ring
  animateScoreRing(data.overall_score);

  // Summary
  scoreSummary.textContent = data.summary || '';
  langBadge.textContent    = data.language || 'unknown';
  langBadge.hidden         = false;
  filenameBadge.textContent = filename;
  filenameBadge.hidden      = false;

  // Update Monaco language
  if (state.monacoEditor && data.language) {
    const mLang = _langToMonaco(data.language);
    monaco.editor.setModelLanguage(state.monacoEditor.getModel(), mLang);
    // Update lang chip
    document.querySelectorAll('#lang-chips .chip').forEach(c => {
      c.classList.toggle('active', c.dataset.lang === data.language || (c.dataset.lang === 'auto' && !data.language));
    });
    document.getElementById('detected-lang-badge').style.display = 'inline-flex';
  }

  // Stats
  const stats = data._stats || {};
  document.getElementById('cnt-critical').textContent = stats.critical || 0;
  document.getElementById('cnt-high').textContent     = stats.high     || 0;
  document.getElementById('cnt-medium').textContent   = stats.medium   || 0;
  document.getElementById('cnt-low').textContent      = stats.low      || 0;
  document.getElementById('cnt-info').textContent     = stats.info     || 0;

  // Bug cards
  state.activeFilter = 'all';
  document.querySelectorAll('.stat-chip').forEach(c => c.classList.toggle('active', c.dataset.filter === 'all'));
  renderBugCards(data.bug_report || []);

  // Performance notes
  if (data.performance_notes) {
    perfNotesText.textContent = data.performance_notes;
    perfNotes.hidden = false;
  } else {
    perfNotes.hidden = true;
  }

  setStatus('Review complete', 'online');
  showToast('Analysis complete!', 'success');

  if (window.lucide) lucide.createIcons();
}

// ─── Score ring animation ────────────────────────────────────────────────────
function animateScoreRing(score) {
  const circumference = 251.2;
  const offset = circumference - (score / 100) * circumference;

  // Color by score
  let color;
  if (score >= 80)      color = '#22c55e';  // green
  else if (score >= 60) color = '#f59e0b';  // amber
  else if (score >= 40) color = '#f97316';  // orange
  else                  color = '#ef4444';  // red

  scoreRing.style.stroke = color;
  scoreRing.style.strokeDashoffset = offset;

  scoreNumber.style.color = color;
  scoreNumber.textContent = '0';

  // Count-up animation
  let current = 0;
  const step = Math.ceil(score / 40);
  const timer = setInterval(() => {
    current = Math.min(current + step, score);
    scoreNumber.textContent = current;
    if (current >= score) clearInterval(timer);
  }, 25);
}

// ─── Bug cards ───────────────────────────────────────────────────────────────
function renderBugCards(bugs) {
  const filtered = state.activeFilter === 'all'
    ? bugs
    : bugs.filter(b => b.severity === state.activeFilter);

  bugsList.innerHTML = '';

  if (!filtered.length) {
    bugsList.innerHTML = `
      <div style="text-align:center;padding:2rem;color:var(--text-muted);font-size:0.875rem;">
        No ${state.activeFilter === 'all' ? '' : state.activeFilter + ' '}issues found
      </div>`;
    return;
  }

  filtered.forEach((bug, i) => {
    const card = document.createElement('div');
    card.className = 'bug-card';
    card.innerHTML = `
      <div class="bug-card-header">
        <span class="severity-dot ${bug.severity}"></span>
        <span class="bug-title">${escHtml(bug.title)}</span>
        ${bug.line ? `<span class="bug-line">L${bug.line}</span>` : ''}
        <span class="severity-badge ${bug.severity}">${bug.severity}</span>
        <span class="category-tag">${escHtml(bug.category)}</span>
        <i data-lucide="chevron-down" style="width:13px;height:13px;color:var(--text-muted);flex-shrink:0;transition:transform 0.2s;"></i>
      </div>
      <div class="bug-card-body">
        <div class="bug-card-inner">
          <div class="bug-desc">${escHtml(bug.description)}</div>
          ${bug.suggestion ? `
          <div class="bug-suggestion">
            <strong style="font-size:0.75rem;text-transform:uppercase;letter-spacing:0.05em;color:var(--brand);">Suggestion</strong><br>
            ${escHtml(bug.suggestion)}
          </div>` : ''}
        </div>
      </div>
    `;

    card.querySelector('.bug-card-header').addEventListener('click', () => {
      const isOpen = card.classList.toggle('open');
      const icon = card.querySelector('[data-lucide="chevron-down"]');
      if (icon) icon.style.transform = isOpen ? 'rotate(180deg)' : '';
    });

    bugsList.appendChild(card);
  });

  if (window.lucide) lucide.createIcons();
}

// ─── Stats filter ────────────────────────────────────────────────────────────
document.getElementById('stats-bar').addEventListener('click', e => {
  const chip = e.target.closest('.stat-chip');
  if (!chip) return;
  const filter = chip.dataset.filter;
  document.querySelectorAll('.stat-chip').forEach(c => c.classList.toggle('active', c.dataset.filter === filter));
  state.activeFilter = filter;
  if (state.lastResult) renderBugCards(state.lastResult.bug_report || []);
});

// ─── Monaco: Fixed code editor ────────────────────────────────────────────────
function initFixedEditor(code, language) {
  const container = document.getElementById('fixed-code-container');
  if (!container || !window.monaco) return;
  const lang = _langToMonaco(language || 'plaintext');
  state.fixedEditor = monaco.editor.create(container, {
    value:    code,
    language: lang,
    theme:    'decodelabs-dark',
    readOnly: true,
    fontSize: 13,
    fontFamily: '"JetBrains Mono", monospace',
    minimap:  { enabled: true },
    scrollBeyondLastLine: false,
    automaticLayout: true,
    lineNumbers: 'on',
    padding: { top: 12, bottom: 12 },
    wordWrap: 'off',
  });
}

// ─── Monaco: Diff editor ──────────────────────────────────────────────────────
function initDiffEditor(original, modified) {
  const container = document.getElementById('diff-container');
  if (!container || !window.monaco) return;
  const lang = state.lastResult ? _langToMonaco(state.lastResult.language) : 'plaintext';

  state.diffEditor = monaco.editor.createDiffEditor(container, {
    theme:             'decodelabs-dark',
    readOnly:          true,
    fontSize:          13,
    fontFamily:        '"JetBrains Mono", monospace',
    minimap:           { enabled: false },
    automaticLayout:   true,
    renderSideBySide:  true,
    scrollBeyondLastLine: false,
    padding: { top: 12, bottom: 12 },
  });

  state.diffEditor.setModel({
    original: monaco.editor.createModel(original || '', lang),
    modified: monaco.editor.createModel(modified || '', lang),
  });
}

// ─── Copy fixed code ─────────────────────────────────────────────────────────
document.getElementById('copy-fixed-btn').addEventListener('click', () => {
  const code = state.lastResult?.refactored_code || '';
  navigator.clipboard.writeText(code).then(() => showToast('Copied!', 'success'));
});

// ─── Export .md ──────────────────────────────────────────────────────────────
document.getElementById('export-md-btn').addEventListener('click', () => {
  if (!state.lastResult) return;
  const md   = buildMarkdownReport(state.lastResult, state.uploadedFilename || 'code');
  const blob = new Blob([md], { type: 'text/markdown' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const safe = (state.uploadedFilename || 'code').replace(/[^a-z0-9._-]/gi, '-');
  a.href     = url;
  a.download = `code-review-${safe}-${Date.now()}.md`;
  // Must append to body so browser triggers download instead of navigating
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);  // delay so browser can start download
  showToast('Report exported!', 'success');
});

function buildMarkdownReport(data, filename) {
  const { overall_score, summary, language, bug_report = [], refactored_code, performance_notes } = data;
  const date = new Date().toISOString().split('T')[0];

  let md = `# Code Review Report\n\n`;
  md += `**File:** \`${filename}\`  \n`;
  md += `**Language:** ${language}  \n`;
  md += `**Score:** ${overall_score}/100  \n`;
  md += `**Date:** ${date}  \n\n`;
  md += `---\n\n## Summary\n\n${summary}\n\n`;

  const stats = data._stats || {};
  md += `## Issue Summary\n\n`;
  md += `| Severity | Count |\n|---|---|\n`;
  md += `| 🔴 Critical | ${stats.critical || 0} |\n`;
  md += `| 🟠 High     | ${stats.high || 0} |\n`;
  md += `| 🟡 Medium   | ${stats.medium || 0} |\n`;
  md += `| 🔵 Low      | ${stats.low || 0} |\n`;
  md += `| ⚪ Info     | ${stats.info || 0} |\n\n`;

  md += `## Issues\n\n`;
  bug_report.forEach((bug, i) => {
    const sev = bug.severity.toUpperCase();
    md += `### ${i + 1}. [${sev}] ${bug.title}\n`;
    if (bug.line) md += `**Line:** ${bug.line}  \n`;
    md += `**Category:** ${bug.category}  \n\n`;
    md += `${bug.description}\n\n`;
    if (bug.suggestion) md += `**Suggestion:** ${bug.suggestion}\n\n`;
    md += `---\n\n`;
  });

  if (performance_notes) {
    md += `## Performance Notes\n\n${performance_notes}\n\n`;
  }

  if (refactored_code) {
    md += `## Refactored Code\n\n\`\`\`${language || ''}\n${refactored_code}\n\`\`\`\n`;
  }

  return md;
}

// ─── Re-analyze ───────────────────────────────────────────────────────────────
document.getElementById('re-analyze-btn').addEventListener('click', handleAnalyze);

// ─── Analyzing overlay ───────────────────────────────────────────────────────
const _analyzeSteps = [
  'Reading code structure…',
  'Identifying security issues…',
  'Checking for logic bugs…',
  'Generating refactored code…',
  'Compiling review…',
  'Almost done…',
];

let _stepTimer = null;
let _stepIdx   = 0;

function showAnalyzing(initialMsg) {
  analyzingOverlay.classList.add('active');
  analyzingStep.textContent = initialMsg;
  setStatus('Analyzing…', 'loading');
  analyzeBtn.disabled = true;

  _stepIdx = 0;
  _stepTimer = setInterval(() => {
    _stepIdx = (_stepIdx + 1) % _analyzeSteps.length;
    analyzingStep.textContent = _analyzeSteps[_stepIdx];
  }, 2000);
}

function hideAnalyzing() {
  analyzingOverlay.classList.remove('active');
  clearInterval(_stepTimer);
  analyzeBtn.disabled = false;
}

function updateAnalyzingStep(msg) { analyzingStep.textContent = msg; }

// ─── Status (null-safe — status-dot/text may not exist in all layouts) ───────
function setStatus(text, type) {
  if (statusText) statusText.textContent = text;
  if (statusDot) {
    statusDot.className = 'status-dot';
    statusDot.classList.add(type === 'online' ? 'online' : type === 'loading' ? 'loading' : 'offline');
  }
}

// ─── Toast ───────────────────────────────────────────────────────────────────
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  const icon = { success:'✓', error:'✕', warning:'⚠', info:'ℹ' }[type] || 'ℹ';
  toast.innerHTML = `<span>${icon}</span> <span>${escHtml(message)}</span>`;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('visible'));
  setTimeout(() => { toast.classList.remove('visible'); setTimeout(() => toast.remove(), 350); }, 3500);
}

// ─── Language helpers ─────────────────────────────────────────────────────────
function _langToMonaco(lang) {
  const map = {
    python:'python', javascript:'javascript', typescript:'typescript',
    java:'java', go:'go', rust:'rust', cpp:'cpp', c:'c', csharp:'csharp',
    ruby:'ruby', php:'php', swift:'swift', kotlin:'kotlin',
    sql:'sql', bash:'shell', html:'html', css:'css', yaml:'yaml',
    json:'json', toml:'ini', markdown:'markdown',
  };
  return map[(lang || '').toLowerCase()] || 'plaintext';
}

function _extToMonacoLang(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const map = { py:'python', js:'javascript', ts:'typescript', jsx:'javascript', tsx:'typescript',
    java:'java', go:'go', rs:'rust', cpp:'cpp', c:'c', cs:'csharp', rb:'ruby',
    php:'php', swift:'swift', kt:'kotlin', sql:'sql', sh:'shell', bash:'shell',
    html:'html', css:'css', yaml:'yaml', yml:'yaml', json:'json' };
  return map[ext] || 'plaintext';
}

// ─── Utils ───────────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── Sample fallbacks (if /static/samples/ fails) ────────────────────────────
function _getSampleFallback(sample) {
  const samples = {
    'buggy.py': `# buggy.py — sample with intentional bugs\nimport sqlite3\n\nDB_PASSWORD = "admin123"  # BAD: hardcoded\n\ndef login(username, password):\n    conn = sqlite3.connect("users.db")\n    cursor = conn.cursor()\n    # CRITICAL: SQL injection\n    query = f"SELECT * FROM users WHERE username = '{username}' AND password = '{password}'"\n    cursor.execute(query)\n    return cursor.fetchone()  # BAD: conn never closed\n\ndef parse_config(f):\n    try:\n        return eval(open(f).read())  # BAD: eval()\n    except:  # BAD: bare except\n        pass\n`,
    'buggy.js': `// buggy.js — sample with intentional bugs\nconst API_KEY = "sk-live-abc123";  // BAD: hardcoded\n\nfunction displayMessage(msg) {\n    document.getElementById("out").innerHTML = msg;  // BAD: XSS\n}\n\nfunction isAdmin(role) {\n    if (role == 1) return true;  // BAD: == coercion\n    return false;\n}\n`,
    'buggy.java': `// buggy.java — sample with intentional bugs\nimport java.sql.*;\n\npublic class UserService {\n    private static final String DB_PASS = "password123";  // BAD: hardcoded\n\n    public boolean checkRole(String role) {\n        if (role == "admin") return true;  // BAD: == not .equals()\n        return false;\n    }\n\n    public String getUser(String userId) throws SQLException {\n        Connection conn = DriverManager.getConnection("jdbc:mysql://localhost/db", "root", DB_PASS);\n        PreparedStatement ps = conn.prepareStatement(\n            "SELECT * FROM users WHERE id = '" + userId + "'"  // CRITICAL: SQL injection\n        );\n        ResultSet rs = ps.executeQuery();\n        if (rs.next()) return rs.getString("name");\n        return null;  // BAD: conn never closed\n    }\n}\n`,
  };
  return samples[sample] || '// Sample not found\n';
}
