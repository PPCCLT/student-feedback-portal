
// Use built-in fetch (Node 18+) or dynamic import if needed, but for simplicity in this env:
// We'll just use standard fetch which is available in Node 20+ (likely env).

async function testFeedbackFlow() {
    const baseUrl = 'http://localhost:4001';

    console.log('Creating feedback...');
    try {
        const createRes = await fetch(`${baseUrl}/api/feedbacks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                category: 'Academic',

                text: 'Test feedback for tracking',

                studentName: 'Test Student'
            })
        });

        if (!createRes.ok) {
            console.error('Failed to create feedback:', createRes.status, await createRes.text());
            return;
        }

        const created = await createRes.json();
        console.log('Created feedback:', created.id);

        console.log('Fetching feedback...');
        const getRes = await fetch(`${baseUrl}/api/feedbacks/${created.id}`);

        if (!getRes.ok) {
            console.error('Failed to fetch feedback:', getRes.status, await getRes.text());
            return;
        }

        const fetched = await getRes.json();
        console.log('Fetched feedback successfully:', fetched.id === created.id);
        console.log('Data:', fetched);

    } catch (e) {
        console.error('Error:', e.message);
    }
}

testFeedbackFlow();
