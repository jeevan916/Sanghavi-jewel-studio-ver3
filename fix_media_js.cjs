const fs = require('fs');
const content = fs.readFileSync('server/routes/media.js', 'utf8');

const replacement = `          const imgStr = arr[parseInt(index)] || '';
          if (imgStr.includes('/api/media/stream')) return res.redirect('https://cdn-icons-png.flaticon.com/512/2611/2611152.png');
          if (!imgStr.startsWith('data:')) return res.redirect(imgStr);`;

const newContent = content.replace(
    /const imgStr = arr\[parseInt\(index\)\] \|\| '';\s+if \(\!imgStr\.startsWith\('data:'\)\) return res\.redirect\(imgStr\);/,
    replacement
);

fs.writeFileSync('server/routes/media.js', newContent);
console.log('Patched media.js');
