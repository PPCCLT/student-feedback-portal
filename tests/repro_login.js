
async function attemptLogin() {
    const url = 'http://localhost:4001/api/login';
    console.log('Attempting login to:', url);
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ department: 'Super Admin', password: 'superadmin123' })
        });
        console.log('Status:', res.status);
        const text = await res.text();
        console.log('Body:', text);
    } catch (e) {
        console.error('Fetch error:', e.message);
    }
}

attemptLogin();
