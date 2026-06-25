'use strict';

// ─── State ───────────────────────────────────────────────────────────────────
let hasDocument = false;

// ─── DOM ─────────────────────────────────────────────────────────────────────
const uploadZone   = document.getElementById('upload-zone');
const fileInput    = document.getElementById('file-input');
const pasteArea    = document.getElementById('paste-area');
const pasteFilename = document.getElementById('paste-filename');
const ingestBtn    = document.getElementById('ingest-btn');
const clearBtn     = document.getElementById('clear-btn');
const docStatus    = document.getElementById('doc-status');
const docName      = document.getElementById('doc-name');
const docMeta      = document.getElementById('doc-meta');
const docPreview   = document.getElementById('doc-preview');
const chatArea     = document.getElementById('chat-area');
const chatEmpty    = document.getElementById('chat-empty');
const queryInput   = document.getElementById('query-input');
const queryBtn     = document.getElementById('query-btn');
const statusDot    = document.getElementById('status-dot');
const statusText   = document.getElementById('status-text');

// ─── Status ──────────────────────────────────────────────────────────────────
function setStatus(text, type) {
  if (statusText) statusText.textContent = text;
  if (statusDot) {
    statusDot.className = 'status-dot';
    if (type === 'online')  statusDot.classList.add('online');
    if (type === 'loading') statusDot.classList.add('loading');
    if (type === 'offline') statusDot.classList.add('offline');
  }
}

// ─── Toast ───────────────────────────────────────────────────────────────────
function showToast(msg, type = 'info') {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.innerHTML = `<span>${{ success:'✓', error:'✕', warning:'⚠', info:'ℹ' }[type]||'ℹ'}</span> <span>${esc(msg)}</span>`;
  c.appendChild(t);
  requestAnimationFrame(() => t.classList.add('visible'));
  setTimeout(() => { t.classList.remove('visible'); setTimeout(() => t.remove(), 350); }, 3500);
}

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ─── Check API status ────────────────────────────────────────────────────────
async function checkStatus() {
  try {
    const r = await fetch('/api/status');
    const d = await r.json();
    if (!d.api_ready) {
      setStatus('No API key', 'offline');
      showToast('Add GEMINI_API_KEY to .env', 'error');
    } else if (d.has_document) {
      setStatus('Document loaded', 'online');
      showDocStatus(d.filename, d.chunk_count, '');
    } else {
      setStatus('Ready', 'online');
    }
  } catch {
    setStatus('Offline', 'offline');
  }
}

// ─── File upload ─────────────────────────────────────────────────────────────
uploadZone.addEventListener('click', () => fileInput.click());
uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('drag-over'); });
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
uploadZone.addEventListener('drop', e => {
  e.preventDefault();
  uploadZone.classList.remove('drag-over');
  const f = e.dataTransfer.files[0];
  if (f) ingestFile(f);
});
fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) ingestFile(fileInput.files[0]);
});

// ─── Ingest (file) ───────────────────────────────────────────────────────────
async function ingestFile(file) {
  setStatus('Embedding…', 'loading');
  ingestBtn.disabled = true;
  const fd = new FormData();
  fd.append('file', file);
  try {
    const r = await fetch('/api/ingest', { method: 'POST', body: fd });
    const d = await r.json();
    if (!r.ok) { showToast(d.error, 'error'); setStatus('Error', 'offline'); return; }
    onIngested(d);
  } catch (e) {
    showToast(e.message, 'error'); setStatus('Error', 'offline');
  } finally {
    ingestBtn.disabled = false;
  }
}

// ─── Ingest (paste) ──────────────────────────────────────────────────────────
ingestBtn.addEventListener('click', async () => {
  const text = pasteArea.value.trim();
  if (!text) { showToast('Paste some text first', 'warning'); return; }
  const filename = pasteFilename.value.trim() || 'pasted_text.txt';

  setStatus('Embedding…', 'loading');
  ingestBtn.disabled = true;
  try {
    const r = await fetch('/api/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, filename }),
    });
    const d = await r.json();
    if (!r.ok) { showToast(d.error, 'error'); setStatus('Error', 'offline'); return; }
    onIngested(d);
  } catch (e) {
    showToast(e.message, 'error'); setStatus('Error', 'offline');
  } finally {
    ingestBtn.disabled = false;
  }
});

function onIngested(d) {
  showDocStatus(d.filename, d.chunk_count, d.preview);
  enableQA();
  showToast(`Loaded "${d.filename}" — ${d.chunk_count} chunks`, 'success');
  setStatus('Ready to query', 'online');
  pasteArea.value = '';
}

