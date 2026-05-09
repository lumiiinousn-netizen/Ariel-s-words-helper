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

// 静态文件托管（前端页面）
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

// 验证邀请码
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

// 生成邀请码
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

// 获取邀请码列表
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

// 删除邀请码
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));