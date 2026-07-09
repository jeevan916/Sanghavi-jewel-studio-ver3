const fs = require('fs');
let content = fs.readFileSync('src/pages/ProductDetails.tsx', 'utf8');

content = content.replace("import { Bell, ", "import { ");
content = content.replace("Heart, ArrowLeft, Share2, ZoomIn, Info, ShieldCheck, Scale, Check, Image as ImageIcon, Camera, Wand2, X, RefreshCw", "Heart, ArrowLeft, Share2, ZoomIn, Info, ShieldCheck, Scale, Check, Image as ImageIcon, Camera, Wand2, X, RefreshCw, Bell");

fs.writeFileSync('src/pages/ProductDetails.tsx', content);
