function getApiKey() {
  let k = localStorage.getItem('openrouter_key');
  if (k) return k;
  const c = document.cookie.split(';').map(s => s.trim()).find(r => r.startsWith('openrouter_key='));
  return c ? decodeURIComponent(c.split('=')[1]) : '';
}
function setApiKey(k) {
  localStorage.setItem('openrouter_key', k);
  document.cookie = `openrouter_key=${encodeURIComponent(k)}; path=/; max-age=31536000; SameSite=Lax`;
}
function safeParse(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}

const state = {
  apiKey: getApiKey(),
  image: { data: '', name: '', mime: '' },
  messages: safeParse('chat_history', []),
  history: safeParse('ai_history', []),
  timestamp: parseInt(localStorage.getItem('chat_timestamp') || '0') || Date.now(),
  sending: false,
  stealth: false
};
const EXPIRY_MS = 3600000;
const MAX_HISTORY = 20;

const $ = id => document.getElementById(id);
const chatContainer = $('chatContainer');
const input = $('questionInput');
const sendBtn = $('sendBtn');
const fileBtn = $('fileBtn');
const fileInput = $('fileInput');
const previewBar = $('imagePreviewBar');
const previewThumb = $('previewThumb');
const previewName = $('previewName');
const removeImgBtn = $('removeImgBtn');
const apiBtn = $('apiBtn');
const apiToast = $('apiToast');
const apiKeyInput = $('apiKeyInput');
const saveApiKey = $('saveApiKey');
const closeToast = $('closeToast');
const timerDisplay = $('timerDisplay');
const stealthOverlay = $('stealthOverlay');

function checkExpiry() {
  if (Date.now() - state.timestamp > EXPIRY_MS) {
    state.messages = []; state.history = []; state.timestamp = Date.now();
    localStorage.setItem('chat_history', '[]');
    localStorage.setItem('ai_history', '[]');
    localStorage.setItem('chat_timestamp', String(state.timestamp));
    renderMessages();
  }
}
function updateTimer() {
  const remaining = Math.max(0, EXPIRY_MS - (Date.now() - state.timestamp));
  const m = Math.floor(remaining / 60000);
  const s = Math.floor((remaining % 60000) / 1000);
  timerDisplay.textContent = `${m}:${String(s).padStart(2,'0')}`;
  if (remaining <= 0) checkExpiry();
}

function renderMessages() {
  const fragment = document.createDocumentFragment();
  state.messages.forEach(m => {
    const div = document.createElement('div');
    div.className = `msg ${m.role}`;
    if (m.role === 'ai') {
      const label = document.createElement('div');
      label.className = 'label';
      label.textContent = 'ai';
      div.appendChild(label);
    }
    if (m.image) {
      const img = document.createElement('img');
      img.className = 'attached';
      img.src = m.image;
      div.appendChild(img);
    }
    const text = document.createElement('div');
    text.textContent = m.text;
    div.appendChild(text);
    if (m.choices) {
      const wrap = document.createElement('div');
      wrap.className = 'choices';
      m.choices.forEach(c => {
        const el = document.createElement('div');
        el.className = `choice-item${c.status ? ' '+c.status : ''}`;
        el.textContent = c.text;
        wrap.appendChild(el);
      });
      div.appendChild(wrap);
    }
    const time = document.createElement('div');
    time.className = 'time';
    time.textContent = m.time;
    div.appendChild(time);
    fragment.appendChild(div);
  });
  chatContainer.innerHTML = '';
  chatContainer.appendChild(fragment);
  scrollToBottom();
}
function scrollToBottom() {
  requestAnimationFrame(() => { chatContainer.scrollTop = chatContainer.scrollHeight; });
}
function addMessage(role, text, opts = {}) {
  const msg = { role, text, time: new Date().toLocaleTimeString('th-TH', { hour:'2-digit', minute:'2-digit' }), ...opts };
  state.messages.push(msg);
  try {
    const toSave = state.messages.slice(-30);
    localStorage.setItem('chat_history', JSON.stringify(toSave));
    localStorage.setItem('chat_timestamp', String(state.timestamp));
  } catch (e) {
    if (e.name === 'QuotaExceededError' || e.code === 22) {
      state.messages = state.messages.slice(-10);
      localStorage.setItem('chat_history', JSON.stringify(state.messages));
    }
  }
  renderMessages();
}
function showTyping() {
  const d = document.createElement('div');
  d.className = 'msg ai'; d.id = 'typingIndicator';
  const l = document.createElement('div'); l.className = 'label'; l.textContent = 'ai';
  d.appendChild(l);
  const t = document.createElement('div'); t.className = 'typing';
  t.innerHTML = '<span></span><span></span><span></span>';
  d.appendChild(t);
  chatContainer.appendChild(d);
  scrollToBottom();
}
function hideTyping() {
  const el = document.getElementById('typingIndicator');
  if (el) el.remove();
}

