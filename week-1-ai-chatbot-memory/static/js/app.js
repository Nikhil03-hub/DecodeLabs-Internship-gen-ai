/**
 * Week 1 — AI Chatbot with Memory
 * Frontend logic: chat UI + memory panel
 */

'use strict';

// ─── State ───────────────────────────────────────────────────────────────────

let isLoading = false;
let MAX_TOKENS = 6000;

// ─── DOM refs ────────────────────────────────────────────────────────────────

const chatMessages   = document.getElementById('chat-messages');
const userInput      = document.getElementById('user-input');
const sendBtn        = document.getElementById('send-btn');
const newChatBtn     = document.getElementById('new-chat-btn');
const clearMemBtn    = document.getElementById('clear-memory-btn');
const demoBtn        = document.getElementById('demo-btn');
const typingIndicator = document.getElementById('typing-indicator');
const emptyState     = document.getElementById('empty-state');
const charCount      = document.getElementById('char-count');
const memoryList     = document.getElementById('memory-list');
const msgCount       = document.getElementById('msg-count');
const tokenEst       = document.getElementById('token-est');
const tokenBar       = document.getElementById('token-bar');
const tokenPct       = document.getElementById('token-pct');
const prunedBadge    = document.getElementById('pruned-badge');
const statusDot      = document.getElementById('status-dot');
const statusText     = document.getElementById('status-text');

// ─── Toast system ────────────────────────────────────────────────────────────

function showToast(title, message = '', type = 'info', duration = 4000) {
  const container = document.getElementById('toast-container');
  const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || 'ℹ'}</span>
    <div class="toast-content">
      <div class="toast-title">${escapeHtml(title)}</div>
      ${message ? `<div class="toast-message">${escapeHtml(message)}</div>` : ''}
    </div>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('removing');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  }, duration);
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function scrollToBottom() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// ─── Message rendering ───────────────────────────────────────────────────────

function appendMessage(role, content) {
  // Hide empty state on first message
  const empty = document.getElementById('empty-state');
  if (empty) empty.remove();

  const msgEl = document.createElement('div');
  msgEl.className = `message message-${role === 'user' ? 'user' : 'assistant'}`;
  msgEl.innerHTML = `
    <div class="message-avatar ${role === 'user' ? 'user-avatar' : 'assistant-avatar'}">
      ${role === 'user' ? 'You' : 'AI'}
    </div>
    <div>
      <div class="message-bubble">${formatContent(content)}</div>
      <div class="message-meta">
        <span>${formatTime()}</span>
      </div>
    </div>
  `;

  chatMessages.appendChild(msgEl);
  scrollToBottom();
  return msgEl;
}

function formatContent(text) {
  // Basic markdown: bold, code inline
  return escapeHtml(text)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code style="background:rgba(255,255,255,0.08);padding:0.1em 0.35em;border-radius:3px;font-size:0.875em;font-family:var(--font-mono)">$1</code>')
    .replace(/\n/g, '<br>');
}

// ─── Memory panel ────────────────────────────────────────────────────────────

function updateMemoryPanel(data) {
  const { memory = [], message_count = 0, est_tokens = 0, pruned = false } = data;

  msgCount.textContent  = message_count;
  tokenEst.textContent  = est_tokens.toLocaleString();

  const pct = Math.min((est_tokens / MAX_TOKENS) * 100, 100);
  tokenBar.style.width = pct + '%';
  tokenPct.textContent = Math.round(pct) + '%';

  // Color the bar based on usage
  if (pct > 85) {
    tokenBar.style.background = 'var(--danger)';
  } else if (pct > 60) {
    tokenBar.style.background = 'var(--warning)';
  } else {
    tokenBar.style.background = 'linear-gradient(90deg, var(--brand), var(--brand-2))';
  }

  // Pruned badge
  if (pruned) {
    prunedBadge.hidden = false;
    setTimeout(() => { prunedBadge.hidden = true; }, 5000);
  }

  // Re-render memory list
  memoryList.innerHTML = '';

  if (!memory.length) {
    memoryList.innerHTML = `
      <div class="empty-state" style="padding:2rem 1rem;">
        <div class="empty-state-desc">Memory array is empty — start chatting!</div>
      </div>`;
    return;
  }

  memory.forEach((msg, idx) => {
    const entry = document.createElement('div');
    entry.className = 'memory-entry';
    const snippet = msg.content.length > 80
      ? escapeHtml(msg.content.slice(0, 80)) + '…'
      : escapeHtml(msg.content);
    entry.innerHTML = `
      <span class="memory-entry-idx">${idx}</span>
      <div class="memory-entry-content">
        <span class="memory-entry-role role-${msg.role}">${msg.role}</span>
        <div class="memory-entry-text">${snippet}</div>
      </div>
    `;
    memoryList.appendChild(entry);
  });

  // Scroll memory list to bottom
  memoryList.scrollTop = memoryList.scrollHeight;
}

// ─── Status indicator ────────────────────────────────────────────────────────

