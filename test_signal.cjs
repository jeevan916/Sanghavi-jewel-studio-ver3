const { spawn } = require('child_process');

const pythonProcess = spawn('python3', ['-c', 'import time; time.sleep(10)']);

pythonProcess.on('close', (code, signal) => {
    console.log("close:", code, signal);
});

setTimeout(() => pythonProcess.kill('SIGKILL'), 500);

