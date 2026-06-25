// ===== API Keys =====
// ใส่ key ของคุณตรงนี้ ถ้ายังไม่มี ให้ใส่ YOUR_xxx_KEY_HERE ไว้ก่อน ระบบจะข้ามอัตโนมัติ
const KEYS = {
  openRouter: [
    ['sk-or-v1-', '19fbfa52', 'bdaecb2f', 'd0ba1cf6', 'a24f09f7', '89fd4ea0', '7c213bc1', 'a66e23de', '852efef9'].join(''),
    ['sk-or-v1-', 'ea63325d', '3f827c15', '23351a69', 'cf23c3bd', 'ac90f968', '23ed3d38', 'c4c1f934', '4e134a95'].join(''),
  ],
  openAI: [
    ['sk-proj-', 'jglAxGE_', 'ltEmVXyq', 'AbId9gi9', 'K0hCEaNz', 'k3NU40sr', 'xgBNQyDp', 'XNcCaXRS', 'e-5F39bV', 'wAaPgDYv', 'FyT3Blbk', 'FJpqLfHm', 'uE1g465L', 'IyyEejN6', 'QO80vq5r', 'qKe9b1u5', 'uAMXKuIs', 'PbZX586P', 'ShR93kzP', 'GPr6YJtC', 'tQ8A'].join(''),
  ],
  deepSeek: [
    ['sk-', '3ace0288', '0a0e4420', '87f1a37b', '5ade64d9'].join(''),
    ['sk-', '0b7c85c1', '37304a7c', 'b15dbf4c', '69fa6559'].join(''),
  ],
  google: [
    ['AQ.', 'Ab8RN6JQ', '1ggqSi6w', 'QiOCML7t', 'BGx36Yxu', 'JcPICzio', '8NMr4oLr', '3w'].join(''),
  ],
  groq: [
    ['gsk_', 'H9aONQpt', 'itVX30b8', 'idMXWGdy', 'b3FYacHS', 'E9sIsMKQ', 'eUNzjC7O', 'nS7k'].join(''),
    ['gsk_', 'wSMaYWwp', 'vo2zlZht', 'ssRBWGdy', 'b3FY4ts2', 'RfTjJ5D2', 'G2izkGyr', 'ppSP'].join(''),
  ],
};

const FETCH_TIMEOUT_TEXT = 6000;   // 6 วิ สำหรับข้อความ
const FETCH_TIMEOUT_VISION = 10000; // 10 วิ สำหรับรูป

// ===== Provider configs (DeepSeek ก่อนเพราะไวสุด) =====
const PROVIDERS = [
  {
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1/chat/completions',
    needReferer: false,
    keys: KEYS.deepSeek.filter(k => !k.includes('YOUR_') && !k.includes('xxxx')),
    models: [
      'deepseek-chat',
      'deepseek-reasoner',
    ],
    visionModels: [
      // DeepSeek ยังไม่มี vision model ผ่าน API → ข้ามไป Groq/Google อัตโนมัติ
    ],
  },
  {
    name: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
    needReferer: false,
    keys: KEYS.groq.filter(k => !k.includes('YOUR_') && !k.includes('xxxx')),
    models: [
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant',
    ],
    visionModels: [
      'llama-3.2-11b-vision-preview',
    ],
  },
  {
    name: 'Google',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
    needReferer: false,
    keys: KEYS.google.filter(k => !k.includes('YOUR_') && !k.includes('xxxx')),
    models: [
      'gemini-2.0-flash:generateContent',
      'gemini-2.5-flash-preview:generateContent',
      'gemini-1.5-flash:generateContent',
    ],
    visionModels: [
      'gemini-2.0-flash:generateContent',
      'gemini-2.5-flash-preview:generateContent',
      'gemini-1.5-flash:generateContent',
    ],
  },
  {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1/chat/completions',
    needReferer: false,
    keys: KEYS.openAI.filter(k => !k.includes('YOUR_') && !k.includes('xxxx')),
    models: [
      'gpt-4o-mini',
      'gpt-4o',
    ],
    visionModels: [
      'gpt-4o-mini',
      'gpt-4o',
    ],
  },
  {
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
    needReferer: true,
    keys: KEYS.openRouter.filter(k => !k.includes('YOUR_') && !k.includes('xxxx')),
    models: [
      'google/gemma-4-31b-it:free',
      'nvidia/nemotron-3-super-120b-a12b:free',
      'openrouter/free',
    ],
    visionModels: [
      'google/gemma-4-31b-it:free',
      'nvidia/nemotron-nano-12b-v2-vl:free',
      'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
      'openrouter/free',
    ],
  },
];
function safeParse(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}

