const { spawn } = require('child_process');
const fs = require('fs');
async function run() {
    const { default: sharp } = await import('sharp');
    const buffer = fs.readFileSync('data/uploads/1080/0267116d9670-1783232394957-1080w.webp');
    const jpegBuffer = await sharp(buffer).toFormat('jpeg').toBuffer();
    const jpegBase64 = jpegBuffer.toString('base64');
    
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
    pythonProcess.stdin.write(jpegBase64);
    pythonProcess.stdin.end();
}
run();
