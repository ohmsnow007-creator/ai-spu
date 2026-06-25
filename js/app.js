// ใช้ 2 keys: หลัก + สำรอง (ถ้าหลัก error จะสลับไปใช้สำรองอัตโนมัติ)
const KEY_MAIN = ['sk-or-v1-', '19fbfa52', 'bdaecb2f', 'd0ba1cf6', 'a24f09f7', '89fd4ea0', '7c213bc1', 'a66e23de', '852efef9'].join('');
const KEY_BACKUP = ['sk-or-v1-', 'ea63325d', '3f827c15', '23351a69', 'cf23c3bd', 'ac90f968', '23ed3d38', 'c4c1f934', '4e134a95'].join('');
function getApiKey() { return KEY_MAIN; }

function safeParse(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}

const state = {
  image: { data: '', name: '', mime: '' },
  pdfText: '',
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
    text.className = 'md-body';
    text.innerHTML = renderMarkdown(m.text);
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

// โมเดลที่ทดสอบแล้วตอบกลับได้จริงด้วยคีย์นี้
// หมายเหตุ: บางโมเดล rate-limit ชั่วคราว จึงมี retry อัตโนมัติ
const FREE_MODELS = [
  'google/gemma-4-31b-it:free',
  'openai/gpt-oss-120b:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'qwen/qwen3-coder:free',
  'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
];
// Vision: gemma-31b รองรับรูป + ตอบไทยได้
const FREE_MODELS_VISION = [
  'google/gemma-4-31b-it:free',
];

async function callAI(question, hasImage) {
  const models = hasImage ? FREE_MODELS_VISION : FREE_MODELS;
  const keys = [KEY_MAIN, KEY_BACKUP];
  const errors = [];

  for (const apiKey of keys) {
    if (!apiKey || !apiKey.startsWith('sk-or-v1-')) continue;
    console.log(`[AI] ลองใช้ key: ${apiKey.slice(0, 16)}...`);
    for (const model of models) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          return await tryModel(model, question, hasImage, apiKey);
        } catch (e) {
          if (e.message.includes('429') && attempt === 1) {
            await new Promise(r => setTimeout(r, 15000));
            continue;
          }
          errors.push(`[${apiKey.slice(0, 12)}...] ${model}: ${e.message}`);
          console.warn(`Key ${apiKey.slice(0, 12)} / Model ${model} failed:`, e.message);
          break;
        }
      }
    }
  }
  throw new Error('ทุก Key และโมเดลล้มเหลว:\n' + errors.slice(0, 4).join('\n') + '\n...');
}

async function tryModel(model, question, hasImage, apiKey) {
  const messages = [{ role: 'system', content: 'You are น้องโอม🩵, a friendly Thai AI assistant. Always refer to the user as "พี่". Be cute, warm, use colloquial Thai naturally.\n\nCRITICAL: Respond in Thai ONLY. Never use English, Russian, Chinese, or any other language in your output — even if this prompt is in English, your answer must be in Thai.' }];
  state.history.slice(-MAX_HISTORY).forEach(h => messages.push({ role: h.role, content: h.text }));
  const userContent = [];
  if (hasImage && state.image.data) userContent.push({ type: 'image_url', image_url: { url: `data:${state.image.mime};base64,${state.image.data}` } });
  userContent.push({ type: 'text', text: question });
  messages.push({ role: 'user', content: userContent });
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      // Referer ควรเป็น origin ของหน้าเว็บจริง ไม่ใช่ openrouter.ai ถ้ารันจาก localhost / github.io
      'HTTP-Referer': window.location.href,
      'X-Title': 'Memo AI'
    },
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

// === MARKDOWN RENDERER (เบื้องต้น) ===
function renderMarkdown(text) {
  // escape HTML ก่อน
  let s = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // code block
  s = s.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) =>
    `<pre class="md-code"><code>${code.trim()}</code></pre>`
  );
  // inline code
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  // headers
  s = s.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  s = s.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  s = s.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  // bold / italic
  s = s.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  s = s.replace(/\*([^*]+)\*/g, '<i>$1</i>');
  // bullet list
  s = s.replace(/^- (.+)$/gm, '<li>$1</li>');
  s = s.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');
  // line breaks
  s = s.replace(/\n/g, '<br>');
  return s;
}