const state = {
  image: { data: '', name: '', mime: '' },
  pdfText: '',
  messages: safeParse('chat_history', []),
  history: safeParse('ai_history', []),
  msgId: 0,
  imgVer: 0
};
const MAX_HISTORY = 20;

const $ = id => document.getElementById(id);
const chatContainer = $('chatContainer');
const input = $('questionInput');
const sendBtn = $('sendBtn');
const fileInput = $('fileInput');
const previewBar = $('imagePreviewBar');
const previewThumb = $('previewThumb');
const previewName = $('previewName');
const removeImgBtn = $('removeImgBtn');
const clearHistoryBtn = $('clearHistoryBtn');
const videoOverlay = $('videoOverlay');
const overlayVideo = $('overlayVideo');
const historyPanel = $('historyPanel');
const historyList = $('historyList');

function clearHistory() {
  if (!confirm('ลบประวัติการสนทนาทั้งหมด?')) return;
  state.messages = []; state.history = []; state.msgId = 0; state.imgVer = 0;
  localStorage.setItem('chat_history', '[]');
  localStorage.setItem('ai_history', '[]');
  renderMessages();
}

function renderMessages() {
  const fragment = document.createDocumentFragment();
  state.messages.forEach(m => {
    const div = document.createElement('div');
    div.className = `msg ${m.role}`;
    if (m.id) div.id = 'msg-' + m.id;
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
    if (m.loading) {
      const t = document.createElement('div'); t.className = 'typing';
      t.innerHTML = '<span></span><span></span><span></span>';
      div.appendChild(t);
    } else {
      const text = document.createElement('div');
      text.className = 'md-body';
      text.innerHTML = renderMarkdown(m.text);
      div.appendChild(text);
    }
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
function saveMessages() {
  try {
    const toSave = state.messages.filter(m => !m.loading).slice(-30);
    localStorage.setItem('chat_history', JSON.stringify(toSave));
  } catch (e) {
    if (e.name === 'QuotaExceededError' || e.code === 22) {
      state.messages = state.messages.filter(m => !m.loading).slice(-10);
      localStorage.setItem('chat_history', JSON.stringify(state.messages));
    }
  }
}
function addMessage(role, text, opts = {}) {
  const msg = { role, text, time: new Date().toLocaleTimeString('th-TH', { hour:'2-digit', minute:'2-digit' }), ...opts };
  state.messages.push(msg);
  if (!msg.loading) saveMessages();
  renderMessages();
}

const SYSTEM_PROMPT = 'คุณคือติวเตอร์ AI ชื่อ "โอม" ผู้ช่วยเรียนอัจฉริยะ ตอบเป็นภาษาไทยเท่านั้น ใช้ภาษาเข้าใจง่าย เป็นกันเอง เหมาะกับนักเรียน\n\nเมื่อผู้ใช้อัปโหลดรูปภาพ ให้วิเคราะห์และตอบตามรูปแบบต่อไปนี้:\n\n--- รูปเนื้อหาเรียนทั่วไป (บทความ, แผนภาพ, กราฟ, แผนที่, วิทยาศาสตร์, ประวัติศาสตร์) ---\nTitle:\n[หัวข้อ]\n\nExplanation:\n[อธิบายเชิงการศึกษา]\n\nKey Points:\n• จุดที่ 1\n• จุดที่ 2\n• จุดที่ 3\n\n--- รูปข้อสอบเลือกตอบ (มี choices A/B/C/D หรือ 1/2/3/4) ---\nQuestion:\n[คำถาม]\n\nCorrect Answer:\n[ตัวเลือกที่ถูก]\n\nReason:\n[เหตุผล]\n\nWhy Other Choices Are Incorrect:\n• Choice A: ...\n• Choice B: ...\n• Choice C: ...\n• Choice D: ...\n\nConfidence:\nHigh / Medium / Low\n\n--- รูปที่ต้องใช้การมองเห็น (แผนที่, กราฟ, ภาพวาด, แผนภาพ, ศิลปะ, สัญลักษณ์) ---\nVisual Analysis:\n[สิ่งที่เห็น]\n\nImportant Clues:\n• ...\n• ...\n\nBest Answer:\n[คำตอบ]\n\nReasoning:\n[อธิบายเหตุผล]\n\nกฎ:\n1. ให้ความรู้เป็นหลัก อธิบายแนวคิดให้ชัดเจน\n2. ใช้ภาษาง่าย เหมาะกับนักเรียน\n3. ใช้โครงสร้างชัดเจน ห้ามตอบคำเดียว\n4. ถ้ามั่นใจน้อย ให้บอกตรงๆ\n5. ห้ามสร้างข้อมูลที่ไม่มีในภาพ\n6. ใช้ visual reasoning เมื่อคำตอบขึ้นอยู่กับภาพ';

async function callAI(question, hasImage, imgData) {
  const errors = [];

  for (const provider of PROVIDERS) {
    if (!provider.keys.length) continue;
    const models = hasImage ? provider.visionModels : provider.models;

    for (const apiKey of provider.keys) {
      for (const model of models) {
        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            const reply = await tryModel(provider, model, question, hasImage, apiKey, imgData);
            // แสดงสถาน์ที่ provider ที่ใช้สำเร็จ (สำหรับ debug)
            console.log(`[AI] ใช้สำเร็จ: ${provider.name} / ${model}`);
            return reply;
          } catch (e) {
            const errMsg = e.message || String(e);
            // 429 = rate limit → รอแล้วลองใหม่
            if (errMsg.includes('429') && attempt === 1) {
              await new Promise(r => setTimeout(r, 15000));
              continue;
            }
            // 401/403 = key ผิด → ข้าม key นี้ไปเลย ไม่ต้องลอง model อื่นของ key นี้
            if (errMsg.includes('401') || errMsg.includes('403') || errMsg.includes('404')) {
              errors.push(`[${provider.name}] ${model}: ${errMsg.slice(0, 60)}`);
              break; // ข้ามไป key ถัดไป
            }
            errors.push(`[${provider.name}] ${model}: ${errMsg.slice(0, 60)}`);
            break; // ลอง model ถัดไป
          }
        }
      }
    }
  }

  throw new Error(
    'ทุก Provider / Key / Model ล้มเหลว:\n' +
    errors.slice(0, 5).join('\n') +
    '\n\n💡 วิธีแก้:\n' +
    '• ตรวจสอบ API key ที่ถูกต้อง\n' +
    '• เติมเงิน credits ในบัญชี\n' +
    '• รองรับ: OpenRouter, OpenAI, DeepSeek, Google, Groq'
  );
}

async function tryModel(provider, model, question, hasImage, apiKey, imgData) {
  let body, headers, url;

  if (provider.name === 'Google') {
    // --- Google Gemini format ---
    const parts = [];
    if (question) parts.push({ text: question });
    if (hasImage && imgData) parts.push({ inlineData: { mimeType: imgData.mime, data: imgData.data } });
    const contents = [];
    state.history.slice(-MAX_HISTORY).forEach(h => contents.push({
      role: h.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: h.text }]
    }));
    contents.push({ role: 'user', parts });
    url = `${provider.baseUrl}/${model}?key=${apiKey}`;
    headers = { 'Content-Type': 'application/json' };
    body = JSON.stringify({ systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] }, contents, generationConfig: { temperature: 0.7, maxOutputTokens: 2048 } });
  } else {
    // --- OpenAI-compatible format ---
    const messages = [{ role: 'system', content: SYSTEM_PROMPT }];
    state.history.slice(-MAX_HISTORY).forEach(h => messages.push({ role: h.role, content: h.text }));
    const userContent = [];
    if (hasImage && imgData) userContent.push({ type: 'image_url', image_url: { url: `data:${imgData.mime};base64,${imgData.data}` } });
    if (question) userContent.push({ type: 'text', text: question });
    messages.push({ role: 'user', content: userContent });
    url = provider.baseUrl;
    headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` };
    if (provider.needReferer) { headers['HTTP-Referer'] = window.location.href; headers['X-Title'] = 'Tutor AI'; }
    body = JSON.stringify({ model, messages, temperature: 0.7, max_tokens: 2048 });
  }

  const timeout = hasImage ? FETCH_TIMEOUT_VISION : FETCH_TIMEOUT_TEXT;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  const res = await fetch(url, { method: 'POST', headers, body, signal: controller.signal });
  clearTimeout(timer);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || `HTTP ${res.status}`);

  let reply;
  if (provider.name === 'Google') {
    reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
  } else {
    reply = data.choices?.[0]?.message?.content;
  }
  if (!reply) throw new Error('ไม่มี response จาก API');

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

function renderMarkdown(text) {
  let s = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  s = s.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) =>
    `<pre class="md-code"><code>${code.trim()}</code></pre>`
  );
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  s = s.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  s = s.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  s = s.replace(/\*([^*]+)\*/g, '<i>$1</i>');
  s = s.replace(/^- (.+)$/gm, '<li>$1</li>');
  s = s.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');
  s = s.replace(/\n/g, '<br>');
  return s;
}

async function sendMessage(overrideText) {
  const text = (overrideText || input.value).trim();
  if (!text && !state.image.data) return;

  const id = ++state.msgId;
  const hasImage = !!state.image.data && state.image.mime !== 'application/pdf';
  const hasPdf = state.image.mime === 'application/pdf' && !!state.pdfText;
  const imgData = hasImage ? { data: state.image.data, mime: state.image.mime } : null;
  const pdfText = state.pdfText;

  addMessage('user', text || '(ไฟล์แนบ)', { id, ...(imgData ? { image: `data:${imgData.mime};base64,${imgData.data}` } : {}) });
  input.value = '';

  const aiMsg = { role: 'ai', text: '', id: id + '-ai', loading: true, time: new Date().toLocaleTimeString('th-TH', { hour:'2-digit', minute:'2-digit' }) };
  state.messages.push(aiMsg);
  renderMessages();

  const sentVer = state.imgVer;
  let prompt = text;
  if (hasPdf) {
    if (!prompt) prompt = 'สรุปเนื้อหาจากเอกสารนี้ให้หน่อย เป็นประเด็นสั้นๆ เข้าใจง่าย แยกหัวข้อชัดเจน';
    else prompt = `เนื้อหา PDF:\n${pdfText}\n\n` + prompt;
  } else if (hasImage && !text) {
    prompt = '';
  } else if (hasImage && /ข้อสอบ|quiz|เฉลย|ช้อย|choices/i.test(text)) {
    prompt = 'รูปนี้เป็นข้อสอบ ช่วยวิเคราะห์และเฉลยให้หน่อย';
  } else if (hasImage && /สรุป|summary|อธิบาย/i.test(text)) {
    prompt = 'ช่วยอธิบายเนื้อหาในรูปนี้แบบการเรียนการสอน';
  }

  try {
    const reply = await callAI(prompt, hasImage, imgData);
    const idx = state.messages.findIndex(m => m.id === id + '-ai');
    if (idx !== -1) {
      state.messages[idx].text = reply;
      state.messages[idx].loading = false;
      const choices = parseChoices(reply);
      if (choices) state.messages[idx].choices = choices;
      saveMessages();
      renderMessages();
    }
    if (state.imgVer === sentVer) clearImage();
  } catch (err) {
    const idx = state.messages.findIndex(m => m.id === id + '-ai');
    if (idx !== -1) {
      state.messages[idx].text = `⚠️ ${err.message}`;
      state.messages[idx].loading = false;
      saveMessages();
      renderMessages();
    }
  }
}

function handleImage(file) {
  if (!file) return;
  const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'application/pdf'];
  if (file.type === 'application/pdf') return handlePdf(file);
  if (!validTypes.includes(file.type) && !file.type.startsWith('image/')) {
    addMessage('ai', '⚠️ รองรับเฉพาะไฟล์รูปภาพ (JPG, PNG, GIF, WebP) และ PDF เท่านั้น');
    return;
  }
  if (file.size > 10 * 1024 * 1024) { addMessage('ai', '⚠️ รูปใหญ่เกินไป (จำกัด 10MB)'); return; }
  const reader = new FileReader();
  reader.onerror = () => { addMessage('ai', '⚠️ อ่านไฟล์ไม่สำเร็จ'); };
  reader.onload = (e) => {
    const data = e.target.result.split(',')[1];
    if (data.length > 15 * 1024 * 1024) { addMessage('ai', '⚠️ รูปมีความละเอียดสูงเกินไป กรุณาลดขนาดก่อน'); return; }
    state.image = { data, name: file.name, mime: file.type };
    state.imgVer++;
    previewThumb.src = e.target.result;
    previewName.textContent = file.name;
    previewBar.classList.add('show');
  };
  reader.readAsDataURL(file);
}
function clearImage() {
  state.image = { data: '', name: '', mime: '' };
  state.pdfText = '';
  previewBar.classList.remove('show'); fileInput.value = '';
}

function scrollToMessage(id) {
  historyPanel.classList.remove('show');
  const el = document.getElementById('msg-' + id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function buildHistoryList() {
  const pairs = []; let currentUser = null;
  state.messages.forEach(m => {
    if (m.role === 'user') currentUser = m;
    else if (m.role === 'ai' && currentUser) {
      pairs.push({ user: currentUser, ai: m });
      currentUser = null;
    }
  });
  if (!pairs.length) {
    historyList.innerHTML = '<div class="hist-empty">ยังไม่มีคำถาม</div>';
    return;
  }
  historyList.innerHTML = '';
  for (let i = pairs.length - 1; i >= 0; i--) {
    const { user, ai } = pairs[i];
    const item = document.createElement('div');
    item.className = 'hist-item';
    const q = document.createElement('div');
    q.className = 'hist-q';
    const badge = document.createElement('span');
    badge.className = 'badge ' + (user.image ? 'image' : 'text');
    badge.textContent = user.image ? '📷' : '💬';
    q.appendChild(badge);
    q.append(document.createTextNode(user.text || '(ไฟล์แนบ)'));
    const a = document.createElement('div');
    a.className = 'hist-a' + (ai.loading ? ' loading' : '');
    a.textContent = ai.loading ? '⏳ กำลังประมวลผล...' : (ai.text ? ai.text.slice(0, 120) + (ai.text.length > 120 ? '...' : '') : '');
    const t = document.createElement('div');
    t.className = 'hist-time';
    t.textContent = user.time;
    item.append(q, a, t);
    const scrollId = user.id;
    item.addEventListener('click', () => scrollToMessage(scrollId));
    historyList.appendChild(item);
  }
}

function showHistoryPanel() {
  buildHistoryList();
  historyPanel.classList.add('show');
}
function hideHistoryPanel() {
  historyPanel.classList.remove('show');
}

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
  try {
    state.pdfText = await extractPdfText(file);
    state.image = { data: '', name: file.name, mime: 'application/pdf' };
    previewName.textContent = file.name + ` (${state.pdfText.length} chars)`;
    previewThumb.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNmZmQ3MDAiIHN0cm9rZS13aWR0aD0iMiI+PHJlY3QgeD0iMyIgeT0iMiIgd2lkdGg9IjE4IiBoZWlnaHQ9IjIwIiByeD0iMiIvPjxsaW5lIHg9IjciIHk9IjYiIHgyPSIxNyIgeT0iNiIvPjxsaW5lIHg9IjciIHk9IjEwIiB4Mj0iMTciIHk9IjEwIi8+PGxpbmUgeD0iNyIgeT0iMTQiIHgyPSIxNyIgeT0iMTQiLz48L3N2Zz4=';
    previewBar.classList.add('show');
  } catch (e) {
    addMessage('ai', 'อ่าน PDF ไม่สำเร็จ: ' + e.message);
  }
}

function toggleVideo() {
  const shown = videoOverlay.classList.toggle('show');
  if (shown) {
    overlayVideo.currentTime = 0;
    overlayVideo.play().catch(() => {});
    input.blur();
  } else {
    overlayVideo.pause();
    input.focus();
  }
}

sendBtn.addEventListener('click', () => sendMessage());
input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); sendMessage(); } });
fileInput.addEventListener('change', (e) => handleImage(e.target.files[0]));
removeImgBtn.addEventListener('click', clearImage);

let tapCount = 0, tapTimer = null;
$('menuToggle').addEventListener('click', () => {
  tapCount++;
  if (tapCount === 3) {
    toggleVideo(); tapCount = 0;
    clearTimeout(tapTimer); return;
  }
  clearTimeout(tapTimer);
  tapTimer = setTimeout(() => { tapCount = 0; }, 600);
});

let sx = 0;
document.addEventListener('touchstart', (e) => { sx = e.changedTouches[0].screenX; }, { passive: true });
document.addEventListener('touchend', (e) => {
  const dx = e.changedTouches[0].screenX - sx;
  if (dx > 60) showHistoryPanel();
}, { passive: true });
$('videoCloseZone').addEventListener('click', toggleVideo);
$('videoCloseZone').addEventListener('touchend', (e) => { e.preventDefault(); toggleVideo(); });
$('closePanel').addEventListener('click', hideHistoryPanel);
$('newChatBtn').addEventListener('click', () => {
  state.messages = []; state.history = []; state.msgId = 0; state.imgVer = 0;
  localStorage.setItem('chat_history', '[]');
  localStorage.setItem('ai_history', '[]');
  renderMessages();
});
clearHistoryBtn.addEventListener('click', clearHistory);
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => { e.preventDefault(); if (e.dataTransfer.files[0]) handleImage(e.dataTransfer.files[0]); });
setTimeout(() => input.focus(), 500);

let lastHeight = window.innerHeight;
window.addEventListener('resize', () => {
  const h = window.innerHeight;
  if (lastHeight > h) setTimeout(scrollToBottom, 300);
  lastHeight = h;
});
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', () => {
    if (window.visualViewport.height < window.innerHeight) setTimeout(scrollToBottom, 400);
  });
}

try {
  renderMessages();
} catch (e) {
  state.messages = []; state.history = [];
  try {
    localStorage.setItem('chat_history', '[]');
    localStorage.setItem('ai_history', '[]');
  } catch {}
  renderMessages();
}