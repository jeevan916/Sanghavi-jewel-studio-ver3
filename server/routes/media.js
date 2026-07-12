import express from 'express';
import multer from 'multer';
import path from 'path';
import { existsSync, writeFileSync, unlinkSync } from 'fs';
import crypto from 'crypto';
import { requireStaff } from '../auth.js';

export default function (pool, UPLOADS_ROOT) {
  const router = express.Router();
  const storage = multer.memoryStorage();
  const upload = multer({ storage });



  router.post('/api/media/upload', requireStaff, upload.array('files'), async (req, res) => {
    try {
      if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files uploaded' });
      
      const results = [];
      for (const file of req.files) {
        const contentHash = crypto.createHash('md5').update(file.buffer).digest('hex').substring(0, 12);
        const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        
        if (file.mimetype.startsWith('video/')) {
          // Fallback simple save for video
          const fallbackFilename = `${contentHash}-${safeName}${path.extname(file.originalname) || '.mp4'}`;
          const fallbackPath = path.join(UPLOADS_ROOT, '1080', fallbackFilename);
          if (!existsSync(fallbackPath)) writeFileSync(fallbackPath, file.buffer);
          results.push({
              originalName: file.originalname,
              primary: `/uploads/1080/${fallbackFilename}`,
              thumbnail: `/uploads/1080/${fallbackFilename}`
          });
        } else {
          const processVariant = async (width, format, quality) => {
            const filename = `${contentHash}-${safeName}-${width}w.${format}`;
            const filepath = path.join(UPLOADS_ROOT, width.toString(), filename);
            if (existsSync(filepath)) return `/uploads/${width}/${filename}`;
            try {
              const { default: sharp } = await import('sharp');
              await sharp(file.buffer).rotate().resize(width, null, { withoutEnlargement: true }).sharpen({ sigma: 0.8, m1: 0.5, m2: 0.5 }).toFormat(format, { quality }).toFile(filepath);
            } catch (e) {
              writeFileSync(filepath, file.buffer);
            }
            return `/uploads/${width}/${filename}`;
          };
          const [desktopWebP, mobileThumb] = await Promise.all([
              processVariant(1080, 'webp', 85),
              processVariant(300, 'webp', 80)
          ]);
          results.push({ originalName: file.originalname, primary: desktopWebP, thumbnail: mobileThumb });
        }
      }
      res.json({ success: true, files: results });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.post('/api/settings/logo', requireStaff, upload.single('logo'), async (req, res) => {
      try {
          if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
          const filepath = path.join(UPLOADS_ROOT, 'custom_logo.png');
          try {
              const { default: sharp } = await import('sharp');
              await sharp(req.file.buffer).png().toFile(filepath);
          } catch (e) { writeFileSync(filepath, req.file.buffer); }
          res.json({ success: true, url: '/api/settings/logo.png?t=' + Date.now() });
      } catch (error) { res.status(500).json({ error: 'Internal server error' }); }
  });

  router.get('/api/settings/logo.png', (req, res) => {
      const customLogoPath = path.join(UPLOADS_ROOT, 'custom_logo.png');
      if (existsSync(customLogoPath)) res.sendFile(customLogoPath);
      else res.redirect('https://cdn-icons-png.flaticon.com/512/2611/2611152.png');
  });

  router.get('/logo.png', (req, res) => res.redirect('https://cdn-icons-png.flaticon.com/512/2611/2611152.png'));

  router.get('/api/media/stream/:id/:type/:index.webp', async (req, res) => {
      try {
          const { id, type, index } = req.params;
          const [rows] = await pool.query('SELECT images, thumbnails FROM products WHERE id = ?', [id]);
          if (rows.length === 0) return res.status(404).send('Not found');
          const col = type === 'thumb' ? rows[0].thumbnails : rows[0].images;
          if (!col) return res.status(404).send('No images');
          const arr = typeof col === 'string' ? JSON.parse(col) : col;
          const imgStr = arr[parseInt(index)] || '';
          if (!imgStr.startsWith('data:')) return res.redirect(imgStr);
          const matches = imgStr.match(/^data:([a-zA-Z0-9+\/\-]+);base64,(.+)$/);
          if (!matches || matches.length !== 3) return res.status(400).send('Invalid image format');
          res.setHeader('Content-Type', matches[1]);
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          res.send(Buffer.from(matches[2], 'base64'));
      } catch (e) { res.status(500).send('Internal Server Error'); }
  });

  router.post('/api/media/deterministic-enhance', requireStaff, async (req, res) => {
      try {
          const { base64Image } = req.body;
          const cleanBase64 = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;
          const buffer = Buffer.from(cleanBase64, 'base64');
          
          const { default: sharp } = await import('sharp');
          
          const enhancedBuffer = await sharp(buffer)
            // Enhance contrast automatically
            .normalize()
            // Slight saturation boost
            .modulate({ saturation: 1.15 })
            // Aggressive sharpening for jewelry facets
            .sharpen({ sigma: 1.5, m1: 1.5, m2: 0.8 })
            .toFormat('webp', { quality: 95 })
            .toBuffer();
            
          res.json({ success: true, data: `data:image/webp;base64,${enhancedBuffer.toString('base64')}` });
      } catch (error) {
          console.error("Deterministic Enhance Error:", error);
          res.status(500).json({ error: 'Internal server error' });
      }
  });

  return router;
}