function showDocStatus(filename, chunkCount, preview) {
  hasDocument = true;
  docStatus.classList.add('visible');
  docName.textContent = filename;
  docMeta.textContent = `${chunkCount} chunk${chunkCount !== 1 ? 's' : ''} embedded`;
  if (preview) docPreview.textContent = preview + (preview.length >= 300 ? '…' : '');
  chatEmpty.querySelector('h3').textContent = 'Document ready';
  chatEmpty.querySelector('p').textContent  = 'Ask any question about your document below.';
}

function enableQA() {
  queryInput.disabled = false;
  queryBtn.disabled   = false;
  queryInput.focus();
}

// ─── Clear ───────────────────────────────────────────────────────────────────
clearBtn.addEventListener('click', async () => {
  await fetch('/api/clear', { method: 'POST' });
  hasDocument = false;
  docStatus.classList.remove('visible');
  queryInput.disabled = true;
  queryBtn.disabled   = true;
  chatArea.innerHTML  = '';
  chatArea.appendChild(chatEmpty);
  chatEmpty.querySelector('h3').textContent = 'No document loaded yet';
  chatEmpty.querySelector('p').textContent  = 'Upload or paste a document on the left, then ask questions here.';
  setStatus('Ready', 'online');
  showToast('Document cleared', 'info');
});

// ─── Sample loader ───────────────────────────────────────────────────────────
const SAMPLES = {
  ai_overview: {
    filename: 'ai_overview.txt',
    text: `Artificial intelligence (AI) is intelligence demonstrated by machines, as opposed to the natural intelligence displayed by animals including humans. AI research has been defined as the field of study of intelligent agents, which refers to any system that perceives its environment and takes actions that maximize its chance of achieving its goals.

The term "artificial intelligence" had previously been used to describe machines that mimic and display "human" cognitive skills associated with the human mind, such as "learning" and "problem-solving". This definition has since been rejected by major AI researchers who now describe AI in terms of rationality and acting rationally, which does not limit how intelligence can be articulated.

AI applications include advanced web search engines (e.g., Google Search), recommendation systems (used by YouTube, Amazon, and Netflix), understanding human speech (such as Siri and Alexa), self-driving cars (e.g., Waymo), generative or creative tools (ChatGPT and AI art), and competing at the highest level in strategic games (such as chess and Go).

Machine learning (ML) is a field of inquiry devoted to understanding and building methods that "learn" — that is, methods that leverage data to improve performance on some set of tasks. It is seen as a part of artificial intelligence.

Deep learning is part of a broader family of machine learning methods based on artificial neural networks with representation learning. Learning can be supervised, semi-supervised or unsupervised. Deep learning architectures such as deep neural networks, recurrent neural networks, convolutional neural networks and transformers have been applied to fields including computer vision, natural language processing, audio recognition, and bioinformatics.

Large language models (LLMs) are language models consisting of a neural network with many parameters, trained on large quantities of unlabeled text using self-supervised or semi-supervised learning. They emerged around 2018 and perform well at a wide variety of tasks. This has shifted the focus of natural language processing research away from the previous paradigm of training specialized supervised models for specific tasks.`,
  },
  flask_docs: {
    filename: 'flask_quickstart.txt',
    text: `Flask Quickstart Guide

A minimal Flask application looks something like this:

from flask import Flask
app = Flask(__name__)

@app.route("/")
def hello_world():
    return "<p>Hello, World!</p>"

So what did that code do? First we imported the Flask class. An instance of this class will be our WSGI application. Next we create an instance of this class. The first argument is the name of the application's module or package.

Debug Mode
Just running app.run() is fine for development, but for production you should use a production WSGI server like gunicorn. To enable debug mode, set FLASK_DEBUG=1 in the environment.

Routing
Modern web applications use meaningful URLs to help users. Use the route() decorator to bind a function to a URL. The @app.route("/") decoration means the hello_world() function will be called when visiting the root URL.

Variable Rules
You can add variable sections to a URL by marking sections with <variable_name>. Your function then receives the <variable_name> as a keyword argument.

@app.route('/user/<username>')
def show_user_profile(username):
    return f'User {username}'

HTTP Methods
Web applications use different HTTP methods when accessing URLs. By default, a route only answers to GET requests. You can use the methods argument of the route() decorator to handle different HTTP methods.

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        return do_the_login()
    else:
        return show_the_login_form()

The Request Object
The request object is documented in the API section. Here is a brief overview of some of the most common operations. First of all you have to import it from the flask module. The current request method is available by using the method attribute. To access form data (data transmitted in a POST or PUT request) you can use the form attribute.

Rendering Templates
Generating HTML from within Python is not fun, and actually pretty cumbersome. Flask configures the Jinja2 template engine for you automatically. To render a template you can use the render_template() method. All you have to do is provide the name of the template and the variables you want to pass to the template engine as keyword arguments.`,
  },
  startup_report: {
    filename: 'startup_funding_report.txt',
    text: `Global Startup Funding Report — Q1 2025

Executive Summary
Global venture capital funding rebounded strongly in Q1 2025, with total investment reaching $89.3 billion across 4,200 deals. This represents a 23% increase compared to Q1 2024, signaling renewed investor confidence in the technology sector following a prolonged correction period.

Key Findings

AI and Machine Learning continue to dominate investment, capturing 38% of total funding ($33.9B). Generative AI companies alone secured $14.2 billion, with foundation model companies accounting for $8.1 billion of that total.

Healthcare technology was the second-largest sector, with $12.4 billion invested across 680 deals. Digital health platforms and AI-assisted diagnostics attracted particular interest from strategic investors.

Fintech investment reached $9.8 billion, driven by embedded finance solutions and cross-border payment infrastructure. Southeast Asia emerged as the fastest-growing fintech market, with 41% year-over-year growth.

Geographic Distribution
North America remained the largest market by volume, accounting for 44% of global deals. However, growth was strongest in Southeast Asia (+41%), Middle East (+38%), and Africa (+29%). European funding stabilized after a challenging 2024, with $18.2 billion deployed across 1,100 deals.

Stage Analysis
Seed and Series A rounds increased by 31%, indicating strong pipeline health. Late-stage funding grew more modestly at 15%, reflecting continued valuation discipline. The average Series A round size reached $12.3 million, up from $9.8 million in 2024.

Notable Deals
The quarter's largest deals included a $2.1B Series D for an AI infrastructure company, a $1.8B round for a climate tech company building grid-scale storage, and a $1.4B Series C for a healthcare AI platform operating across 47 countries.

Outlook
Analysts project continued growth through Q2 and Q3 2025, with particular optimism around AI infrastructure, climate technology, and emerging market fintech. IPO activity is expected to increase in H2 2025 as market conditions improve.`,
  },
};

