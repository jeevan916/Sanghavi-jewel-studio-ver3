import fetch from 'node-fetch';
import FormData from 'form-data';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config();

async function run() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'test'
    });
    const [rows] = await pool.query("SELECT id, role FROM staff WHERE role='admin' LIMIT 1");
    pool.end();
    
    if (rows.length === 0) { console.log("no admin"); return; }

    const form = new FormData();
    form.append('logo', fs.createReadStream('package.json'));
    
    const token = jwt.sign({ id: rows[0].id, role: rows[0].role }, process.env.JWT_SECRET || 'default_dev_jwt_secret_change_in_production');
    
    const res = await fetch('http://localhost:3000/_proxy/JTJGc2V0dGluZ3MlMkZsb2dv', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`
        },
        body: form
    });
    
    console.log(res.status, await res.text());
}
run();
