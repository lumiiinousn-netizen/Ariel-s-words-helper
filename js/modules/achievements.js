import { escapeHtml } from './utils.js';

let ACHIEVEMENTS = [];
let unlockedSet = new Set();

async function loadAchievementsDef() {
    try {
        const res = await fetch('/data/achievements.json');
        if (res.ok) {
            ACHIEVEMENTS = await res.json();
            return;
        }
    } catch (e) {}
    // 内置默认成就
    ACHIEVEMENTS = [
        { id: "first_word", title: "初入词海", desc: "添加第一个单词", icon: "🎉" },
        { id: "ten_words", title: "十词起步", desc: "累计添加10个单词", icon: "📚" },
        { id: "fifty_words", title: "词汇达人", desc: "累计添加50个单词", icon: "🏅" },
        { id: "perfect_rate_80", title: "正确率80%", desc: "单词平均正确率≥80%", icon: "💯" },
        { id: "ten_quiz", title: "勤学苦练", desc: "完成10次听写", icon: "✍️" },
        { id: "ebbinghaus_master", title: "艾宾浩斯大师", desc: "完成一个单词的全部复习周期", icon: "🧠" },
        { id: "first_correct", title: "旗开得胜", desc: "第一次听写答对", icon: "⭐" }
    ];
}

function loadUnlocked() {
    const saved = localStorage.getItem('ariel_achievements_unlocked');
    if (saved) unlockedSet = new Set(JSON.parse(saved));
}

function saveUnlocked() {
    localStorage.setItem('ariel_achievements_unlocked', JSON.stringify([...unlockedSet]));
}

function showAchievementToast(ach) {
    const toast = document.createElement('div');
    toast.className = 'achievement-toast';
    toast.innerHTML = `<div class="icon">${ach.icon}</div><div class="text"><div class="title">🎖️ 获得新成就！</div><div>${escapeHtml(ach.title)} - ${escapeHtml(ach.desc)}</div></div>`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

export async function checkAndUnlockAchievements(db) {
    if (ACHIEVEMENTS.length === 0) {
        await loadAchievementsDef();
        loadUnlocked();
    }
    let newUnlocked = [];

    if (!unlockedSet.has('first_word') && db.wordBank.length >= 1) { unlockedSet.add('first_word'); newUnlocked.push(ACHIEVEMENTS.find(a => a.id === 'first_word')); }
    if (!unlockedSet.has('ten_words') && db.wordBank.length >= 10) { unlockedSet.add('ten_words'); newUnlocked.push(ACHIEVEMENTS.find(a => a.id === 'ten_words')); }
    if (!unlockedSet.has('fifty_words') && db.wordBank.length >= 50) { unlockedSet.add('fifty_words'); newUnlocked.push(ACHIEVEMENTS.find(a => a.id === 'fifty_words')); }
    if (!unlockedSet.has('perfect_rate_80')) {
        let totalCorrect = 0, totalAttempts = 0;
        for (let w of db.wordBank) {
            if (w.attempts > 0) { totalAttempts += w.attempts; totalCorrect += (w.attempts - (w.wrongCount || 0)); }
        }
        if (totalAttempts > 0 && totalCorrect / totalAttempts >= 0.8) { unlockedSet.add('perfect_rate_80'); newUnlocked.push(ACHIEVEMENTS.find(a => a.id === 'perfect_rate_80')); }
    }
    if (!unlockedSet.has('ten_quiz')) {
        let totalAttempts = 0;
        for (let w of db.wordBank) totalAttempts += (w.attempts || 0);
        if (totalAttempts >= 10) { unlockedSet.add('ten_quiz'); newUnlocked.push(ACHIEVEMENTS.find(a => a.id === 'ten_quiz')); }
    }
    if (!unlockedSet.has('ebbinghaus_master')) {
        if (db.wordBank.some(w => (w.reviewStage || 0) >= 6)) { unlockedSet.add('ebbinghaus_master'); newUnlocked.push(ACHIEVEMENTS.find(a => a.id === 'ebbinghaus_master')); }
    }
    if (!unlockedSet.has('first_correct')) {
        if (db.wordBank.some(w => (w.attempts - (w.wrongCount || 0)) > 0)) { unlockedSet.add('first_correct'); newUnlocked.push(ACHIEVEMENTS.find(a => a.id === 'first_correct')); }
    }
    if (newUnlocked.length) {
        saveUnlocked();
        newUnlocked.forEach(ach => { if (ach) showAchievementToast(ach); });
    }
}

export async function renderAchievementsTab(container) {
    if (ACHIEVEMENTS.length === 0) {
        await loadAchievementsDef();
        loadUnlocked();
    }
    const list = ACHIEVEMENTS.map(ach => {
        const unlocked = unlockedSet.has(ach.id);
        return `<div class="achievement-card ${unlocked ? '' : 'locked'}"><div class="icon">${ach.icon}</div><div class="info"><div class="title">${escapeHtml(ach.title)}</div><div class="desc">${escapeHtml(ach.desc)}</div><div class="progress">${unlocked ? '✅ 已获得' : '🔒 未解锁'}</div></div></div>`;
    }).join('');
    container.innerHTML = `<div class="section-header"><h2>🏆 我的成就</h2></div><div class="achievements-grid">${list}</div>`;
}

export async function initAchievements() {
    await loadAchievementsDef();
    loadUnlocked();
}