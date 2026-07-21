const http = require('http');

http.get('http://localhost:3000/api/config', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        const config = JSON.parse(data);
        config.whatsappGoldRateTemplateName = 'new_template_name';
        
        const postData = JSON.stringify(config);
        
        const req = http.request({
            hostname: 'localhost',
            port: 3000,
            path: '/api/config',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-Role': 'admin', // Wait, requireAdmin expects a valid JWT token!
            }
        }, (res) => {
            let resData = '';
            res.on('data', d => resData += d);
            res.on('end', () => console.log('Response:', res.statusCode, resData));
        });
        
        req.write(postData);
        req.end();
    });
});
