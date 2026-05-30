/* ─────────────────────────────────────────────────────────────
   Aditya Verma — Voice Bot Frontend Logic
   ───────────────────────────────────────────────────────────── */

const chatWindow      = document.getElementById('chat-window');
const textInput       = document.getElementById('text-input');
const sendBtn         = document.getElementById('send-btn');
const micBtn          = document.getElementById('mic-btn');
const statusPill      = document.getElementById('status-pill');
const statusText      = document.getElementById('status-text');
const visualizerCont  = document.getElementById('visualizer-container');
const waveform        = document.getElementById('waveform');
const listeningLabel  = document.getElementById('listening-label');
const speakingOverlay = document.getElementById('speaking-overlay');
const stopSpeakingBtn = document.getElementById('stop-speaking-btn');
const quickPills      = document.querySelectorAll('.quick-pill');

// ── State ─────────────────────────────────────────────────────
let conversationHistory = [];
let isRecording  = false;
let isSpeaking   = false;
let recognition  = null;
let currentUtter = null;

// ── Speech Recognition Setup ──────────────────────────────────
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const hasSpeech = !!SpeechRecognition;

if (!hasSpeech) {
  micBtn.title = 'Speech recognition not supported in this browser. Use Chrome.';
  micBtn.style.opacity = '0.4';
  micBtn.style.pointerEvents = 'none';
  document.getElementById('input-hint').textContent = '⌨️ Type your question · ↵ to send';
}

// ── Helpers ───────────────────────────────────────────────────
function getTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function setStatus(state, label) {
  statusPill.className = 'status-pill ' + (state || '');
  statusText.textContent = label;
}

function scrollToBottom() {
  chatWindow.scrollTo({ top: chatWindow.scrollHeight, behavior: 'smooth' });
}

// ── Append Messages ───────────────────────────────────────────
function appendMessage(role, text) {
  const isBot = role === 'bot';
  const div = document.createElement('div');
  div.className = `message ${isBot ? 'bot-message' : 'user-message'}`;

  const avatarHtml = isBot
    ? `<div class="message-avatar bot-avatar">
         <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
           <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"/>
         </svg>
       </div>`
    : `<div class="message-avatar">You</div>`;

  div.innerHTML = `
    ${avatarHtml}
    <div class="message-bubble">
      <p>${text.replace(/\n/g, '<br>')}</p>
      <span class="message-time">${getTime()}</span>
    </div>`;

  chatWindow.appendChild(div);
  scrollToBottom();
  return div;
}

// ── Typing Indicator ──────────────────────────────────────────
function showTyping() {
  const div = document.createElement('div');
  div.className = 'message bot-message typing-indicator';
  div.id = 'typing-indicator';
  div.innerHTML = `
    <div class="message-avatar bot-avatar">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"/>
      </svg>
    </div>
    <div class="message-bubble">
      <div class="typing-dots"><span></span><span></span><span></span></div>
    </div>`;
  chatWindow.appendChild(div);
  scrollToBottom();
}

function hideTyping() {
  const el = document.getElementById('typing-indicator');
  if (el) el.remove();
}

