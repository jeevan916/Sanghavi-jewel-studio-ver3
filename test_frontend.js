async function run() {
    try {
        const res = await fetch('http://localhost:3000/api/media/deterministic-enhance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ base64Image: "data:image/jpeg;base64,invalidbase64" })
        });
        console.log("Status:", res.status);
        const text = await res.text();
        console.log("Response:", text);
    } catch (e) {
        console.error("Error:", e.message);
    }
}
run();
