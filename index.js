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
