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
            console.error(error);
            return res.status(500).json({ error: '数据库操作失败' });
        }
        if (!data || data.length === 0) {
            return res.status(400).json({ error: '邀请码无效或已使用' });
        }
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: '服务器内部错误' });
    }
});

app.get('/api/list', async (req, res) => {
    // 为了测试，简单返回（实际需要管理员验证）
    res.json({ valid: [], used: [] });
});

export default app;