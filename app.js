// Set JS running indicator
try { var s = document.getElementById('js-status'); if(s) { s.textContent = '●'; s.style.color = '#27AE60'; } } catch(e) {}
window.onerror = function(msg, url, line) {
  try { var s = document.getElementById('js-status'); if(s) { s.textContent = '⚠'; s.style.color = 'red'; } } catch(e) {}
};

// ============================================================================
// CONFIGURATION
// ============================================================================
const SUPABASE_URL = 'https://edibgrvefqfohlqsdfxs.supabase.co';
const SUPABASE_KEY = 'sb_publishable_kumBhObEHh7jpIbN6jnkjQ_JL7ZG2c1';

// ============================================================================
// API HELPER — direct REST calls, no Supabase SDK needed
// ============================================================================
let accessToken = null;
let refreshToken = null;

function apiHeaders() {
  const h = { 'apikey': SUPABASE_KEY, 'Content-Type': 'application/json' };
  if (accessToken) h['Authorization'] = 'Bearer ' + accessToken;
  return h;
}

async function apiFetch(path, options = {}) {
  const url = SUPABASE_URL + path;
  const res = await fetch(url, { ...options, headers: { ...apiHeaders(), ...options.headers } });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.msg || err.message || 'Request failed: ' + res.status);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// Auth API
