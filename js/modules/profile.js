// js/modules/profile.js
import { exportData, importData, manualSave, escapeHtml } from './utils.js';

let currentAvatarBase64 = null;

export function renderProfileTab(db) {
    const main = document.getElementById('main-view');
    const nick = localStorage.getItem('ariels_nickname') || '';
    const avatar = localStorage.getItem('ariels_avatar') || '';
    currentAvatarBase64 = avatar;

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
                <button id="profile-manual-save-btn" class="icon-btn">💿 手动保存</button>
            </div>
            <div class="stats-summary">
                <h3>📊 学习统计</h3>
                <div style="display:flex; justify-content:space-around; margin:20px 0;">
                    <div><b>${db.wordBank.length}</b><br><small>总词条</small></div>
                    <div><b>${db.wordBank.filter(w => w.mode === 'spell').length}</b><br><small>默写词</small></div>
                    <div><b>${db.wordBank.filter(w => w.mode === 'meaning').length}</b><br><small>了解词</small></div>
                </div>
            </div>
            <div class="info-note">
                <p>💡 提示：导出记忆会下载一个JSON文件，请妥善保管；导入记忆将覆盖当前所有单词数据，建议先导出备份。</p>
                <p style="margin-top:8px; color:red; font-size:10px; cursor:pointer;" onclick="if(confirm('清空所有数据？')){localStorage.clear();location.reload();}">彻底重置系统</p>
            </div>
        </div>
    `;

    // 绑定头像上传
    const uploadBtn = document.getElementById('upload-avatar-btn');
    const avatarInput = document.getElementById('avatar-upload');
    uploadBtn.onclick = () => avatarInput.click();
    avatarInput.onchange = (e) => {
        const file = e.target.files[0];
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const img = document.getElementById('avatar-img');
                img.src = ev.target.result;
                currentAvatarBase64 = ev.target.result;
                alert("头像已上传，记得点击保存");
            };
            reader.readAsDataURL(file);
        } else {
            alert("请选择图片文件");
        }
        avatarInput.value = '';
    };

    // 保存个人信息
    document.getElementById('save-profile-btn').onclick = () => {
        const nickInput = document.getElementById('nickname-input');
        const newNick = nickInput.value.trim();
        if (newNick) localStorage.setItem('ariels_nickname', newNick);
        else localStorage.removeItem('ariels_nickname');
        if (currentAvatarBase64) localStorage.setItem('ariels_avatar', currentAvatarBase64);
        else localStorage.removeItem('ariels_avatar');
        alert("个人信息已保存");
    };

    // 导出/导入/手动保存
    document.getElementById('profile-export-btn').onclick = () => exportData(db);
    document.getElementById('profile-import-btn').onclick = () => document.getElementById('import-file').click();
    document.getElementById('profile-manual-save-btn').onclick = () => manualSave(db);
}