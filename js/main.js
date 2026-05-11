import { AppState, setDB } from './app.js';
import { renderUnderstanding, renderSpelling, showAddUnderstandingForm, hideAddUnderstandingForm, autoFillUnderstanding, addUnderstandingWord, showAddSpellingForm, hideAddSpellingForm, autoFillSpelling, addSpellingWord, importExcelToUnderstanding, importExcelToSpelling } from './modules/wordbank.js';
import { updateSpellList, getWordGroup, getWordAccuracy, isDueForReview } from './modules/ebbinghaus.js';
import { startNewQuiz, setQuizNavCallbacks, updateQuizNav } from './modules/dictation.js';
import { renderProfileTab } from './modules/profile.js';
import { loadNotice } from './modules/notice.js';
import { renderAchievementsTab, checkAndUnlockAchievements, initAchievements } from './modules/achievements.js';
import { speakEnglishWord, exportData, importData, manualSave, formatReviewDate } from './modules/utils.js';

class Database {
    constructor() {
        this.wordBank = [];
        this.load();
    }
    load() {
        const saved = localStorage.getItem('ariel_words_data');
        if (saved) {
            const data = JSON.parse(saved);
            this.wordBank = data.wordBank || [];
        } else {
            this.wordBank = [];
        }
    }
    save() {
        localStorage.setItem('ariel_words_data', JSON.stringify({ wordBank: this.wordBank }));
    }
}

function renderApp() {
    const root = document.getElementById('app-root') || document.body;
    // 实际上页面已经静态写好，此函数可空，但保留结构
}

function bindEvents(db) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            switchTab(tab, db);
        });
    });

    // 管理员面板（连续点击标题5次）
    let clickCount = 0, clickTimer = null;
    const title = document.getElementById('clickable-title');
    if (title) {
        title.addEventListener('click', () => {
            clickCount++;
            if (clickTimer) clearTimeout(clickTimer);
            clickTimer = setTimeout(() => { clickCount = 0; }, 1000);
            if (clickCount >= 5) {
                clickCount = 0;
                document.getElementById('admin-panel').classList.toggle('show');
            }
        });
    }

    document.getElementById('reset-storage').onclick = () => {
        if (confirm("重置所有数据？")) {
            localStorage.clear();
            location.reload();
        }
    };
    document.getElementById('close-admin').onclick = () => document.getElementById('admin-panel').classList.remove('show');

    document.getElementById('close-notice-btn').addEventListener('click', () => {
        document.getElementById('notice-bar').classList.add('hidden');
    });

    // 导入导出
    document.getElementById('profile-export-btn')?.addEventListener('click', () => exportData(db));
    document.getElementById('profile-import-btn')?.addEventListener('click', () => document.getElementById('import-file').click());
    document.getElementById('import-file').addEventListener('change', (e) => {
        if (e.target.files.length) importData(e.target.files[0], db, () => location.reload());
        e.target.value = '';
    });

    // 听写导航回调
    if (typeof setQuizNavCallbacks === 'function') {
        setQuizNavCallbacks(
            () => { if (AppState.currentQuizIndex > 0) { AppState.currentQuizIndex--; startNewQuiz(); } },
            () => { if (AppState.currentQuizIndex < AppState.spellWordList.length - 1) { AppState.currentQuizIndex++; startNewQuiz(); } }
        );
    }
}

function switchTab(tab, db) {
    AppState.currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
    const main = document.getElementById('main-view');
    if (tab === 'understanding') {
        renderUnderstanding();
    } else if (tab === 'spelling') {
        renderSpelling();
    } else if (tab === 'quiz') {
        updateSpellList();
        startNewQuiz();
    } else if (tab === 'profile') {
        renderProfileTab(db);
    } else if (tab === 'achievements') {
        renderAchievementsTab(main);
    }
}

async function init() {
    const db = new Database();
    setDB(db);
    await loadNotice();
    bindEvents(db);
    AppState.subscribe(() => {
        updateSpellList();
        if (AppState.currentTab === 'quiz') startNewQuiz();
    });
    updateSpellList();
    switchTab('understanding', db);
    await initAchievements();
    checkAndUnlockAchievements(db);
}

init();