async function authSignup(email, password) {
  const res = await fetch(SUPABASE_URL + '/auth/v1/signup', {
    method: 'POST',
    headers: { 'apikey': SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.msg || 'Signup failed');
  if (data.access_token) {
    accessToken = data.access_token;
    refreshToken = data.refresh_token;
    localStorage.setItem('vocab_session', JSON.stringify({ accessToken, refreshToken }));
  }
  return data;
}

async function authLogin(email, password) {
  const res = await fetch(SUPABASE_URL + '/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: { 'apikey': SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.msg || data.error_description || 'Login failed');
  accessToken = data.access_token;
  refreshToken = data.refresh_token;
  localStorage.setItem('vocab_session', JSON.stringify({ accessToken, refreshToken }));
  return data;
}

async function authLogout() {
  try {
    await fetch(SUPABASE_URL + '/auth/v1/logout', {
      method: 'POST',
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + accessToken },
    });
  } catch(e) {}
  accessToken = null;
  refreshToken = null;
  localStorage.removeItem('vocab_session');
}

async function authGetUser() {
  const res = await fetch(SUPABASE_URL + '/auth/v1/user', {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + accessToken },
  });
  if (!res.ok) return null;
  return res.json();
}

async function authRefresh() {
  if (!refreshToken) return false;
  try {
    const res = await fetch(SUPABASE_URL + '/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      headers: { 'apikey': SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    const data = await res.json();
    if (!res.ok) return false;
    accessToken = data.access_token;
    refreshToken = data.refresh_token;
    localStorage.setItem('vocab_session', JSON.stringify({ accessToken, refreshToken }));
    return true;
  } catch(e) { return false; }
}

// Data API
async function fetchWords() {
  const data = await apiFetch('/rest/v1/words?select=*&order=created_at.desc');
  return (data || []).map(w => ({
    id: w.id, english: w.english, chinese: w.chinese, breakdown: w.breakdown || '',
    status: w.status, correctStreak: w.correct_streak, totalCorrect: w.total_correct,
    totalWrong: w.total_wrong, lastCorrectDate: w.last_correct_date,
    lastAnswerCorrect: w.last_answer_correct, masteredAt: w.mastered_at, createdAt: w.created_at,
  }));
}

async function saveWord(word) {
  return apiFetch('/rest/v1/words', {
    method: 'POST',
    body: JSON.stringify({
      id: word.id, user_id: word.user_id, english: word.english, chinese: word.chinese,
      breakdown: word.breakdown || '', status: word.status, correct_streak: word.correctStreak,
      total_correct: word.totalCorrect, total_wrong: word.totalWrong,
      last_correct_date: word.lastCorrectDate, last_answer_correct: word.lastAnswerCorrect,
      mastered_at: word.masteredAt,
    }),
    headers: { Prefer: 'resolution=merge-duplicates' },
  });
}

async function updateWord(id, updates) {
  const body = {};
  if (updates.status !== undefined) body.status = updates.status;
  if (updates.correctStreak !== undefined) body.correct_streak = updates.correctStreak;
  if (updates.totalCorrect !== undefined) body.total_correct = updates.totalCorrect;
  if (updates.totalWrong !== undefined) body.total_wrong = updates.totalWrong;
  if (updates.lastCorrectDate !== undefined) body.last_correct_date = updates.lastCorrectDate;
  if (updates.lastAnswerCorrect !== undefined) body.last_answer_correct = updates.lastAnswerCorrect;
  if (updates.masteredAt !== undefined) body.mastered_at = updates.masteredAt;
  return apiFetch('/rest/v1/words?id=eq.' + encodeURIComponent(id), {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

async function deleteWordRemote(id) {
  return apiFetch('/rest/v1/words?id=eq.' + encodeURIComponent(id), { method: 'DELETE' });
}

async function fetchState() {
  try {
    const data = await apiFetch('/rest/v1/user_state?select=*&limit=1');
    if (!data || data.length === 0) return null;
    const s = data[0];
    return {
      checkInDates: s.check_in_dates || [], dailyReviewCount: s.daily_review_count || {},
      todayMasteredCount: s.today_mastered_count || 0, todayStudiedCount: s.today_studied_count || 0,
      quizSessionWordCount: s.quiz_session_word_count || 0, quizSessionWords: s.quiz_session_words || [],
      lastQuizDate: s.last_quiz_date, lastPassageAt: s.last_passage_at || 0,
    };
  } catch(e) { return null; }
}

async function saveState(state) {
  const user = await authGetUser();
  if (!user) return;
  return apiFetch('/rest/v1/user_state', {
    method: 'POST',
    body: JSON.stringify({
      user_id: user.id, check_in_dates: state.checkInDates, daily_review_count: state.dailyReviewCount,
      today_mastered_count: state.todayMasteredCount, today_studied_count: state.todayStudiedCount,
      quiz_session_word_count: state.quizSessionWordCount, quiz_session_words: state.quizSessionWords,
      last_quiz_date: state.lastQuizDate, last_passage_at: state.lastPassageAt || 0,
    }),
    headers: { Prefer: 'resolution=merge-duplicates' },
  });
}
function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}
function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}
function dateDiffDays(d1, d2) {
  return Math.floor((new Date(d2).getTime() - new Date(d1).getTime()) / 86400000);
}
function shuffle(arr) { const a = arr.slice(); for (let i = a.length-1; i>0; i--) { const j = Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
function pickRandom(arr, n) { return shuffle(arr).slice(0, n); }
function el(id) { return document.getElementById(id); }
function escapeRegex(str) { return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// Global auth handlers (called via onclick)
async function handleLogin() {
  const btn = el('btn-login');
  btn.disabled = true; btn.textContent = '登录中...';
  const email = el('login-email').value.trim();
  const password = el('login-password').value;
  if (!email || !password) { alert('请填写邮箱和密码'); btn.disabled=false; btn.textContent='登 录'; return; }
  try {
    await authLogin(email, password);
    const user = await authGetUser();
    if (user) { await Auth.onLoggedIn(user); return; }
    alert('登录失败，请重试');
  } catch(e) { alert('登录失败：' + e.message); }
  btn.disabled = false; btn.textContent = '登 录';
}

async function handleSignup() {
  const btn = el('btn-signup');
  btn.disabled = true; btn.textContent = '注册中...';
  const email = el('signup-email').value.trim();
  const password = el('signup-password').value;
  if (!email || !password) { alert('请填写邮箱和密码'); btn.disabled=false; btn.textContent='注 册'; return; }
  if (password.length < 6) { alert('密码至少6位'); btn.disabled=false; btn.textContent='注 册'; return; }
  try {
    await authSignup(email, password);
    const user = await authGetUser();
    if (user) { await Auth.onLoggedIn(user); return; }
    alert('注册成功！请登录');
  } catch(e) { alert('注册失败：' + e.message); }
  btn.disabled = false; btn.textContent = '注 册';
}
function cacheWordsLocal(words) { localStorage.setItem('vocab_words_cache', JSON.stringify(words)); }
function cacheStateLocal(state) { localStorage.setItem('vocab_state_cache', JSON.stringify(state)); }
function getCachedWords() { try { return JSON.parse(localStorage.getItem('vocab_words_cache')) || []; } catch(e) { return []; } }
function getCachedState() {
  const defaults = { checkInDates:[], dailyReviewCount:{}, todayMasteredCount:0, todayStudiedCount:0, quizSessionWordCount:0, quizSessionWords:[], lastQuizDate:null, lastPassageAt:0 };
  try { return Object.assign(defaults, JSON.parse(localStorage.getItem('vocab_state_cache')) || {}); } catch(e) { return defaults; }
}

// ============================================================================
// AUTH
// ============================================================================
const Auth = {
  async init() {
    // Restore session from localStorage
    const saved = localStorage.getItem('vocab_session');
    if (saved) {
      try {
        const sess = JSON.parse(saved);
        accessToken = sess.accessToken;
        refreshToken = sess.refreshToken;
        // Verify token is still valid
        const user = await authGetUser();
        if (user) {
          await this.onLoggedIn(user);
          return;
        }
        // Token expired, try refresh
        const refreshed = await authRefresh();
        if (refreshed) {
          const user = await authGetUser();
          if (user) { await this.onLoggedIn(user); return; }
        }
      } catch(e) {}
      // Session invalid
      accessToken = null; refreshToken = null;
      localStorage.removeItem('vocab_session');
    }
    this.showAuthScreen();
  },

  showAuthScreen() {
    el('auth-screen').classList.remove('hidden');
    el('app-screen').classList.remove('active');
  },

  async onLoggedIn(user) {
    el('auth-screen').classList.add('hidden');
    el('app-screen').classList.add('active');
    el('user-email-display').textContent = user.email;
    try {
      appData.words = await fetchWords();
      cacheWordsLocal(appData.words);
      const cloudState = await fetchState();
      if (cloudState) {
        appData.state = cloudState;
      } else {
        appData.state = getCachedState();
      }
      const today = todayStr();
      if (appData.state.lastQuizDate !== today) {
        appData.state.lastQuizDate = today;
        appData.state.todayStudiedCount = 0; appData.state.todayMasteredCount = 0;
        appData.state.quizSessionWordCount = 0; appData.state.quizSessionWords = [];
        appData.state.lastPassageAt = 0;
      }
      if (!appData.state.dailyReviewCount) appData.state.dailyReviewCount = {};
      if (!appData.state.checkInDates) appData.state.checkInDates = [];
      cacheStateLocal(appData.state);
      await saveState(appData.state);
    } catch(e) {
      console.error('Load error:', e);
      appData.words = getCachedWords();
      appData.state = getCachedState();
    }
    UI.updateStreakBadge();
    UI.renderStudy();
    DataManager.checkIn(appData.state);
    showInstallButton();
  },

  async login(email, password) {
    try {
      await authLogin(email, password);
      const user = await authGetUser();
      if (user) { await this.onLoggedIn(user); return { success: true }; }
      return { error: '登录失败，请重试' };
    } catch(e) { return { error: e.message }; }
  },

  async signup(email, password) {
    try {
      await authSignup(email, password);
      const user = await authGetUser();
      if (user) { await this.onLoggedIn(user); return { success: true, autoLogin: true }; }
      return { success: true, autoLogin: false, message: '注册成功，请登录' };
    } catch(e) { return { error: e.message }; }
  },

  async logout() {
    await authLogout();
    localStorage.removeItem('vocab_words_cache');
    localStorage.removeItem('vocab_state_cache');
    appData.words = [];
    appData.state = getCachedState();
  },
};

// ============================================================================
// DATA MANAGER (local + cloud sync)
// ============================================================================
const DataManager = {
  async checkIn(state) {
    const today = todayStr();
    if (!state.checkInDates.includes(today)) { state.checkInDates.push(today); state.checkInDates.sort(); }
    if (state.lastQuizDate !== today) {
      state.todayStudiedCount = 0; state.todayMasteredCount = 0;
      state.quizSessionWordCount = 0; state.quizSessionWords = []; state.lastPassageAt = 0; state.lastQuizDate = today;
    }
    await this.syncState(state);
  },

  async syncState(state) {
    cacheStateLocal(state);
    try { await saveState(state); } catch(e) {}
  },

  async addWord(english, chinese, breakdown) {
    const user = await authGetUser();
    const uid = user ? user.id : null;
    const word = {
      id: uuid(), user_id: uid,
      english: english.trim(), chinese: chinese.trim(), breakdown: breakdown.trim(),
      status: 'new', correctStreak: 0, totalCorrect: 0, totalWrong: 0,
      lastCorrectDate: null, lastAnswerCorrect: false, masteredAt: null, createdAt: new Date().toISOString(),
    };
    try { await saveWord(word); } catch(e) { console.error('Save word error:', e); }
    appData.words.unshift(word);
    cacheWordsLocal(appData.words);
    return word;
  },

  async deleteWord(id) {
    try { await deleteWordRemote(id); } catch(e) {}
    appData.words = appData.words.filter(w => w.id !== id);
    cacheWordsLocal(appData.words);
  },

  async updateWord(id, updates) {
    const idx = appData.words.findIndex(w => w.id === id);
    if (idx === -1) return;
    Object.assign(appData.words[idx], updates);
    try { await updateWord(id, updates); } catch(e) {}
    cacheWordsLocal(appData.words);
  },

  getStreak(state) {
    if (!state.checkInDates.length) return 0;
    const dates = [...state.checkInDates].sort();
    let streak = 0, check = new Date(todayStr());
    for (let i = dates.length - 1; i >= 0; i--) {
      const expected = check.getFullYear()+'-'+String(check.getMonth()+1).padStart(2,'0')+'-'+String(check.getDate()).padStart(2,'0');
      if (dates[i] === expected) { streak++; check.setDate(check.getDate()-1); }
      else if (i === dates.length-1 && dates[i] !== todayStr()) {
        const y = new Date(); y.setDate(y.getDate()-1);
        const ys = y.getFullYear()+'-'+String(y.getMonth()+1).padStart(2,'0')+'-'+String(y.getDate()).padStart(2,'0');
        if (dates[i] === ys) { streak++; check = new Date(y); check.setDate(check.getDate()-1); continue; }
        break;
      } else break;
    }
    return streak;
  },

  exportData() {
    return JSON.stringify({ words: appData.words, state: appData.state, exportedAt: new Date().toISOString() }, null, 2);
  },

  async importData(jsonStr) {
    try {
      const data = JSON.parse(jsonStr);
      if (!data.words || !Array.isArray(data.words)) throw new Error('格式错误');
      for (const w of data.words) { try { await saveWord(w); } catch(e) {} }
      appData.words = await fetchWords();
      if (data.state) { appData.state = Object.assign(appData.state, data.state); await this.syncState(appData.state); }
      cacheWordsLocal(appData.words);
      return { success: true, count: data.words.length };
    } catch(e) { return { success: false, error: e.message }; }
  },
};

// ============================================================================
// SPEECH
// ============================================================================
const SpeechManager = {
  synth: window.speechSynthesis,
  isAvailable() { return !!this.synth; },
  speak(text, rate = 0.9) {
    if (!this.isAvailable()) return null;
    this.synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US'; u.rate = rate; u.pitch = 1;
    const voices = this.synth.getVoices();
    const v = voices.find(x => x.lang.startsWith('en') && x.name.includes('Google'))
      || voices.find(x => x.lang.startsWith('en-US'))
      || voices.find(x => x.lang.startsWith('en'));
    if (v) u.voice = v;
    this.synth.speak(u);
    return u;
  },
  speakSlowly(text) { return this.speak(text, 0.7); },
};
if (window.speechSynthesis) {
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
}

// ============================================================================
// SENTENCE & PASSAGE GENERATOR
// ============================================================================
const SENTENCE_TEMPLATES = [
  'The word "{word}" is very useful in daily conversation.',
  'People often use "{word}" when they talk about this topic.',
  'Everyone agrees that "{word}" is an important word to know.',
  'The teacher explains what "{word}" means to the class.',
  'I think "{word}" describes this situation perfectly.',
  'This book uses "{word}" many times in every chapter.',
  '{word} appears frequently in English newspapers.',
  'My friend always says "{word}" when she is excited.',
  'I am practicing how to use "{word}" in a sentence right now.',
  'Many students are learning "{word}" for the upcoming test.',
  'Yesterday I looked up "{word}" in the dictionary.',
  'She used "{word}" correctly in her essay last week.',
  'He finally understood what "{word}" meant after the lesson.',
  'They learned the word "{word}" during their English class.',
  'I will try to use "{word}" more often in my writing.',
  'You are going to need "{word}" for the next assignment.',
  'We will remember "{word}" because it is so useful.',
  'I did not know the meaning of "{word}" until today.',
  'You should not forget to review "{word}" before the exam.',
  'He does not understand how to use "{word}" properly yet.',
  'It is not easy to remember "{word}" without practice.',
  'Do you know how to pronounce "{word}" correctly?',
  'Can you give me an example sentence using "{word}"?',
  'Have you ever heard someone say "{word}" in a movie?',
  'What does "{word}" remind you of?',
  'You could use "{word}" to express your opinion more clearly.',
  'Students must learn "{word}" before moving to the next level.',
  'I should write down "{word}" so I do not forget it.',
  'Although "{word}" seems simple, it has a deep meaning.',
  'One of the best ways to learn "{word}" is to use it in context.',
];

const PASSAGE_FRAMES = [
  {
    title: 'My Vocabulary Journey',
    sentences: [
      'Today I studied several new English words. The first one was "{w0}", which is quite common in English.',
      'Then I learned "{w1}" and "{w2}" — these two words are related to each other.',
      '"{w3}" was a bit challenging, but I practiced it many times.',
      'I also reviewed "{w4}", "{w5}", and "{w6}" to make sure I remember them.',
      'The most interesting word was "{w7}" because it sounds very nice.',
      '"{w8}" and "{w9}" were easier because I had seen them before.',
      'Overall, this was a productive study session!',
    ],
  },
  {
    title: 'A Day of Learning',
    sentences: [
      'This morning, I decided to expand my vocabulary. I started with "{w0}".',
      'After that, I wrote down "{w1}" and "{w2}" in my notebook.',
      'My teacher told me that "{w3}" is frequently used in academic writing.',
      'I practiced saying "{w4}" out loud to improve my pronunciation.',
      'Later, I made sentences using "{w5}", "{w6}", and "{w7}".',
      'The words "{w8}" and "{w9}" completed my study list for the day.',
      'I feel confident that I can use all of these words correctly now.',
    ],
  },
  {
    title: 'Words in Context',
    sentences: [
      'Learning vocabulary is like collecting treasures. "{w0}" is one such treasure.',
      'I discovered that "{w1}" and "{w2}" often appear together in sentences.',
      'When I read a story, I noticed the author used "{w3}" to describe the main character.',
      '"{w4}" is a word that can change the meaning of a whole sentence.',
      'I compared "{w5}" with "{w6}" and found they have different uses.',
      'After reviewing "{w7}", "{w8}", and "{w9}", I tested myself.',
      'Now I can recognize all ten words whenever I see them!',
    ],
  },
];

function fillTemplate(template, word) {
  return template.replace(/\{word\}/g, '<span class="highlight">'+word+'</span>');
}
function fillTemplatePlain(template, word) {
  return template.replace(/\{word\}/g, word);
}
function generateExampleSentences(word) {
  return pickRandom(SENTENCE_TEMPLATES, 3).map(t => ({
    html: fillTemplate(t, word),
    plain: fillTemplatePlain(t, word),
  }));
}
function generateSentenceWithBlank(word) {
  const template = pickRandom(SENTENCE_TEMPLATES, 1)[0];
  const plain = fillTemplatePlain(template, word);
  const blanked = plain.replace(new RegExp(escapeRegex(word), 'gi'), '___');
  return { sentence: blanked, answer: word, template: plain };
}
function generatePassage(words) {
  const frame = PASSAGE_FRAMES[Math.floor(Math.random() * PASSAGE_FRAMES.length)];
  const w = words.slice(0, 10);
  while (w.length < 10) w.push('example');
  let html = '';
  frame.sentences.forEach(s => {
    let filled = s;
    for (let j = 0; j < 10; j++) filled = filled.replace('{w'+j+'}', '<span class="pw">'+w[j]+'</span>');
    html += '<p style="margin-bottom:8px;">'+filled+'</p>';
  });
  const q1Word = w[Math.floor(Math.random()*5)];
  const q1 = { question: 'Which word did the passage describe as interesting or useful?', options: shuffle([q1Word, w[5], w[7], w[9]]), answer: q1Word };
  const q2 = { question: 'How many words were studied in this passage?', options: shuffle(['10', '8', '6', '12']), answer: '10' };
  return { title: frame.title, html, words: w, questions: [q1, q2] };
}

// ============================================================================
// QUIZ ENGINE
// ============================================================================
const QuizEngine = {
  getReviewableWords(words, state) {
    const today = todayStr();
    return words.filter(w => w.status === 'new').filter(w => {
      if (w.lastCorrectDate === null && !w.lastAnswerCorrect) return true;
      if (w.lastAnswerCorrect === false) return true;
      const daysAgo = dateDiffDays(w.lastCorrectDate, today);
      if (daysAgo === 0) return true;
      if (daysAgo === 1) return Math.random() < 0.5;
      return false;
    });
  },

  getDistractors(correctWord, allWords, count) {
    const others = allWords.filter(w => w.id !== correctWord.id);
    return others.length < count ? pickRandom(others, others.length) : pickRandom(others, count);
  },

  generateQuestion(word, allWords, lastType) {
    const filtered = [1,2,3,4,5,6].filter(t => {
      if (t === 6 && allWords.length < 3) return false;
      if ((t===1||t===2||t===3) && allWords.length < 4) return false;
      return true;
    });
    const pool = filtered.filter(t => t !== lastType);
    const type = pool.length ? pool[Math.floor(Math.random()*pool.length)] : filtered[Math.floor(Math.random()*filtered.length)];
    const q = { type, word };

    switch(type) {
      case 1:
        q.prompt = '请选择「'+word.chinese+'」对应的英文单词：';
        q.options = shuffle([word, ...this.getDistractors(word, allWords, 3)]);
        q.correctAnswer = word.id;
        break;
      case 2:
        q.prompt = '「<span class="word-display">'+word.english+'</span>」的中文意思是？';
        q.options = shuffle([
          { id: word.id, text: word.chinese },
          ...this.getDistractors(word, allWords, 3).map(w => ({ id: w.id, text: w.chinese })),
        ]);
        q.correctAnswer = word.id;
        break;
      case 3:
        q.prompt = '请听发音，选择对应的单词：';
        q.audioWord = word.english;
        q.options = shuffle([word, ...this.getDistractors(word, allWords, 3)]);
        q.correctAnswer = word.id;
        break;
      case 4:
        q.prompt = '请根据中文意思，拼写出英文单词：';
        q.chineseHint = word.chinese;
        q.correctAnswer = word.english.toLowerCase().trim();
        break;
      case 5:
        q.prompt = '请补全单词的正确拼写：';
        q.displayWord = this.generateMissingLetters(word.english);
        q.correctAnswer = word.english.toLowerCase().trim();
        break;
      case 6:
        q.prompt = '请将单词拖放到正确的句子空白处：';
        q.dragWord = word.english;
        const correct = generateSentenceWithBlank(word.english);
        const distractors = this.getDistractors(word, allWords, 2);
        const sentences = [correct, ...distractors.map(d => generateSentenceWithBlank(d.english))];
        q.sentences = shuffle(sentences);
        q.correctSentenceIndex = q.sentences.indexOf(correct);
        break;
    }
    return q;
  },

  generateMissingLetters(english) {
    if (english.length <= 2) return english[0]+' _ ';
    const chars = english.split('');
    const rest = chars.slice(1);
    const numToHide = Math.max(1, Math.floor(rest.length*0.4));
    const hideIndices = pickRandom(rest.map((_,i)=>i), Math.min(numToHide, rest.length));
    const display = [chars[0]];
    rest.forEach((c,i) => { display.push(hideIndices.includes(i)?'_':c); });
    return display.join(' ');
  },

  validate(q, answer) {
    switch(q.type) {
      case 1: case 2: case 3: return answer === q.correctAnswer;
      case 4: case 5: return answer.toLowerCase().trim() === q.correctAnswer.toLowerCase().trim();
      case 6: return answer === q.correctSentenceIndex;
    }
    return false;
  },
};

// ============================================================================
// APP STATE
// ============================================================================
const appData = {
  words: [],
  state: {},
  currentQuestion: null,
  currentBankFilter: 'new',
  lastQuestionType: null,
  quizQueue: [],
  quizQueueIndex: 0,
  isQuizActive: false,
};

// ============================================================================
// UI RENDERER
// ============================================================================
const UI = {
  switchTab(panelId) {
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('#tab-bar .tab').forEach(t => t.classList.remove('active'));
    const panel = el(panelId); if (panel) panel.classList.add('active');
    const tab = document.querySelector('[data-panel="'+panelId+'"]'); if (tab) tab.classList.add('active');
    if (panelId === 'panel-study') { DataManager.checkIn(appData.state); this.renderStudy(); }
    else if (panelId === 'panel-wordbank') this.renderWordBank();
    else if (panelId === 'panel-stats') this.renderStats();
    this.updateStreakBadge();
  },

  updateStreakBadge() {
    el('streak-badge').textContent = '🔥 '+DataManager.getStreak(appData.state)+'天';
  },

  // --- Study ---
  renderStudy() {
    const reviewable = QuizEngine.getReviewableWords(appData.words, appData.state);
    el('review-count').textContent = '📋 今日待复习：'+reviewable.length+' 个单词';
    if (reviewable.length === 0) {
      el('quiz-container').innerHTML = '<div class="no-review"><div class="emoji">🎉</div><div class="msg">今天没有需要复习的单词！<br>去「词库」添加新词，或者休息一下吧~</div></div>';
      el('passage-container').innerHTML = '';
      el('session-end-container').innerHTML = '';
      return;
    }
    appData.quizQueue = shuffle(reviewable);
    appData.quizQueueIndex = 0;
    appData.isQuizActive = true;
    el('passage-container').innerHTML = '';
    el('session-end-container').innerHTML = '';
    this.renderNextQuestion();
  },

  renderNextQuestion() {
    if (appData.quizQueueIndex >= appData.quizQueue.length) { this.renderSessionEnd(); return; }
    const wordCount = appData.state.quizSessionWordCount;
    if (wordCount > 0 && wordCount % 10 === 0 && wordCount > (appData.state.lastPassageAt||0) && appData.state.quizSessionWords.length >= 10) {
      appData.state.lastPassageAt = wordCount;
      DataManager.syncState(appData.state);
      this.renderPassage(); return;
    }
    const word = appData.quizQueue[appData.quizQueueIndex];
    const q = QuizEngine.generateQuestion(word, appData.words, appData.lastQuestionType);
    appData.currentQuestion = q;
    appData.lastQuestionType = q.type;

    const labels = {1:'📝 看中文选英文',2:'📝 看英文选中文',3:'🎧 听发音选单词',4:'✍️ 看中文默写英文',5:'🔤 补全缺失字母',6:'🖱️ 拖放单词到句子'};
    let html = '<div class="quiz-card" id="quiz-card">';
    html += '<div class="quiz-type-label">'+labels[q.type]+'</div>';
    html += '<div class="quiz-prompt">'+q.prompt+'</div>';
    if (q.chineseHint) html += '<div class="quiz-prompt" style="font-size:18px;color:var(--primary);">'+q.chineseHint+'</div>';

    switch(q.type) {
      case 1: html += '<div class="options-grid">'+q.options.map(o => '<button class="option-btn" data-answer="'+o.id+'">'+o.english+'</button>').join('')+'</div>'; break;
      case 2: html += '<div class="options-grid">'+q.options.map(o => '<button class="option-btn" data-answer="'+o.id+'">'+o.text+'</button>').join('')+'</div>'; break;
      case 3:
        html += '<button class="listen-btn" id="btn-listen-q"><span class="speaker-icon">🔊</span> 点击听发音</button>';
        html += '<div class="options-grid">'+q.options.map(o => '<button class="option-btn" data-answer="'+o.id+'">'+o.english+'</button>').join('')+'</div>';
        break;
      case 4:
        html += '<div class="quiz-input-row"><input type="text" class="quiz-input" id="quiz-input" placeholder="请输入英文单词..." autocomplete="off" autocapitalize="off" spellcheck="false"><button class="submit-btn" id="btn-submit">确定</button></div>';
        break;
      case 5:
        html += '<div class="missing-letters" id="missing-display">'+q.displayWord+'</div>';
        html += '<div class="quiz-input-row"><input type="text" class="quiz-input" id="quiz-input" placeholder="请输入完整单词..." autocomplete="off" autocapitalize="off" spellcheck="false"><button class="submit-btn" id="btn-submit">确定</button></div>';
        break;
      case 6:
        html += '<div style="text-align:center;"><div class="drag-word" id="drag-word" draggable="true">'+q.dragWord+'</div></div>';
        html += '<div class="drop-zones">'+q.sentences.map((s,i) => '<div class="drop-zone" data-index="'+i+'" id="drop-zone-'+i+'">'+s.sentence+'</div>').join('')+'</div>';
        html += '<div style="text-align:center;margin-top:14px;color:var(--text-tertiary);font-size:14px;font-weight:500;">💡 点击单词选中，再点击目标句子（桌面端可拖拽）</div>';
        break;
    }
    html += '<div class="answer-reveal" id="answer-reveal" style="display:none;"></div></div>';

    el('quiz-container').innerHTML = html;
    el('quiz-container').style.display = 'block';
    el('passage-container').innerHTML = '';
    el('session-end-container').innerHTML = '';
    this.bindQuizEvents(q);
  },

  bindQuizEvents(q) {
    const card = el('quiz-card');
    card.querySelectorAll('.option-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        if (this.classList.contains('selected-correct')||this.classList.contains('selected-wrong')) return;
        UI.handleAnswer(QuizEngine.validate(q, this.dataset.answer), this.dataset.answer, q, card, this);
      });
    });
    const listenBtn = el('btn-listen-q');
    if (listenBtn) { listenBtn.addEventListener('click', () => SpeechManager.speakSlowly(q.audioWord)); setTimeout(() => SpeechManager.speakSlowly(q.audioWord), 300); }
    const submitBtn = el('btn-submit');
    const quizInput = el('quiz-input');
    if (submitBtn && quizInput) {
      const doSubmit = () => { const a = quizInput.value; UI.handleAnswer(QuizEngine.validate(q, a), a, q, card, quizInput); };
      submitBtn.addEventListener('click', doSubmit);
      quizInput.addEventListener('keydown', e => { if (e.key==='Enter') doSubmit(); });
      setTimeout(() => quizInput.focus(), 100);
    }
    if (q.type === 6) this.setupDragAndDrop(q, card);
  },

  setupDragAndDrop(q, card) {
    const dragWord = el('drag-word');
    const dropZones = card.querySelectorAll('.drop-zone');
    if (!dragWord) return;
    dragWord.addEventListener('click', e => { e.stopPropagation(); dragWord.classList.toggle('selected'); dropZones.forEach(dz => dz.classList.remove('drag-over')); });
    dropZones.forEach(dz => {
      dz.addEventListener('click', () => { if (dragWord.classList.contains('selected')) { const idx = parseInt(dz.dataset.index); UI.handleAnswer(idx===q.correctSentenceIndex, idx, q, card, dz); dragWord.classList.remove('selected'); } });
      dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag-over'); });
      dz.addEventListener('dragleave', () => dz.classList.remove('drag-over'));
      dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('drag-over'); UI.handleAnswer(parseInt(dz.dataset.index)===q.correctSentenceIndex, parseInt(dz.dataset.index), q, card, dz); });
    });
    dragWord.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain',''); dragWord.classList.add('dragging'); });
    dragWord.addEventListener('dragend', () => { dragWord.classList.remove('dragging'); dropZones.forEach(dz => dz.classList.remove('drag-over')); });
    card.addEventListener('click', function(e) { if (!e.target.closest('.drag-word') && !e.target.closest('.drop-zone')) dragWord.classList.remove('selected'); });
  },

  handleAnswer(isCorrect, answer, q, card, targetEl) {
    card.querySelectorAll('.option-btn').forEach(b => { b.style.pointerEvents='none'; if (b.dataset.answer===q.correctAnswer) b.classList.add('reveal-correct'); });
    const input = card.querySelector('.quiz-input'); if (input) input.disabled=true;
    const submit = card.querySelector('.submit-btn'); if (submit) submit.disabled=true;
    const dragW = card.querySelector('.drag-word'); if (dragW) dragW.style.pointerEvents='none';
    if (targetEl) { targetEl.classList.add(isCorrect?'selected-correct':'selected-wrong'); }
    if (input) { input.classList.add(isCorrect?'correct':'wrong'); }

    const toast = document.createElement('div');
    toast.className = 'feedback-toast '+(isCorrect?'correct':'wrong');
    toast.textContent = isCorrect ? '✅ 回答正确！' : '❌ 回答错误';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 1200);
    card.classList.add(isCorrect?'correct':'wrong');

    const reveal = el('answer-reveal');
    if (reveal && !isCorrect) {
      let correctDisplay = '';
      switch(q.type) {
        case 1: correctDisplay='正确答案：<strong>'+q.word.english+'</strong>'; break;
        case 2: correctDisplay='正确答案：<strong>'+q.word.chinese+'</strong>'; break;
        case 3: correctDisplay='正确答案：<strong>'+q.word.english+'</strong>'; break;
        case 4: case 5: correctDisplay='正确答案：<strong>'+q.correctAnswer+'</strong>'; break;
        case 6: correctDisplay='正确句子：<strong>'+q.sentences[q.correctSentenceIndex].template+'</strong>'; break;
      }
      reveal.innerHTML = correctDisplay;
      reveal.style.display = 'block';
    } else if (reveal) { reveal.style.display = 'none'; }

    this.updateWordStats(q.word.id, isCorrect);

    setTimeout(() => {
      appData.quizQueueIndex++;
      appData.state.quizSessionWordCount++;
      appData.state.quizSessionWords.push(q.word.english);
      if (appData.state.quizSessionWords.length > 20) appData.state.quizSessionWords = appData.state.quizSessionWords.slice(-20);
      DataManager.syncState(appData.state);
      this.renderNextQuestion();
    }, isCorrect ? 800 : 1800);
  },

  async updateWordStats(wordId, isCorrect) {
    const word = appData.words.find(w => w.id === wordId);
    if (!word) return;
    const today = todayStr();
    if (isCorrect) {
      word.correctStreak = Math.min(3, word.correctStreak+1);
      word.totalCorrect++;
      word.lastCorrectDate = today;
      word.lastAnswerCorrect = true;
      if (word.correctStreak >= 3) { word.status = 'mastered'; word.masteredAt = new Date().toISOString(); appData.state.todayMasteredCount++; }
    } else {
      word.correctStreak = 0;
      word.totalWrong++;
      word.lastAnswerCorrect = false;
    }
    appData.state.todayStudiedCount++;
    appData.state.dailyReviewCount[today] = (appData.state.dailyReviewCount[today]||0) + 1;
    await DataManager.updateWord(wordId, {
      correctStreak: word.correctStreak, totalCorrect: word.totalCorrect, totalWrong: word.totalWrong,
      lastCorrectDate: word.lastCorrectDate, lastAnswerCorrect: word.lastAnswerCorrect,
      status: word.status, masteredAt: word.masteredAt,
    });
  },

  renderPassage() {
    const words = appData.state.quizSessionWords.slice(-10);
    const passage = generatePassage(words);
    el('quiz-container').style.display = 'none';
    let html = '<div class="passage-card animate-pop"><div class="passage-title">📄 '+passage.title+'</div><div class="passage-text">'+passage.html+'</div>';
    const answered = {};
    passage.questions.forEach((pq, qi) => {
      html += '<div class="passage-question">❓ '+(qi+1)+'. '+pq.question+'</div>';
      html += '<div class="passage-options" id="passage-options-'+qi+'">'+pq.options.map(opt => '<button class="passage-option" data-q="'+qi+'" data-answer="'+opt+'">'+opt+'</button>').join('')+'</div>';
    });
    html += '<div id="passage-feedback" style="text-align:center;margin-top:12px;"></div>';
    html += '<button class="btn btn-primary" id="btn-passage-continue" style="width:100%;margin-top:12px;display:none;">继续学习 ➡️</button></div>';
    el('passage-container').innerHTML = html;

    el('passage-container').querySelectorAll('.passage-option').forEach(btn => {
      btn.addEventListener('click', function() {
        const qi = parseInt(this.dataset.q);
        if (answered[qi]) return;
        answered[qi] = true;
        const correct = passage.questions[qi].answer;
        const isCorrect = this.dataset.answer === correct;
        const optsContainer = el('passage-options-'+qi);
        optsContainer.querySelectorAll('.passage-option').forEach(b => { b.style.pointerEvents='none'; if (b.dataset.answer===correct) b.classList.add('chosen-correct'); if (b===this&&!isCorrect) b.classList.add('chosen-wrong'); });
        el('passage-feedback').innerHTML = isCorrect ? '<span style="color:var(--success);">✅ 正确！</span>' : '<span style="color:var(--danger);">❌ 正确答案是：'+correct+'</span>';
        if (Object.keys(answered).length >= passage.questions.length) el('btn-passage-continue').style.display = 'block';
      });
    });
    el('btn-passage-continue').addEventListener('click', () => { el('passage-container').innerHTML=''; el('quiz-container').style.display='block'; this.renderNextQuestion(); });
  },

  renderSessionEnd() {
    appData.isQuizActive = false;
    el('quiz-container').style.display = 'none';
    el('passage-container').innerHTML = '';
    const mastered = appData.state.todayMasteredCount;
    const studied = appData.state.todayStudiedCount;
    let emoji = studied ? (mastered ? '🏆' : '🎉') : '😴';
    let msg = studied ? (mastered ? '恭喜！今天掌握了 '+mastered+' 个新单词！' : '太棒了！已完成今天的所有复习。') : '今天还没有学习任何单词，明天再来吧！';
    el('session-end-container').innerHTML = '<div class="session-summary animate-pop"><div class="big-emoji">'+emoji+'</div><div class="summary-text">'+msg+'</div><div class="summary-stats"><div class="ss-stat"><div class="ss-stat-val">'+studied+'</div><div class="ss-stat-lbl">今日学习</div></div><div class="ss-stat"><div class="ss-stat-val">'+mastered+'</div><div class="ss-stat-lbl">今日掌握</div></div></div><button class="btn btn-primary" style="margin-top:20px;" onclick="UI.renderStudy()">🔄 重新检查复习</button></div>';
  },

  // --- Word Bank ---
  renderWordBank() {
    const filter = appData.currentBankFilter;
    el('wb-tab-new').classList.toggle('active', filter==='new');
    el('wb-tab-mastered').classList.toggle('active', filter==='mastered');
    const searchTerm = el('search-input').value.toLowerCase().trim();
    let filtered = appData.words.filter(w => w.status === filter);
    if (searchTerm) filtered = filtered.filter(w => w.english.toLowerCase().includes(searchTerm) || w.chinese.includes(searchTerm));
    const listEl = el('word-list');
    if (filtered.length === 0) {
      listEl.innerHTML = '<div class="empty-state">📭 暂无单词，点击上方按钮添加吧！</div>';
    } else {
      listEl.innerHTML = filtered.map(w => {
        const total = w.totalCorrect + w.totalWrong;
        const pct = total > 0 ? Math.round((w.totalCorrect/total)*100) : 0;
        const pc = w.status === 'mastered' ? ' mastered' : '';
        const phId = 'ph-'+w.id;
        return '<div class="word-card" id="word-card-'+w.id+'" data-id="'+w.id+'"><div class="word-card-header"><div class="word-card-main" data-action="expand" data-id="'+w.id+'"><div class="word-card-english">'+w.english+' <span class="phonetic" id="'+phId+'"></span></div><div class="word-card-chinese">'+w.chinese+'</div></div><div class="word-card-actions"><button class="card-action-btn" data-action="speak" data-id="'+w.id+'" title="朗读">🔊</button><button class="card-action-btn delete" data-action="delete" data-id="'+w.id+'" title="删除">🗑️</button></div></div><div class="progress-bar-wrap"><div class="progress-bar-fill'+pc+'" style="width:'+pct+'%;"></div></div><div class="word-detail" id="detail-'+w.id+'">'+(w.breakdown?'<div class="word-detail-row"><div class="word-detail-label">词根词缀拆解</div><div>'+w.breakdown+'</div></div>':'')+'<div class="word-detail-row"><div class="word-detail-label">学习记录</div><div>✅ 答对 <strong>'+w.totalCorrect+'</strong> 次 &nbsp; ❌ 答错 <strong>'+w.totalWrong+'</strong> 次</div><div>熟练度：<strong>'+pct+'%</strong> &nbsp; 连续答对：<strong>'+w.correctStreak+'/3</strong></div></div><div class="word-detail-row"><div class="word-detail-label">例句</div><div class="example-sentences" id="examples-'+w.id+'">'+generateExampleSentences(w.english).map(s => '<div class="example-sentence">'+s.html+'</div>').join('')+'</div></div><button class="detail-listen-btn" data-action="speak" data-id="'+w.id+'">🔊 朗读</button></div></div>';
      }).join('');
      // Fetch phonetics for displayed words
      filtered.forEach(w => {
        getPhonetic(w.english).then(ph => {
          const el = document.getElementById('ph-'+w.id);
          if (el && ph) el.textContent = ph;
        });
      });
    }
    el('wb-tab-new').textContent = '🌱 生词库 ('+appData.words.filter(w=>w.status==='new').length+')';
    el('wb-tab-mastered').textContent = '✅ 熟词库 ('+appData.words.filter(w=>w.status==='mastered').length+')';
    this.bindWordCardEvents();
  },

  bindWordCardEvents() {
    el('word-list').querySelectorAll('[data-action="expand"]').forEach(el => { el.addEventListener('click', function() { document.getElementById('word-card-'+this.dataset.id).classList.toggle('expanded'); }); });
    el('word-list').querySelectorAll('[data-action="speak"]').forEach(el => { el.addEventListener('click', function(e) { e.stopPropagation(); const w = appData.words.find(x=>x.id===this.dataset.id); if (w) SpeechManager.speak(w.english); }); });
    el('word-list').querySelectorAll('[data-action="delete"]').forEach(el => { el.addEventListener('click', async function(e) { e.stopPropagation(); if (confirm('确定删除？')) { await DataManager.deleteWord(this.dataset.id); UI.renderWordBank(); UI.updateStreakBadge(); } }); });
  },

  // --- Stats ---
  renderStats() {
    const mastered = appData.words.filter(w=>w.status==='mastered');
    const newWords = appData.words.filter(w=>w.status==='new');
    el('stat-mastered').textContent = mastered.length;
    el('stat-new').textContent = newWords.length;
    el('stat-today-studied').textContent = appData.state.todayStudiedCount||0;
    el('stat-today-mastered').textContent = appData.state.todayMasteredCount||0;

    const days = [];
    for (let i=6; i>=0; i--) {
      const d = new Date(); d.setDate(d.getDate()-i);
      const key = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
      days.push({ key, label:['日','一','二','三','四','五','六'][d.getDay()], count: appData.state.dailyReviewCount[key]||0 });
    }
    const max = Math.max(1,...days.map(d=>d.count));
    el('weekly-chart').innerHTML = days.map(d => {
      const h = Math.max(4,(d.count/max)*100);
      return '<div class="chart-bar-wrap"><div class="chart-bar-value">'+d.count+'</div><div class="chart-bar" style="height:'+h+'px;'+(d.key===todayStr()?'background:linear-gradient(180deg,var(--primary-dark),var(--primary));':'')+'"></div><div class="chart-bar-label">'+d.label+'</div></div>';
    }).join('');

    const recent = mastered.filter(w=>w.masteredAt).sort((a,b)=>new Date(b.masteredAt)-new Date(a.masteredAt)).slice(0,10);
    el('recent-mastered-list').innerHTML = recent.length ? recent.map(w=>'<div class="stats-list-item"><div><span class="word-en">'+w.english+'</span><span class="word-cn"> — '+w.chinese+'</span></div><span style="color:var(--success);font-size:12px;">✅ 已掌握</span></div>').join('') : '<div style="color:var(--text-secondary);font-size:13px;">暂无掌握记录</div>';

    const weakest = newWords.map(w => { const t=w.totalCorrect+w.totalWrong; return {...w, pct: t?Math.round((w.totalCorrect/t)*100):0}; }).sort((a,b)=>a.pct-b.pct).slice(0,5);
    el('weakest-list').innerHTML = weakest.length ? weakest.map(w=>'<div class="stats-list-item"><div><span class="word-en">'+w.english+'</span><span class="word-cn"> — '+w.chinese+'</span></div><span class="word-pct">'+w.pct+'%</span></div>').join('') : '<div style="color:var(--text-secondary);font-size:13px;">暂无生词</div>';
    this.updateStreakBadge();
  },
};

