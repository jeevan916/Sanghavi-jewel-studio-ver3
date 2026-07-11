const fs = require('fs');
let content = fs.readFileSync('src/pages/ProductDetails.tsx', 'utf8');

const oldLogic = `        const updatedThumbnails = [...(product.thumbnails || [])];
        updatedThumbnails[activeImageIndex] = thumbnail;`;

const newLogic = `        const updatedThumbnails = [...(product.thumbnails || [])];
        // Ensure array is fully populated to avoid nulls
        for (let i = 0; i < updatedImages.length; i++) {
            if (!updatedThumbnails[i]) updatedThumbnails[i] = updatedImages[i];
        }
        updatedThumbnails[activeImageIndex] = thumbnail;`;

if (content.includes(oldLogic)) {
    content = content.replace(oldLogic, newLogic);
    fs.writeFileSync('src/pages/ProductDetails.tsx', content);
    console.log("Replaced updatedThumbnails logic successfully!");
} else {
    console.log("Could not find TargetContent in updatedThumbnails logic");
}
