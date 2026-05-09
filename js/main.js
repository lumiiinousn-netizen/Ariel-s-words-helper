import { AppState, setDB } from './app.js';
import { loadInviteData, verifyInviteCode, isInviteVerified, generateInviteCodes, isAdminPasswordSet, verifyAdminPassword, resetInviteStorage, getInviteList, deleteInviteCode } from './modules/invite.js';
import { renderUnderstanding, renderSpelling, showAddUnderstandingForm, hideAddUnderstandingForm, autoFillUnderstanding, addUnderstandingWord, showAddSpellingForm, hideAddSpellingForm, autoFillSpelling, addSpellingWord } from './modules/wordbank.js';
import { updateSpellList, getWordGroup, getWordAccuracy, isDueForReview } from './modules/ebbinghaus.js';
import { startNewQuiz, setQuizNavCallbacks, updateQuizNav } from './modules/dictation.js';
import { renderProfileTab } from './modules/profile.js';
import { loadNotice } from './modules/notice.js';
import { renderAchievementsTab, checkAndUnlockAchievements } from './modules/achievements.js';
import { speakEnglishWord, exportData, importData, manualSave, formatReviewDate } from './modules/utils.js';

// 数据库类
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
            this.isLoggedIn = data.isLoggedIn || false;
        } else {
            this.wordBank = [];
            this.isLoggedIn = false;
        }
    }
    save() {
        localStorage.setItem('ariel_words_data', JSON.stringify({
            wordBank: this.wordBank,
            isLoggedIn: this.isLoggedIn
        }));
    }
}

// 渲染整个UI（静态结构）
function renderApp() {
    const root = document.getElementById('app-root');
    root.innerHTML = `
        <div id="invite-overlay" class="invite-overlay" style="display:flex;">
            <div class="invite-card">
                <h2>🔐 邀请码验证</h2>
                <div id="invite-notice" class="invite-notice">✨ 正在加载公告...</div>
                <div class="admin-contact-tip">📧 请向管理员申请邀请码</div>
                <p>请输入邀请码以继续使用</p>
                <input type="text" id="invite-code-input" placeholder="例如: WELCOME-2025" autocomplete="off">
                <button id="submit-invite-btn" class="btn-primary">验证</button>
                <div id="invite-error" class="error-msg" style="display:none;">邀请码无效或已使用</div>
                <button id="reset-storage-btn" style="margin-top:1rem; background:#dc2626; color:white; border:none; padding:0.5rem 1rem; border-radius:2rem;">⚠️ 重置存储</button>
            </div>
        </div>
        <div id="app-container" class="app-container" style="display:none;">
            <div id="notice-bar" class="notice-bar hidden">
                <div class="notice-content" id="notice-content"></div>
                <button id="close-notice-btn" class="notice-close">✖</button>
            </div>
            <header>
                <h1 id="clickable-title">❄️ Ariel's Words Helper ❄️</h1>
                <div class="tab-bar">
                    <button class="tab-btn active" data-tab="understanding">📖 了解词库</button>
                    <button class="tab-btn" data-tab="spelling">✍️ 默写词库</button>
                    <button class="tab-btn" data-tab="quiz">🎧 听写练习</button>
                    <button class="tab-btn" data-tab="profile">👤 我的</button>
                    <button class="tab-btn" data-tab="achievements">🏆 成就</button>
                </div>
            </header>
            <main id="main-view" class="content-container"></main>
        </div>
        <div id="admin-panel" class="admin-panel" style="display:none;">
            <h4>🔑 邀请码管理</h4>
            <div id="admin-codes-list"></div>
            <div style="margin-top:8px;">
                <button id="gen1-code">生成1个</button>
                <button id="gen5-code">生成5个</button>
                <button id="refresh-codes">刷新列表</button>
                <button id="reset-storage">重置存储</button>
                <button id="close-admin">关闭</button>
            </div>
        </div>
        <audio id="tts-audio" style="display:none;"></audio>
        <input type="file" id="import-file" style="display:none" accept=".json">
    `;
}

