const http = require('http');

const body = JSON.stringify({
    // We send a tiny valid JPEG base64 to test the API route (bypass sharp/cv2 issues)
    base64Image: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA="
});

const req = http.request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/media/deterministic-enhance',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
    }
}, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => console.log('Status:', res.statusCode, 'Body:', data));
});
req.on('error', console.error);
req.write(body);
req.end();
