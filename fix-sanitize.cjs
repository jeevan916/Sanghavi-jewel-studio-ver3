const fs = require('fs');
let serverJs = fs.readFileSync('server.js', 'utf8');

const oldSanitize = `const sanitizeProduct = (p) => p ? ({ ...p, tags: safeParse(p.tags), images: safeParse(p.images), thumbnails: safeParse(p.thumbnails), meta: safeParse(p.meta, {}) }) : null;`;
const newSanitize = `const sanitizeProduct = (p) => {
    if (!p) return null;
    let images = safeParse(p.images);
    let thumbnails = safeParse(p.thumbnails);
    
    images = images.map((img, i) => (typeof img === 'string' && img.startsWith('data:image') ? \`/api/media/stream/\${p.id}/image/\${i}.webp\` : img));
    thumbnails = thumbnails.map((img, i) => (typeof img === 'string' && img.startsWith('data:image') ? \`/api/media/stream/\${p.id}/thumb/\${i}.webp\` : img));

    return { ...p, tags: safeParse(p.tags), images, thumbnails, meta: safeParse(p.meta, {}) };
};`;

if (serverJs.includes(oldSanitize)) {
    serverJs = serverJs.replace(oldSanitize, newSanitize);
    fs.writeFileSync('server.js', serverJs);
    console.log('Fixed sanitizeProduct!');
} else {
    console.log('Could not find oldSanitize');
}
