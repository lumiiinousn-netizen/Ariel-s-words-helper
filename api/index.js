import express from 'express';
import { createClient } from '@supabase/supabase-js';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// 静态文件托管（可选，Vercel 会自动处理静态文件，但这里也可以保留）
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.join(__dirname, '..')));

// Supabase 客户端（使用 service_role 密钥，拥有完全权限）
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

function generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
        if (i === 3) code += '-';
    }
    return code;
}

// ========== API 路由 ==========

// 1. 验证邀请码（一次性）
app.post('/api/verify', async (req, res) => {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: '邀请码不能为空' });

    const { data, error } = await supabase
        .from('invite_codes')
        .update({ used: true, used_at: new Date().toISOString() })
        .eq('code', code.trim().toUpperCase())
        .eq('used', false)
        .select();

    if (error || !data || data.length === 0) {
        return res.status(400).json({ error: '邀请码无效或已使用' });
    }
    res.json({ success: true });
});

// 2. 生成新邀请码（需要管理员密钥）
app.post('/api/generate', async (req, res) => {
    const adminKey = req.headers['x-admin-key'];
    if (adminKey !== process.env.ADMIN_KEY) {
        return res.status(403).json({ error: '无权限' });
    }
    const { count = 1 } = req.body;
    const codes = [];
    for (let i = 0; i < count; i++) {
        let newCode = generateCode();
        let exists = true;
        while (exists) {
            const { data } = await supabase
                .from('invite_codes')
                .select('code')
                .eq('code', newCode);
            if (!data || data.length === 0) exists = false;
            else newCode = generateCode();
        }
        await supabase.from('invite_codes').insert({ code: newCode });
        codes.push(newCode);
    }
    res.json({ codes });
});

// 3. 获取邀请码列表（管理员）
app.get('/api/list', async (req, res) => {
    const adminKey = req.headers['x-admin-key'];
    if (adminKey !== process.env.ADMIN_KEY) {
        return res.status(403).json({ error: '无权限' });
    }
    const { data: valid } = await supabase
        .from('invite_codes')
        .select('code, created_at')
        .eq('used', false)
        .order('created_at', { ascending: false });
    const { data: used } = await supabase
        .from('invite_codes')
        .select('code, used_at')
        .eq('used', true)
        .order('used_at', { ascending: false });
    res.json({ valid: valid || [], used: used || [] });
});

// 4. 删除有效邀请码（管理员）
app.delete('/api/delete', async (req, res) => {
    const adminKey = req.headers['x-admin-key'];
    if (adminKey !== process.env.ADMIN_KEY) {
        return res.status(403).json({ error: '无权限' });
    }
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: '缺少邀请码' });
    await supabase
        .from('invite_codes')
        .delete()
        .eq('code', code)
        .eq('used', false);
    res.json({ success: true });
});

// 注意：Vercel 不需要 app.listen，直接导出 app
export default app;