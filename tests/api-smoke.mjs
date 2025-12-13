const BASE = process.env.BASE_URL || 'http://localhost:3000';

async function main() {
  const outputs = [];

  // Health
  const healthRes = await fetch(`${BASE}/health`);
  outputs.push(['GET /health', healthRes.status, await healthRes.json()]);

  // Create feedback
  const createRes = await fetch(`${BASE}/api/feedbacks`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      category: 'General',

      text: `Smoke test ${Date.now()}`,

      suggestions: 'optional'
    })
  });
  const created = await createRes.json();
  outputs.push(['POST /api/feedbacks', createRes.status, created && created.id]);

  // List with pagination and filters
  const listRes = await fetch(`${BASE}/api/feedbacks?limit=5&page=1&category=General`);
  const listJson = await listRes.json();
  outputs.push(['GET /api/feedbacks?limit=5&page=1&category=General', listRes.status, Array.isArray(listJson.data) ? listJson.data.length : 'n/a']);

  // Get single
  if (created && created.id) {
    const getRes = await fetch(`${BASE}/api/feedbacks/${created.id}`);
    outputs.push(['GET /api/feedbacks/:id', getRes.status]);

    // Update status
    const patchRes = await fetch(`${BASE}/api/feedbacks/${created.id}/status`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'in-progress', adminComment: 'ack' })
    });
    outputs.push(['PATCH /api/feedbacks/:id/status', patchRes.status]);
  }

  console.table(outputs.map(([name, status, extra]) => ({ endpoint: name, status, extra })));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});


