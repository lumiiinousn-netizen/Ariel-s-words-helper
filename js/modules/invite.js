// ========== 邀请码模块 ==========
// 后端 API 基础地址（与前端同源，使用相对路径）
const API_BASE = '/api';

// 本地存储的 key
const STORAGE_KEYS = {
    INVITE_VERIFIED: 'invite_verified',
    ADMIN_PASSWORD_HASH: 'admin_password_hash'
};

// ========== 工具函数 ==========
function simpleHash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
        h = ((h << 5) - h) + str.charCodeAt(i);
        h |= 0;
    }
    return h.toString();
}

// ========== 邀请码验证相关 ==========
// 调用后端验证邀请码（一次性）
export async function verifyInviteCode(code) {
    try {
        const response = await fetch(`${API_BASE}/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code })
        });
        const data = await response.json();
        if (response.ok && data.success) {
            // 验证成功，存储验证状态（本地和会话）
            localStorage.setItem(STORAGE_KEYS.INVITE_VERIFIED, 'true');
            sessionStorage.setItem(STORAGE_KEYS.INVITE_VERIFIED, 'true');
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

// 检查当前设备是否已验证过（从本地存储读取）
export function isInviteVerified() {
    return localStorage.getItem(STORAGE_KEYS.INVITE_VERIFIED) === 'true' ||
           sessionStorage.getItem(STORAGE_KEYS.INVITE_VERIFIED) === 'true';
}

// 重置邀请码存储（清除本地验证状态和邀请码列表，注意：此操作不会影响后端数据库）
export function resetInviteStorage() {
    if (confirm("⚠️ 重置邀请码存储会清除本地验证状态和本地缓存的邀请码列表。\n（后端数据库中的邀请码不受影响）确认吗？")) {
        localStorage.removeItem(STORAGE_KEYS.INVITE_VERIFIED);
        sessionStorage.removeItem(STORAGE_KEYS.INVITE_VERIFIED);
        localStorage.removeItem('invite_valid_codes');   // 清除本地缓存的有效码列表（如果有）
        localStorage.removeItem('invite_used_codes');    // 清除本地缓存的已用码列表
        alert("已重置，请刷新页面。");
        location.reload();
    }
}

// ========== 管理员密码（本地存储哈希，用于前端管理面板验证） ==========
// 注意：后端 Admin 操作需要请求头 X-Admin-Key 中的明文密码，请确保与后端 ADMIN_KEY 环境变量一致。
export function isAdminPasswordSet() {
    return localStorage.getItem(STORAGE_KEYS.ADMIN_PASSWORD_HASH) !== null;
}

// 验证管理员密码（首次设置则保存哈希）
export function verifyAdminPassword(pwd) {
    const storedHash = localStorage.getItem(STORAGE_KEYS.ADMIN_PASSWORD_HASH);
    if (!storedHash) {
        // 首次使用：存储哈希（用户输入的密码应与后端 ADMIN_KEY 一致）
        const hash = simpleHash(pwd);
        localStorage.setItem(STORAGE_KEYS.ADMIN_PASSWORD_HASH, hash);
        return true;
    }
    return simpleHash(pwd) === storedHash;
}

// ========== 邀请码管理 API（需要管理员密码） ==========
// 生成新邀请码（管理员）
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
    return data.codes;   // 字符串数组
}

// 获取邀请码列表（有效和已使用）
export async function getInviteList(adminKey) {
    const response = await fetch(`${API_BASE}/list`, {
        headers: { 'X-Admin-Key': adminKey }
    });
    if (!response.ok) throw new Error('获取列表失败');
    const data = await response.json();
    // 返回格式: { valid: [{code, created_at}], used: [{code, used_at}] }
    return data;
}

// 删除有效邀请码（管理员）
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

// ========== 以下为兼容旧版本本地存储的辅助函数（已废弃，但可能被其他模块引用） ==========
// 加载本地邀请码列表数据（仅用于向后兼容，新项目不应该再使用本地存储管理邀请码）
export function loadInviteData() {
    // 此函数仅为兼容，实际已不再使用本地存储的邀请码列表
    console.warn('loadInviteData 已废弃，请使用后端 API');
}

// 获取有效邀请码列表（本地缓存版，不再使用）
export function getValidInviteCodes() {
    return [];
}

// 获取已使用邀请码列表（本地缓存版）
export function getUsedInviteCodes() {
    return [];
}