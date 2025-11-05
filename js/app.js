/* Harvest Q – Stage 3/4 Front-End Controller (IBM-Ready)
 * - Tabs, i18n, grids, dual maps, AI stubs, watsonx.ai mock
 * - Post modal, validation, PWA, offline fallback
 * - Optimized for Vercel + IBM Call for Code 2025
 */

const $  = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];
const on = (el, ev, fn) => el && el.addEventListener(ev, fn);
const toNumber = (s) => Number(String(s ?? '').replace(/[^0-9.\-]/g, '')) || 0;

const CURRENCY = {
  US:{symbol:'$', unit:'lb', code:'USD'}, India:{symbol:'₹', unit:'kg', code:'INR'},
  Nigeria:{symbol:'₦', unit:'kg', code:'NGN'}, Russia:{symbol:'₽', unit:'kg', code:'RUB'},
  Canada:{symbol:'$', unit:'kg', code:'CAD'}, China:{symbol:'¥', unit:'kg', code:'CNY'},
  Germany:{symbol:'€', unit:'kg', code:'EUR'}, Brazil:{symbol:'R$', unit:'kg', code:'BRL'},
  Kenya:{symbol:'KSh', unit:'kg', code:'KES'}, Ethiopia:{symbol:'Br', unit:'kg', code:'ETB'},
  Turkey:{symbol:'₺', unit:'kg', code:'TRY'}, France:{symbol:'€', unit:'kg', code:'EUR'},
  Spain:{symbol:'€', unit:'kg', code:'EUR'}, Italy:{symbol:'€', unit:'kg', code:'EUR'},
  Guatemala:{symbol:'Q', unit:'kg', code:'GTQ'}
};

