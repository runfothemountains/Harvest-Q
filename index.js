/* Harvest Q – Stage 2/3 front-end controller (FULL)
 * File: ./js/app.js
 * - Tabs & language strings
 * - Market loader (data/marketIndex.json + data/market/*.json)
 * - Farmers/Consumers rendering + Leaflet map
 * - Post Listing (in-memory)
 * - AI panel (Pricing/Match)
 * - AI Playground (trace + runTool)
 * - IBM Connect button + status + demo flows (suggest farmers/buyers)
 * - Quick Start prompt runner
 */

///////////////////////////////
// Small helpers
///////////////////////////////
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const on = (el, evt, cb) => el && el.addEventListener(evt, cb);

function showErrorOverlay(msg) {
  const box = $('#hq-error');
  if (!box) return alert(msg || 'Error');
  $('#hq-error-text')?.textContent = String(msg || 'Unknown error');
  box.hidden = false;
}

function toMoney(n, unit = '$') {
  const v = Number(n);
  if (Number.isNaN(v)) return n;
  return `${unit}${v.toFixed(2)}`;
}

///////////////////////////////
// Tabs / Panels
///////////////////////////////
function initTabs() {
  const tabs = $('#tabs');
  on(tabs, 'click', (e) => {
    const btn = e.target.closest('button[data-panel]');
    if (!btn) return;
    const target = btn.getAttribute('data-panel');
    $$('main [role="tabpanel"]').forEach(sec => sec.hidden = true);
    const panel = document.getElementById(target);
    if (panel) panel.hidden = false;
    $$('#tabs button[data-panel]').forEach(b => b.classList.toggle('active', b === btn));
  });
  const first = $$('#tabs button[data-panel]')[0];
  if (first) first.click();
}

///////////////////////////////
// Language (basic placeholders)
///////////////////////////////
function initLanguage() {
  const langSelect = $('#langSelect');
  on(langSelect, 'change', () => applyLanguage(langSelect.value));
  applyLanguage(langSelect?.value || 'en');
}

function applyLanguage(lang) {
  const strings = {
    en: {
      whatTitle: 'What is Harvest Q?',
      whatContent: 'A direct marketplace where farmers list products and consumers buy or barter directly.',
      philContent: 'Community, transparency, fair pricing.',
      philQuote: '“Feeding people is nation-building.”',
      homeSwitchNote: 'Use filters to view listings by country and region.',
      lawsDisclaimer: 'These summaries are not legal advice.',
      tradeDisclaimer: 'Trade panel will expand in Stage 3/4 with advanced flows.',
      aiPriceBtn: 'Get Price Suggestion',
      aiMatchBtn: 'Find Match',
      footer: '© Harvest Q — Stage 3 (Work in Progress)'
    },
    hi: {
      whatTitle: 'हार्वेस्ट Q क्या है?',
      whatContent: 'एक डायरेक्ट मार्केटप्लेस जहाँ किसान उत्पाद सूचीबद्ध करते हैं और उपभोक्ता सीधे खरीदते/विनिमय करते हैं।',
      philContent: 'समुदाय, पारदर्शिता, उचित मूल्य।',
      philQuote: '“लोगों को भोजन देना राष्ट्र निर्माण है।”',
      homeSwitchNote: 'देश और क्षेत्र के अनुसार लिस्टिंग देखने के लिए फ़िल्टर का उपयोग करें।',
      lawsDisclaimer: 'ये सारांश कानूनी सलाह नहीं हैं।',
      tradeDisclaimer: 'ट्रेड पैनल स्टेज 3/4 में उन्नत फ्लो के साथ विस्तारित होगा।',
      aiPriceBtn: 'क़ीमत सुझाव',
      aiMatchBtn: 'मिलान खोजें',
      footer: '© हार्वेस्ट Q — स्टेज 3 (कार्य प्रगति पर है)'
    }
  }[lang] || {};
  $('#home-what-title') && ($('#home-what-title').textContent = strings.whatTitle || '');
  $('#home-what-content') && ($('#home-what-content').textContent = strings.whatContent || '');
  $('#home-phil-content') && ($('#home-phil-content').textContent = strings.philContent || '');
  $('#home-phil-quote') && ($('#home-phil-quote').textContent = strings.philQuote || '');
  $('#home-switch-note') && ($('#home-switch-note').textContent = strings.homeSwitchNote || '');
  $('#laws-disclaimer') && ($('#laws-disclaimer').textContent = strings.lawsDisclaimer || '');
  $('#trade-disclaimer') && ($('#trade-disclaimer').textContent = strings.tradeDisclaimer || '');
  $('#ai-price-btn-text') && ($('#ai-price-btn-text').textContent = strings.aiPriceBtn || 'Get Price');
  $('#ai-match-btn-text') && ($('#ai-match-btn-text').textContent = strings.aiMatchBtn || 'Find Match');
  $('#footer-text') && ($('#footer-text').textContent = strings.footer || '');
}

