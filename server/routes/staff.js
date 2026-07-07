import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { requireAdmin } from '../auth.js';

export default function staffRoutes(pool) {
    const router = express.Router();

    router.get('/api/staff', requireAdmin, async (req, res) => {
        try {
            const [rows] = await pool.query('SELECT id, username, role, name, isActive, createdAt FROM staff');
            res.json(rows);
        } catch (e) { res.status(500).json({ error: 'Internal server error' }); }
    });

    router.post('/api/staff', requireAdmin, async (req, res) => {
        try {
            const { username, password, role, name, isActive } = req.body;
            if (!username || !password || !role) {
                return res.status(400).json({ error: 'Missing required fields' });
            }
            if (!['admin', 'contributor', 'staff'].includes(role)) {
                return res.status(400).json({ error: 'Invalid role' });
            }

            const id = crypto.randomUUID();
            const hashedPassword = await bcrypt.hash(password, 10);
            
            const staffRecord = {
                id,
                username,
                password: hashedPassword,
                role,
                name: name || '',
                isActive: isActive !== false,
                createdAt: new Date()
            };

            await pool.query('INSERT INTO staff SET ?', staffRecord);
            const { password: _, ...safeStaff } = staffRecord;
            res.status(201).json(safeStaff);
        } catch (e) { res.status(500).json({ error: 'Internal server error' }); }
    });

    router.put('/api/staff/:id', requireAdmin, async (req, res) => {
        try {
            const { username, password, role, name, isActive } = req.body;
            
            const updateFields = [];
            const updateValues = [];

            if (username !== undefined) {
                updateFields.push('username = ?');
                updateValues.push(username);
            }
            if (role !== undefined) {
                if (!['admin', 'contributor', 'staff'].includes(role)) {
                    return res.status(400).json({ error: 'Invalid role' });
                }
                updateFields.push('role = ?');
                updateValues.push(role);
            }
            if (name !== undefined) {
                updateFields.push('name = ?');
                updateValues.push(name);
            }
            if (isActive !== undefined) {
                updateFields.push('isActive = ?');
                updateValues.push(isActive);
            }
            if (password) {
                updateFields.push('password = ?');
                updateValues.push(await bcrypt.hash(password, 10));
            }

            if (updateFields.length > 0) {
                updateValues.push(req.params.id);
                await pool.query(`UPDATE staff SET ${updateFields.join(', ')} WHERE id = ?`, updateValues);
            }

            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: 'Internal server error' }); }
    });

    router.delete('/api/staff/:id', requireAdmin, async (req, res) => {
        try {
            await pool.query('DELETE FROM staff WHERE id = ?', [req.params.id]);
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: 'Internal server error' }); }
    });

    return router;
}
