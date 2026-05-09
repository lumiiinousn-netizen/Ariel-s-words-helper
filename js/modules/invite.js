// 后端 API 基础地址（Zeabur 部署后会自动处理）
const API_BASE = '/api';

// 验证邀请码（调用后端）
export async function verifyInviteCode(code) {
    try {
        const response = await fetch(`${API_BASE}/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code })
        });
        const data = await response.json();
        if (response.ok && data.success) {
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

// 检查是否已验证（本地存储）
export function isInviteVerified() {
    return localStorage.getItem('invite_verified') === 'true' ||
           sessionStorage.getItem('invite_verified') === 'true';
}

// 生成邀请码（管理员，需要 adminKey）
export async function generateInviteCodes(count, adminKey) {
    const response = await fetch(`${API_BASE}/generate`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Admin-Key': adminKey
        },
        body: JSON.stringify({ count })
    });
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || '生成失败');
    }
    const data = await response.json();
    return data.codes;
}

// 获取邀请码列表（管理员）
export async function getInviteList(adminKey) {
    const response = await fetch(`${API_BASE}/list`, {
        headers: { 'X-Admin-Key': adminKey }
    });
    if (!response.ok) throw new Error('获取失败');
    return response.json();
}

// 删除邀请码（管理员）
export async function deleteInviteCode(code, adminKey) {
    const response = await fetch(`${API_BASE}/delete`, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
            'X-Admin-Key': adminKey
        },
        body: JSON.stringify({ code })
    });
    return response.ok;
}