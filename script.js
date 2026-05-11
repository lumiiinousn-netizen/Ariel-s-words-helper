// ========== 全局状态 ==========
let wordBank = [];
let currentTab = 'understanding';
let currentGroup = 'all';
let wrongPriority = true;
let useEbbinghaus = true;
let currentAccent = 'en-GB';        // 'en-GB' 英音, 'en-US' 美音
let currentQuizIndex = 0;
let spellWordList = [];
let listeners = [];

function notifyState() { listeners.forEach(fn => fn()); }
function subscribe(fn) { listeners.push(fn); return () => listeners = listeners.filter(f => f !== fn); }

// ========== 辅助函数 ==========
function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>]/g, m => m === '&' ? '&amp;' : m === '<' ? '&lt;' : '&gt;');
}
function getTodayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function formatReviewDate(ts) {
    if (!ts) return '未安排';
    const d = new Date(ts);
    return `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}`;
}

// ========== 免费真人发音（有道 + 金山词霸双保险） ==========
async function speakEnglishWord(word) {
    if (!word) return;
    const playAudio = async (url) => {
        return new Promise((resolve, reject) => {
            const audio = new Audio(url);
            audio.onerror = () => reject(new Error(`无法加载音频: ${url}`));
            audio.onended = () => resolve();
            audio.play().catch(reject);
        });
    };
    
    const urls = [];
    if (currentAccent === 'en-GB') {
        urls.push(`https://dict.youdao.com/dict/voice?audio=${encodeURIComponent(word)}&type=1`);
        urls.push(`https://dict.youdao.com/dict/voice?audio=${encodeURIComponent(word)}`);
        urls.push(`http://res.iciba.com/res/amp3/oxford/${encodeURIComponent(word)}.mp3`);
    } else {
        urls.push(`https://dict.youdao.com/dict/voice?audio=${encodeURIComponent(word)}&type=2`);
        urls.push(`https://dict.youdao.com/dict/voice?audio=${encodeURIComponent(word)}`);
        urls.push(`http://res.iciba.com/res/amp3/1/0/${encodeURIComponent(word)}.mp3`);
    }
    
    for (const url of urls) {
        try {
            await playAudio(url);
            return;
        } catch (err) {
            console.warn(`发音失败: ${url}`, err);
        }
    }
    alert(`⚠️ 无法播放单词“${word}”的真人发音，请检查网络连接。\n您可以尝试切换英音/美音后重试。`);
}

function bindVoiceButtons() {
    const enUsBtn = document.getElementById('voiceEnUs');
    const enUkBtn = document.getElementById('voiceEnUk');
    if (enUsBtn) enUsBtn.onclick = () => { currentAccent = 'en-US'; setActiveVoice('en-US'); };
    if (enUkBtn) enUkBtn.onclick = () => { currentAccent = 'en-GB'; setActiveVoice('en-GB'); };
}
function setActiveVoice(accent) {
    const enUs = document.getElementById('voiceEnUs');
    const enUk = document.getElementById('voiceEnUk');
    if (enUs && enUk) {
        if (accent === 'en-US') { enUs.classList.add('active'); enUk.classList.remove('active'); }
        else { enUk.classList.add('active'); enUs.classList.remove('active'); }
    }
}

// ========== 加强版自动翻译 ==========
async function fetchTranslation(word) {
    if (!word) return null;
    try {
        const r = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=en|zh`, { signal: AbortSignal.timeout(8000) });
        const d = await r.json();
        if (d?.responseData?.translatedText && d.responseData.translatedText !== word) {
            let trans = d.responseData.translatedText.replace(/&#39;/g,"'").replace(/&quot;/g,'"');
            trans = trans.replace(/^(n\.|adj\.|v\.|adv\.|prep\.|conj\.|pron\.)\s+/i, '');
            if (trans && trans.length < 50) return trans;
        }
    } catch(e) { /* 继续 */ }
    try {
        const r = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh&dt=t&q=${encodeURIComponent(word)}`, { signal: AbortSignal.timeout(8000) });
        const d = await r.json();
        if (d?.[0]?.[0]?.[0]) return d[0][0][0];
    } catch(e) {}
    return null;
}

function detectPos(word) {
    const patterns = {
        'tion$|sion$': 'n.', 'ing$': 'v.', 'ly$': 'adv.',
        'ful$|ous$|ive$|al$|able$': 'adj.', 'ize$|ise$': 'v.',
        'ment$': 'n.', 'ness$': 'n.', 'ity$': 'n.'
    };
    for (let [regex, pos] of Object.entries(patterns)) {
        if (new RegExp(regex,'i').test(word)) return pos;
    }
    return '';
}

