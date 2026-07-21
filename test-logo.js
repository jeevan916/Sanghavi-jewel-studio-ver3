import mysql from 'mysql2/promise';
import jwt from 'jsonwebtoken';
import FormData from 'form-data';
import fs from 'fs';
import fetch from 'node-fetch';

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
        
        const form = new FormData();
        form.append('logo', fs.createReadStream('package.json')); // upload a file
        
        const res = await fetch('http://localhost:3000/api/settings/logo', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: form
        });
        
        const text = await res.text();
        console.log("Status:", res.status, text);
    } catch (e) {
        console.error(e);
    }
    pool.end();
}
run();
