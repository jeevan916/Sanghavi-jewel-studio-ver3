const fs = require('fs');

let mediaJs = fs.readFileSync('server/routes/media.js', 'utf8');

const oldImageProc = `        // Handle Image Processing
        const processVariant = async (width, format, quality) => {
          const filename = \`\${contentHash}-\${safeName}-\${width}w.\${format}\`;
          const filepath = path.join(UPLOADS_ROOT, width.toString(), filename);
          
          // Deduplication Check
          if (existsSync(filepath)) {
              console.log(\`🖼️ [Media] Image variant already exists, skipping: \${filename}\`);
              return \`/uploads/\${width}/\${filename}\`;
          }
          try {
            const { default: sharp } = await import('sharp');
            await sharp(file.buffer).rotate().resize(width, null, { withoutEnlargement: true }).sharpen({ sigma: 0.8, m1: 0.5, m2: 0.5 }).toFormat(format, { quality }).toFile(filepath);
          } catch (e) {
            console.error('Sharp processing failed, saving raw file instead:', e);
            const fs = await import('fs');
            fs.writeFileSync(filepath, file.buffer);
          }
          return \`/uploads/\${width}/\${filename}\`;
        };

        const [desktopWebP, mobileThumb] = await Promise.all([
            processVariant(1080, 'webp', 85),
            processVariant(300, 'webp', 80)
        ]);
        
        results.push({ 
            originalName: file.originalname, 
            primary: desktopWebP,
            thumbnail: mobileThumb 
        });`;

const newImageProc = `        // Handle Image Processing (Base64 for persistence)
        const processVariant = async (width, quality) => {
          try {
            const { default: sharp } = await import('sharp');
            const buffer = await sharp(file.buffer).rotate().resize(width, null, { withoutEnlargement: true }).sharpen({ sigma: 0.8, m1: 0.5, m2: 0.5 }).toFormat('webp', { quality }).toBuffer();
            return 'data:image/webp;base64,' + buffer.toString('base64');
          } catch (e) {
            console.error('Sharp processing failed:', e);
            return 'data:' + file.mimetype + ';base64,' + file.buffer.toString('base64');
          }
        };

        const [desktopWebP, mobileThumb] = await Promise.all([
            processVariant(1080, 85),
            processVariant(300, 80)
        ]);
        
        results.push({ 
            originalName: file.originalname, 
            primary: desktopWebP,
            thumbnail: mobileThumb 
        });`;

mediaJs = mediaJs.replace(oldImageProc, newImageProc);

fs.writeFileSync('server/routes/media.js', mediaJs);
console.log('Fixed media.js!');