function isValidSentence(s) {
    if (!s || typeof s !== 'string') return false;
    s = s.trim();
    if (s.length < 12) return false;
    const l = s.toLowerCase();
    const blacklist = ['pizza','burger','sandwich','spaghetti','curry','sushi','taco','burrito','noodle','rice','chicken','beef','pork','cake','cookie','ice cream','chocolate','apple pie','steak'];
    if (blacklist.some(f => l.includes(f))) return false;
    const verbIndicators = /\b(is|am|are|was|were|be|been|being|have|has|had|having|do|does|did|doing|go|goes|went|gone|make|makes|made|take|takes|took|taken|see|sees|saw|seen|say|says|said|get|gets|got|gotten|find|finds|found|give|gives|gave|given|think|thinks|thought|know|knows|knew|known)\b/i;
    if (!verbIndicators.test(l) && !/\b\w+ed\b/.test(l)) return false;
    if (!/\s/.test(s)) return false;
    return true;
}

async function fetchOxfordExample(word) {
    try {
        const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
        if (!res.ok) return null;
        const data = await res.json();
        if (!data[0]) return null;
        for (const m of data[0].meanings) {
            for (const d of m.definitions) {
                if (d.example && isValidSentence(d.example)) return d.example;
            }
        }
        return null;
    } catch(e) { return null; }
}

// ========== 数据持久化 ==========
function loadData() {
    const saved = localStorage.getItem('ariel_words_data');
    if (saved) {
        wordBank = JSON.parse(saved);
        wordBank = wordBank.map(w => ({
            ...w,
            reviewCount: w.reviewCount || 0,
            mnemonic: w.mnemonic || '',
            reviewStage: w.reviewStage ?? 0,
            lastReviewDate: w.lastReviewDate || null,
            nextTime: w.nextTime || null,
            attempts: w.attempts || 0,
            wrongCount: w.wrongCount || 0
        }));
    } else {
        wordBank = [];
    }
}
function saveData() {
    localStorage.setItem('ariel_words_data', JSON.stringify(wordBank));
    notifyState();
    if (currentTab === 'understanding') renderUnderstanding();
    else if (currentTab === 'spelling') renderSpelling();
    else if (currentTab === 'quiz') updateSpellList();
    checkAchievements();
}

// ========== 艾宾浩斯复习周期 ==========
const EBB = [1,2,4,7,15,30];
function updateReview(word, isCorrect) {
    if (!isCorrect) {
        word.reviewStage = 0;
        word.lastReviewDate = getTodayStr();
        word.nextTime = Date.now() + EBB[0] * 24*60*60*1000;
    } else {
        word.reviewStage = (word.reviewStage || 0) + 1;
        word.lastReviewDate = getTodayStr();
        if (word.reviewStage < EBB.length) {
            word.nextTime = Date.now() + EBB[word.reviewStage] * 24*60*60*1000;
        } else {
            word.nextTime = null;
        }
    }
    saveData();
}
function isDue(word) {
    if (word.reviewStage === undefined) return true;
    if (word.reviewStage >= EBB.length) return false;
    const next = word.nextTime || 0;
    return next === 0 || next <= Date.now();
}
function getAccuracy(word) {
    if (!word.attempts || word.attempts === 0) return 1;
    return (word.attempts - (word.wrongCount || 0)) / word.attempts;
}
function getGroup(word) {
    const acc = getAccuracy(word);
    if (acc >= 0.8) return 'high';
    if (acc >= 0.6) return 'medium';
    return 'low';
}
function updateSpellList() {
    let filtered = wordBank.filter(w => w.mode === 'spell');
    if (useEbbinghaus) filtered = filtered.filter(w => isDue(w));
    if (currentGroup !== 'all') filtered = filtered.filter(w => getGroup(w) === currentGroup);
    if (wrongPriority) filtered.sort((a,b) => (b.wrongCount||0)-(a.wrongCount||0) || a.id-b.id);
    else filtered.sort((a,b) => a.id-b.id);
    spellWordList = filtered;
    if (currentQuizIndex >= spellWordList.length) currentQuizIndex = 0;
    notifyState();
}

