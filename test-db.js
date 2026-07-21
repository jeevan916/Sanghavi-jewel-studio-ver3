import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config({path: '.env'});

async function run() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });
    
    try {
        const [rows] = await pool.query("DESCRIBE system_settings");
        console.log("system_settings schema:", rows);
        
        const [rows2] = await pool.query("DESCRIBE categories");
        console.log("categories schema:", rows2);
    } catch (e) {
        console.error(e);
    }
    pool.end();
}
run();