///////////////////////////////
// Markets (country data)
///////////////////////////////
let marketIndex = { markets: [] };
let currentMarket = null;

async function initMarketFilters() {
  try {
    const r = await fetch('data/marketIndex.json');
    marketIndex = await r.json();
  } catch {
    marketIndex = { markets: [] };
  }
  const countrySel = $('#countrySelect');
  if (countrySel) {
    countrySel.innerHTML = '';
    marketIndex.markets.forEach(m =>
      countrySel.appendChild(new Option(m.country, m.file))
    );
    $('#stateSelect') && ($('#stateSelect').innerHTML = '');
    $('#citySelect') && ($('#citySelect').innerHTML = '<option value="">All Cities</option>');
    on($('#refreshBtn'), 'click', () => loadSelectedMarket());
    on(countrySel, 'change', () => loadSelectedMarket());
    if (countrySel.options.length) {
      countrySel.selectedIndex = 0;
      await loadSelectedMarket();
    }
  }
}

async function loadSelectedMarket() {
  const file = $('#countrySelect')?.value;
  if (!file) return;
  try {
    const r = await fetch(file);
    currentMarket = await r.json();
    renderFarmers();
    renderConsumers();
    renderMap();
    $('#home-warning') && ($('#home-warning').textContent = '');
  } catch (e) {
    currentMarket = null;
    $('#farmerGrid') && ($('#farmerGrid').innerHTML = '');
    $('#consumerGrid') && ($('#consumerGrid').innerHTML = '');
    $('#home-warning') && ($('#home-warning').textContent = 'Could not load market data for this country.');
    console.error(e);
  }
}