// 管理面板刷新（调用后端API）
async function refreshAdminPanel(adminKey) {
    const container = document.getElementById('admin-codes-list');
    if (!container) return;
    try {
        const { valid, used } = await getInviteList(adminKey);
        container.innerHTML = `
            <div><strong>✅ 有效 (${valid.length}):</strong></div>
            ${valid.map(code => `
                <div style="margin:4px 0; display:flex; justify-content:space-between; align-items:center;">
                    <span>${code.code}</span>
                    <div>
                        <button class="copy-code-btn" data-code="${code.code}" style="font-size:10px;">复制链接</button>
                        <button class="delete-code-btn" data-code="${code.code}" style="font-size:10px; background:#dc2626; color:white; border:none; border-radius:1rem; padding:0.2rem 0.5rem;">删除</button>
                    </div>
                </div>
            `).join('')}
            <div style="margin-top:8px;"><strong>❌ 已使用 (${used.length}):</strong></div>
            ${used.map(item => `<div style="color:#94a3b8;">${item.code}</div>`).join('')}
        `;

        // 绑定复制链接按钮
        document.querySelectorAll('.copy-code-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const code = btn.dataset.code;
                const link = `${location.origin}${location.pathname}?code=${code}`;
                navigator.clipboard.writeText(link);
                alert("链接已复制，可发送给朋友");
            });
        });

        // 绑定删除按钮
        document.querySelectorAll('.delete-code-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const code = btn.dataset.code;
                if (confirm(`确定要删除邀请码 ${code} 吗？\n该码将立即失效。`)) {
                    await deleteInviteCode(code, adminKey);
                    refreshAdminPanel(adminKey);
                }
            });
        });
    } catch (err) {
        console.error(err);
        container.innerHTML = '<div>加载失败，请检查网络或后端服务</div>';
    }
}

