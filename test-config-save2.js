import fetch from 'node-fetch';
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
    
    const token = jwt.sign({ id: rows[0].id, role: rows[0].role }, process.env.JWT_SECRET || 'default_dev_jwt_secret_change_in_production');
    
    const res = await fetch('http://localhost:3000/api/config', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            suppliers: [{ id: "sup1", name: "Test Supplier", isPrivate: false }],
            categories: [{ id: "cat1", name: "Test Cat", isPrivate: false, subCategories: ["Test Sub"] }]
        })
    });
    
    console.log(res.status, await res.text());
}
run();
