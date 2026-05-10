export async function loadNotice() {
    try {
        const res = await fetch(`/notice.json?t=${Date.now()}`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        const content = data.content || '';
        const noticeBar = document.getElementById('notice-bar');
        const noticeContent = document.getElementById('notice-content');
        const inviteNotice = document.getElementById('invite-notice');
        if (noticeContent) noticeContent.innerHTML = content;
        if (inviteNotice && content) inviteNotice.innerHTML = content;
        if (noticeBar && content) noticeBar.classList.remove('hidden');
    } catch(e) {
        console.warn('公告加载失败', e);
    }
}