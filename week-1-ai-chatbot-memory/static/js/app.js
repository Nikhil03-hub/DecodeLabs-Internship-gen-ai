/**
 * Week 1 — AI Chatbot with Memory
 * Frontend logic: chat UI + localStorage conversation history
 */

'use strict';

// ─── State ───────────────────────────────────────────────────────────────────

let isLoading = false;

// ─── DOM refs ────────────────────────────────────────────────────────────────

const chatMessages    = document.getElementById('chat-messages');
const userInput       = document.getElementById('user-input');
const sendBtn         = document.getElementById('send-btn');
const newChatBtn      = document.getElementById('new-chat-btn');
const typingIndicator = document.getElementById('typing-indicator');
const charCount       = document.getElementById('char-count');
const statusDot       = document.querySelector('.model-dot');

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

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ─── Message rendering ───────────────────────────────────────────────────────

function appendMessage(role, content, time) {
  const empty = document.getElementById('empty-state');
  if (empty) empty.remove();

  const msgEl = document.createElement('div');
  const isUser = role === 'user';
  const displayTime = time || formatTime();

  msgEl.className = `message message-${isUser ? 'user' : 'assistant'}`;

  if (isUser) {
    // Right-aligned gradient bubble, no avatar — naturally content-sized
    msgEl.innerHTML = `
      <div class="message-bubble">${formatContent(content)}</div>
      <div class="message-meta"><span>${displayTime}</span></div>
    `;
  } else {
    // Left-side avatar circle + content-sized bubble to its right
    msgEl.innerHTML = `
      <div class="message-avatar assistant-avatar">AI</div>
      <div class="msg-body">
        <div class="message-bubble">${formatContent(content)}</div>
        <div class="message-meta"><span>${displayTime}</span></div>
      </div>
    `;
  }

  chatMessages.appendChild(msgEl);
  scrollToBottom();
  return msgEl;
}

function formatContent(text) {
  return escapeHtml(text)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code style="background:rgba(255,255,255,0.08);padding:0.1em 0.35em;border-radius:3px;font-size:0.875em;font-family:var(--font-mono)">$1</code>')
    .replace(/\n/g, '<br>');
}

// ─── Conversation History (localStorage) ─────────────────────────────────────

const CONV_KEY = 'dl_w1_convs';
let conversations = [];
let activeConvId = null;

function loadStoredConversations() {
  try {
    conversations = JSON.parse(localStorage.getItem(CONV_KEY) || '[]');
  } catch {
    conversations = [];
  }
}

function persistConversations() {
  try {
    // Keep last 50 conversations
    localStorage.setItem(CONV_KEY, JSON.stringify(conversations.slice(0, 50)));
  } catch {
    // Storage full: trim to 10
    conversations = conversations.slice(0, 10);
    localStorage.setItem(CONV_KEY, JSON.stringify(conversations));
  }
}

function collectCurrentMessages() {
  const msgs = [];
  document.querySelectorAll('#chat-messages .message').forEach(el => {
    const isUser = el.classList.contains('message-user');
    const bubble = el.querySelector('.message-bubble');
    const time = el.querySelector('.message-meta span')?.textContent || formatTime();
    if (bubble) {
      msgs.push({
        role: isUser ? 'user' : 'model',
        content: (bubble.innerText || bubble.textContent).trim(),
        time,
      });
    }
  });
  return msgs;
}

function saveCurrentConversation() {
  const messages = collectCurrentMessages();
  if (!messages.length) return;

  const firstUser = messages.find(m => m.role === 'user');
  const title = firstUser ? firstUser.content.slice(0, 60) : 'New conversation';
  const now = Date.now();

  if (activeConvId) {
    const idx = conversations.findIndex(c => c.id === activeConvId);
    if (idx !== -1) {
      conversations[idx].messages = messages;
      conversations[idx].title = title;
      conversations[idx].updatedAt = now;
    }
  } else {
    const conv = { id: generateId(), title, createdAt: now, updatedAt: now, messages };
    conversations.unshift(conv);
    activeConvId = conv.id;
  }

  persistConversations();
  renderHistoryPanel();
}

async function loadConversation(convId) {
  const conv = conversations.find(c => c.id === convId);
  if (!conv) return;

  // Save current first
  const current = collectCurrentMessages();
  if (current.length) saveCurrentConversation();

  activeConvId = convId;

  // Clear chat UI
  chatMessages.innerHTML = '';

  // Render saved messages
  conv.messages.forEach(msg => appendMessage(msg.role, msg.content, msg.time));

  // Restore server-side context so AI remembers the conversation
  try {
    const serverMsgs = conv.messages.map(m => ({ role: m.role, content: m.content }));
    await fetch('/api/load_messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: serverMsgs }),
    });
  } catch {
    // Silently fail — messages show but AI context starts fresh
  }

  renderHistoryPanel();
}

function deleteConversation(convId, e) {
  e.stopPropagation();
  conversations = conversations.filter(c => c.id !== convId);
  persistConversations();

  if (activeConvId === convId) {
    activeConvId = null;
    chatMessages.innerHTML = buildEmptyState();
    document.getElementById('demo-btn')?.addEventListener('click', runMemoryTest);
    fetch('/api/reset', { method: 'POST' }).catch(() => {});
  }

  renderHistoryPanel();
}