// ========== 词库渲染 ==========
function renderUnderstanding() {
    const container = document.getElementById('understanding-words-container');
    if (!container) return;
    const words = wordBank.filter(w => w.mode === 'meaning');
    container.innerHTML = '';
    if (!words.length) {
        container.innerHTML = '<div class="empty-state">✨ 暂无了解词库单词，点击右上角添加</div>';
        return;
    }
    words.forEach(w => {
        const card = document.createElement('div');
        card.className = 'word-card';
        card.innerHTML = `
            <div class="word-info">
                <div class="word-english">${escapeHtml(w.english)}<button class="icon-small play-word-btn">🔊</button></div>
                <div class="word-chinese">${escapeHtml(w.chinese)}${w.pos ? ` <span style="color:#6c757d;">(${escapeHtml(w.pos)})</span>` : ''}</div>
                ${w.example ? `<div class="example-box">📖 ${escapeHtml(w.example)}</div>` : ''}
                <div class="word-meta">
                    <span class="badge">👁️ 理解</span>
                    <span class="badge">📖 复习次数: ${w.reviewCount || 0}</span>
                </div>
            </div>
            <div class="word-actions">
                <button class="icon-small review-btn" title="增加复习次数">📚 复习</button>
                <button class="icon-small delete-btn">🗑️</button>
            </div>
        `;
        container.appendChild(card);
        card.querySelector('.play-word-btn').onclick = () => speakEnglishWord(w.english);
        card.querySelector('.review-btn').onclick = () => {
            w.reviewCount = (w.reviewCount || 0) + 1;
            saveData();
            renderUnderstanding();
        };
        card.querySelector('.delete-btn').onclick = () => {
            if (confirm(`删除单词“${w.english}”？`)) {
                wordBank = wordBank.filter(x => x.id !== w.id);
                saveData();
                renderUnderstanding();
                renderSpelling();
                updateSpellList();
            }
        };
    });
}
function renderSpelling() {
    const container = document.getElementById('spelling-words-container');
    if (!container) return;
    const words = wordBank.filter(w => w.mode === 'spell');
    container.innerHTML = '';
    if (!words.length) {
        container.innerHTML = '<div class="empty-state">✨ 暂无默写单词，点击右上角添加</div>';
        return;
    }
    words.forEach(w => {
        const acc = getAccuracy(w);
        const percent = w.attempts ? Math.round(acc*100) : 100;
        let gClass='', gIcon='';
        if (acc >= 0.8) { gClass='high'; gIcon='💯'; }
        else if (acc >= 0.6) { gClass='medium'; gIcon='🔵'; }
        else { gClass='low'; gIcon='💪🏻'; }
        const due = isDue(w);
        const nextReview = w.nextTime ? formatReviewDate(w.nextTime) : '已完成';
        const mnemonicHtml = w.mnemonic ? `<div class="example-box">🧠 口诀: ${escapeHtml(w.mnemonic)}</div>` : '';
        const card = document.createElement('div');
        card.className = 'word-card';
        card.innerHTML = `
            <div class="word-info">
                <div class="word-english">${escapeHtml(w.english)}<button class="icon-small play-word-btn">🔊</button></div>
                <div class="word-chinese">${escapeHtml(w.chinese)}</div>
                ${w.example ? `<div class="example-box">📖 ${escapeHtml(w.example)}</div>` : ''}
                ${mnemonicHtml}
                <div class="word-meta">
                    <span class="badge">✍️ 默写</span>
                    <span class="badge ${gClass}">${gIcon} ${percent}%</span>
                    <span class="badge">📅 下次复习: ${nextReview}</span>
                    ${due ? `<span class="badge due">⏰ 待复习</span>` : ''}
                </div>
            </div>
            <div class="word-actions">
                <button class="icon-small edit-mnemonic-btn" title="编辑记忆口诀">✏️ 口诀</button>
                <button class="icon-small wrong-inc-btn">❌ +1错</button>
                <button class="icon-small delete-btn">🗑️</button>
            </div>
        `;
        container.appendChild(card);
        card.querySelector('.play-word-btn').onclick = () => speakEnglishWord(w.english);
        card.querySelector('.edit-mnemonic-btn').onclick = () => {
            const newMnemonic = prompt('编辑记忆口诀（帮助拼写联想）:', w.mnemonic || '');
            if (newMnemonic !== null) {
                w.mnemonic = newMnemonic.trim();
                saveData();
                renderSpelling();
            }
        };
        card.querySelector('.wrong-inc-btn').onclick = () => {
            w.wrongCount = (w.wrongCount || 0) + 1;
            w.attempts = (w.attempts || 0) + 1;
            updateReview(w, false);
            saveData();
            renderSpelling();
            updateSpellList();
        };
        card.querySelector('.delete-btn').onclick = () => {
            if (confirm(`删除单词“${w.english}”？`)) {
                wordBank = wordBank.filter(x => x.id !== w.id);
                saveData();
                renderUnderstanding();
                renderSpelling();
                updateSpellList();
            }
        };
    });
}

