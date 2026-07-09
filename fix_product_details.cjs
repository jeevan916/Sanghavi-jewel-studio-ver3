const fs = require('fs');
let content = fs.readFileSync('src/pages/ProductDetails.tsx', 'utf8');

content = content.replace("currentPrice: priceNow", "currentPrice: priceData?.total || 0");

if (!content.includes('Bell,')) {
    content = content.replace("import { ", "import { Bell, ");
}

fs.writeFileSync('src/pages/ProductDetails.tsx', content);