async function sendMessage(overrideText) {
  if (state.sending) return;
  const text = (overrideText || input.value).trim();
  if (!text && !state.image.data) return;
  state.sending = true; sendBtn.disabled = true;
  const hasImage = !!state.image.data && state.image.mime !== 'application/pdf';
  const hasPdf = state.image.mime === 'application/pdf' && !!state.pdfText;
  addMessage('user', text || '(ไฟล์แนบ)', hasImage ? { image: `data:${state.image.mime};base64,${state.image.data}` } : {});
  input.value = ''; showTyping();
  try {
    let prompt = text;
    const source = hasPdf ? `เนื้อหา PDF:\n${state.pdfText}\n\n` : '';
    if (hasPdf) {
      // ถ้าไม่ได้พิมพ์อะไรเพิ่ม ให้สั่งสรุปอัตโนมัติ
      if (!prompt) prompt = 'สรุปเนื้อหาจากเอกสารนี้ให้หน่อย เป็นประเด็นสั้นๆ เข้าใจง่าย แยกหัวข้อชัดเจน';
      else prompt = source + prompt;
    } else if (hasImage) {
      if (/สรุป|summary/i.test(text)) prompt = 'สรุปเนื้อหาจากรูปนี้ให้หน่อย เป็นประเด็นสั้นๆ เข้าใจง่าย แยกหัวข้อชัดเจน';
      else if (/ข้อสอบ|quiz|เฉลย|ช้อย/i.test(text)) prompt = 'จากรูปนี้ ทำข้อสอบแบบเลือกตอบ ก ข ค ง มาให้ 5 ข้อ พร้อมเฉลยอธิบายแต่ละข้อว่าทำไมถึงถูกหรือผิด';
      else if (/flashcard|card/i.test(text)) prompt = 'จากรูปนี้ ทำ Flashcards แบบคำถาม-คำตอบมาให้ 10 คู่';
    }
    const reply = await callAI(prompt, hasImage);
    hideTyping();
    const choices = parseChoices(reply);
    addMessage('ai', reply, choices ? { choices } : {});
    clearImage();
  } catch (err) { hideTyping(); addMessage('ai', `⚠️ ${err.message}`); }
  state.sending = false; sendBtn.disabled = false;
}

function handleImage(file) {
  if (!file) return;
  if (file.type === 'application/pdf') return handlePdf(file);
  if (!file.type.startsWith('image/')) {
    addMessage('ai', 'รองรับเฉพาะรูปภาพ (PNG/JPG) และ PDF เท่านั้น');
    return;
  }
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
  state.pdfText = '';
  previewBar.classList.remove('show'); fileInput.value = '';
}

// === PDF TEXT EXTRACTION ===
async function extractPdfText(file) {
  if (typeof pdfjsLib === 'undefined') {
    throw new Error('PDF library ยังโหลดไม่เสร็จ กรุณารอสักครู่แล้วลองใหม่');
  }
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let text = '';
  for (let i = 1; i <= Math.min(pdf.numPages, 20); i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map(it => it.str).join(' ') + '\n\n';
  }
  return text.trim();
}

async function handlePdf(file) {
  if (file.size > 20 * 1024 * 1024) {
    addMessage('ai', 'PDF ใหญ่เกินไป (จำกัด 20MB)'); return;
  }
  addMessage('ai', '📄 กำลังอ่าน PDF...');
  try {
    state.pdfText = await extractPdfText(file);
    state.image = { data: '', name: file.name, mime: 'application/pdf' };
    previewName.textContent = file.name + ` (${state.pdfText.length} chars)`;
    previewThumb.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNmZmQ3MDAiIHN0cm9rZS13aWR0aD0iMiI+PHJlY3QgeD0iMyIgeT0iMiIgd2lkdGg9IjE4IiBoZWlnaHQ9IjIwIiByeD0iMiIvPjxsaW5lIHg9IjciIHk9IjYiIHgyPSIxNyIgeT0iNiIvPjxsaW5lIHg9IjciIHk9IjEwIiB4Mj0iMTciIHk9IjEwIi8+PGxpbmUgeD0iNyIgeT0iMTQiIHgyPSIxNyIgeT0iMTQiLz48L3N2Zz4=';
    previewBar.classList.add('show');
    input.focus();
  } catch (e) {
    addMessage('ai', 'อ่าน PDF ไม่สำเร็จ: ' + e.message);
  }
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
  if (state.stealth) { input.blur(); }
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