// ========== 添加单词 ==========
let tempExample = '';
async function autoFillUnderstanding() {
    const engInput = document.getElementById('new-ueng');
    const word = engInput.value.trim();
    if (!word) { alert("请先输入英文单词"); engInput.focus(); return; }
    const posInput = document.getElementById('new-u-pos');
    const chiInput = document.getElementById('new-uci');
    posInput.placeholder = "检测中...";
    chiInput.placeholder = "翻译中...";
    const translation = await fetchTranslation(word);
    if (translation) {
        let pos = detectPos(word);
        let finalChinese = translation;
        const posRegex = /^(n\.|adj\.|v\.|adv\.|prep\.|conj\.|pron\.)\s+/i;
        if (posRegex.test(finalChinese)) {
            const match = finalChinese.match(posRegex);
            if (match && !pos) pos = match[1].toLowerCase();
            finalChinese = finalChinese.replace(posRegex, '').trim();
        }
        posInput.value = pos || "";
        chiInput.value = finalChinese;
        const example = await fetchOxfordExample(word);
        tempExample = example || "";
        document.getElementById('temp-ex').value = tempExample;
    } else {
        alert("自动翻译失败，请手动输入中文释义");
        posInput.value = "";
        chiInput.value = "";
        tempExample = "";
    }
    posInput.placeholder = "词性（可选）";
    chiInput.placeholder = "中文释义";
}
function addUnderstandingWord() {
    const pos = document.getElementById('new-u-pos').value.trim();
    let ch = document.getElementById('new-uci').value.trim();
    const en = document.getElementById('new-ueng').value.trim();
    const ex = document.getElementById('temp-ex').value.trim() || tempExample;
    if (!en || !ch) { alert("请完整填写英文和中文释义"); return; }
    if (wordBank.some(w => w.english.toLowerCase() === en.toLowerCase())) { alert("单词已存在！"); return; }
    const finalChinese = pos ? `${pos} ${ch}` : ch;
    const newWord = {
        id: Date.now(),
        english: en,
        chinese: finalChinese,
        mode: 'meaning',
        pos: pos || '',
        example: ex,
        reviewCount: 0,
        createdDate: getTodayStr(),
        attempts: 0,
        wrongCount: 0
    };
    wordBank.push(newWord);
    saveData();
    document.getElementById('new-ueng').value = '';
    document.getElementById('new-uci').value = '';
    document.getElementById('new-u-pos').value = '';
    document.getElementById('temp-ex').value = '';
    document.getElementById('add-understanding-form').classList.add('hidden');
    renderUnderstanding();
    alert(`✅ 单词“${en}”已加入理解词库`);
}
async function autoFillSpelling() {
    const engInput = document.getElementById('new-seng');
    const word = engInput.value.trim();
    if (!word) { alert("请先输入英文单词"); engInput.focus(); return; }
    const chiInput = document.getElementById('new-sci');
    chiInput.placeholder = "翻译中...";
    const translation = await fetchTranslation(word);
    if (translation) {
        chiInput.value = translation;
        const example = await fetchOxfordExample(word);
        document.getElementById('temp-ex-spell').value = example || "";
    } else {
        alert("翻译失败，请手动输入中文");
        chiInput.value = "";
        document.getElementById('temp-ex-spell').value = "";
    }
    chiInput.placeholder = "中文释义";
}
function addSpellingWord() {
    const ch = document.getElementById('new-sci').value.trim();
    const en = document.getElementById('new-seng').value.trim();
    const ex = document.getElementById('temp-ex-spell').value.trim();
    if (!en || !ch) { alert("请完整填写英文和中文"); return; }
    if (wordBank.some(w => w.english.toLowerCase() === en.toLowerCase())) { alert("单词已存在"); return; }
    const newWord = {
        id: Date.now(),
        english: en,
        chinese: ch,
        mode: 'spell',
        example: ex || '',
        mnemonic: '',
        reviewStage: 0,
        lastReviewDate: null,
        nextTime: Date.now(),
        attempts: 0,
        wrongCount: 0,
        createdDate: getTodayStr()
    };
    wordBank.push(newWord);
    saveData();
    document.getElementById('new-seng').value = '';
    document.getElementById('new-sci').value = '';
    document.getElementById('temp-ex-spell').value = '';
    document.getElementById('add-spelling-form').classList.add('hidden');
    renderSpelling();
    updateSpellList();
    alert(`✅ 单词“${en}”已加入默写词库`);
}

// ========== Excel 导入 ==========
async function importExcelTo(target) {
    const input = document.getElementById('import-excel');
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        let count = 0;
        for (let i = 0; i < rows.length; i++) {
            let eng = rows[i][0]?.toString().trim();
            let chn = rows[i][1]?.toString().trim();
            if (!eng || !chn) continue;
            if (wordBank.some(w => w.english.toLowerCase() === eng.toLowerCase())) continue;
            const newWord = {
                id: Date.now() + count,
                english: eng,
                chinese: chn,
                mode: target === 'understanding' ? 'meaning' : 'spell',
                example: '',
                pos: '',
                mnemonic: '',
                reviewCount: 0,
                reviewStage: 0,
                attempts: 0,
                wrongCount: 0,
                createdDate: getTodayStr()
            };
            if (target === 'spell') newWord.nextTime = Date.now();
            wordBank.push(newWord);
            count++;
        }
        saveData();
        alert(`成功导入 ${count} 个单词`);
        if (target === 'understanding') renderUnderstanding();
        else { renderSpelling(); updateSpellList(); }
        input.value = '';
    };
    input.click();
}

