/* Harvest Q – Stage 3 front-end controller (FINAL BUILD)
 * Syncs with updated index.html
 * - Tabs, Language, Markets, AI, Grants, Health, Trade, Laws
 */

///////////////////////////////
// Helpers
///////////////////////////////
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const on = (el, evt, cb) => el && el.addEventListener(evt, cb);

function showErrorOverlay(msg) {
  const box = $('#hq-error');
  if (!box) return alert(msg || 'Error');
  $('#hq-error-text').textContent = msg || 'Unknown error';
  box.hidden = false;
}

function toMoney(n, unit = '$') {
  const v = Number(n);
  if (Number.isNaN(v)) return n;
  return `${unit}${v.toFixed(2)}`;
}

///////////////////////////////
// Tabs
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
// Language
///////////////////////////////
function initLanguage() {
  const langSelect = $('#langSelect');
  on(langSelect, 'change', () => applyLanguage(langSelect.value));
  applyLanguage(langSelect.value || 'en');
}

function applyLanguage(lang) {
  const text = {
    en: {
      whatTitle: 'What is Harvest Q?',
      whatContent: 'A marketplace where farmers sell or barter, consumers buy local, and communities grow stronger.',
      homeSwitchNote: 'Use filters to explore markets by country.',
      aiPriceBtn: 'Get Price Suggestion',
      aiMatchBtn: 'Find Match',
      footer: '© Harvest Q — Connecting Farms & Communities'
    },
    hi: {
      whatTitle: 'हार्वेस्ट Q क्या है?',
      whatContent: 'एक प्लेटफ़ॉर्म जहां किसान बेचते या विनिमय करते हैं, और उपभोक्ता स्थानीय उत्पाद खरीदते हैं।',
      homeSwitchNote: 'देश के अनुसार बाजार देखने के लिए फ़िल्टर करें।',
      aiPriceBtn: 'क़ीमत सुझाव',
      aiMatchBtn: 'मिलान खोजें',
      footer: '© हार्वेस्ट Q — खेतों और समुदायों को जोड़ना'
    }
  }[lang];

  $('#home-what-title').textContent = text.whatTitle;
  $('#home-what-content').textContent = text.whatContent;
  $('#home-switch-note').textContent = text.homeSwitchNote;
  $('#ai-price-btn-text').textContent = text.aiPriceBtn;
  $('#ai-match-btn-text').textContent = text.aiMatchBtn;
  $('#footer-text').textContent = text.footer;
}

///////////////////////////////
// Country Filters (15 Nations)
///////////////////////////////
const COUNTRIES = [
  'US', 'India', 'Nigeria', 'Russia', 'Canada', 'China', 'Germany', 'Brazil',
  'Kenya', 'Ethiopia', 'Turkey', 'France', 'Spain', 'Italy', 'Guatemala'
];

async function initMarketFilters() {
  const countrySel = $('#countrySelect');
  countrySel.innerHTML = '';
  COUNTRIES.forEach(c => countrySel.appendChild(new Option(c, c)));
  $('#stateSelect').innerHTML = '';
  $('#citySelect').innerHTML = '<option>All Cities</option>';
  on($('#refreshBtn'), 'click', () => refreshMarket(countrySel.value));
  on(countrySel, 'change', () => refreshMarket(countrySel.value));
  refreshMarket(COUNTRIES[0]);
}

async function refreshMarket(country) {
  // Demo: generate fake sample market data per country
  const sample = {
    country,
    farmers: [
      { id: 1, name: 'Aisha Bello', location: country + ' Central', products: [{ name: 'Tomatoes', quantity: '200 kg', price_per_kg: 1.5, barter: true }] },
      { id: 2, name: 'Carlos Gomez', location: country + ' North', products: [{ name: 'Onions', quantity: '150 kg', price_per_kg: 1.2 }] }
    ],
    consumers: [
      { name: 'Maria D.', location: country + ' Market', request: { product: 'Tomatoes', quantity: '100 kg' } }
    ]
  };
  renderFarmers(sample);
  renderConsumers(sample);
  renderMap(sample);
}

///////////////////////////////
// Farmers + Consumers Render
///////////////////////////////
function renderFarmers(data) {
  const grid = $('#farmerGrid');
  grid.innerHTML = '';
  if (!data?.farmers?.length) return grid.innerHTML = '<div class="muted">No listings yet.</div>';
  data.farmers.forEach(f => {
    f.products.forEach(p => {
      const div = document.createElement('div');
      div.className = 'card';
      div.innerHTML = `
        <h4>${p.name} ${p.barter ? '<span class="chip">Barter</span>' : ''}</h4>
        <p class="muted">${f.name} – ${f.location}</p>
        <p><strong>${p.quantity}</strong> at ${p.price_per_kg ? '$' + p.price_per_kg + '/kg' : 'Trade Only'}</p>
      `;
      grid.appendChild(div);
    });
  });
}

function renderConsumers(data) {
  const grid = $('#consumerGrid');
  grid.innerHTML = '';
  if (!data?.consumers?.length) return grid.innerHTML = '<div class="muted">No requests yet.</div>';
  data.consumers.forEach(c => {
    const div = document.createElement('div');
    div.className = 'card';
    div.innerHTML = `
      <h4>${c.name}</h4>
      <p class="muted">${c.location}</p>
      <p><strong>Wants:</strong> ${c.request.product} (${c.request.quantity})</p>
    `;
    grid.appendChild(div);
  });
}

///////////////////////////////
// Map Demo (Leaflet)
///////////////////////////////
let map;
function renderMap(data) {
  const div = $('#map');
  if (!div) return;
  if (!map) {
    map = L.map('map').setView([10, 10], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(map);
  }
  map.eachLayer(l => { if (l instanceof L.Marker) map.removeLayer(l); });
  data.farmers.forEach(f => {
    const lat = Math.random() * 100 - 50;
    const lng = Math.random() * 200 - 100;
    L.marker([lat, lng]).addTo(map).bindPopup(`<strong>${f.name}</strong><br>${f.location}`);
  });
}

///////////////////////////////
// AI Simulation (Frontend)
///////////////////////////////
async function aiPriceHandler() {
  const crop = $('#aiCrop').value || 'Tomatoes';
  const qty = $('#aiQty').value || '100 kg';
  const output = $('#aiPriceOut');
  output.textContent = `Estimated price for ${qty} of ${crop}: $${(Math.random() * 2 + 0.5).toFixed(2)} per kg`;
}

async function aiMatchHandler() {
  const want = $('#aiWant').value || 'Tomatoes';
  const output = $('#aiMatchOut');
  output.textContent = `Searching for barter partners for ${want}... Found match: Aisha Bello in Nigeria.`;
}

///////////////////////////////
// Event Hooks
///////////////////////////////
function initListeners() {
  on($('#aiPriceBtn'), 'click', aiPriceHandler);
  on($('#aiMatchBtn'), 'click', aiMatchHandler);
  on($('#refreshBtn'), 'click', () => refreshMarket($('#countrySelect').value));
}

///////////////////////////////
// Boot
///////////////////////////////
document.addEventListener('DOMContentLoaded', async () => {
  initTabs();
  initLanguage();
  await initMarketFilters();
  initListeners();
});
