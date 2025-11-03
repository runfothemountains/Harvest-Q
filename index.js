async function watsonxOrchestrate() {
  const statusEl = document.getElementById('agentStatus');
  statusEl.textContent = 'Connecting to IBM watsonx…';
  try {
    const r = await fetch('/api/agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Initialize Harvest Q agents' })
    });
    const data = await r.json();
    statusEl.innerHTML = `✅ Connected. ${data.text || ''}`;
    window.ORCH_CONNECTED = true;
  } catch (e) {
    statusEl.textContent = '❌ IBM connection failed (demo fallback active).';
  }
}

const trace = (step, payload) => {
  const el = document.getElementById('agentTrace');
  const row = document.createElement('pre');
  row.textContent = `[${new Date().toLocaleTimeString()}] ${step}: ` +
                    JSON.stringify(payload, null, 2);
  el.prepend(row);
};

async function runTool(tool, args){
  trace('CALL', {tool, args});
  const t0 = performance.now();
  const r = await fetch('/api/agent', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({tool, args})
  }).then(x=>x.json()).catch(e=>({ok:false, error:String(e)}));
  trace('RESULT', {tool, ms: Math.round(performance.now()-t0), ...r});
  return r;
}

async function callTool(tool, args = {}) {
  const r = await fetch('/api/agent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // message is optional; tool+args are what your server reads
    body: JSON.stringify({ message: `run ${tool}`, tool, args })
  });
  return r.json();
}

async function aiSuggestFarmersFlow(btn) {
  if (!window.ORCH_CONNECTED) return alert('Connect IBM Agent first.');
  const crop = btn.dataset.crop;
  const minQty = btn.dataset.minqty || '0';
  const location = btn.dataset.location || '';

  // Step 1: find suppliers
  const res1 = await callTool('findSuppliers', { crop, minQty, location, maxDistanceKm: 120 });
  const suppliers = res1.result?.suppliers || res1.suppliers || [];
  if (!suppliers.length) return renderAI(btn, 'No matching suppliers found.');

  // Step 2: score top 3 suppliers
  const top = suppliers.slice(0, 3);
  const scored = [];
  for (const s of top) {
    const { result } = await callTool('scoreMatch', { supplierId: s.supplierId, criteria: { location } });
    scored.push({ ...s, score: (result?.score ?? 0) });
  }
  scored.sort((a,b) => (b.score - a.score));

  // Step 3: route suggestion for the best supplier
  const best = scored[0];
  const route = await callTool('planRoute', { pickup: best.location, dropoff: location });
  const plan = route.result || route;

  // Render
  renderAI(btn, `
    <strong>Top match:</strong> ${best.supplierName} (${best.product})
    <br>Qty: ${best.quantity} • Distance: ${best.distanceKm}km • Score: ${best.score}
    <br>Route: ${plan.distanceKm}km — ${plan.window}
  `);
}

function renderAI(btn, html) {
  const box = btn.parentElement.querySelector('.ai-result') || btn.nextElementSibling;
  if (box) box.innerHTML = html;
}

// Delegate click
document.addEventListener('click', (e) => {
  if (e.target.matches('.ai-suggest-farmers')) aiSuggestFarmersFlow(e.target);
});

async function aiSuggestBuyersFlow(btn) {
  if (!window.ORCH_CONNECTED) return alert('Connect IBM Agent first.');
  const crop = btn.dataset.crop;
  const quantity = btn.dataset.qty || '0';
  const region = btn.dataset.location || '';

  // Use PricingAgent for a quick price hint
  const price = await callTool('suggestPrice', { crop, region, quantity });
  const p = price.result || price;

  // In a full build, you’d query a business dataset here.
  // For the demo, show price + route suggestion to a mock “nearby market”.
  const route = await callTool('planRoute', { pickup: region, dropoff: region });
  const plan = route.result || route;

  renderAI(btn, `
    <strong>Price hint:</strong> ${p.suggestedPricePerUnit} ${p.currency}/unit
    <br>${plan.window} • Est. distance: ${plan.distanceKm}km
  `);
}

document.addEventListener('click', (e) => {
  if (e.target.matches('.ai-suggest-buyers')) aiSuggestBuyersFlow(e.target);
});
