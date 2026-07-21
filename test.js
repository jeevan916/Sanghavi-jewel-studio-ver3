const http = require('http');
http.get('http://localhost:3000/api/whatsapp/templates', { headers: { 'x-user-role': 'admin' } }, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log(data));
});
