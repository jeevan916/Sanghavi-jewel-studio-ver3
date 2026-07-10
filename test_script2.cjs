const { spawn } = require('child_process');
const fs = require('fs');

async function run() {
    const { default: sharp } = await import('sharp');
    // Read the webp as buffer
    // Wait, earlier we found that sharp couldn't open this webp file! 
    // We'll use a normal image from somewhere else, or create a random RGB buffer and save as jpeg.
    
    const jpegBuffer = await sharp({
        create: {
            width: 1080,
            height: 1080,
            channels: 3,
            background: { r: 255, g: 0, b: 0 }
        }
    }).jpeg().toBuffer();
    
    const clean = jpegBuffer.toString('base64');
    
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
        console.log("Code:", code);
        console.log("Error:", errorOutput);
        console.log("Output Length:", outputBase64.length);
    });
    
    pythonProcess.stdin.write(clean);
    pythonProcess.stdin.end();
}
run();