// ============================================================================
// EVENT HANDLERS
// ============================================================================
function initEvents() {
  // Only bind once
  if (initEvents._bound) return;
  initEvents._bound = true;

  // Auth tabs
  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', function() {
      document.querySelectorAll('.auth-tab').forEach(t=>t.classList.remove('active'));
      document.querySelectorAll('.auth-form').forEach(f=>f.classList.remove('active'));
      this.classList.add('active');
      const target = this.dataset.authTab;
      el('form-'+target).classList.add('active');
    });
  });

  // Auth events handled via onclick in HTML

  // Logout
  el('btn-logout').addEventListener('click', async () => { if (confirm('确定退出登录？')) await Auth.logout(); });

  // Tab switching
  el('tab-bar').addEventListener('click', function(e) { const tab = e.target.closest('.tab'); if (tab) UI.switchTab(tab.dataset.panel); });

  // Word bank filter
  el('wb-tab-new').addEventListener('click', () => { appData.currentBankFilter='new'; UI.renderWordBank(); });
  el('wb-tab-mastered').addEventListener('click', () => { appData.currentBankFilter='mastered'; UI.renderWordBank(); });
  el('search-input').addEventListener('input', () => UI.renderWordBank());

  // Add word
  el('btn-add-word').addEventListener('click', () => { el('modal-add-word').style.display='flex'; el('add-english').value=''; el('add-chinese').value=''; el('add-breakdown').value=''; const h=el('translate-hint'); if(h){h.textContent='';h.style.display='none';} setTimeout(()=>el('add-english').focus(),100); });
  el('btn-add-cancel').addEventListener('click', () => el('modal-add-word').style.display='none');
  el('btn-add-confirm').addEventListener('click', async () => {
    const en = el('add-english').value.trim();
    const cn = el('add-chinese').value.trim();
    const bd = el('add-breakdown').value.trim();
    if (!en) { alert('请输入英文单词'); return; }
    if (!cn) { alert('请输入中文释义'); return; }
    await DataManager.addWord(en, cn, bd);
    el('modal-add-word').style.display='none';
    UI.renderWordBank();
  });

  // I/O modal
  el('btn-export').addEventListener('click', () => el('modal-io').style.display='flex');
  el('btn-io-close').addEventListener('click', () => el('modal-io').style.display='none');
  el('btn-do-export').addEventListener('click', () => {
    const json = DataManager.exportData();
    const blob = new Blob([json],{type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download='vocab-backup-'+todayStr()+'.json';
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    alert('✅ 已导出！');
  });
  el('btn-do-import').addEventListener('click', () => el('import-file-input').click());
  el('import-file-input').addEventListener('change', async function(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async function(ev) {
      const result = await DataManager.importData(ev.target.result);
      alert(result.success ? '✅ 成功导入 '+result.count+' 个单词！' : '❌ 导入失败：'+result.error);
      if (result.success) { UI.renderWordBank(); UI.renderStudy(); UI.renderStats(); }
    };
    reader.readAsText(file);
    el('import-file-input').value = '';
  });

  // Close modals
  document.querySelectorAll('.modal-overlay').forEach(o => { o.addEventListener('click', function(e) { if (e.target===this) this.style.display='none'; }); });
  document.addEventListener('keydown', function(e) { if (e.key==='Escape') document.querySelectorAll('.modal-overlay').forEach(m => { if (m.style.display==='flex') m.style.display='none'; }); });
}

// ============================================================================
// AUTO TRANSLATE — free MyMemory API, no key needed
// ============================================================================
let translateTimer = null;

// Phonetics — free dictionary API, fetched on display
const phoneticCache = {};

async function getPhonetic(word) {
  const w = word.toLowerCase().trim();
  if (phoneticCache[w]) return phoneticCache[w];
  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(w)}`);
    if (!res.ok) { phoneticCache[w] = ''; return ''; }
    const data = await res.json();
    if (data && data[0] && data[0].phonetics) {
      for (const p of data[0].phonetics) {
        if (p.text) { phoneticCache[w] = p.text; return p.text; }
      }
    }
  } catch(e) {}
  phoneticCache[w] = '';
  return '';
}

async function lookupWord(word) {
  // Use iciba (金山词典) for accurate English-Chinese translation with part of speech
  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 6000);
    const res = await fetch(`https://dict.iciba.com/dictionary/word/suggestion?word=${encodeURIComponent(word.toLowerCase().trim())}&nums=1`, { signal: controller.signal });
    const data = await res.json();
    if (data.status === 1 && data.message && data.message[0] && data.message[0].paraphrase) {
      return data.message[0].paraphrase; // e.g. "v.使生气,惹恼"
    }
  } catch(e) {}
  return '';
}

