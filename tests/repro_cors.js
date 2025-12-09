
async function attemptCorsLogin() {
    const url = 'http://localhost:4001/api/login';
    console.log('Attempting CORS login to:', url);
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Origin': 'http://evil.com'
            },
            body: JSON.stringify({ department: 'Super Admin', password: 'superadmin123' })
        });
        console.log('Status:', res.status);
        const text = await res.text();
        console.log('Body:', text);
    } catch (e) {
        console.error('Fetch error:', e.message);
    }
}

attemptCorsLogin();
