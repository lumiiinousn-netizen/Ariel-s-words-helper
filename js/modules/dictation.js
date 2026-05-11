import { AppState } from '../app.js';
import { speakEnglishWord, escapeHtml, formatReviewDate } from './utils.js';
import { updateReviewProgress, getWordAccuracy, updateSpellList } from './ebbinghaus.js';
import { checkAndUnlockAchievements } from './achievements.js';

let quizStartTime = 0;
let currentWord = null;
let prevCallback = null;
let nextCallback = null;

export function setQuizNavCallbacks(prev, next) {
    prevCallback = prev;
    nextCallback = next;
}

export function updateQuizNav() {
    const total = AppState.spellWordList.length;
    const counter = document.getElementById('word-counter');
    if (counter) counter.textContent = total ? `${AppState.currentQuizIndex + 1}/${total}` : `0/0`;
    const prevBtn = document.getElementById('prev-word-btn');
    const nextBtn = document.getElementById('next-word-btn');
    if (prevBtn && nextBtn) {
        prevBtn.disabled = total === 0 || AppState.currentQuizIndex === 0;
        nextBtn.disabled = total === 0 || AppState.currentQuizIndex === total - 1;
    }
}

export function startNewQuiz() {
    updateSpellList();
    const container = document.getElementById('quiz-card');
    if (!AppState.spellWordList.length) {
        container.innerHTML = '<div class="empty-state">当前分组暂无单词</div>';
        updateQuizNav();
        return;
    }
    const word = AppState.spellWordList[AppState.currentQuizIndex];
    currentWord = word;
    quizStartTime = Date.now();

    container.innerHTML = `
        <div class="quiz-word">📖 ${escapeHtml(word.chinese)}</div>
        <div class="quiz-hint">🔊 点击喇叭听发音，输入英文</div>
        <div class="quiz-input-area">
            <input type="text" id="quiz-answer-input" placeholder="请输入英文" autocomplete="off">
            <button id="play-quiz-sound" class="play-btn">🔊 朗读单词</button>
            <button id="submit-answer-btn" class="btn-primary">✍️ 提交答案</button>
        </div>
        <div id="quiz-feedback" class="quiz-feedback"></div>
        <div id="quiz-result" class="quiz-result-card" style="display:none;"></div>
    `;

    document.getElementById('play-quiz-sound').onclick = () => speakEnglishWord(word.english, AppState.currentAccent);
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
    updateReviewProgress(word, isCorrect);
    AppState.db.save();

    checkAndUnlockAchievements(AppState.db);

    const feedbackDiv = document.getElementById('quiz-feedback');
    feedbackDiv.innerHTML = isCorrect ? '✅ 正确！' : `❌ 错误！正确答案: ${word.english}`;
    feedbackDiv.style.color = isCorrect ? 'green' : '#b91c1c';

    const accuracyPercent = Math.round(getWordAccuracy(word) * 100);
    const nextReview = word.nextTime ? formatReviewDate(word.nextTime) : '已完成';
    const exampleHtml = word.example ? `<div class="example-box" style="margin-top:12px;">📖 例句：${escapeHtml(word.example)}</div>` : '';

    const resultDiv = document.getElementById('quiz-result');
    resultDiv.style.display = 'block';
    resultDiv.innerHTML = `
        <div class="stat-row"><span>⏱️ 本次用时</span><span>${elapsed.toFixed(1)} 秒</span></div>
        <div class="stat-row"><span>📅 下次复习</span><span>${nextReview}</span></div>
        <div class="stat-row"><span>📊 单词正确率</span><span>${accuracyPercent}% (基于${word.attempts}次练习)</span></div>
        ${exampleHtml}
        <div class="mnemonic-area">
            <label>🧠 记忆口诀/联想：</label>
            <textarea id="word-mnemonic" placeholder="例如：他日他哥 → heritage 遗产..." rows="2">${word.mnemonic || ''}</textarea>
            <button id="save-mnemonic-btn" class="icon-small" style="margin-top:8px;">💾 保存</button>
        </div>
    `;
    document.getElementById('save-mnemonic-btn').onclick = () => {
        const newMnemonic = document.getElementById('word-mnemonic').value.trim();
        word.mnemonic = newMnemonic;
        AppState.db.save();
        alert('记忆口诀已保存');
    };

    setTimeout(() => {
        if (AppState.currentQuizIndex + 1 < AppState.spellWordList.length) {
            AppState.currentQuizIndex++;
            startNewQuiz();
        } else if (AppState.currentQuizIndex + 1 === AppState.spellWordList.length) {
            document.getElementById('quiz-card').innerHTML = '<div class="empty-state">🎉 恭喜！当前分组所有单词已完成复习！</div>';
            updateQuizNav();
        } else {
            updateQuizNav();
        }
    }, 2000);
}