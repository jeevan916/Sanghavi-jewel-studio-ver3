// Hostinger Passenger Wrapper
// Passenger uses require() to load the main file. Since our app is an ES Module ("type": "module"),
// require('server.js') will throw ERR_REQUIRE_ESM and crash with a 503 error.
// This wrapper dynamically imports the ES module, bypassing the issue.

async function start() {
    try {
        await import('./server.js');
    } catch (err) {
        console.error('Failed to load ES module server:', err);
    }
}

start();
