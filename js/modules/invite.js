const API_BASE = '/api';

export async function verifyInviteCode(code) {
    try {
        const res = await fetch(`${API_BASE}/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code })
        });
        const data = await res.json();
        if (res.ok && data.success === true) {
            localStorage.setItem('invite_verified', 'true');
            sessionStorage.setItem('invite_verified', 'true');
            return true;
        } else {
            console.error('验证失败:', data.error);
            return false;
        }
    } catch (err) {
        console.error('网络错误:', err);
        return false;
    }
}

export function isInviteVerified() {
    return localStorage.getItem('invite_verified') === 'true' ||
           sessionStorage.getItem('invite_verified') === 'true';
}