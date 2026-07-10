const { spawn } = require('child_process');
const fs = require('fs');

async function run() {
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
    
    // We create a tiny dummy JPEG to test
    const dummyJpeg = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";
    const clean = dummyJpeg.split(',')[1];
    
    pythonProcess.stdin.write(clean);
    pythonProcess.stdin.end();
}
run();
