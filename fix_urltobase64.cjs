const fs = require('fs');
let content = fs.readFileSync('src/pages/ProductDetails.tsx', 'utf8');

const oldFunc = `  const urlToBase64 = async (url: string): Promise<string> => {
      try {
        if (url.startsWith('data:')) return url;
        const response = await fetch(url);
        const blob = await response.blob();
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
        });
      } catch (e) {
          console.error("Image conversion failed", e);
          return "";
      }
  };`;

const newFunc = `  const urlToBase64 = async (url: string): Promise<string> => {
      try {
        if (url.startsWith('data:image/jpeg')) return url;
        
        return new Promise((resolve, reject) => {
            const img = new window.Image();
            img.crossOrigin = 'Anonymous';
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    resolve(url);
                    return;
                }
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0);
                resolve(canvas.toDataURL('image/jpeg', 0.95));
            };
            img.onerror = () => reject(new Error("Failed to load image for conversion"));
            img.src = url;
        });
      } catch (e) {
          console.error("Image conversion failed", e);
          return "";
      }
  };`;

if(content.includes(oldFunc)) {
    fs.writeFileSync('src/pages/ProductDetails.tsx', content.replace(oldFunc, newFunc));
    console.log("Success");
} else {
    console.log("Failed to find TargetContent");
}