function setStatus(state, text) {
  statusDot.className = `status-dot ${state}`;
  statusText.textContent = text;
}

// ─── API calls ───────────────────────────────────────────────────────────────

async function sendMessage(message) {
  if (isLoading) return;
  isLoading = true;

  sendBtn.disabled = true;
  sendBtn.innerHTML = '<div class="spinner spinner-sm"></div><span>Sending…</span>';
  typingIndicator.hidden = false;
  scrollToBottom();
  setStatus('loading', 'Thinking…');

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || `Server error ${res.status}`);
    }

    typingIndicator.hidden = true;
    appendMessage('model', data.reply);
    updateMemoryPanel(data);
    setStatus('online', 'Ready');

    if (data.pruned) {
      showToast('Context trimmed', 'Older messages removed to stay within token limit.', 'warning');
    }

  } catch (err) {
    typingIndicator.hidden = true;
    setStatus('offline', 'Error');
    showToast('Error', err.message, 'error');
  } finally {
    isLoading = false;
    sendBtn.disabled = false;
    sendBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg><span>Send</span>';
    userInput.focus();
  }
}

async function resetChat() {
  try {
    await fetch('/api/reset', { method: 'POST' });
    chatMessages.innerHTML = `
      <div class="empty-state" id="empty-state">
        <div class="empty-state-icon">💬</div>
        <div class="empty-state-title">Start a conversation</div>
        <p class="empty-state-desc">
          Your memory builds up in the panel →<br/>
          The AI sees the full history on every turn.
        </p>
        <button class="btn btn-ghost btn-sm" id="demo-btn" style="margin-top:0.5rem;">
          <span>Run memory test</span>
        </button>
      </div>`;
    // Re-attach demo button
    document.getElementById('demo-btn')?.addEventListener('click', runMemoryTest);
    updateMemoryPanel({ memory: [], message_count: 0, est_tokens: 0 });
    prunedBadge.hidden = true;
    setStatus('online', 'Ready');
    showToast('New chat started', '', 'success');
  } catch (err) {
    showToast('Error', 'Could not reset chat.', 'error');
  }
}

async function loadHistory() {
  try {
    const res = await fetch('/api/history');
    if (res.ok) {
      const data = await res.json();
      updateMemoryPanel(data);
      // Restore chat messages from history
      if (data.memory && data.memory.length > 0) {
        const empty = document.getElementById('empty-state');
        if (empty) empty.remove();
        data.memory.forEach(msg => appendMessage(msg.role, msg.content));
      }
      setStatus('online', 'Ready');
    }
  } catch (err) {
    setStatus('offline', 'Offline');
  }
}

// ─── Memory test (demo) ──────────────────────────────────────────────────────

async function runMemoryTest() {
  showToast('Running memory test…', 'Sending two messages to prove cross-turn recall.', 'info', 3000);

  // Message 1: introduce a fact
  appendMessage('user', 'My name is Nikhil and my favorite city is Kyoto.');
  await sendMessage('My name is Nikhil and my favorite city is Kyoto.');

  // Wait then ask to recall
  await new Promise(r => setTimeout(r, 1500));
  appendMessage('user', 'What is my name and favorite city?');
  await sendMessage('What is my name and favorite city?');
}

// ─── Event listeners ─────────────────────────────────────────────────────────

function handleSend() {
  const text = userInput.value.trim();
  if (!text || isLoading) return;

  appendMessage('user', text);
  userInput.value = '';
  charCount.textContent = '0 / 4000';
  autoResize();
  sendMessage(text);
}

userInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
});

sendBtn.addEventListener('click', handleSend);
newChatBtn.addEventListener('click', resetChat);
clearMemBtn.addEventListener('click', resetChat);

// Auto-resize textarea
function autoResize() {
  userInput.style.height = 'auto';
  userInput.style.height = Math.min(userInput.scrollHeight, 160) + 'px';
}

userInput.addEventListener('input', () => {
  autoResize();
  const len = userInput.value.length;
  charCount.textContent = `${len} / 4000`;
  charCount.style.color = len > 3800 ? 'var(--danger)' : len > 3000 ? 'var(--warning)' : 'var(--text-muted)';
});

// Demo button
document.getElementById('demo-btn')?.addEventListener('click', runMemoryTest);

// Spotlight effect on cards (Magic UI inspired)
document.querySelectorAll('.card').forEach(card => {
  card.addEventListener('mousemove', (e) => {
    const rect = card.getBoundingClientRect();
    card.style.setProperty('--mouse-x', (e.clientX - rect.left) + 'px');
    card.style.setProperty('--mouse-y', (e.clientY - rect.top) + 'px');
  });
});

// Intersection Observer for reveal animations
const revealObserver = new IntersectionObserver(
  (entries) => entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('visible'); revealObserver.unobserve(e.target); }
  }),
  { threshold: 0.1 }
);
document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

// ─── Init ────────────────────────────────────────────────────────────────────

loadHistory();
