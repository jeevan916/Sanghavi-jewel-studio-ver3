const http = require('http');

http.get('http://localhost:3000/_proxy/JTJGYXV0aCUyRnZlcmlmeQ==', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log(res.statusCode, data));
});