const debounce = (fn, ms=200) => { let t; return (...a) => { clearTimeout(t); t=setTimeout(() => fn(...a), ms); }; };
const LS = { get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }, set(k, v) { localStorage.setItem(k, JSON.stringify(v)); } };
const slug = (s='') => String(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
const cropImageSrc = name => `./img/crops/${slug(name)}.jpg`;

function toMoney(n, sym='$') {
  const v = Number(n);
  return isNaN(v) ? String(n) : `${sym}${v.toFixed(2)}`;
}

function showErrorOverlay(msg) {
  const box = $('#hq-error');
  if (!box) return alert(msg || 'Error');
  $('#hq-error-text').textContent = String(msg || 'Unknown error');
  box.hidden = false;
}

/* --------------------------------
   i18n
----------------------------------- */
const LANG = {
  en: {
    'tab-home':'Home','tab-farmers':'Farmers','tab-consumers':'Consumers','tab-laws':'Laws',
    'tab-medical':'Medical','tab-trade':'Trade','tab-ai':'AI','tab-grants':'Grants',
    'header-sub':'Fresh • Local • Trusted',
    'home-what-title':'What this beta shows',
    'home-what-content':'Country/state/city filters • Farmers & Consumers • Map markers • PWA scaffold',
    'refresh':'Refresh','all-cities':'All Cities',
    'farmer-search-placeholder':'Search farmers or products…','consumer-search-placeholder':'Search buyers or requests…',
    'mode-all':'All','mode-sale':'For Sale','mode-trade':'Willing to Trade','mode-both':'Both',
    'sort-name':'Name','sort-price':'Price (low→high)',
    'ai-price-btn':'Ask AI','ai-match-btn':'Find Match',
    'post-errors':'Please correct highlighted fields',
    'no-farmers':'No farmer listings match your filters yet.',
    'no-consumers':'No consumer listings match your filters yet.',
    'laws-disclaimer':'High-level summaries only. Always check local rules or talk to an extension officer.',
    'trade-disclaimer':'Examples only. Agree on quality, weights, and timing before you trade.',
    'map-loading':'Loading map…','ai-connecting':'Connecting to IBM watsonx.ai…'
  },
  hi: {
    'tab-home':'होम','tab-farmers':'किसान','tab-consumers':'उपभोक्ता','tab-laws':'कानून',
    'tab-medical':'स्वास्थ्य','tab-trade':'विनिमय','tab-ai':'एआई','tab-grants':'अनुदान',
    'header-sub':'ताज़ा • स्थानीय • विश्वसनीय',
    'home-what-title':'यह बीटा क्या दिखाता है',
    'home-what-content':'देश/राज्य/शहर फ़िल्टर • किसान/उपभोक्ता • मानचित्र • PWA',
    'refresh':'ताज़ा करें','all-cities':'सभी शहर',
    'farmer-search-placeholder':'उत्पाद या खेत खोजें…','consumer-search-placeholder':'खरीदार खोजें…',
    'mode-all':'सभी','mode-sale':'बिक्री के लिए','mode-trade':'विनिमय के लिए','mode-both':'दोनों',
    'sort-name':'नाम','sort-price':'कीमत (कम→अधिक)',
    'ai-price-btn':'एआई से पूछें','ai-match-btn':'मिलान खोजें',
    'post-errors':'कृपया फ़ील्ड सुधारें',
    'no-farmers':'कोई किसान सूची नहीं मिली।',
    'no-consumers':'कोई उपभोक्ता सूची नहीं मिली।',
    'laws-disclaimer':'ये केवल संक्षिप्त सारांश हैं। निर्णय से पहले स्थानीय नियम अवश्य जाँचें।',
    'trade-disclaimer':'ये केवल उदाहरण हैं। विनिमय से पहले गुणवत्ता, मात्रा और समय तय करें।',
    'map-loading':'मानचित्र लोड हो रहा है…','ai-connecting':'IBM watsonx.ai से कनेक्ट हो रहा है…'
  }
};
let currentLang = localStorage.getItem('hq:lang') || 'en';
const t = (k) => (LANG[currentLang] && LANG[currentLang][k]) || k;

/* --------------------------------
   DOM Cache
----------------------------------- */
const E = (id) => document.getElementById(id);
const els = {
  tabs: E('tabs'), panels: {},
  country: E('countrySelect'), state: E('stateSelect'), city: E('citySelect'),
  refreshBtn: E('refreshBtn'),
  farmerGrid: E('farmerGrid'), consumerGrid: E('consumerGrid'),
  farmerSearch: E('farmerSearch'), consumerSearch: E('consumerSearch'),
  modeFilter: E('modeFilter'), sortBy: E('sortBy'),
  postOpenBtn: E('postOpenBtn'), postModal: E('postModal'), postForm: E('postForm'),
  pfFarm: E('pfFarm'), pfProduct: E('pfProduct'), pfQty: E('pfQty'), pfPrice: E('pfPrice'), pfMode: E('pfMode'), postErrors: E('postErrors'),
  aiCrop: E('aiCrop'), aiQty: E('aiQty'), aiPriceBtn: E('aiPriceBtn'), aiPriceOut: E('aiPriceOut'),
  aiWant: E('aiWant'), aiMatchBtn: E('aiMatchBtn'), aiMatchOut: E('aiMatchOut'),
  mapEl: E('map'), mapLoading: E('map-loading'), mapLegend: E('map-legend'),
  consumerMapEl: E('consumer-map'), consumerMapLoading: E('consumer-map-loading'), consumerMapLegend: E('consumer-map-legend'),
  lawGrid: E('lawGrid'), medGrid: E('medGrid'),
  tradePanel: E('panel-trade'), tradeDisclaimer: E('trade-disclaimer'),
  footerText: E('footer-text'), homeWarning: E('home-warning'),
  agentStatus: E('agentStatus'), connectAgentBtn: E('connectAgentBtn'),
  footerDate: E('footer-date')
};
['home','farmers','consumers','laws','medical','trade','ai','grants'].forEach(k => els.panels[k] = E(`panel-${k}`));

/* --------------------------------
   Tabs
----------------------------------- */
function renderTabs() {
  if (!els.tabs) return;
  const buttons = els.tabs.querySelectorAll('button[data-panel]') || [];
  buttons.forEach(btn => {
    const id = btn.dataset.panel;
    btn.textContent = t(`tab-${id}`);
    btn.setAttribute('role', 'tab');
    btn.classList.add('tab');
  });
  on(els.tabs, 'click', (e) => {
    const btn = e.target.closest('button[data-panel]');
    if (!btn) return;
    switchPanel(btn.dataset.panel, true);
  });
}

function switchPanel(id, push) {
  Object.values(els.panels).forEach(p => p && (p.hidden = p.id !== `panel-${id}`));
  $$('#tabs .tab').forEach(b => b.classList.toggle('active', b.dataset.panel === id));
  if (push) location.hash = `#${id}`;
  LS.set('hq:tab', id);
}

function startTab() {
  const fromHash = location.hash.replace('#', '');
  const saved = LS.get('hq:tab', 'home');
  const target = TABS.some(t => t.id === fromHash) ? fromHash : saved;
  switchPanel(target, false);
}

/* --------------------------------
   Language
----------------------------------- */
function setLanguage(lang) {
  currentLang = lang;
  LS.set('hq:lang', lang);
  E('header-sub') && (E('header-sub').textContent = t('header-sub'));
  E('home-what-title') && (E('home-what-title').textContent = t('home-what-title'));
  E('home-what-content') && (E('home-what-content').textContent = t('home-what-content'));
  els.farmerSearch && (els.farmerSearch.placeholder = t('farmer-search-placeholder'));
  els.consumerSearch && (els.consumerSearch.placeholder = t('consumer-search-placeholder'));
  ['mode-all','mode-sale','mode-trade','mode-both'].forEach((k,i) => els.modeFilter?.options[i]?.textContent = t(k));
  ['sort-name','sort-price'].forEach((k,i) => els.sortBy?.options[i]?.textContent = t(k));
  E('laws-disclaimer') && (E('laws-disclaimer').textContent = t('laws-disclaimer'));
  E('trade-disclaimer') && (E('trade-disclaimer').textContent = t('trade-disclaimer'));
  els.mapLoading && (els.mapLoading.textContent = t('map-loading'));
  els.consumerMapLoading && (els.consumerMapLoading.textContent = t('map-loading'));
}

/* --------------------------------
   Data
----------------------------------- */
let DATA_FARMERS = [], DATA_CONSUMERS = [];
async function loadJSON(path, fallback = []) {
  try {
    const r = await fetch(path, { cache: 'no-store' });
    return r.ok ? await r.json() : fallback;
  } catch { return fallback; }
}
async function loadData() {
  DATA_FARMERS = await loadJSON('./data/farmers.json', []);
  DATA_CONSUMERS = await loadJSON('./data/consumers.json', []);
}

/* --------------------------------
   Geo Selects
----------------------------------- */
const GEO = { /* ... your full GEO object ... */ };

function populateCountrySelect() {
  if (!els.country) return;
  const countries = Object.keys(GEO);
  els.country.innerHTML = countries.map(c => `<option value="${c}">${c}</option>`).join('');
  els.country.value = LS.get('hq:country', 'US');
}

function populateStateCities() {
  if (!els.country || !els.state || !els.city) return;
  const country = els.country.value;
  const states = Object.keys(GEO[country] || {});
  els.state.innerHTML = states.map(s => `<option value="${s}">${s}</option>`).join('');
  const savedState = LS.get('hq:state', states[0] || '');
  els.state.value = states.includes(savedState) ? savedState : states[0] || '';

  function updateCity() {
    const cities = GEO[country]?.[els.state.value] || [];
    els.city.innerHTML = `<option value="">${t('all-cities')}</option>` + cities.map(c => `<option value="${c}">${c}</option>`).join('');
    els.city.value = LS.get('hq:city', '');
  }
  els.state.onchange = () => { LS.set('hq:state', els.state.value); updateCity(); refreshAll(); };
  updateCity();
}

/* --------------------------------
   Rendering
----------------------------------- */
function emptyState(el, txt) {
  el.innerHTML = `<div class="card" style="text-align:center;color:var(--text-muted)">${txt}</div>`;
}

function filterByGeo(arr) {
  const c = els.country?.value, s = els.state?.value, ci = els.city?.value;
  return arr.filter(x => x.country === c && (!s || x.state === s) && (!ci || x.city === ci));
}

function renderFarmers() {
  if (!els.farmerGrid) return;
  let list = filterByGeo(DATA_FARMERS);
  const q = (els.farmerSearch?.value || '').toLowerCase();
  const mode = els.modeFilter?.value || 'all';
  const sort = els.sortBy?.value || 'name';

  list = list.filter(f => {
    const hay = `${f.farm} ${f.farmer} ${f.products?.map(p => p.name).join(' ')}`.toLowerCase();
    const passQ = !q || hay.includes(q);
    const passM = mode === 'all' || f.mode === mode || (mode === 'both' && f.mode === 'both');
    return passQ && passM;
  });

  if (sort === 'priceAsc') list.sort((a, b) => toNumber(a.products?.[0]?.price) - toNumber(b.products?.[0]?.price));

  if (!list.length) return emptyState(els.farmerGrid, t('no-farmers'));
  els.farmerGrid.innerHTML = '';
  list.forEach(f => f.products?.forEach(p => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <img class="thumb" src="${cropImageSrc(p.name)}" alt="${p.name}" onerror="this.src='./img/placeholder.png'">
      <h3>${p.name} — ${p.qty || ''}</h3>
      <p><strong>Price:</strong> ${p.price || '—'}</p>
      <p><strong>Farm:</strong> ${f.farm} · <span class="muted">${f.city || ''}, ${f.state || ''}</span></p>
      <p><strong>Pickup:</strong> ${f.pickup || ''}</p>
      <div class="flex" style="gap:6px;margin-top:8px">
        <a class="btn secondary" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(f.city + ',' + f.state)}" target="_blank">Open in Maps</a>
      </div>`;
    els.farmerGrid.appendChild(card);
  }));
}

function renderConsumers() {
  if (!els.consumerGrid) return;
  const list = filterByGeo(DATA_CONSUMERS).filter(c => {
    const hay = `${c.name} ${c.want} ${c.city} ${c.state}`.toLowerCase();
    return !els.consumerSearch?.value || hay.includes(els.consumerSearch.value.toLowerCase());
  });
  if (!list.length) return emptyState(els.consumerGrid, t('no-consumers'));
  els.consumerGrid.innerHTML = list.map(c => `
    <div class="card">
      <h3>${c.name}</h3>
      <p>${c.city || ''}, ${c.state || ''}</p>
      <p><strong>Wants:</strong> ${c.want || ''}</p>
    </div>`).join('');
}

/* --------------------------------
   Laws, Medical, Trade
----------------------------------- */
const LAW_INFO = { /* ... your full LAW_INFO ... */ };
function renderLaws() { /* ... same as before ... */ }
function renderMedical() { /* ... same ... */ }
function renderTrade() {
  if (els.tradeDisclaimer) els.tradeDisclaimer.textContent = t('trade-disclaimer');
}

/* --------------------------------
   Maps with Loading
----------------------------------- */
let map = null, consumerMap = null;

function showMapLoading(id) { const el = $(`#${id}-loading`); if (el) el.style.display = 'block'; }
function hideMapLoading(id) { const el = $(`#${id}-loading`); if (el) el.style.display = 'none'; $(`#${id}`)?.style.display = 'block'; }

function initMap() {
  if (!els.mapEl || map) return;
  showMapLoading('map');
  try {
    map = L.map('map').setView([10, 10], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
    loadMarkets();
    hideMapLoading('map');
  } catch (e) {
    console.warn('Map init failed', e);
    hideMapLoading('map');
    els.mapEl && (els.mapEl.innerHTML = '<p style="color:red">Map unavailable offline.</p>');
  }
}

function initConsumerMap() {
  if (!els.consumerMapEl || consumerMap) return;
  showMapLoading('consumer-map');
  try {
    consumerMap = L.map('consumer-map').setView([10, 10], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(consumerMap);
    loadConsumerMarkets();
    hideMapLoading('consumer-map');
  } catch (e) {
    hideMapLoading('consumer-map');
  }
}

/* --------------------------------
   Post Modal
----------------------------------- */
function openPostModal() { /* ... same ... */ }
function closePostModal() { /* ... same ... */ }

/* --------------------------------
   AI + IBM watsonx.ai Mock
----------------------------------- */
on(els.aiPriceBtn, 'click', () => {
  const crop = els.aiCrop?.value, qty = els.aiQty?.value;
  if (!crop || !qty) return (els.aiPriceOut.textContent = 'Enter crop and quantity.');
  const country = els.country?.value || 'US';
  const base = BASE_RATES[country]?.[crop] || 2.0;
  const lo = (base * 0.9).toFixed(2), hi = (base * 1.1).toFixed(2);
  els.aiPriceOut.innerHTML = `<strong>IBM watsonx.ai</strong>: ${CURRENCY[country].symbol}${lo}–${hi}/${CURRENCY[country].unit}`;
});

on(els.aiMatchBtn, 'click', async () => {
  const want = els.aiWant?.value.trim();
  if (!want) return (els.aiMatchOut.textContent = 'Describe your trade.');
  els.aiMatchOut.textContent = 'Searching barter matches…';
  setTimeout(() => {
    els.aiMatchOut.innerHTML = `<pre>{\n  "match": "3 farmers want tomatoes",\n  "suggestion": "Offer onions for fair trade"\n}</pre>`;
  }, 800);
});

/* IBM Connect Button */
window.ORCH_CONNECTED = false;
on(els.connectAgentBtn, 'click', () => {
  if (els.agentStatus) els.agentStatus.textContent = t('ai-connecting');
  setTimeout(() => {
    window.ORCH_CONNECTED = true;
    if (els.agentStatus) els.agentStatus.innerHTML = 'Connected to IBM watsonx.ai (granite-13b-code)';
  }, 1200);
});

/* --------------------------------
   Boot
----------------------------------- */
document.addEventListener('DOMContentLoaded', async () => {
  renderTabs();
  const langSel = E('langSelect');
  if (langSel) { langSel.value = currentLang; on(langSel, 'change', e => setLanguage(e.target.value)); }
  setLanguage(currentLang);

  populateCountrySelect();
  populateStateCities();

  on(els.country, 'change', () => { LS.set('hq:country', els.country.value); populateStateCities(); });
  on(els.refreshBtn, 'click', refreshAll);
  on(els.farmerSearch, 'input', debounce(renderFarmers, 200));
  on(els.consumerSearch, 'input', debounce(renderConsumers, 200));
  on(els.modeFilter, 'change', () => { LS.set('hq:mode', els.modeFilter.value); renderFarmers(); });
  on(els.sortBy, 'change', () => { LS.set('hq:sort', els.sortBy.value); renderFarmers(); });

  await loadData();
  renderFarmers(); renderConsumers(); renderLaws(); renderTrade();
  initMap(); initConsumerMap();

  els.footerDate && (els.footerDate.textContent = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));
  startTab();
});

function refreshAll() {
  renderFarmers(); renderConsumers(); renderLaws(); renderTrade();
  loadMarkets(); loadConsumerMarkets();
}
