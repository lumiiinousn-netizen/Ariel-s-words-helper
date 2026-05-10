app.post('/api/verify', async (req, res) => {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: '邀请码不能为空' });
    const normalized = code.trim().toUpperCase();
    try {
        // 查询邀请码是否存在且未使用
        const { data: existing, error: findErr } = await supabase
            .from('invite_codes')
            .select('code')
            .eq('code', normalized)
            .eq('used', false);
        if (findErr) {
            console.error('查询错误:', findErr);
            // 返回详细错误信息（调试用）
            return res.status(500).json({ error: '数据库查询失败', detail: findErr.message });
        }
        if (!existing || existing.length === 0) {
            return res.status(400).json({ error: '邀请码无效或已使用' });
        }
        // 更新为已使用
        const { error: updateErr } = await supabase
            .from('invite_codes')
            .update({ used: true, used_at: new Date().toISOString() })
            .eq('code', normalized);
        if (updateErr) {
            console.error('更新错误:', updateErr);
            return res.status(500).json({ error: '更新失败', detail: updateErr.message });
        }
        res.json({ success: true });
    } catch (err) {
        console.error('异常:', err);
        res.status(500).json({ error: '服务器内部错误', detail: err.message });
    }
});