// 事件绑定
function bindEvents(db) {
    // 标签切换
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            switchTab(tab, db);
        });
    });

    // 管理员面板：连续点击标题5次
    let clickCount = 0, clickTimer = null;
    const title = document.getElementById('clickable-title');
    title.addEventListener('click', () => {
        clickCount++;
        if (clickTimer) clearTimeout(clickTimer);
        clickTimer = setTimeout(() => { clickCount = 0; }, 1000);
        if (clickCount >= 5) {
            clickCount = 0;
            if (isAdminPasswordSet()) {
                const pwd = prompt("请输入管理员密码：");
                if (pwd && verifyAdminPassword(pwd)) {
                    document.getElementById('admin-panel').classList.add('show');
                    refreshAdminPanel(pwd);
                } else {
                    alert("密码错误");
                }
            } else {
                const newPwd = prompt("首次使用，请设置管理员密码：");
                if (newPwd && newPwd.trim()) {
                    verifyAdminPassword(newPwd);
                    alert("管理员密码已设置");
                    document.getElementById('admin-panel').classList.add('show');
                    refreshAdminPanel(newPwd);
                } else {
                    alert("必须设置密码");
                }
            }
        }
    });

    // 管理员面板内部按钮
    const adminKey = localStorage.getItem('admin_password_hash'); // 实际是哈希，不能直接用。应该用用户输入的密码。
    // 但在生成/删除操作中，我们需要用户输入的密码（即上述验证成功后的pwd）。所以生成/删除操作应动态获取密码。
    // 更好的做法：在每次生成/删除时重新询问密码。或者将密码存储为全局变量。
    let currentAdminKey = null;

    const getAdminKey = () => {
        if (currentAdminKey) return currentAdminKey;
        const key = prompt("请输入管理员密码：");
        if (key && verifyAdminPassword(key)) {
            currentAdminKey = key;
            return key;
        }
        return null;
    };

    document.getElementById('gen1-code').onclick = async () => {
        const key = getAdminKey();
        if (!key) return;
        const codes = await generateInviteCodes(1, key);
        alert(`生成邀请码: ${codes[0]}\n链接: ${location.origin}${location.pathname}?code=${codes[0]}`);
        if (currentAdminKey) refreshAdminPanel(currentAdminKey);
    };
    document.getElementById('gen5-code').onclick = async () => {
        const key = getAdminKey();
        if (!key) return;
        const codes = await generateInviteCodes(5, key);
        alert(`生成邀请码:\n${codes.join('\n')}\n\n对应链接:\n${codes.map(c => `${location.origin}${location.pathname}?code=${c}`).join('\n')}`);
        if (currentAdminKey) refreshAdminPanel(currentAdminKey);
    };
    document.getElementById('refresh-codes').onclick = async () => {
        const key = getAdminKey();
        if (key && currentAdminKey) refreshAdminPanel(currentAdminKey);
    };
    document.getElementById('reset-storage').onclick = () => resetInviteStorage();
    document.getElementById('close-admin').onclick = () => document.getElementById('admin-panel').classList.remove('show');

    // 公告关闭
    document.getElementById('close-notice-btn').addEventListener('click', () => {
        document.getElementById('notice-bar').classList.add('hidden');
    });

    // 导出/导入/手动保存
    document.getElementById('profile-export-btn')?.addEventListener('click', () => exportData(db));
    document.getElementById('profile-import-btn')?.addEventListener('click', () => document.getElementById('import-file').click());
    document.getElementById('profile-manual-save-btn')?.addEventListener('click', () => manualSave(db));
    document.getElementById('import-file').addEventListener('change', (e) => {
        if (e.target.files.length) importData(e.target.files[0], db, () => location.reload());
        e.target.value = '';
    });

    // 听写导航
    if (typeof setQuizNavCallbacks === 'function') {
        setQuizNavCallbacks(
            () => {
                if (AppState.currentQuizIndex > 0) {
                    AppState.currentQuizIndex--;
                    startNewQuiz();
                }
            },
            () => {
                if (AppState.currentQuizIndex < AppState.spellWordList.length - 1) {
                    AppState.currentQuizIndex++;
                    startNewQuiz();
                }
            }
        );
    }
}

function switchTab(tab, db) {
    AppState.currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });
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

// 启动应用
async function init() {
    renderApp();
    const db = new Database();
    setDB(db);
    loadInviteData();
    const urlParams = new URLSearchParams(window.location.search);
    const codeParam = urlParams.get('code');
    if (codeParam && await verifyInviteCode(codeParam)) {
        db.isLoggedIn = true;
        db.save();
    }
    if (db.isLoggedIn) {
        document.getElementById('invite-overlay').style.display = 'none';
        document.getElementById('app-container').style.display = 'flex';
        await loadNotice();
        bindEvents(db);
        AppState.subscribe(() => {
            updateSpellList();
            if (AppState.currentTab === 'quiz') startNewQuiz();
        });
        updateSpellList();
        switchTab('understanding', db);
        checkAndUnlockAchievements(db);
    } else {
        // 绑定邀请码验证按钮
        const submitBtn = document.getElementById('submit-invite-btn');
        const inputEl = document.getElementById('invite-code-input');
        const errorDiv = document.getElementById('invite-error');
        const resetStorageBtn = document.getElementById('reset-storage-btn');
        submitBtn.onclick = async () => {
            const code = inputEl.value.trim();
            if (await verifyInviteCode(code)) {
                db.isLoggedIn = true;
                db.save();
                location.reload();
            } else {
                errorDiv.style.display = 'block';
                setTimeout(() => errorDiv.style.display = 'none', 2000);
            }
        };
        resetStorageBtn.onclick = () => resetInviteStorage();
        // 加载邀请码界面的公告
        try {
            const res = await fetch(`notice.json?t=${Date.now()}`);
            const data = await res.json();
            const inviteNotice = document.getElementById('invite-notice');
            if (inviteNotice && data.content) inviteNotice.innerHTML = data.content;
        } catch (e) {}
    }
}

init();