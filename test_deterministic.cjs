const http = require('http');

const body = JSON.stringify({
    base64Image: "data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA=="
});

const req = http.request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/media/deterministic-enhance',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        // mock auth using a dummy role that requiresStaff allows?
        // Wait, the API requires a real JWT token because requireStaff uses jwt.verify
    }
}, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => console.log('Status:', res.statusCode));
});
req.on('error', console.error);
req.write(body);
req.end();
