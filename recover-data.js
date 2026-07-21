import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'test'
    });
    
    try {
        const [products] = await pool.query('SELECT DISTINCT category, subCategory, supplier FROM products');
        
        const suppliers = new Set();
        const categoriesMap = new Map();
        
        for (const p of products) {
            if (p.supplier) {
                suppliers.add(p.supplier);
            }
            if (p.category) {
                if (!categoriesMap.has(p.category)) {
                    categoriesMap.set(p.category, new Set());
                }
                if (p.subCategory) {
                    categoriesMap.get(p.category).add(p.subCategory);
                }
            }
        }
        
        console.log('Found suppliers:', Array.from(suppliers));
        console.log('Found categories:', Array.from(categoriesMap.keys()));
        
        // Recover suppliers
        for (const sup of suppliers) {
            const id = 'sup_' + Date.now() + Math.floor(Math.random() * 1000);
            await pool.query('INSERT IGNORE INTO suppliers (id, name, isPrivate) VALUES (?, ?, ?)', [id, sup, false]);
        }
        
        // Recover categories and sub_categories
        for (const [cat, subs] of categoriesMap.entries()) {
            const catId = 'cat_' + Date.now() + Math.floor(Math.random() * 1000);
            await pool.query('INSERT IGNORE INTO categories (id, name, isPrivate) VALUES (?, ?, ?)', [catId, cat, false]);
            
            for (const sub of subs) {
                await pool.query('INSERT IGNORE INTO sub_categories (categoryId, name) VALUES (?, ?)', [catId, sub]);
            }
        }
        
        console.log('Recovery completed successfully.');
    } catch (e) {
        console.error('Error during recovery:', e);
    }
    pool.end();
}
run();