///////////////////////////////
// Grids
///////////////////////////////
function renderFarmers() {
  const grid = $('#farmerGrid');
  if (!grid) return;
  grid.innerHTML = '';
  if (!currentMarket?.farmers?.length) {
    grid.innerHTML = `<div class="muted">No farmer listings yet.</div>`;
    return;
  }
  const search = ($('#farmerSearch')?.value || '').toLowerCase();
  const mode = $('#modeFilter')?.value || 'all';
  const sortBy = $('#sortBy')?.value || 'name';

  let items = [];
  currentMarket.farmers.forEach(f => {
    (f.products || []).forEach(p => {
      items.push({
        farmerId: f.id, farmer: f.name, location: f.location,
        productId: p.id, product: p.name, qty: p.quantity,
        price: p.price_per_kg ?? p.price_per_liter ?? null,
        unit: (p.price_per_kg != null) ? '/kg' : (p.price_per_liter != null) ? '/liter' : '',
        barter: !!p.barter, notes: p.notes || ''
      });
    });
  });

  if (search) {
    items = items.filter(x =>
      x.farmer.toLowerCase().includes(search) ||
      x.product.toLowerCase().includes(search) ||
      x.location.toLowerCase().includes(search)
    );
  }
  if (mode !== 'all') {
    if (mode === 'sale') items = items.filter(x => x.price != null);
    if (mode === 'trade') items = items.filter(x => x.barter === true);
    if (mode === 'both') items = items.filter(x => x.price != null && x.barter === true);
  }
  if (sortBy === 'name') items.sort((a,b)=>a.product.localeCompare(b.product));
  if (sortBy === 'priceAsc') items.sort((a,b)=>(a.price??Infinity)-(b.price??Infinity));

  items.forEach(x => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <h4>${x.product} ${x.barter ? '<span class="chip">Barterable</span>' : ''}</h4>
      <div class="muted">${x.qty || ''}</div>
      <div><strong>${x.price!=null ? toMoney(x.price) + x.unit : '—'}</strong></div>
      <div class="muted">Farmer: ${x.farmer} • ${x.location}</div>
      ${x.notes ? `<div class="muted">${x.notes}</div>` : ''}
    `;
    grid.appendChild(card);
  });
}

function renderConsumers() {
  const grid = $('#consumerGrid');
  if (!grid) return;
  grid.innerHTML = '';
  if (!currentMarket?.consumers?.length) {
    grid.innerHTML = `<div class="muted">No consumer requests yet.</div>`;
    return;
  }
  const search = ($('#consumerSearch')?.value || '').toLowerCase();
  currentMarket.consumers
    .filter(c => !search ||
      c.name.toLowerCase().includes(search) ||
      c.location.toLowerCase().includes(search) ||
      c.request?.product?.toLowerCase().includes(search))
    .forEach(c => {
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <h4>${c.name}</h4>
        <div class="muted">${c.location}</div>
        <div><strong>Wants:</strong> ${c.request?.product || ''}</div>
        <div><strong>Qty:</strong> ${c.request?.quantity || ''}</div>
        ${c.request?.notes ? `<div class="muted">${c.request.notes}</div>` : ''}
      `;
      grid.appendChild(card);
    });
}

///////////////////////////////
// Map (Leaflet; coarse demo)
///////////////////////////////
let map;
function renderMap() {
  const mapDiv = $('#map');
  if (!mapDiv) return;
  if (!map) {
    map = L.map('map', { zoomControl: true }).setView([10, 10], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18, attribution: '&copy; OpenStreetMap'
    }).addTo(map);
  }
  map.invalidateSize();
  map.setView([10,10], 2);

  // cheap coordinate guess so we can place markers in demo
  const guessLatLng = (loc='') => {
    let h=0; for (let i=0;i<loc.length;i++) h = (h*31 + loc.charCodeAt(i))|0;
    const lat = ((h % 120) - 60);
    const lng = (((h/120|0) % 360) - 180);
    return [lat, lng];
  };
  // Remove old markers by re-creating a layer group (simplest demo approach)
  // In a real app, keep refs and remove them; okay for demo.
  map.eachLayer(l => { if (l instanceof L.Marker) map.removeLayer(l); });

  if (currentMarket?.farmers) {
    currentMarket.farmers.forEach(f => {
      const [lat,lng] = guessLatLng(`${currentMarket.country} ${f.location}`);
      L.marker([lat,lng]).addTo(map)
        .bindPopup(`<strong>${f.name}</strong><br>${f.location}`);
    });
  }
}

///////////////////////////////
// Post Listing (in-memory)
///////////////////////////////
function initPostModal() {
  const modal = $('#postModal');
  const open = $('#postOpenBtn');
  const cancel = $('#postCancel');
  const form = $('#postForm');

  on(open, 'click', () => { if (modal) modal.hidden = false; });
  on(cancel, 'click', () => { if (modal) modal.hidden = true; });

  on(form, 'submit', (e) => {
    e.preventDefault();
    try {
      const farm = $('#pfFarm').value.trim();
      const prod = $('#pfProduct').value.trim();
      const qty = $('#pfQty').value.trim();
      const price = parseFloat($('#pfPrice').value);
      const mode = $('#pfMode').value;

      if (!farm || !prod || !qty || !price || price <= 0)
        throw new Error('Please fill all fields with valid values.');

      if (!currentMarket) currentMarket = { country:'Custom', farmers:[], consumers:[] };
      let f = currentMarket.farmers.find(x => x.name === farm);
      if (!f) {
        f = { id:`local-${Date.now()}`, name:farm, location:'Local', products:[] };
        currentMarket.farmers.push(f);
      }
      f.products.push({
        id:`p-${Date.now()}`, name: prod, quantity: qty,
        price_per_kg: price, barter: (mode !== 'sale'), notes: ''
      });
      renderFarmers();
      if (modal) modal.hidden = true;
      form.reset();
    } catch (err) {
      $('#postErrors') && ($('#postErrors').textContent = String(err.message || err));
    }
  });
}

