import express from 'express';
import multer from 'multer';
import path from 'path';
import fs, { existsSync } from 'fs';
import crypto from 'crypto';
import ffmpeg from 'fluent-ffmpeg';
import { requireStaff } from '../auth.js';

export default function mediaRoutes(pool, UPLOADS_ROOT) {
    const router = express.Router();

router.get('/api/media/resize', async (req, res) => {
    try {
        const { url, width, format = 'webp', quality = 80 } = req.query;
        if (!url) return res.status(400).json({ error: 'Missing url' });
        
        // Ensure URL is within uploads
        const safeUrl = url.startsWith('/') ? url : `/${url}`;
        const filepath = path.resolve(path.join(UPLOADS_ROOT, safeUrl.replace(/^\/uploads\//, '')));
        
        if (!filepath.startsWith(path.resolve(UPLOADS_ROOT))) {
             return res.status(403).json({ error: 'Access denied' });
        }
        
        if (!existsSync(filepath)) {
            const redirectUrl = new URL(req.originalUrl, 'https://studio.sanghavijewellers.com');
            return res.redirect(redirectUrl.toString());
        }

        const { default: sharp } = await import('sharp');
        const transformer = sharp(filepath);
        
        if (width) {
            transformer.resize(parseInt(width), null, { withoutEnlargement: true });
        }
        
        const buffer = await transformer.toFormat(format, { quality: parseInt(quality) }).toBuffer();
        
        res.setHeader('Content-Type', `image/${format}`);
        res.send(buffer);
    } catch (e) {
        console.error('Dynamic resize failed:', e);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// --- IMAGE METADATA ---
router.get('/api/media/info', async (req, res) => {
    try {
        const { url } = req.query;
        if (!url) return res.status(400).json({ error: 'Missing url' });
        
        const safeUrl = url.startsWith('/') ? url : `/${url}`;
        const filepath = path.resolve(path.join(UPLOADS_ROOT, safeUrl.replace(/^\/uploads\//, '')));
        
        if (!filepath.startsWith(path.resolve(UPLOADS_ROOT))) {
             return res.status(403).json({ error: 'Access denied' });
        }
        
        if (!existsSync(filepath)) return res.status(404).json({ error: 'Image not found' });
        
        const stats = statSync(filepath);
        res.json({ size: stats.size });
    } catch (e) {
        console.error('Metadata fetch failed:', e);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// --- MEDIA PROCESSING ---
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype.match(/^(image\/(jpeg|png|webp))$/)) {
            cb(null, true);
        } else {
            cb(new Error('Unsupported file format. Only JPEG, PNG, and WEBP are allowed.'), false);
        }
    }
});

const slugify = (text) => text.toString().toLowerCase().replace(/\s+/g, '-').replace(/[^\w\-]+/g, '').replace(/\-\-+/g, '-').replace(/^-+/, '').replace(/-+$/, '');

const getHash = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 12);

router.post('/api/media/upload', requireStaff, upload.array('files', 10), async (req, res) => {
  if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files uploaded' });
  const results = [];
  try {
    for (const file of req.files) {
      const originalName = file.originalname.split('.').slice(0, -1).join('.');
      const safeName = slugify(originalName) || 'asset';
      const contentHash = getHash(file.buffer);
      
      if (file.mimetype.startsWith('video/')) {
        // Handle Video Processing
        console.log(`🎬 [Media] Processing video: ${file.originalname} (${file.size} bytes)`);
        const filename = `${contentHash}-${safeName}.webm`;
        const filepath = path.join(UPLOADS_ROOT, '1080', filename);
        const tempInput = path.join(UPLOADS_ROOT, `temp-${contentHash}.tmp`);
        
        const fs = await import('fs');
        
        // Deduplication Check
        if (existsSync(filepath)) {
            console.log(`🎬 [Media] Video already exists, skipping: ${filename}`);
            results.push({
                originalName: file.originalname,
                primary: `/uploads/1080/${filename}`,
                thumbnail: `/uploads/1080/${filename}`
            });
            continue;
        }

        fs.writeFileSync(tempInput, file.buffer);
        console.log(`🎬 [Media] Temp file created: ${tempInput}`);

        try {
            await new Promise((resolve, reject) => {
              ffmpeg(tempInput)
                .outputOptions([
                  '-an', // Remove audio
                  '-c:v libvpx-vp9', // WebM video codec
                  '-crf 30', // Constant Rate Factor for quality
                  '-b:v 0', // Required for CRF in VP9
                  '-deadline realtime' // Speed up encoding
                ])
                .toFormat('webm')
                .on('start', (cmd) => console.log(`🎬 [Media] FFmpeg started: ${cmd}`))
                .on('end', () => {
                  console.log(`🎬 [Media] FFmpeg finished: ${filename}`);
                  if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput); // Cleanup temp file
                  resolve();
                })
                .on('error', (err) => {
                  console.error('🎬 [Media] FFmpeg error:', err);
                  if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
                  reject(err);
                })
                .save(filepath);
            });

            results.push({
              originalName: file.originalname,
              primary: `/uploads/1080/${filename}`,
              thumbnail: `/uploads/1080/${filename}` // Use video itself as thumbnail
            });
        } catch (err) {
            console.error('🎬 [Media] Video processing failed, falling back to original buffer:', err);
            // Fallback: save original buffer if ffmpeg fails
            const fallbackFilename = `${contentHash}-${safeName}${path.extname(file.originalname) || '.mp4'}`;
            const fallbackPath = path.join(UPLOADS_ROOT, '1080', fallbackFilename);
            if (!existsSync(fallbackPath)) {
                fs.writeFileSync(fallbackPath, file.buffer);
            }
            results.push({
                originalName: file.originalname,
                primary: `/uploads/1080/${fallbackFilename}`,
                thumbnail: `/uploads/1080/${fallbackFilename}`
            });
        }
      } else {
        // Handle Image Processing
        const processVariant = async (width, format, quality) => {
          const filename = `${contentHash}-${safeName}-${width}w.${format}`;
          const filepath = path.join(UPLOADS_ROOT, width.toString(), filename);
          
          // Deduplication Check
          if (existsSync(filepath)) {
              console.log(`🖼️ [Media] Image variant already exists, skipping: ${filename}`);
              return `/uploads/${width}/${filename}`;
          }

          try {
            const { default: sharp } = await import('sharp');
            await sharp(file.buffer).rotate().resize(width, null, { withoutEnlargement: true }).sharpen({ sigma: 0.8, m1: 0.5, m2: 0.5 }).toFormat(format, { quality }).toFile(filepath);
          } catch (e) {
            console.error('Sharp processing failed, saving raw file instead:', e);
            const fs = await import('fs');
            fs.writeFileSync(filepath, file.buffer);
          }
          return `/uploads/${width}/${filename}`;
        };

        const [desktopWebP, mobileThumb] = await Promise.all([
            processVariant(1080, 'webp', 85),
            processVariant(300, 'webp', 80)
        ]);
        
        results.push({ 
            originalName: file.originalname, 
            primary: desktopWebP,
            thumbnail: mobileThumb 
        });
      }
    }
    res.json({ success: true, files: results });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- LOGO UPLOAD & SERVE ---
router.post('/api/settings/logo', requireStaff, upload.single('logo'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
        const filepath = path.join(UPLOADS_ROOT, 'custom_logo.png');
        try {
            const { default: sharp } = await import('sharp');
            await sharp(req.file.buffer).png().toFile(filepath);
        } catch (e) {
            console.error('Sharp processing failed, saving raw file instead:', e);
            const fs = await import('fs');
            fs.writeFileSync(filepath, req.file.buffer);
        }
        res.json({ success: true, url: '/api/settings/logo.png?t=' + Date.now() });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/api/settings/logo.png', (req, res) => {
    const customLogoPath = path.join(UPLOADS_ROOT, 'custom_logo.png');
    if (existsSync(customLogoPath)) {
        res.sendFile(customLogoPath);
    } else {
        res.redirect('https://cdn-icons-png.flaticon.com/512/2611/2611152.png');
    }
});

// Catch-all for /logo.png to prevent infinite loops from cached clients
router.get('/logo.png', (req, res) => {
    res.redirect('https://cdn-icons-png.flaticon.com/512/2611/2611152.png');
});

// --- API ROUTES ---

router.post('/api/media/deterministic-enhance', requireStaff, async (req, res) => {
    try {
        const { base64Image } = req.body;
        const cleanBase64 = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;
        const buffer = Buffer.from(cleanBase64, 'base64');
        const { default: sharp } = await import('sharp');
        
        const enhancedBuffer = await sharp(buffer)
            .normalize() // basic auto-contrast
            .modulate({
                brightness: 1.05,
                saturation: 1.15
            })
            .sharpen({ sigma: 1.5, m1: 1, m2: 1 })
            .toFormat('jpeg', { quality: 95 })
            .toBuffer();

        const dataUri = `data:image/jpeg;base64,${enhancedBuffer.toString('base64')}`;
        res.json({ success: true, data: dataUri });
    } catch (error) {
        console.error("Deterministic Enhance Error:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

    return router;
}
