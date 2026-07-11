const sharp = require('sharp');
const fs = require('fs');

async function run() {
    try {
        const buf = await sharp({
            create: { width: 100, height: 100, channels: 3, background: { r: 255, g: 0, b: 0 } }
        }).jpeg().toBuffer();
        
        await sharp(buf).resize(300, null).toFormat('webp').toFile('test_out.webp');
        console.log("Sharp success");
    } catch (e) {
        console.error("Sharp error", e);
    }
}
run();
