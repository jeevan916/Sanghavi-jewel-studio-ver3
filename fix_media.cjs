const fs = require('fs');
let content = fs.readFileSync('server/routes/media.js', 'utf8');

const pythonLogic = `
        const { spawn } = require('child_process');

        const pythonProcess = spawn('python3', ['scripts/enhance.py']);
        
        let outputBase64 = '';
        let errorOutput = '';

        pythonProcess.stdout.on('data', (data) => {
            outputBase64 += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });

        pythonProcess.on('close', (code) => {
            if (code !== 0) {
                console.error("Python Script Error:", errorOutput);
                return res.status(500).json({ error: 'Image processing failed' });
            }
            
            const dataUri = \`data:image/jpeg;base64,\${outputBase64.trim()}\`;
            res.json({ success: true, data: dataUri });
        });

        pythonProcess.stdin.write(cleanBase64);
        pythonProcess.stdin.end();
`;

const sharpLogic = `const buffer = Buffer.from(cleanBase64, 'base64');
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

        const dataUri = \`data:image/jpeg;base64,\${enhancedBuffer.toString('base64')}\`;
        res.json({ success: true, data: dataUri });`;

content = content.replace(sharpLogic, pythonLogic);

fs.writeFileSync('server/routes/media.js', content);
