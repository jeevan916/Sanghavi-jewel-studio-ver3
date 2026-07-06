const fs = require('fs');

let mediaJs = fs.readFileSync('server/routes/media.js', 'utf8');

const streamEndpoint = `
// --- MEDIA STREAMING ---
router.get('/api/media/stream/:id/:type/:index.webp', async (req, res) => {
    try {
        const { id, type, index } = req.params;
        const [rows] = await pool.query('SELECT images, thumbnails FROM products WHERE id = ?', [id]);
        if (rows.length === 0) return res.status(404).send('Not found');
        
        const col = type === 'thumb' ? rows[0].thumbnails : rows[0].images;
        if (!col) return res.status(404).send('No images');
        
        const arr = typeof col === 'string' ? JSON.parse(col) : col;
        const imgStr = arr[parseInt(index)] || '';
        
        if (!imgStr.startsWith('data:image')) {
            // It might be an external URL or /uploads/ path
            return res.redirect(imgStr);
        }
        
        const matches = imgStr.match(/^data:(image\\/[a-zA-Z0-9+-]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) {
            return res.status(400).send('Invalid image format in DB');
        }
        
        const mimeType = matches[1];
        const base64Data = matches[2];
        const buffer = Buffer.from(base64Data, 'base64');
        
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.send(buffer);
    } catch (e) {
        console.error('Streaming error:', e);
        res.status(500).send('Internal Server Error');
    }
});
`;

if (!mediaJs.includes('/api/media/stream')) {
    mediaJs = mediaJs.replace('// --- API ROUTES ---', streamEndpoint + '\n// --- API ROUTES ---');
    fs.writeFileSync('server/routes/media.js', mediaJs);
    console.log('Stream endpoint added!');
} else {
    console.log('Stream endpoint already exists');
}
