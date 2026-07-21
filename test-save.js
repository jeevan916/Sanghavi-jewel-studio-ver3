import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';

async function run() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'test'
    });
    
    try {
        const [rows] = await pool.query("SELECT id, role FROM staff WHERE role='admin' LIMIT 1");
        if (rows.length === 0) { console.log("no admin"); return; }
        
        const secret = process.env.JWT_SECRET || 'default_dev_jwt_secret_change_in_production';
        const token = jwt.sign({ id: rows[0].id, role: rows[0].role }, secret, { algorithm: 'HS256' });
        
        const res = await fetch('http://localhost:3000/api/config', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                whatsappGoldRateTemplateName: 'test_123',
                linkExpiryHours: 24,
                goldRate22k: 6500,
                goldRate24k: 7200,
                gstPercent: 3
            })
        });
        
        const text = await res.text();
        console.log("Status:", res.status, text);
    } catch (e) {
        console.error(e);
    }
    pool.end();
}
run();
