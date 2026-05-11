export async function loadNotice() {
    try {
        const res = await fetch(`/notice.json?t=${Date.now()}`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        const content = data.content || '';
        const noticeBar = document.getElementById('notice-bar');
        const noticeContent = document.getElementById('notice-content');
        if (noticeContent) noticeContent.innerHTML = content;
        if (noticeBar && content) noticeBar.classList.remove('hidden');
        else if (noticeBar) noticeBar.classList.add('hidden');
    } catch(e) {
        const noticeBar = document.getElementById('notice-bar');
        if (noticeBar) noticeBar.classList.add('hidden');
        console.warn('公告加载失败', e);
    }
}