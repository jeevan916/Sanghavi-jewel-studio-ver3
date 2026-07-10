const fs = require('fs');
let content = fs.readFileSync('server/routes/media.js', 'utf8');

const pythonLogic = `        const { spawn } = await import('child_process');

        const pythonProcess = spawn('python3', [path.resolve(process.cwd(), 'scripts/enhance.py')]);`;

const newPythonLogic = `        const { spawn } = await import('child_process');
        const { default: sharp } = await import('sharp');
        
        // Convert to JPEG first to ensure OpenCV can read it
        const buffer = Buffer.from(cleanBase64, 'base64');
        const jpegBuffer = await sharp(buffer).toFormat('jpeg').toBuffer();
        const jpegBase64 = jpegBuffer.toString('base64');

        const pythonProcess = spawn('python3', [path.resolve(process.cwd(), 'scripts/enhance.py')]);`;

content = content.replace(pythonLogic, newPythonLogic);

// Replace stdin.write(cleanBase64) with stdin.write(jpegBase64)
content = content.replace('pythonProcess.stdin.write(cleanBase64);', 'pythonProcess.stdin.write(jpegBase64);');

fs.writeFileSync('server/routes/media.js', content);
