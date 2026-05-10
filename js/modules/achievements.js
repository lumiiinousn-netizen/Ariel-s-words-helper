// ========== 成就系统模块 ==========
import { escapeHtml } from './utils.js';

// 成就定义（优先从 JSON 加载，失败则使用内置）
let ACHIEVEMENTS = [];

// 已解锁的成就 ID 集合
let unlockedSet = new Set();

// 加载成就定义
async function loadAchievementsDef() {
    try {
        const res = await fetch('/data/achievements.json');
        if (res.ok) {
            ACHIEVEMENTS = await res.json();
            return;
        }
    } catch (e) {
        console.warn('从文件加载成就失败，使用内置成就');
    }
    // 内置成就（与您的 JSON 保持一致）
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

// 从本地存储加载已解锁成就
function loadUnlocked() {
    const saved = localStorage.getItem('ariel_achievements_unlocked');
    if (saved) {
        try {
            unlockedSet = new Set(JSON.parse(saved));
        } catch(e) {}
    }
}

// 保存已解锁成就
function saveUnlocked() {
    localStorage.setItem('ariel_achievements_unlocked', JSON.stringify([...unlockedSet]));
}

// 显示成就弹窗
function showAchievementToast(ach) {
    const toast = document.createElement('div');
    toast.className = 'achievement-toast';
    toast.innerHTML = `
        <div class="icon">${ach.icon}</div>
        <div class="text">
            <div class="title">🎖️ 获得新成就！</div>
            <div>${escapeHtml(ach.title)} - ${escapeHtml(ach.desc)}</div>
        </div>
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// 检查并解锁新成就
export async function checkAndUnlockAchievements(db) {
    // 确保成就定义已加载
    if (ACHIEVEMENTS.length === 0) {
        await loadAchievementsDef();
        loadUnlocked();
    }
    let newUnlocked = [];

    // 1. 初入词海
    if (!unlockedSet.has('first_word') && db.wordBank.length >= 1) {
        unlockedSet.add('first_word');
        newUnlocked.push(ACHIEVEMENTS.find(a => a.id === 'first_word'));
    }

    // 2. 十词起步
    if (!unlockedSet.has('ten_words') && db.wordBank.length >= 10) {
        unlockedSet.add('ten_words');
        newUnlocked.push(ACHIEVEMENTS.find(a => a.id === 'ten_words'));
    }

    // 3. 词汇达人
    if (!unlockedSet.has('fifty_words') && db.wordBank.length >= 50) {
        unlockedSet.add('fifty_words');
        newUnlocked.push(ACHIEVEMENTS.find(a => a.id === 'fifty_words'));
    }

    // 4. 正确率80%
    if (!unlockedSet.has('perfect_rate_80')) {
        let totalCorrect = 0, totalAttempts = 0;
        for (let w of db.wordBank) {
            if (w.attempts > 0) {
                totalAttempts += w.attempts;
                totalCorrect += (w.attempts - (w.wrongCount || 0));
            }
        }
        const avgRate = totalAttempts > 0 ? totalCorrect / totalAttempts : 0;
        if (avgRate >= 0.8) {
            unlockedSet.add('perfect_rate_80');
            newUnlocked.push(ACHIEVEMENTS.find(a => a.id === 'perfect_rate_80'));
        }
    }

    // 5. 勤学苦练（完成10次听写 = 至少10次尝试？这里统计所有单词的 attempts 总和）
    if (!unlockedSet.has('ten_quiz')) {
        let totalAttempts = 0;
        for (let w of db.wordBank) totalAttempts += (w.attempts || 0);
        if (totalAttempts >= 10) {
            unlockedSet.add('ten_quiz');
            newUnlocked.push(ACHIEVEMENTS.find(a => a.id === 'ten_quiz'));
        }
    }

    // 6. 艾宾浩斯大师（任意单词 reviewStage >= 6）
    if (!unlockedSet.has('ebbinghaus_master')) {
        const hasMaster = db.wordBank.some(w => (w.reviewStage || 0) >= 6);
        if (hasMaster) {
            unlockedSet.add('ebbinghaus_master');
            newUnlocked.push(ACHIEVEMENTS.find(a => a.id === 'ebbinghaus_master'));
        }
    }

    // 7. 旗开得胜（第一次听写答对：通过标志位存储）
    if (!unlockedSet.has('first_correct')) {
        // 检查是否存在任何一次正确的记录？简单做法：检查是否有单词被正确答对过（attempts - wrongCount > 0）
        // 但更准确：有某次提交正确。这里如果有任何单词正确次数大于0，即认为已达成。
        const hasCorrect = db.wordBank.some(w => (w.attempts - (w.wrongCount || 0)) > 0);
        if (hasCorrect) {
            unlockedSet.add('first_correct');
            newUnlocked.push(ACHIEVEMENTS.find(a => a.id === 'first_correct'));
        }
    }

    if (newUnlocked.length) {
        saveUnlocked();
        newUnlocked.forEach(ach => {
            if (ach) showAchievementToast(ach);
        });
    }
}

// 渲染成就展示页面
export async function renderAchievementsTab(container) {
    if (ACHIEVEMENTS.length === 0) {
        await loadAchievementsDef();
        loadUnlocked();
    }
    const list = ACHIEVEMENTS.map(ach => {
        const unlocked = unlockedSet.has(ach.id);
        return `
            <div class="achievement-card ${unlocked ? '' : 'locked'}">
                <div class="icon">${ach.icon}</div>
                <div class="info">
                    <div class="title">${escapeHtml(ach.title)}</div>
                    <div class="desc">${escapeHtml(ach.desc)}</div>
                    <div class="progress">${unlocked ? '✅ 已获得' : '🔒 未解锁'}</div>
                </div>
            </div>
        `;
    }).join('');
    container.innerHTML = `
        <div class="section-header"><h2>🏆 我的成就</h2></div>
        <div class="achievements-grid">
            ${list}
        </div>
    `;
}

// 初始化（在应用启动时调用，加载定义和已解锁记录）
export async function initAchievements() {
    await loadAchievementsDef();
    loadUnlocked();
}