const { spawn } = require('child_process');
const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

async function run() {
    const { default: sharp } = await import('sharp');
    const jpegBuffer = await sharp({
        create: {
            width: 500, height: 500, channels: 3, background: { r: 255, g: 0, b: 0 }
        }
    }).jpeg().toBuffer();
    
    const clean = jpegBuffer.toString('base64');
    
    const id = crypto.randomUUID();
    const inputPath = path.join(os.tmpdir(), `${id}_in.jpg`);
    const outputPath = path.join(os.tmpdir(), `${id}_out.jpg`);
    
    await fs.writeFile(inputPath, clean);
    
    const pythonProcess = spawn('python3', [path.resolve(process.cwd(), 'scripts/enhance.py'), inputPath, outputPath]);
    
    let errorOutput = '';
    pythonProcess.stderr.on('data', (data) => errorOutput += data.toString());
    
    pythonProcess.on('close', async (code) => {
        console.log("Code:", code);
        console.log("Error:", errorOutput);
        if (code === 0) {
            const out = await fs.readFile(outputPath, 'utf8');
            console.log("Output Length:", out.length);
        }
        await fs.unlink(inputPath).catch(e=>{});
        await fs.unlink(outputPath).catch(e=>{});
    });
}
run();
