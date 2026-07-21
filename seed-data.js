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
        await pool.query('DELETE FROM sub_categories');
        await pool.query('DELETE FROM categories');
        await pool.query('DELETE FROM suppliers');
        
        const categories = [
            { id: 'cat1', name: 'Rings', isPrivate: false, sub: ['Engagement', 'Wedding', 'Casual'] },
            { id: 'cat2', name: 'Necklaces', isPrivate: false, sub: ['Chokers', 'Chains', 'Pendants'] },
            { id: 'cat3', name: 'Earrings', isPrivate: false, sub: ['Studs', 'Drops', 'Hoops'] }
        ];
        
        for (const c of categories) {
            await pool.query('INSERT INTO categories (id, name, isPrivate) VALUES (?, ?, ?)', [c.id, c.name, false]);
            if (c.sub.length) {
                const subValues = c.sub.map(s => [c.id, s]);
                await pool.query('INSERT INTO sub_categories (categoryId, name) VALUES ?', [subValues]);
            }
        }
        
        const suppliers = [
            { id: 'sup1', name: 'Premium Gold Suppliers', isPrivate: false },
            { id: 'sup2', name: 'Diamond Direct', isPrivate: false }
        ];
        
        const supplierValues = suppliers.map(s => [s.id, s.name, false]);
        await pool.query('INSERT INTO suppliers (id, name, isPrivate) VALUES ?', [supplierValues]);
        
        console.log("Seeded basic categories and suppliers.");
    } catch (e) {
        console.error(e);
    }
    pool.end();
}
run();
