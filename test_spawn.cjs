const { spawn } = require('child_process');
const crypto = require('crypto');
const cleanBase64 = crypto.randomBytes(5 * 1024 * 1024).toString('base64'); // 5MB payload

console.log("Starting spawn test, payload size:", cleanBase64.length);

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
    console.log("Process closed with code", code);
    console.log("Error output:", errorOutput);
    console.log("Output size:", outputBase64.length);
});

pythonProcess.stdin.write(cleanBase64);
pythonProcess.stdin.end();