document.querySelectorAll('[data-sample]').forEach(btn => {
  btn.addEventListener('click', async () => {
    const s = SAMPLES[btn.dataset.sample];
    if (!s) return;
    pasteArea.value   = s.text;
    pasteFilename.value = s.filename;
    showToast(`Sample loaded: ${s.filename}`, 'info');
  });
});

// ─── Query ───────────────────────────────────────────────────────────────────
queryBtn.addEventListener('click', runQuery);
queryInput.addEventListener('keydown', e => { if (e.key === 'Enter') runQuery(); });

async function runQuery() {
  const q = queryInput.value.trim();
  if (!q) return;
  if (!hasDocument) { showToast('Load a document first', 'warning'); return; }

  queryInput.value = '';
  queryInput.disabled = true;
  queryBtn.disabled   = true;
  setStatus('Searching…', 'loading');

  // Add question bubble
  const pair = document.createElement('div');
  pair.className = 'qa-pair';

  const qBubble = document.createElement('div');
  qBubble.className = 'q-bubble';
  qBubble.textContent = q;
  pair.appendChild(qBubble);

  // Skeleton answer
  const skeleton = document.createElement('div');
  skeleton.className = 'skeleton-answer';
  skeleton.innerHTML = `<div class="skeleton" style="height:14px;width:80%;margin-bottom:0.5rem;"></div>
    <div class="skeleton" style="height:14px;width:100%;margin-bottom:0.5rem;"></div>
    <div class="skeleton" style="height:14px;width:60%;"></div>`;
  pair.appendChild(skeleton);

  // Remove empty state if present
  if (chatEmpty.parentNode === chatArea) chatArea.removeChild(chatEmpty);
  chatArea.appendChild(pair);
  chatArea.scrollTop = chatArea.scrollHeight;

  try {
    const r = await fetch('/api/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: q, k: 5 }),
    });
    const d = await r.json();

    if (!r.ok) { showToast(d.error, 'error'); skeleton.remove(); setStatus('Error', 'offline'); return; }

    // Replace skeleton with answer card
    const aCard = document.createElement('div');
    aCard.className = 'a-card';
    aCard.innerHTML = `
      <div class="a-card-body">${esc(d.answer)}</div>
      ${d.sources && d.sources.length ? `
      <div class="a-sources">
        <div class="sources-label">Sources used</div>
        ${d.sources.map((s, i) => `
          <div class="source-chip">
            <span class="source-num">${s.index}</span>
            <span class="source-text">${esc(s.chunk)}</span>
            <span class="source-score">${(s.score * 100).toFixed(0)}%</span>
          </div>`).join('')}
      </div>` : ''}
    `;
    skeleton.replaceWith(aCard);
    chatArea.scrollTop = chatArea.scrollHeight;
    setStatus('Ready', 'online');
  } catch (err) {
    showToast(err.message, 'error');
    skeleton.remove();
    setStatus('Error', 'offline');
  } finally {
    queryInput.disabled = false;
    queryBtn.disabled   = false;
    queryInput.focus();
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────
checkStatus();