///////////////////////////////
// AI: Pricing & Match (AI tab)
///////////////////////////////
async function aiPriceHandler() {
  const crop = $('#aiCrop')?.value || 'Tomatoes';
  const qty = $('#aiQty')?.value || '100 kg';
  try {
    const res = await callAgent('priceBands', { product: crop, quantity: qty, location: currentMarket?.country || 'Global' });
    $('#aiPriceOut') && ($('#aiPriceOut').textContent = JSON.stringify(res, null, 2));
  } catch (e) {
    $('#aiPriceOut') && ($('#aiPriceOut').textContent = 'Error: ' + e.message);
  }
}

async function aiMatchHandler() {
  const want = $('#aiWant')?.value || 'Tomatoes';
  try {
    const res = await callAgent('findBarterMatch', {
      itemOffered: want, itemWanted: want,
      location: currentMarket?.country || 'Global'
    });
    $('#aiMatchOut') && ($('#aiMatchOut').textContent = JSON.stringify(res, null, 2));
  } catch (e) {
    $('#aiMatchOut') && ($('#aiMatchOut').textContent = 'Error: ' + e.message);
  }
}

///////////////////////////////
// AI Playground: trace + runner
///////////////////////////////
const trace = (step, payload) => {
  const el = document.getElementById('agentTrace');
  if (!el) return;
  const row = document.createElement('pre');
  row.textContent = `[${new Date().toLocaleTimeString()}] ${step}: ` +
                    JSON.stringify(payload, null, 2);
  el.prepend(row);
};

async function callAgent(tool, args) {
  trace('CALL', { tool, args });
  const t0 = performance.now();
  let out;
  try {
    const r = await fetch('/api/agent', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ tool, args })
    });
    out = await r.json();
  } catch (e) {
    out = { ok:false, error:String(e) };
  }
  trace('RESULT', { tool, ms: Math.round(performance.now()-t0), ...out });
  if (out && out.ok) return out;
  throw new Error(out?.error || `Tool "${tool}" not available on server yet.`);
}

function initPlayground() {
  const runBtn = $('#runToolBtn');
  on(runBtn, 'click', async () => {
    const tool = $('#toolSelect')?.value || 'priceBands';
    try { await callAgent(tool, {}); }
    catch (e) { showErrorOverlay(e.message); }
  });
}

///////////////////////////////
// IBM Connect + demo flows
///////////////////////////////
async function watsonxOrchestrate() {
  const statusEl = document.getElementById('agentStatus');
  if (statusEl) statusEl.textContent = 'Connecting to IBM watsonx…';
  try {
    const r = await fetch('/api/agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Initialize Harvest Q agents' })
    });
    const data = await r.json();
    if (statusEl) statusEl.innerHTML = `✅ Connected. ${data.text || ''}`;
    window.ORCH_CONNECTED = true;
  } catch (e) {
    if (statusEl) statusEl.textContent = '❌ IBM connection failed (demo fallback active).';
    window.ORCH_CONNECTED = false;
  }
}

// generic tool caller compatible with your pasted flows
async function callTool(tool, args = {}) {
  const r = await fetch('/api/agent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: `run ${tool}`, tool, args })
  });
  return r.json();
}

function renderAI(btn, html) {
  const box = btn.parentElement.querySelector('.ai-result') || btn.nextElementSibling;
  if (box) box.innerHTML = html;
}

