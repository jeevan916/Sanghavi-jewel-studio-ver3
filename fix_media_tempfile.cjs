const fs = require('fs');
let content = fs.readFileSync('server/routes/media.js', 'utf8');

const routeLogicStart = "router.post('/api/media/deterministic-enhance', requireStaff, async (req, res) => {";
const routeLogicEnd = "});";
// We'll just replace the entire route body
const newRoute = `router.post('/api/media/deterministic-enhance', requireStaff, async (req, res) => {
    try {
        const { base64Image } = req.body;
        const cleanBase64 = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;
        
        const { spawn } = await import('child_process');
        const fs = await import('fs/promises');
        const crypto = await import('crypto');
        const path = await import('path');
        const os = await import('os');
        
        const id = crypto.randomUUID();
        const inputPath = path.join(os.tmpdir(), \`\${id}_in.jpg\`);
        const outputPath = path.join(os.tmpdir(), \`\${id}_out.jpg\`);
        
        // Write the base64 input to the input file
        await fs.writeFile(inputPath, cleanBase64);
        
        const pythonProcess = spawn('python3', [path.resolve(process.cwd(), 'scripts/enhance.py'), inputPath, outputPath]);
        
        let errorOutput = '';
        pythonProcess.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });

        pythonProcess.on('close', async (code) => {
            try {
                if (code !== 0) {
                    console.error("Python Script Error:", errorOutput);
                    return res.status(500).json({ error: 'Image processing failed' });
                }
                
                const outputBase64 = await fs.readFile(outputPath, 'utf8');
                const dataUri = \`data:image/jpeg;base64,\${outputBase64.trim()}\`;
                res.json({ success: true, data: dataUri });
            } catch (err) {
                console.error("Error reading output:", err);
                res.status(500).json({ error: 'Failed to read processed image' });
            } finally {
                // Cleanup files
                await fs.unlink(inputPath).catch(e => {});
                await fs.unlink(outputPath).catch(e => {});
            }
        });

    } catch (error) {
        console.error("Deterministic Enhance Error:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
});`;

// Extract the old route body and replace it
const startIdx = content.indexOf(routeLogicStart);
if (startIdx === -1) throw new Error("Could not find start");
const remaining = content.slice(startIdx);
const nextRoute = remaining.indexOf("router.post('/api/media/stream");
if (nextRoute === -1) {
    // If not found, find the end of the file or something else
    // Wait, let's just use a regex
}

const beforeRoute = content.slice(0, startIdx);
const afterRoute = content.slice(startIdx).substring(content.slice(startIdx).indexOf("});") + 3);

fs.writeFileSync('server/routes/media.js', beforeRoute + newRoute + afterRoute);
