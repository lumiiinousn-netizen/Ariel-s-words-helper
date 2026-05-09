import { AppState } from '../app.js';
import { escapeHtml, getTodayStr, speakEnglishWord, fetchTranslation, detectPartOfSpeech, fetchOxfordExample } from './utils.js';
import { updateSpellList, getWordAccuracy, getWordGroup, isDueForReview, updateReviewProgress } from './ebbinghaus.js';
import { checkAndUnlockAchievements } from './achievements.js';

function attachCardEvents(card, word) {
    const play = card.querySelector('.play-word-btn');
    if (play) play.onclick = (e) => { e.stopPropagation(); speakEnglishWord(word.english, AppState.currentAccent); };
    const inc = card.querySelector('.wrong-inc-btn');
    if (inc) inc.onclick = () => {
        word.wrongCount = (word.wrongCount || 0) + 1;
        word.attempts = (word.attempts || 0) + 1;
        updateReviewProgress(word, false);
        AppState.db.save();
        renderSpelling();
        updateSpellList();
        checkAndUnlockAchievements(AppState.db);
    };
    const del = card.querySelector('.delete-btn');
    if (del) del.onclick = () => {
        if (confirm(`删除单词“${word.english}”？`)) {
            const idx = AppState.db.wordBank.findIndex(w => w.id === word.id);
            if (idx !== -1) AppState.db.wordBank.splice(idx, 1);
            AppState.db.save();
            renderUnderstanding();
            renderSpelling();
            updateSpellList();
            checkAndUnlockAchievements(AppState.db);
        }
    };
}

export function renderUnderstanding() {
    const container = document.getElementById('understanding-words-container');
    if (!container) return;
    const words = AppState.db.wordBank.filter(w => w.mode === 'meaning');
    container.innerHTML = '';
    if (!words.length) {
        container.innerHTML = '<div class="empty-state">✨ 暂无了解词库单词，点击上方添加</div>';
        return;
    }
    words.forEach(word => {
        const card = document.createElement('div');
        card.className = 'word-card';
        const meta = word.pos ? `<span class="badge">${escapeHtml(word.pos)}</span>` : '';
        card.innerHTML = `
            <div class="word-info">
                <div class="word-english">${escapeHtml(word.english)}<button class="icon-small play-word-btn">🔊</button></div>
                <div class="word-chinese">${escapeHtml(word.chinese)}</div>
                ${word.example ? `<div class="example-box">📖 ${escapeHtml(word.example)}</div>` : ''}
                <div class="word-meta">${meta}<span class="badge">👁️ 了解</span></div>
            </div>
            <div class="word-actions"><button class="icon-small delete-btn">🗑️</button></div>
        `;
        container.appendChild(card);
        attachCardEvents(card, word);
    });
}

export function renderSpelling() {
    const container = document.getElementById('spelling-words-container');
    if (!container) return;
    const words = AppState.db.wordBank.filter(w => w.mode === 'spell');
    container.innerHTML = '';
    if (!words.length) {
        container.innerHTML = '<div class="empty-state">✨ 暂无默写单词，点击上方添加</div>';
        return;
    }
    words.forEach(word => {
        const acc = getWordAccuracy(word);
        const percent = word.attempts ? Math.round(acc * 100) : 100;
        let gClass = '', gIcon = '';
        if (acc >= 0.8) { gClass = 'high'; gIcon = '💯'; }
        else if (acc >= 0.6) { gClass = 'medium'; gIcon = '🔵'; }
        else { gClass = 'low'; gIcon = '💪🏻'; }
        const due = isDueForReview(word);
        const card = document.createElement('div');
        card.className = 'word-card';
        card.innerHTML = `
            <div class="word-info">
                <div class="word-english">${escapeHtml(word.english)}<button class="icon-small play-word-btn">🔊</button></div>
                <div class="word-chinese">${escapeHtml(word.chinese)}</div>
                ${word.example ? `<div class="example-box">📖 ${escapeHtml(word.example)}</div>` : ''}
                <div class="word-meta">
                    <span class="badge">✍️ 默写</span>
                    <span class="badge ${gClass}">${gIcon} ${percent}%</span>
                    ${word.wrongCount ? `<span class="badge wrong">❌ ${word.wrongCount}次</span>` : ''}
                    ${word.attempts ? `<span class="badge">🎧 ${word.attempts}次</span>` : ''}
                    ${due ? `<span class="badge due">📅待复习</span>` : ''}
                </div>
            </div>
            <div class="word-actions">
                <button class="icon-small wrong-inc-btn">🔁 +1错</button>
                <button class="icon-small delete-btn">🗑️</button>
            </div>
        `;
        container.appendChild(card);
        attachCardEvents(card, word);
    });
}

