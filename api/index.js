import express from 'express';
import { createClient } from '@supabase/supabase-js';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

app.post('/api/verify', async (req, res) => {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: '邀请码不能为空' });
    const normalized = code.trim().toUpperCase();
    try {
        const { data, error } = await supabase
            .from('invite_codes')
            .update({ used: true, used_at: new Date().toISOString() })
            .eq('code', normalized)
            .eq('used', false)
            .select();
        if (error) {
            console.error('更新错误:', error);
            return res.status(500).json({ error: '数据库操作失败', detail: error.message });
        }
        if (!data || data.length === 0) {
            return res.status(400).json({ error: '邀请码无效或已使用' });
        }
        res.json({ success: true });
    } catch (err) {
        console.error('异常:', err);
        res.status(500).json({ error: '服务器内部错误', detail: err.message });
    }
});

// 其他路由 (generate, list, delete) 保持原样（或从原文件复制，不要删除）
app.post('/api/generate', async (req, res) => { /* 原代码 */ });
app.get('/api/list', async (req, res) => { /* 原代码 */ });
app.delete('/api/delete', async (req, res) => { /* 原代码 */ });

export default app;