async function callAI(question, hasImage) {
  if (!state.apiKey) throw new Error('NO_KEY');
  const messages = [];
  state.history.slice(-MAX_HISTORY).forEach(h => messages.push({ role: h.role, content: h.text }));
  const userContent = [];
  if (hasImage && state.image.data) userContent.push({ type: 'image_url', image_url: { url: `data:${state.image.mime};base64,${state.image.data}` } });
  userContent.push({ type: 'text', text: question });
  messages.push({ role: 'user', content: userContent });
  const model = 'google/gemma-4-31b-it:free';
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.apiKey}`, 'HTTP-Referer': 'https://memo.local', 'X-Title': 'Memo' },
    body: JSON.stringify({ model, messages, temperature: 0.7, max_tokens: 2048 })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || `HTTP ${res.status}`);
  const reply = data.choices?.[0]?.message?.content || 'ขอโทษครับ ตอบไม่ได้';
  state.history.push({ role: 'user', text: hasImage ? `[รูป] ${question}` : question });
  state.history.push({ role: 'assistant', text: reply });
  if (state.history.length > MAX_HISTORY * 2) state.history = state.history.slice(-MAX_HISTORY * 2);
  try { localStorage.setItem('ai_history', JSON.stringify(state.history)); } catch {}
  return reply;
}

function parseChoices(text) {
  const lines = text.split('\n').filter(l => l.trim());
  const choices = []; let has = false;
  const p = /^[กขคง]\s*[.)]|\b[กขคง]\)\s*|^[A-Da-d]\s*[.)]|\b[A-Da-d]\)\s*/;
  for (const line of lines) {
    if (p.test(line.trim())) {
      has = true;
      const t = line.trim().replace(/[✓✔✅]/g,'').trim();
      let s = '';
      if (/ถูก|correct|ข้อที่ถูก|เฉลย/i.test(t) && !/ผิด|wrong|✗/i.test(t)) s = 'correct';
      else if (/ผิด|wrong|✗/i.test(t)) s = 'wrong';
      choices.push({ text: t, status: s });
    }
  }
  return has ? choices : null;
}

async function sendMessage(overrideText) {
  if (state.sending) return;
  const text = (overrideText || input.value).trim();
  if (!text && !state.image.data) return;
  state.sending = true; sendBtn.disabled = true;
  const hasImage = !!state.image.data;
  addMessage('user', text, hasImage ? { image: `data:${state.image.mime};base64,${state.image.data}` } : {});
  input.value = ''; showTyping();
  try {
    if (!state.apiKey) { hideTyping(); addMessage('ai', 'ใส่ API Key ที่ openrouter.ai/keys'); state.sending = false; sendBtn.disabled = false; return; }
    let prompt = text;
    if (hasImage) {
      if (/สรุป|summary/i.test(text)) prompt = 'สรุปเนื้อหาจากรูปนี้ให้หน่อย เป็นประเด็นสั้นๆ เข้าใจง่าย แยกหัวข้อชัดเจน';
      else if (/ข้อสอบ|quiz|เฉลย|ช้อย/i.test(text)) prompt = 'จากรูปนี้ ทำข้อสอบแบบเลือกตอบ ก ข ค ง มาให้ 5 ข้อ พร้อมเฉลยอธิบายแต่ละข้อว่าทำไมถึงถูกหรือผิด';
      else if (/flashcard|card/i.test(text)) prompt = 'จากรูปนี้ ทำ Flashcards แบบคำถาม-คำตอบมาให้ 10 คู่';
    }
    const reply = await callAI(prompt, hasImage);
    hideTyping();
    const choices = parseChoices(reply);
    addMessage('ai', reply, choices ? { choices } : {});
    if (state.image.data) clearImage();
  } catch (err) { hideTyping(); addMessage('ai', `Error: ${err.message}`); }
  state.sending = false; sendBtn.disabled = false;
}

function handleImage(file) {
  if (!file || !file.type.startsWith('image/')) return;
  if (file.size > 10 * 1024 * 1024) { addMessage('ai', 'รูปใหญ่เกินไป (จำกัด 10MB)'); return; }
  const reader = new FileReader();
  reader.onerror = () => { addMessage('ai', 'อ่านรูปไม่สำเร็จ'); };
  reader.onload = (e) => {
    const data = e.target.result.split(',')[1];
    if (data.length > 15 * 1024 * 1024) { addMessage('ai', 'รูปความละเอียดสูงเกินไป ลดขนาดก่อน'); return; }
    state.image = { data, name: file.name, mime: file.type };
    previewThumb.src = e.target.result;
    previewName.textContent = file.name;
    previewBar.classList.add('show');
    input.focus();
  };
  reader.readAsDataURL(file);
}
function clearImage() {
  state.image = { data: '', name: '', mime: '' };
  previewBar.classList.remove('show'); fileInput.value = '';
}

// === QUICK ACTIONS ===
function handleQuickAction(action) {
  if (action === 'clear') {
    state.messages = []; state.history = []; state.timestamp = Date.now();
    try {
      localStorage.setItem('chat_history', '[]');
      localStorage.setItem('ai_history', '[]');
      localStorage.setItem('chat_timestamp', String(state.timestamp));
    } catch {}
    renderMessages(); return;
  }
  if (!state.image.data) { addMessage('ai', '📷 อัปโหลดรูปก่อน'); return; }
  const prompts = {
    summarize: 'สรุปเนื้อหาจากรูปนี้ให้หน่อย เป็นประเด็นสั้นๆ เข้าใจง่าย แยกหัวข้อชัดเจน',
    quiz: 'จากรูปนี้ ทำข้อสอบแบบเลือกตอบ ก ข ค ง มาให้ 5 ข้อ พร้อมเฉลยอธิบาย',
    flashcard: 'จากรูปนี้ ทำ Flashcards แบบคำถาม-คำตอบมาให้ 10 คู่',
    choices: 'จากรูปนี้ ทำให้เป็นข้อสอบเลือกตอบ ก ข ค ง 5 ข้อ แต่ละข้อเฉลยพร้อมอธิบายว่าทำไมข้อนั้นถึงถูก และทำไมข้ออื่นถึงผิด'
  };
  sendMessage(prompts[action]);
}

// === STEALTH MODE ===
function toggleStealth() {
  state.stealth = !state.stealth;
  stealthOverlay.classList.toggle('show', state.stealth);
  if (state.stealth) { input.blur(); apiToast.classList.remove('show'); }
  else input.focus();
}

let touchStartX = 0, touchStartY = 0;
document.addEventListener('touchstart', (e) => {
  touchStartX = e.changedTouches[0].screenX;
  touchStartY = e.changedTouches[0].screenY;
}, { passive: true });
document.addEventListener('touchend', (e) => {
  const dx = e.changedTouches[0].screenX - touchStartX;
  const dy = e.changedTouches[0].screenY - touchStartY;
  if (Math.abs(dx) > 60 && Math.abs(dy) < 100) toggleStealth();
}, { passive: true });

// Tap status bar to toggle (iOS)
document.addEventListener('click', (e) => {
  if (e.clientY < 30 && state.stealth) toggleStealth();
});

// === EVENTS ===
sendBtn.addEventListener('click', () => sendMessage());
input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); sendMessage(); } });
fileBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => handleImage(e.target.files[0]));
removeImgBtn.addEventListener('click', clearImage);
apiBtn.addEventListener('click', () => { apiKeyInput.value = state.apiKey; apiToast.classList.add('show'); });
closeToast.addEventListener('click', () => apiToast.classList.remove('show'));
saveApiKey.addEventListener('click', () => {
  const k = apiKeyInput.value.trim(); if (!k) return;
  state.apiKey = k; setApiKey(k); apiToast.classList.remove('show');
  updateApiStatus(); addMessage('ai', '✅ saved');
});
document.querySelectorAll('.quick-btn').forEach(btn => btn.addEventListener('click', () => handleQuickAction(btn.dataset.action)));
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => { e.preventDefault(); if (e.dataTransfer.files[0]) handleImage(e.dataTransfer.files[0]); });
setTimeout(() => input.focus(), 500);

let lastHeight = window.innerHeight;
window.addEventListener('resize', () => {
  const h = window.innerHeight;
  if (lastHeight > h) setTimeout(scrollToBottom, 300);
  lastHeight = h;
});

function updateApiStatus() { apiBtn.textContent = state.apiKey ? '✅' : '🔑'; }
updateApiStatus();

try {
  checkExpiry(); renderMessages();
} catch (e) {
  state.messages = []; state.history = []; state.timestamp = Date.now();
  try {
    localStorage.setItem('chat_history', '[]');
    localStorage.setItem('ai_history', '[]');
    localStorage.setItem('chat_timestamp', String(state.timestamp));
  } catch {}
  renderMessages();
}
setInterval(updateTimer, 1000);
updateTimer();