// DEMO: “Suggest Farmers” (requires ORCH_CONNECTED true)
async function aiSuggestFarmersFlow(btn) {
  if (!window.ORCH_CONNECTED) return alert('Connect IBM Agent first.');
  const crop = btn.dataset.crop;
  const minQty = btn.dataset.minqty || '0';
  const location = btn.dataset.location || '';

  const res1 = await callTool('findSuppliers', { crop, minQty, location, maxDistanceKm: 120 });
  const suppliers = res1.result?.suppliers || res1.suppliers || [];
  if (!suppliers.length) return renderAI(btn, 'No matching suppliers found.');

  const top = suppliers.slice(0, 3);
  const scored = [];
  for (const s of top) {
    const { result } = await callTool('scoreMatch', { supplierId: s.supplierId, criteria: { location } });
    scored.push({ ...s, score: (result?.score ?? 0) });
  }
  scored.sort((a,b) => (b.score - a.score));

  const best = scored[0];
  const route = await callTool('planRoute', { pickup: best.location, dropoff: location });
  const plan = route.result || route;

  renderAI(btn, `
    <strong>Top match:</strong> ${best.supplierName} (${best.product})
    <br>Qty: ${best.quantity} • Distance: ${best.distanceKm}km • Score: ${best.score}
    <br>Route: ${plan.distanceKm ?? '?'}km — ${plan.window ?? 'window TBD'}
  `);
}

// DEMO: “Suggest Buyers”
async function aiSuggestBuyersFlow(btn) {
  if (!window.ORCH_CONNECTED) return alert('Connect IBM Agent first.');
  const crop = btn.dataset.crop;
  const quantity = btn.dataset.qty || '0';
  const region = btn.dataset.location || '';

  const price = await callTool('suggestPrice', { crop, region, quantity });
  const p = price.result || price;

  const route = await callTool('planRoute', { pickup: region, dropoff: region });
  const plan = route.result || route;

  renderAI(btn, `
    <strong>Price hint:</strong> ${p.suggestedPricePerUnit ?? '?'} ${p.currency ?? ''}/unit
    <br>${plan.window ?? 'ETA TBD'} • Est. distance: ${plan.distanceKm ?? '?'}km
  `);
}

// wire demo buttons (delegated)
document.addEventListener('click', (e) => {
  if (e.target.matches('.ai-suggest-farmers')) aiSuggestFarmersFlow(e.target);
  if (e.target.matches('.ai-suggest-buyers'))  aiSuggestBuyersFlow(e.target);
});

function initIBMConnect() {
  const btn = $('#connectIBMBtn');
  on(btn, 'click', watsonxOrchestrate);
  // Optional auto-init: try to connect silently on load
  // watsonxOrchestrate(); // uncomment if you want auto-connect attempt
}

///////////////////////////////
// Quick Start prompts
///////////////////////////////
function initQuickStart() {
  $$('#panel-quickstart .qs-btn').forEach(btn => {
    on(btn, 'click', async () => {
      const prompt = btn.getAttribute('data-prompt') || '';
      try {
        // Generic “chat” tool; if not implemented, fall back to logging
        await callAgent('chat', { prompt });
      } catch {
        trace('PROMPT', { prompt, note: 'Backend chat tool not found; showing prompt only.' });
      }
    });
  });
}

///////////////////////////////
// Search/sort and AI tab hooks
///////////////////////////////
function initSearchSort() {
  on($('#farmerSearch'), 'input', renderFarmers);
  on($('#modeFilter'), 'change', renderFarmers);
  on($('#sortBy'), 'change', renderFarmers);
  on($('#consumerSearch'), 'input', renderConsumers);
}

function initAIDemos() {
  on($('#aiPriceBtn'), 'click', aiPriceHandler);
  on($('#aiMatchBtn'), 'click', aiMatchHandler);
}

///////////////////////////////
// Boot
///////////////////////////////
document.addEventListener('DOMContentLoaded', async () => {
  try {
    initTabs();
    initLanguage();
    initSearchSort();
    initAIDemos();
    initPlayground();
    initQuickStart();
    initPostModal();
    initIBMConnect();
    await initMarketFilters();
  } catch (e) {
    console.error(e);
    showErrorOverlay(e.message || e);
  }
});
