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

    return router;
}
