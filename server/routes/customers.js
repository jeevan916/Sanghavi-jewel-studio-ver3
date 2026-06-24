import express from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

export default function customersRoutes(pool) {
    const router = express.Router();

router.get('/api/customers', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT id, name, phone, pincode, role, createdAt FROM customers ORDER BY createdAt DESC');
        res.json(rows);
    } catch (e) { res.status(500).json({ error: 'Internal server error' }); }
});

router.get('/api/customers/check/:phone', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM customers WHERE phone = ?', [req.params.phone]);
        res.json({ exists: rows.length > 0, user: rows[0] || null });
    } catch (e) { res.status(500).json({ error: 'Internal server error' }); }
});

router.post('/api/customers/login', async (req, res) => {
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
        res.json({ user });
    } catch (e) { res.status(500).json({ error: 'Internal server error' }); }
});

router.post('/api/login', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT id, username, role, name, isActive FROM staff WHERE username = ? AND password = ?', [req.body.username, req.body.password]);
        if (rows[0] && rows[0].isActive) {
            const user = rows[0];
            const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '24h' });
            res.json({ user: { ...user, token } });
        }
        else res.status(401).json({ error: 'Invalid or Disabled' });
    } catch (e) { res.status(500).json({ error: 'Internal server error' }); }
});


    return router;
}
