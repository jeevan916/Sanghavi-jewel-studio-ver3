const http = require('http');

http.get('http://localhost:3000/api/config', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        const config = JSON.parse(data);
        config.whatsappGoldRateTemplateName = 'new_template_name';
        
        // We need an admin token to save
        // We can create a fake token or modify server to skip auth for this test
    });
});