// ========== 听写练习 ==========
let quizStartTime = 0;
function startNewQuiz() {
    const container = document.getElementById('quiz-card');
    if (!spellWordList.length) {
        container.innerHTML = '<div class="empty-state">当前分组无待复习单词，请调整筛选条件或添加单词</div>';
        updateQuizNav();
        return;
    }
    const word = spellWordList[currentQuizIndex];
    quizStartTime = Date.now();
    container.innerHTML = `
        <div class="quiz-word">📖 ${escapeHtml(word.chinese)}</div>
        <div class="quiz-hint">🔊 点击喇叭听发音，输入英文拼写</div>
        <div class="quiz-input-area">
            <input type="text" id="quiz-answer-input" placeholder="请输入英文" autocomplete="off">
            <button id="play-quiz-sound" class="play-btn">🔊 朗读单词</button>
            <button id="submit-answer-btn" class="btn-primary">✍️ 提交答案</button>
        </div>
        <div id="quiz-feedback" class="quiz-feedback"></div>
        <div id="quiz-result" class="quiz-result-card" style="display:none;"></div>
    `;
    document.getElementById('play-quiz-sound').onclick = () => speakEnglishWord(word.english);
    document.getElementById('submit-answer-btn').onclick = () => submitAnswer(word);
    document.getElementById('quiz-answer-input').focus();
    updateQuizNav();
}
async function submitAnswer(word) {
    const input = document.getElementById('quiz-answer-input');
    const userAnswer = input.value.trim().toLowerCase();
    const correct = word.english.toLowerCase();
    const isCorrect = (userAnswer === correct);
    const elapsed = (Date.now() - quizStartTime) / 1000;
    word.attempts = (word.attempts || 0) + 1;
    if (!isCorrect) word.wrongCount = (word.wrongCount || 0) + 1;
    updateReview(word, isCorrect);
    saveData();
    checkAchievements();
    const fb = document.getElementById('quiz-feedback');
    fb.innerHTML = isCorrect ? '✅ 正确！' : `❌ 错误！正确答案: ${word.english}`;
    fb.style.color = isCorrect ? 'green' : '#b91c1c';
    const accuracyPercent = Math.round(getAccuracy(word) * 100);
    const nextReview = word.nextTime ? formatReviewDate(word.nextTime) : '已完成所有周期';
    const exampleHtml = word.example ? `<div class="example-box" style="margin-top:12px;">📖 ${escapeHtml(word.example)}</div>` : '';
    const resultDiv = document.getElementById('quiz-result');
    resultDiv.style.display = 'block';
    resultDiv.innerHTML = `
        <div class="stat-row"><span>⏱️ 本次用时</span><span>${elapsed.toFixed(1)} 秒</span></div>
        <div class="stat-row"><span>📅 下次复习</span><span>${nextReview}</span></div>
        <div class="stat-row"><span>📊 单词正确率</span><span>${accuracyPercent}% (${word.attempts}次练习)</span></div>
        ${exampleHtml}
        <div class="mnemonic-area">
            <label>🧠 记忆口诀/联想：</label>
            <textarea id="word-mnemonic" placeholder="例如：他日他哥 → heritage 遗产..." rows="2">${word.mnemonic || ''}</textarea>
            <button id="save-mnemonic-btn" class="icon-small" style="margin-top:8px;">💾 保存</button>
        </div>
    `;
    document.getElementById('save-mnemonic-btn').onclick = () => {
        word.mnemonic = document.getElementById('word-mnemonic').value.trim();
        saveData();
        alert('记忆口诀已保存');
        renderSpelling();
    };
    setTimeout(() => {
        if (currentQuizIndex + 1 < spellWordList.length) {
            currentQuizIndex++;
            startNewQuiz();
        } else if (currentQuizIndex + 1 === spellWordList.length) {
            document.getElementById('quiz-card').innerHTML = '<div class="empty-state">🎉 恭喜！当前分组所有单词已完成复习！</div>';
            updateQuizNav();
        }
    }, 2000);
}
function updateQuizNav() {
    const total = spellWordList.length;
    const counter = document.getElementById('word-counter');
    if (counter) counter.textContent = total ? `${currentQuizIndex+1}/${total}` : `0/0`;
    const prev = document.getElementById('prev-word-btn');
    const next = document.getElementById('next-word-btn');
    if (prev && next) { prev.disabled = total===0 || currentQuizIndex===0; next.disabled = total===0 || currentQuizIndex===total-1; }
}
function prevWord() { if (currentQuizIndex > 0) { currentQuizIndex--; startNewQuiz(); } }
function nextWord() { if (currentQuizIndex < spellWordList.length-1) { currentQuizIndex++; startNewQuiz(); } }
function renderQuizSettings() {
    document.getElementById('refresh-quiz-list').onclick = () => { updateSpellList(); startNewQuiz(); };
    document.getElementById('priority-wrong-checkbox').onchange = e => { wrongPriority = e.target.checked; updateSpellList(); startNewQuiz(); };
    document.getElementById('use-ebbinghaus-filter').onchange = e => { useEbbinghaus = e.target.checked; updateSpellList(); startNewQuiz(); };
    document.querySelectorAll('.group-btn').forEach(btn => btn.onclick = () => {
        currentGroup = btn.dataset.group;
        document.querySelectorAll('.group-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        updateSpellList();
        startNewQuiz();
    });
    document.getElementById('prev-word-btn').onclick = prevWord;
    document.getElementById('next-word-btn').onclick = nextWord;
    bindVoiceButtons();
}

// ========== 成就系统 ==========
let unlocked = new Set();
const ACHIEVEMENTS = [
    { id:"first_word", title:"初入词海", desc:"添加第一个单词", icon:"🎉" },
    { id:"ten_words", title:"十词起步", desc:"累计添加10个单词", icon:"📚" },
    { id:"fifty_words", title:"词汇达人", desc:"累计添加50个单词", icon:"🏅" },
    { id:"perfect_rate_80", title:"正确率80%", desc:"单词平均正确率≥80%", icon:"💯" },
    { id:"ten_quiz", title:"勤学苦练", desc:"完成10次听写", icon:"✍️" },
    { id:"ebbinghaus_master", title:"艾宾浩斯大师", desc:"完成一个单词的全部复习周期", icon:"🧠" },
    { id:"first_correct", title:"旗开得胜", desc:"第一次听写答对", icon:"⭐" }
];
function loadUnlocked() {
    const saved = localStorage.getItem('ariel_achievements_unlocked');
    if (saved) unlocked = new Set(JSON.parse(saved));
}
function saveUnlocked() { localStorage.setItem('ariel_achievements_unlocked', JSON.stringify([...unlocked])); }
function showAchievementToast(ach) {
    const toast = document.createElement('div');
    toast.className = 'achievement-toast';
    toast.innerHTML = `<div class="icon">${ach.icon}</div><div class="text"><div class="title">🎖️ 获得新成就！</div><div>${escapeHtml(ach.title)} - ${escapeHtml(ach.desc)}</div></div>`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}
function checkAchievements() {
    let newUnlocked = [];
    if (!unlocked.has('first_word') && wordBank.length >= 1) { unlocked.add('first_word'); newUnlocked.push(ACHIEVEMENTS.find(a => a.id === 'first_word')); }
    if (!unlocked.has('ten_words') && wordBank.length >= 10) { unlocked.add('ten_words'); newUnlocked.push(ACHIEVEMENTS.find(a => a.id === 'ten_words')); }
    if (!unlocked.has('fifty_words') && wordBank.length >= 50) { unlocked.add('fifty_words'); newUnlocked.push(ACHIEVEMENTS.find(a => a.id === 'fifty_words')); }
    if (!unlocked.has('perfect_rate_80')) {
        let totalCorr = 0, totalAtt = 0;
        for (let w of wordBank) if (w.attempts > 0) { totalAtt += w.attempts; totalCorr += (w.attempts - (w.wrongCount || 0)); }
        if (totalAtt > 0 && totalCorr / totalAtt >= 0.8) { unlocked.add('perfect_rate_80'); newUnlocked.push(ACHIEVEMENTS.find(a => a.id === 'perfect_rate_80')); }
    }
    if (!unlocked.has('ten_quiz')) {
        let totalAtt = 0; for (let w of wordBank) totalAtt += (w.attempts || 0);
        if (totalAtt >= 10) { unlocked.add('ten_quiz'); newUnlocked.push(ACHIEVEMENTS.find(a => a.id === 'ten_quiz')); }
    }
    if (!unlocked.has('ebbinghaus_master')) {
        if (wordBank.some(w => (w.reviewStage || 0) >= 6)) { unlocked.add('ebbinghaus_master'); newUnlocked.push(ACHIEVEMENTS.find(a => a.id === 'ebbinghaus_master')); }
    }
    if (!unlocked.has('first_correct')) {
        if (wordBank.some(w => (w.attempts - (w.wrongCount || 0)) > 0)) { unlocked.add('first_correct'); newUnlocked.push(ACHIEVEMENTS.find(a => a.id === 'first_correct')); }
    }
    if (newUnlocked.length) { saveUnlocked(); newUnlocked.forEach(ach => { if (ach) showAchievementToast(ach); }); }
}
function renderAchievements() {
    const container = document.getElementById('achievements-view');
    if (!container) return;
    const list = ACHIEVEMENTS.map(ach => {
        const isUnlocked = unlocked.has(ach.id);
        return `<div class="achievement-card ${isUnlocked ? '' : 'locked'}"><div class="icon">${ach.icon}</div><div class="info"><div class="title">${escapeHtml(ach.title)}</div><div class="desc">${escapeHtml(ach.desc)}</div><div class="progress">${isUnlocked ? '✅ 已获得' : '🔒 未解锁'}</div></div></div>`;
    }).join('');
    container.innerHTML = `<div class="section-header"><h2>🏆 我的成就</h2></div><div class="achievements-grid">${list}</div>`;
}

// ========== 公告加载 ==========
async function loadNotice() {
    try {
        const res = await fetch(`notice.json?t=${Date.now()}`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        const content = data.content || '';
        const noticeBar = document.getElementById('notice-bar');
        const noticeContent = document.getElementById('notice-content');
        if (noticeContent) noticeContent.innerHTML = content;
        if (noticeBar && content) noticeBar.classList.remove('hidden');
    } catch(e) { console.warn('公告加载失败'); }
}

// ========== 个人信息 + 导入导出 ==========
function renderProfile() {
    const main = document.getElementById('main-view');
    const nick = localStorage.getItem('ariels_nickname') || '';
    const avatar = localStorage.getItem('ariels_avatar') || '';
    let currentAvatar = avatar;
    main.innerHTML = `
        <div class="profile-container">
            <div class="avatar-section">
                <img id="avatar-img" src="${avatar || 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'%3E%3Ccircle cx=\'50\' cy=\'50\' r=\'50\' fill=\'%233b82f6\'/%3E%3Ctext x=\'50\' y=\'67\' font-size=\'50\' text-anchor=\'middle\' fill=\'white\'%3E❄️%3C/text%3E%3C/svg%3E'}" alt="头像">
                <input type="file" id="avatar-upload" accept="image/*">
                <button id="upload-avatar-btn" class="icon-btn">📷 上传头像</button>
            </div>
            <div class="nickname-section">
                <label>昵称：</label>
                <input type="text" id="nickname-input" placeholder="输入你的昵称" maxlength="20" value="${escapeHtml(nick)}">
                <button id="save-profile-btn" class="icon-btn">💾 保存</button>
            </div>
            <div class="data-actions">
                <button id="profile-export-btn" class="icon-btn">📤 导出记忆</button>
                <button id="profile-import-btn" class="icon-btn">📥 导入记忆</button>
                <button id="reset-all-data" class="icon-btn" style="background:#fee2e2;">⚠️ 全部重置</button>
            </div>
            <div class="stats-summary">
                <h3>📊 学习统计</h3>
                <div><b>${wordBank.length}</b> 总词条</div>
                <div><b>${wordBank.filter(w => w.mode === 'spell').length}</b> 默写词</div>
                <div><b>${wordBank.filter(w => w.mode === 'meaning').length}</b> 理解词</div>
            </div>
        </div>
    `;
    document.getElementById('upload-avatar-btn').onclick = () => document.getElementById('avatar-upload').click();
    document.getElementById('avatar-upload').onchange = e => {
        const file = e.target.files[0];
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = ev => { document.getElementById('avatar-img').src = ev.target.result; currentAvatar = ev.target.result; };
            reader.readAsDataURL(file);
        } else alert("请选择图片文件");
    };
    document.getElementById('save-profile-btn').onclick = () => {
        const nick = document.getElementById('nickname-input').value.trim();
        if (nick) localStorage.setItem('ariels_nickname', nick);
        else localStorage.removeItem('ariels_nickname');
        if (currentAvatar) localStorage.setItem('ariels_avatar', currentAvatar);
        alert("个人信息已保存");
    };
    document.getElementById('profile-export-btn').onclick = () => {
        const dataStr = JSON.stringify({ wordBank }, null, 2);
        const blob = new Blob([dataStr], {type:"application/json"});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ariels_backup_${getTodayStr()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        alert("✅ 导出成功");
    };
    document.getElementById('profile-import-btn').onclick = () => document.getElementById('import-file').click();
    document.getElementById('reset-all-data').onclick = () => {
        if (confirm("⚠️ 彻底重置所有数据（单词、成就、头像）？此操作不可恢复！")) {
            localStorage.clear();
            location.reload();
        }
    };
    document.getElementById('import-file').onchange = e => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = ev => {
                try {
                    const imported = JSON.parse(ev.target.result);
                    if (imported.wordBank && Array.isArray(imported.wordBank)) {
                        if (confirm("导入将覆盖当前数据，建议先导出备份。继续？")) {
                            wordBank = imported.wordBank;
                            saveData();
                            location.reload();
                        }
                    } else alert("文件格式错误");
                } catch(err) { alert("解析失败"); }
            };
            reader.readAsText(file);
        }
    };
}

