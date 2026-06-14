import express from 'express';

export default function staffRoutes(pool) {
    const router = express.Router();

    router.get('/api/staff', async (req, res) => {
        try {
            const [rows] = await pool.query('SELECT id, username, role, name, isActive, createdAt FROM staff');
            res.json(rows);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.post('/api/staff', async (req, res) => {
        try {
            const s = req.body;
            await pool.query('INSERT INTO staff SET ?', s);
            res.status(201).json(s);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.put('/api/staff/:id', async (req, res) => {
        try {
            await pool.query('UPDATE staff SET ? WHERE id = ?', [req.body, req.params.id]);
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.delete('/api/staff/:id', async (req, res) => {
        try {
            await pool.query('DELETE FROM staff WHERE id = ?', [req.params.id]);
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    return router;
}
