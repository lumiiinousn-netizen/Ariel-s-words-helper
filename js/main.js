import { verifyInviteCode, isInviteVerified } from './modules/invite.js';
import { loadNotice } from './modules/notice.js';

async function init() {
    await loadNotice();

    const urlParams = new URLSearchParams(window.location.search);
    const codeParam = urlParams.get('code');
    if (codeParam && await verifyInviteCode(codeParam)) {
        // 自动验证成功，刷新页面使状态生效
        location.reload();
        return;
    }

    if (isInviteVerified()) {
        // 已验证，显示主界面（暂时只显示欢迎信息）
        document.getElementById('invite-overlay').style.display = 'none';
        document.getElementById('app-container').style.display = 'flex';
        document.getElementById('main-view').innerHTML = '<div style="text-align:center; padding:2rem;">✅ 验证成功！后续将逐步添加单词库等功能。</div>';
    } else {
        // 未验证，绑定验证按钮事件
        const submitBtn = document.getElementById('submit-invite-btn');
        const inputEl = document.getElementById('invite-code-input');
        const errorDiv = document.getElementById('invite-error');
        submitBtn.onclick = async () => {
            const code = inputEl.value.trim();
            if (await verifyInviteCode(code)) {
                location.reload();
            } else {
                errorDiv.style.display = 'block';
                setTimeout(() => errorDiv.style.display = 'none', 2000);
            }
        };
    }
}

init();