// ========== 标签页切换 ==========
function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
    const main = document.getElementById('main-view');
    if (tab === 'understanding') {
        main.innerHTML = `
            <div class="section-header"><h2>📘 理解词库</h2><button id="add-understanding-btn" class="icon-btn">➕ 新单词</button></div>
            <div id="add-understanding-form" class="add-word-panel hidden">
                <h3>添加新单词（理解即可）</h3>
                <div class="form-row">
                    <input type="text" id="new-u-pos" placeholder="词性(如 n.)" autocomplete="off" style="width:100px;">
                    <input type="text" id="new-uci" placeholder="中文释义" autocomplete="off">
                    <input type="text" id="new-ueng" placeholder="英文单词" autocomplete="off">
                    <button id="auto-fetch-u" class="icon-small mini-btn" type="button">🤖 自动翻译+例句</button>
                    <button id="confirm-u-add" class="btn-primary">确认添加</button>
                    <button id="cancel-u-add" class="btn-secondary">取消</button>
                </div>
                <input type="hidden" id="temp-ex">
            </div>
            <div id="understanding-words-container" class="word-list-container"></div>
            <div class="section-header" style="margin-top:1rem;"><button id="import-excel-understanding" class="icon-btn">📂 从 Excel 导入（英文，中文）</button></div>
        `;
        document.getElementById('add-understanding-btn').onclick = () => document.getElementById('add-understanding-form').classList.remove('hidden');
        document.getElementById('confirm-u-add').onclick = addUnderstandingWord;
        document.getElementById('cancel-u-add').onclick = () => document.getElementById('add-understanding-form').classList.add('hidden');
        document.getElementById('auto-fetch-u').onclick = autoFillUnderstanding;
        document.getElementById('import-excel-understanding').onclick = () => importExcelTo('understanding');
        renderUnderstanding();
    } else if (tab === 'spelling') {
        main.innerHTML = `
            <div class="section-header"><h2>✍️ 默写词库</h2><button id="add-spelling-btn" class="icon-btn">➕ 新单词</button></div>
            <div id="add-spelling-form" class="add-word-panel hidden">
                <h3>添加新单词（需要默写）</h3>
                <div class="form-row">
                    <input type="text" id="new-sci" placeholder="中文释义" autocomplete="off">
                    <input type="text" id="new-seng" placeholder="英文单词" autocomplete="off">
                    <button id="auto-fetch-s" class="icon-small mini-btn" type="button">🤖 自动翻译+例句</button>
                    <button id="confirm-s-add" class="btn-primary">确认添加</button>
                    <button id="cancel-s-add" class="btn-secondary">取消</button>
                </div>
                <input type="hidden" id="temp-ex-spell">
            </div>
            <div id="spelling-words-container" class="word-list-container"></div>
            <div class="section-header" style="margin-top:1rem;"><button id="import-excel-spelling" class="icon-btn">📂 从 Excel 导入（英文，中文）</button></div>
        `;
        document.getElementById('add-spelling-btn').onclick = () => document.getElementById('add-spelling-form').classList.remove('hidden');
        document.getElementById('confirm-s-add').onclick = addSpellingWord;
        document.getElementById('cancel-s-add').onclick = () => document.getElementById('add-spelling-form').classList.add('hidden');
        document.getElementById('auto-fetch-s').onclick = autoFillSpelling;
        document.getElementById('import-excel-spelling').onclick = () => importExcelTo('spelling');
        renderSpelling();
    } else if (tab === 'quiz') {
        main.innerHTML = `
            <div class="group-selector">
                <button class="group-btn active" data-group="all">📚 全部</button>
                <button class="group-btn" data-group="high">💯 完美掌握</button>
                <button class="group-btn" data-group="medium">🔵 仍需巩固</button>
                <button class="group-btn" data-group="low">💪🏻 重点突破</button>
            </div>
            <div class="quiz-settings">
                <label><input type="checkbox" id="priority-wrong-checkbox" checked> 优先听写错词</label>
                <label><input type="checkbox" id="use-ebbinghaus-filter" checked> 📅 艾宾浩斯周期复习</label>
                <button id="refresh-quiz-list" class="icon-btn">🔄 刷新列表</button>
            </div>
            <div class="quiz-nav">
                <button id="prev-word-btn" class="nav-btn">◀</button>
                <span id="word-counter" class="word-counter">0/0</span>
                <button id="next-word-btn" class="nav-btn">▶</button>
            </div>
            <div id="quiz-card" class="quiz-card"><div class="empty-state">✨ 请在上方选择一个分组开始听写</div></div>
        `;
        renderQuizSettings();
        updateSpellList();
        startNewQuiz();
    } else if (tab === 'profile') {
        renderProfile();
    } else if (tab === 'achievements') {
        main.innerHTML = `<div id="achievements-view"></div>`;
        renderAchievements();
    }
}

// ========== 初始化系统 ==========
async function init() {
    loadData();
    loadUnlocked();
    await loadNotice();
    document.querySelectorAll('.tab-btn').forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));
    let clickCount = 0, timer = null;
    document.getElementById('clickable-title').addEventListener('click', () => {
        clickCount++;
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => { clickCount = 0; }, 1000);
        if (clickCount >= 5) {
            clickCount = 0;
            document.getElementById('admin-panel').style.display = 'block';
        }
    });
    document.getElementById('reset-storage').onclick = () => { if (confirm("重置所有数据？")) { localStorage.clear(); location.reload(); } };
    document.getElementById('close-admin').onclick = () => document.getElementById('admin-panel').style.display = 'none';
    subscribe(() => { if (currentTab === 'quiz' && spellWordList.length) startNewQuiz(); });
    updateSpellList();
    switchTab('understanding');
    checkAchievements();
}
init();