// ── Text to Speech ────────────────────────────────────────────
function speak(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();

  const clean = text.replace(/[*_`#]/g, '').trim();
  const utterance = new SpeechSynthesisUtterance(clean);
  currentUtter = utterance;

  // Pick a natural-sounding voice
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find(v =>
    /en[-_]IN/i.test(v.lang) ||
    /Google (US|UK) English Male/i.test(v.name) ||
    (v.lang.startsWith('en') && !v.name.includes('Female'))
  ) || voices.find(v => v.lang.startsWith('en')) || voices[0];

  if (preferred) utterance.voice = preferred;
  utterance.rate  = 0.95;
  utterance.pitch = 1.0;
  utterance.volume = 1;

  utterance.onstart = () => {
    isSpeaking = true;
    speakingOverlay.classList.add('active');
    setStatus('', 'Speaking...');
  };
  utterance.onend = utterance.onerror = () => {
    isSpeaking = false;
    speakingOverlay.classList.remove('active');
    setStatus('', 'Ready to talk');
  };

  window.speechSynthesis.speak(utterance);
}

// Stop speaking
stopSpeakingBtn.addEventListener('click', () => {
  window.speechSynthesis?.cancel();
  isSpeaking = false;
  speakingOverlay.classList.remove('active');
  setStatus('', 'Ready to talk');
});

// ── API Call ──────────────────────────────────────────────────
async function askBot(question) {
  if (!question.trim()) return;

  // Add to UI
  appendMessage('user', question);

  // Add to history
  conversationHistory.push({ role: 'user', content: question });

  // Show typing
  showTyping();
  setStatus('thinking', 'Thinking...');
  sendBtn.disabled = true;

  try {
    const resp = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: question,
        history: conversationHistory.slice(-8), // last 4 turns
      }),
    });

    const data = await resp.json();
    hideTyping();

    if (data.error) {
      appendMessage('bot', '⚠️ ' + data.error);
      setStatus('', 'Ready to talk');
    } else {
      const reply = data.reply;
      conversationHistory.push({ role: 'assistant', content: reply });
      appendMessage('bot', reply);
      setStatus('', 'Ready to talk');
      speak(reply);
    }
  } catch (err) {
    hideTyping();
    appendMessage('bot', '⚠️ Network error — make sure the server is running.');
    setStatus('', 'Ready to talk');
  }

  sendBtn.disabled = false;
}

// ── Send via Text ─────────────────────────────────────────────
function handleSend() {
  const q = textInput.value.trim();
  if (!q) return;
  textInput.value = '';
  textInput.style.height = 'auto';
  askBot(q);
}

sendBtn.addEventListener('click', handleSend);

textInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
});

// Auto-resize textarea
textInput.addEventListener('input', () => {
  textInput.style.height = 'auto';
  textInput.style.height = Math.min(textInput.scrollHeight, 120) + 'px';
});

// ── Quick Pills ───────────────────────────────────────────────
quickPills.forEach(pill => {
  pill.addEventListener('click', () => {
    askBot(pill.dataset.q);
  });
});

// ── Voice Input ───────────────────────────────────────────────
function startRecording() {
  if (!hasSpeech || isRecording) return;

  recognition = new SpeechRecognition();
  recognition.lang = 'en-IN';
  recognition.interimResults = true;
  recognition.continuous = false;
  recognition.maxAlternatives = 1;

  isRecording = true;
  micBtn.classList.add('recording');
  visualizerCont.classList.add('active');
  waveform.classList.add('active');
  setStatus('listening', 'Listening...');
  listeningLabel.textContent = 'Listening...';

  let finalTranscript = '';
  let interimTranscript = '';

  recognition.onresult = (e) => {
    interimTranscript = '';
    finalTranscript = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript;
      if (e.results[i].isFinal) finalTranscript += t;
      else interimTranscript += t;
    }
    textInput.value = finalTranscript || interimTranscript;
    textInput.style.height = 'auto';
    textInput.style.height = Math.min(textInput.scrollHeight, 120) + 'px';
  };

  recognition.onend = () => {
    stopRecording();
    const q = textInput.value.trim();
    if (q) {
      textInput.value = '';
      textInput.style.height = 'auto';
      askBot(q);
    }
  };

  recognition.onerror = (e) => {
    console.warn('Speech error:', e.error);
    stopRecording();
    if (e.error === 'no-speech') listeningLabel.textContent = 'No speech detected';
  };

  recognition.start();
}

function stopRecording() {
  isRecording = false;
  micBtn.classList.remove('recording');
  visualizerCont.classList.remove('active');
  waveform.classList.remove('active');
  recognition?.stop();
  recognition = null;
  setStatus('', 'Ready to talk');
}

micBtn.addEventListener('click', () => {
  if (isRecording) {
    stopRecording();
  } else {
    // Cancel any ongoing speech before listening
    window.speechSynthesis?.cancel();
    speakingOverlay.classList.remove('active');
    isSpeaking = false;
    startRecording();
  }
});

// ── Load voices async (Chrome workaround) ────────────────────
if (window.speechSynthesis) {
  window.speechSynthesis.getVoices();
  window.speechSynthesis.addEventListener('voiceschanged', () => {
    window.speechSynthesis.getVoices();
  });
}