function formatRelativeDate(ts) {
  const now = Date.now();
  const diff = now - ts;
  const day = 86_400_000;
  if (diff < day) {
    return 'Today · ' + new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (diff < 2 * day) {
    return 'Yesterday';
  } else {
    return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
}

function renderHistoryPanel() {
  const list = document.getElementById('history-list');
  if (!list) return;

  list.innerHTML = '';

  if (!conversations.length) {
    list.innerHTML = `
      <div style="padding:2rem 1rem;text-align:center;color:var(--text-muted);font-size:0.8125rem;line-height:1.6;">
        No conversations yet.<br>Start chatting to save history.
      </div>`;
    return;
  }

  conversations.forEach(conv => {
    const item = document.createElement('div');
    item.className = `history-item${conv.id === activeConvId ? ' active' : ''}`;
    item.dataset.id = conv.id;

    item.innerHTML = `
      <div class="history-item-content">
        <div class="history-item-title">${escapeHtml(conv.title)}</div>
        <div class="history-item-time">${formatRelativeDate(conv.updatedAt || conv.createdAt)}</div>
      </div>
      <button class="history-item-delete" title="Delete" aria-label="Delete conversation">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
        </svg>
      </button>
    `;

    item.addEventListener('click', () => loadConversation(conv.id));
    item.querySelector('.history-item-delete').addEventListener('click', (e) => deleteConversation(conv.id, e));
    list.appendChild(item);
  });
}

// ─── API calls ───────────────────────────────────────────────────────────────

async function sendMessage(message) {
  if (isLoading) return;
  isLoading = true;

  sendBtn.disabled = true;
  sendBtn.innerHTML = '<div class="spinner spinner-sm"></div><span>Sending…</span>';
  typingIndicator.hidden = false;
  scrollToBottom();

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });

    const data = await res.json();

    if (!res.ok) throw new Error(data.error || `Server error ${res.status}`);

    typingIndicator.hidden = true;
    appendMessage('model', data.reply);

    if (data.pruned) {
      showToast('Context trimmed', 'Older messages removed to stay within token limit.', 'warning');
    }

    // Auto-save to history after each exchange
    setTimeout(() => saveCurrentConversation(), 50);

  } catch (err) {
    typingIndicator.hidden = true;
    showToast('Error', err.message, 'error');
  } finally {
    isLoading = false;
    sendBtn.disabled = false;
    sendBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg><span>Send</span>';
    userInput.focus();
  }
}

async function startNewChat() {
  // Save current conversation before clearing
  const current = collectCurrentMessages();
  if (current.length) {
    saveCurrentConversation();
    showToast('Chat saved', 'Find it in the sidebar.', 'success', 2500);
  }

  activeConvId = null;

  try {
    await fetch('/api/reset', { method: 'POST' });
  } catch { /* ignore */ }

  chatMessages.innerHTML = buildEmptyState();
  document.getElementById('demo-btn')?.addEventListener('click', runMemoryTest);
  renderHistoryPanel();
}

function buildEmptyState() {
  return `
    <div class="empty-state" id="empty-state">
      <div class="empty-state-icon">💬</div>
      <div class="empty-state-title">Start a conversation</div>
      <p class="empty-state-desc">Your chats are saved in the panel →<br/>Click any past conversation to continue.</p>
      <button class="btn btn-ghost btn-sm" id="demo-btn" style="margin-top:0.5rem;">
        <span>Run memory test</span>
      </button>
    </div>`;
}

async function loadHistory() {
  try {
    const res = await fetch('/api/history');
    if (res.ok) {
      const data = await res.json();
      if (data.memory && data.memory.length > 0) {
        const empty = document.getElementById('empty-state');
        if (empty) empty.remove();
        data.memory.forEach(msg => appendMessage(msg.role, msg.content));
      }
    }
  } catch { /* offline */ }
}

// ─── Memory test (demo) ──────────────────────────────────────────────────────

async function runMemoryTest() {
  showToast('Running memory test…', 'Sending two messages to prove cross-turn recall.', 'info', 3000);
  appendMessage('user', 'My name is Nikhil and my favorite city is Kyoto.');
  await sendMessage('My name is Nikhil and my favorite city is Kyoto.');
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
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
});

sendBtn.addEventListener('click', handleSend);

newChatBtn.addEventListener('click', startNewChat);

document.getElementById('new-chat-side-btn')?.addEventListener('click', startNewChat);

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

document.getElementById('demo-btn')?.addEventListener('click', runMemoryTest);

// Spotlight effect on cards
document.querySelectorAll('.card').forEach(card => {
  card.addEventListener('mousemove', (e) => {
    const rect = card.getBoundingClientRect();
    card.style.setProperty('--mouse-x', (e.clientX - rect.left) + 'px');
    card.style.setProperty('--mouse-y', (e.clientY - rect.top) + 'px');
  });
});

// ─── Init ────────────────────────────────────────────────────────────────────

loadStoredConversations();
renderHistoryPanel();
loadHistory();
