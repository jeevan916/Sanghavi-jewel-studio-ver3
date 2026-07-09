const fs = require('fs');
let content = fs.readFileSync('src/pages/ProductDetails.tsx', 'utf8');

content = content.replace("import { ArrowLeft, Share2,", "import { Bell, ArrowLeft, Share2,");

fs.writeFileSync('src/pages/ProductDetails.tsx', content);
