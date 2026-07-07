import express from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import { requireAdmin } from '../auth.js';

export default function customersRoutes(pool) {
    const router = express.Router();

    const authLimiter = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 20, // limit each IP to 20 login requests per windowMs
        message: { error: 'Too many login attempts, please try again later.' }
    });

router.get('/api/customers', requireAdmin, async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT id, name, phone, pincode, role, createdAt FROM customers ORDER BY createdAt DESC');
        res.json(rows);
    } catch (e) { res.status(500).json({ error: 'Internal server error' }); }
});

router.get('/api/customers/check/:phone', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT name, pincode FROM customers WHERE phone = ?', [req.params.phone]);
        res.json({ exists: rows.length > 0, user: rows[0] || null });
    } catch (e) { res.status(500).json({ error: 'Internal server error' }); }
});

router.post('/api/customers/login', authLimiter, async (req, res) => {
    const { phone, name, pincode } = req.body;
    try {
        const [rows] = await pool.query('SELECT * FROM customers WHERE phone = ?', [phone]);
        let user = rows[0];
        if (!user) {
            user = { id: crypto.randomUUID(), phone, name: name || `Client ${phone.slice(-4)}`, pincode, role: 'customer', createdAt: new Date() };
            await pool.query('INSERT INTO customers SET ?', user);
        } else if (name || pincode) {
            await pool.query('UPDATE customers SET name = COALESCE(?, name), pincode = COALESCE(?, pincode) WHERE phone = ?', [name, pincode, phone]);
            user.name = name || user.name;
        }
        // Identity unverified via OTP
        user.verified = false;
        res.json({ user });
    } catch (e) { res.status(500).json({ error: 'Internal server error' }); }
});

router.post('/api/login', authLimiter, async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT id, username, password, role, name, isActive FROM staff WHERE username = ?', [req.body.username]);
        if (rows[0] && rows[0].isActive) {
            const user = rows[0];
            const isLegacyPlaintext = !user.password.startsWith('$2a$') && !user.password.startsWith('$2b$');
            
            let passwordMatch = false;
            if (isLegacyPlaintext) {
                passwordMatch = (user.password === req.body.password);
                if (passwordMatch) {
                    const hashed = await bcrypt.hash(req.body.password, 10);
                    await pool.query('UPDATE staff SET password = ? WHERE id = ?', [hashed, user.id]);
                }
            } else {
                passwordMatch = await bcrypt.compare(req.body.password, user.password);
            }

            if (passwordMatch) {
                const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '24h' });
                const { password, ...userWithoutPassword } = user;
                return res.json({ user: { ...userWithoutPassword, token } });
            }
        }
        res.status(401).json({ error: 'Invalid or Disabled' });
    } catch (e) { res.status(500).json({ error: 'Internal server error' }); }
});


    return router;
}