async function translateText(text, from, to) {
  if (!text || text.length < 2) return '';
  // For single English words, use iciba first
  if (from === 'en' && !text.includes(' ')) {
    const iciba = await lookupWord(text);
    if (iciba) return iciba;
  }
  // Fallback to MyMemory for sentences or if iciba fails
  const sl = from === 'en' ? 'en' : 'zh-CN';
  const tl = to === 'en' ? 'en' : 'zh-CN';
  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sl}|${tl}`, { signal: controller.signal });
    const data = await res.json();
    if (data.responseStatus === 200 && data.responseData) {
      let r = data.responseData.translatedText;
      if (r && r.toLowerCase() !== text.toLowerCase()) return r;
    }
  } catch(e) {}
  return '';
}

function isEnglish(text) {
  return /^[a-zA-Z\s'-]+$/.test(text.trim());
}

function setupAutoTranslate() {
  if (setupAutoTranslate._done) return;
  setupAutoTranslate._done = true;

  const enInput = el('add-english');
  const cnInput = el('add-chinese');
  const hint = el('translate-hint');
  if (!enInput || !cnInput) return;

  function showHint(text) {
    if (hint) { hint.textContent = text; hint.style.display = text ? 'block' : 'none'; }
  }

  enInput.addEventListener('input', () => {
    clearTimeout(translateTimer);
    const val = enInput.value.trim();
    if (!val || val.length < 2) { showHint(''); return; }
    if (!isEnglish(val)) return;
    showHint('🔄 查询中...');
    translateTimer = setTimeout(async () => {
      const result = await translateText(val, 'en', 'zh-CN');
      if (result) {
        cnInput.value = result;
        showHint('✅ 已填入，可修改');
        setTimeout(() => showHint(''), 1500);
      } else {
        showHint('查询失败，请手动输入');
      }
    }, 500);
  });

  cnInput.addEventListener('input', () => {
    clearTimeout(translateTimer);
    const val = cnInput.value.trim();
    if (!val || val.length < 1) { showHint(''); return; }
    if (isEnglish(val)) return;
    // Only auto-translate to English if English field is empty
    if (enInput.value.trim()) return;
    showHint('🔄 翻译中...');
    translateTimer = setTimeout(async () => {
      const result = await translateText(val, 'zh-CN', 'en');
      if (result) {
        enInput.value = result;
        showHint('✅ 已翻译，可修改');
        setTimeout(() => showHint(''), 1500);
      } else {
        showHint('翻译失败，请手动输入');
      }
    }, 500);
  });
}

// ============================================================================
// INITIALIZATION
// ============================================================================
async function init() {
  initEvents();
  setupAutoTranslate();
  await Auth.init();
}

// PWA Install
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const btn = document.getElementById('btn-install');
  if (btn) { btn.style.display = 'flex'; btn.textContent = '⬇️ 一键安装'; }
});

// Always show install button after login
function showInstallButton() {
  const btn = document.getElementById('btn-install');
  if (!btn) return;
  btn.style.display = 'flex';
  if (!deferredPrompt) {
    btn.textContent = '⬇️ 安装';
    btn.title = '点击查看安装方法';
  }
}

async function installPWA() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      const btn = document.getElementById('btn-install');
      if (btn) btn.style.display = 'none';
      deferredPrompt = null;
      return;
    }
    deferredPrompt = null;
  }
  // Fallback: show manual instructions
  const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
  const isEdge = /Edg/.test(navigator.userAgent);
  if (isChrome || isEdge) {
    alert('📱 安装方法：\n\n1. 点击地址栏右侧的 ⬇️🖥️ 图标\n2. 或按键盘 Ctrl+Shift+I → 顶部「应用」标签 → 安装\n\n如果没有看到安装图标，刷新页面后再试。');
  } else {
    alert('📱 请使用 Chrome 或 Edge 浏览器打开此页面，然后点击地址栏的安装图标。');
  }
}

// Register Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

document.addEventListener('DOMContentLoaded', init);