// 添加了解词库单词的 UI 控制
export function showAddUnderstandingForm() { document.getElementById('add-understanding-form').classList.remove('hidden'); }
export function hideAddUnderstandingForm() {
    document.getElementById('add-understanding-form').classList.add('hidden');
    document.getElementById('new-uci').value = '';
    document.getElementById('new-ueng').value = '';
    document.getElementById('new-u-pos').value = '';
    document.getElementById('temp-ex').value = '';
}
export async function autoFillUnderstanding() {
    const eng = document.getElementById('new-ueng');
    const posInput = document.getElementById('new-u-pos');
    const chiInput = document.getElementById('new-uci');
    const exampleInput = document.getElementById('temp-ex');
    const word = eng.value.trim();
    if (!word) { alert("请先输入英文单词"); eng.focus(); return; }
    posInput.placeholder = "检测中...";
    chiInput.placeholder = "翻译中...";
    const translation = await fetchTranslation(word);
    let example = null;
    if (translation) {
        let pos = detectPartOfSpeech(word);
        let finalChinese = translation;
        const posRegex = /^(n\.|adj\.|v\.|adv\.|prep\.|conj\.|pron\.)\s+/i;
        if (posRegex.test(finalChinese)) {
            const match = finalChinese.match(posRegex);
            if (match && !pos) pos = match[1].toLowerCase();
            finalChinese = finalChinese.replace(posRegex, '').trim();
        }
        posInput.value = pos || "";
        chiInput.value = finalChinese;
        example = await fetchOxfordExample(word);
        if (exampleInput) exampleInput.value = example || "";
    } else {
        alert("自动翻译失败，请手动输入");
        posInput.value = "";
        chiInput.value = "";
        if (exampleInput) exampleInput.value = "";
    }
    posInput.placeholder = "词性";
    chiInput.placeholder = "中文释义";
}
export function addUnderstandingWord() {
    const pos = document.getElementById('new-u-pos').value.trim();
    const ch = document.getElementById('new-uci').value.trim();
    const en = document.getElementById('new-ueng').value.trim();
    const example = document.getElementById('temp-ex').value.trim();
    if (!ch || !en) { alert("请完整填写英文和中文"); return; }
    if (AppState.db.wordBank.some(w => w.english.toLowerCase() === en.toLowerCase())) { alert("单词已存在"); return; }
    const fullChinese = pos ? `${pos} ${ch}` : ch;
    AppState.db.wordBank.push({
        id: Date.now(),
        chinese: fullChinese,
        english: en,
        mode: 'meaning',
        wrongCount: 0,
        attempts: 0,
        createdDate: getTodayStr(),
        pos: pos,
        example: example
    });
    AppState.db.save();
    hideAddUnderstandingForm();
    renderUnderstanding();
    checkAndUnlockAchievements(AppState.db);
}

// 添加默写词库单词的 UI 控制
export function showAddSpellingForm() { document.getElementById('add-spelling-form').classList.remove('hidden'); }
export function hideAddSpellingForm() {
    document.getElementById('add-spelling-form').classList.add('hidden');
    document.getElementById('new-sci').value = '';
    document.getElementById('new-seng').value = '';
    document.getElementById('temp-ex').value = '';
}
export async function autoFillSpelling() {
    const eng = document.getElementById('new-seng');
    const chi = document.getElementById('new-sci');
    const exampleInput = document.getElementById('temp-ex');
    const word = eng.value.trim();
    if (!word) { alert("请先输入英文单词"); eng.focus(); return; }
    chi.placeholder = "翻译中...";
    const translation = await fetchTranslation(word);
    let example = null;
    if (translation) {
        chi.value = translation;
        example = await fetchOxfordExample(word);
        if (exampleInput) exampleInput.value = example || "";
    } else {
        alert("翻译失败，请手动输入");
        chi.value = "";
        if (exampleInput) exampleInput.value = "";
    }
    chi.placeholder = "中文释义";
}
export function addSpellingWord() {
    const ch = document.getElementById('new-sci').value.trim();
    const en = document.getElementById('new-seng').value.trim();
    const example = document.getElementById('temp-ex').value.trim();
    if (!ch || !en) { alert("请完整填写中文和英文"); return; }
    if (AppState.db.wordBank.some(w => w.english.toLowerCase() === en.toLowerCase())) { alert("单词已存在"); return; }
    AppState.db.wordBank.push({
        id: Date.now(),
        chinese: ch,
        english: en,
        mode: 'spell',
        wrongCount: 0,
        attempts: 0,
        reviewStage: 0,
        lastReviewDate: null,
        createdDate: getTodayStr(),
        example: example
    });
    AppState.db.save();
    hideAddSpellingForm();
    renderSpelling();
    updateSpellList();
    checkAndUnlockAchievements(AppState.db);
}