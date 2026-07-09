const fs = require('fs');
let content = fs.readFileSync('src/pages/ProductDetails.tsx', 'utf8');

// 1. Add Bell icon import
content = content.replace(
    "Heart, ArrowLeft, Share2, ZoomIn, Info, ShieldCheck, Scale, Check, Image as ImageIcon, Camera, Wand2, X, RefreshCw",
    "Heart, ArrowLeft, Share2, ZoomIn, Info, ShieldCheck, Scale, Check, Image as ImageIcon, Camera, Wand2, X, RefreshCw, Bell"
);

// 2. Add state
const stateInsertion = "  const [isLiked, setIsLiked] = useState(false);\n  const [isPriceAlertSet, setIsPriceAlertSet] = useState(false);";
content = content.replace("  const [isLiked, setIsLiked] = useState(false);", stateInsertion);

// 3. Add togglePriceAlert function
const funcToInsert = `
  const togglePriceAlert = async () => {
      if (!user) {
          navigate('/login', { state: { from: location.pathname } });
          return;
      }
      setIsPriceAlertSet(true);
      try {
          await apiFetch('/api/price-drop-alerts', {
              method: 'POST',
              body: JSON.stringify({
                  customerId: user.id,
                  productId: product.id,
                  currentPrice: priceNow
              })
          });
          // Show toast or success indication here if we had a toast system
      } catch (e) {
          console.error(e);
          setIsPriceAlertSet(false);
      }
  };
`;
const insertionPoint = "  const toggleWishlist = async () => {";
content = content.replace(insertionPoint, funcToInsert + "\n" + insertionPoint);

// 4. Add Button in UI
const buttonUI = `
                    <button onClick={() => toggleWishlist()} className={\`p-3 rounded-2xl transition-all \${isWishlisted ? 'text-brand-gold bg-brand-gold/5' : 'text-stone-300 hover:text-brand-gold hover:bg-stone-50'}\`}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill={isWishlisted ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>
                    </button>
                    <button onClick={() => togglePriceAlert()} title="Notify me on price drop" className={\`p-3 rounded-2xl transition-all \${isPriceAlertSet ? 'text-emerald-500 bg-emerald-50' : 'text-stone-300 hover:text-emerald-500 hover:bg-stone-50'}\`}>
                        <Bell size={26} fill={isPriceAlertSet ? "currentColor" : "none"} />
                    </button>
`;

content = content.replace(
    `<button onClick={() => toggleWishlist()} className={\`p-3 rounded-2xl transition-all \${isWishlisted ? 'text-brand-gold bg-brand-gold/5' : 'text-stone-300 hover:text-brand-gold hover:bg-stone-50'}\`}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill={isWishlisted ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>
                    </button>`,
    buttonUI
);

// 5. Add apiFetch to storeService imports
// Let's check if apiFetch is imported. 
if (!content.includes('apiFetch')) {
    content = content.replace("import { storeService } from '@/services/storeService.ts';", "import { storeService, apiFetch } from '@/services/storeService.ts';");
}

fs.writeFileSync('src/pages/ProductDetails.tsx', content);
