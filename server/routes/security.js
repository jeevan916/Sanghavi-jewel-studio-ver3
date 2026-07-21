import express from 'express';
import crypto from 'crypto';
import { requireStaff } from '../auth.js';

export default function securityRoutes(pool) {
    const router = express.Router();

    router.get('/api/security/trace', requireStaff, async (req, res) => {
        try {
            const traceId = crypto.randomBytes(4).toString('hex').toUpperCase() + '-' + crypto.randomBytes(4).toString('hex').toUpperCase();
            
            // Generate HMAC for IP and user agent
            const hmacSecret = process.env.JWT_SECRET || 'fallback-secret';
            const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
            const userAgent = req.headers['user-agent'] || 'unknown';
            
            const ipHmac = crypto.createHmac('sha256', hmacSecret).update(ip).digest('hex');
            const uaHmac = crypto.createHmac('sha256', hmacSecret).update(userAgent).digest('hex');
            
            const now = new Date();
            const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

            await pool.query(
                'INSERT INTO security_traces (trace_id, staff_id, role, ip_hmac, user_agent_hmac, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [traceId, req.user.id, req.user.role, ipHmac, uaHmac, now, expiresAt]
            );

            res.json({
                traceId: traceId,
                issuedAt: now.toISOString(),
                expiresAt: expiresAt.toISOString()
            });
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    router.post('/api/security/log-capture', async (req, res) => {
        try {
            const { action, details } = req.body;
            let userId = 'anonymous';
            let role = 'guest';
            let userName = 'Unknown';
            
            if (req.user) {
                userId = req.user.id;
                role = req.user.role;
                userName = req.user.name || 'Unknown';
            }

            await pool.query(
                'INSERT INTO capture_logs (user_id, user_name, role, action, details) VALUES (?, ?, ?, ?, ?)',
                [userId, userName, role, action, JSON.stringify(details)]
            );

            res.json({ success: true });
        } catch (e) {
            console.error('Error logging capture:', e);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    router.get('/api/security/capture-logs', requireStaff, async (req, res) => {
        try {
            const [rows] = await pool.query('SELECT * FROM capture_logs ORDER BY created_at DESC LIMIT 100');
            res.json(rows);
        } catch (e) {
            console.error('Error fetching capture logs:', e);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    return router;
}
