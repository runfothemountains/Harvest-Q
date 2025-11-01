/* Stage-2 app.js
 - i18n (EN/HI)
 - UI orchestration
 - Map (Leaflet) lazy-load / markets with fallback
 - Modal accessibility + validation (inline errors)
 - AI price & match stubs
 - Nice-to-haves: stateful filters, image fallback, analytics hooks
*/

/* -------------------------
   Small helpers & constants
   ------------------------- */
const CURRENCY = const CURRENCY = {
  US:{symbol:'$', unit:'lb', code:'USD'},
  India:{symbol:'₹', unit:'kg', code:'INR'},
  Nigeria:{symbol:'₦', unit:'kg', code:'NGN'},
  Russia:{symbol:'₽', unit:'kg', code:'RUB'},
  Canada:{symbol:'$', unit:'kg', code:'CAD'},
  China:{symbol:'¥', unit:'kg', code:'CNY'},
  Germany:{symbol:'€', unit:'kg', code:'EUR'},
  Brazil:{symbol:'R$', unit:'kg', code:'BRL'},
  Kenya:{symbol:'KSh', unit:'kg', code:'KES'},
  Ethiopia:{symbol:'Br', unit:'kg', code:'ETB'},
  Turkey:{symbol:'₺', unit:'kg', code:'TRY'},
  France:{symbol:'€', unit:'kg', code:'EUR'},
  Spain:{symbol:'€', unit:'kg', code:'EUR'},
  Italy:{symbol:'€', unit:'kg', code:'EUR'},
  Guatemala:{symbol:'Q', unit:'kg', code:'GTQ'}
};

const toNumber = s => Number(String(s||'').replace(/[^0-9.\-]/g,'')) || 0;

// --- Barter Agent implementations ---

// 1) Find compatible barter partners
async function findBarterMatch({ itemOffered, itemWanted, location, maxDistanceKm = 100, minQuantity }) {
  const data = await loadJSON('data/farmers.json');
  if (!data) return { matches: [], note: 'No farmer dataset found.' };

  // Flatten all barter-capable items
  const items = data.flatMap(listBarterables);

  // Farmers who HAVE what I want
  const suppliers = items.filter(i => i.name.toLowerCase().includes(itemWanted.toLowerCase()));

  // Farmers who WANT what I offer (rough proxy: they list it too, so a swap is plausible)
  const counterparts = items.filter(i => i.name.toLowerCase().includes(itemOffered.toLowerCase()));

  // Pair by proximity and distinct farmer
  const pairs = [];
  for (const s of suppliers) {
    for (const c of counterparts) {
      if (s.farmerId === c.farmerId) continue;
      const dist = pseudoDistance(s.location, location || c.location);
      if (dist <= maxDistanceKm) {
        pairs.push({
          partnerId: s.farmerId,
          partnerName: s.farmerName,
          distanceKm: dist,
          theyOffer: { name: s.name, qty: s.qty },
          youOffer:  { name: c.name, qty: c.qty },
          rationale: `Close proximity and reciprocal goods (${itemOffered}↔${itemWanted}).`
        });
      }
    }
  }

  // Sort by distance
  pairs.sort((a,b)=>a.distanceKm - b.distanceKm);

  // Return top 3 options
  return { matches: pairs.slice(0, 3), note: pairs.length ? 'Top barter candidates.' : 'No compatible partners found.' };
}

// 2) Evaluate trade value (very simple reference math)
async function evaluateTradeValue({ itemsA = [], itemsB = [] }) {
  // If refPricePerUnit missing, use tiny reference table (you can expand later).
  const ref = {
    tomato: 0.5, onion: 0.6, corn: 0.22, rice: 0.9, avocado: 2.1, dates: 4.0
  };

  function unitPrice(name, fallback = 1.0) {
    return ref[name?.toLowerCase()] ?? fallback;
  }

  // calculate notional value = sum(qty_numeric * price_per_unit)
  function parseQty(q) {
    // naive: extract numeric part only
    const m = String(q).match(/[\d.]+/);
    return m ? Number(m[0]) : 0;
  }

  const valA = itemsA.reduce((sum, it) => {
    const p = it.refPricePerUnit ?? unitPrice(it.name);
    return sum + parseQty(it.qty) * p;
  }, 0);

  const valB = itemsB.reduce((sum, it) => {
    const p = it.refPricePerUnit ?? unitPrice(it.name);
    return sum + parseQty(it.qty) * p;
  }, 0);

  // propose simple ratio A:B
  const ratio = valB ? (valA / valB) : 0;
  const fair = ratio > 0.9 && ratio < 1.1; // within ~10%

  return {
    valueA: Number(valA.toFixed(2)),
    valueB: Number(valB.toFixed(2)),
    proposedRatioAtoB: Number(ratio.toFixed(2)),
    fairness: fair ? 'balanced' : (ratio < 0.9 ? 'A owes more' : 'B owes more'),
    note: 'Naive valuation using reference prices; replace with real market feed when available.'
  };
}

// 3) Initiate exchange (stub; logs and returns a contract snapshot)
async function initiateExchange({ partnerId, terms }) {
  // In production: persist to Cloudant and trigger NotifyAgent.
  const contractId = `BAR-${Date.now()}`;
  const summary = {
    contractId,
    partnerId,
    terms,
    status: 'pending-confirmation',
    createdAt: new Date().toISOString()
  };
  // TODO: send event/notification here
  return { ok: true, summary };
}

const toolImpl = {
  // ...existing tool impls...
  findBarterMatch,
  evaluateTradeValue,
  initiateExchange
};

async function uiFindBarterMatch(offered, wanted, location) {
  if (!window.ORCH_CONNECTED) return alert('Connect IBM Agent first.');
  const r = await fetch('/api/agent', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: `Find barter match for ${offered} ↔ ${wanted}`,
      tool: 'findBarterMatch',
      args: { itemOffered: offered, itemWanted: wanted, location }
    })
  });
  const data = await r.json();
  // render data.result.matches into your Barter grid
  console.log('Barter matches:', data);
}

const debounce = (fn,ms=200)=>{let t; return (...a)=>{clearTimeout(t); t=setTimeout(()=>fn(...a),ms);}};
const LS = {
  get(k, d){ try{ return JSON.parse(localStorage.getItem(k)) ?? d; }catch{ return d; } },
  set(k, v){ localStorage.setItem(k, JSON.stringify(v)); }
};
const ANALYTICS_ENDPOINT = ''; // set later if you add a backend endpoint
async function track(event, data={}){ 
  const payload = { event, ts: Date.now(), ...data };
  console.log('[analytics]', payload);
  if(!ANALYTICS_ENDPOINT) return;
  try{ await fetch(ANALYTICS_ENDPOINT, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)}); }catch{}
}
const slug = (s='')=>String(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
const cropImageSrc = name => `./img/crops/${slug(name)}.jpg`;

/* -------------------------
   i18n (extracted minimal)
   ------------------------- */
const LANG = {
  en: {
    'tab-home':'Home','tab-farmers':'Farmers','tab-consumers':'Consumers','tab-laws':'Laws','tab-ai':'AI Hooks',
    'header-sub':'Fresh • Local • Trusted',
    'home-what-title':'What this beta shows','home-what-content':'Country/state/city switching (US, India, Nigeria) • Farmers & Consumers • Map with markers • PWA scaffold',
    'refresh':'Refresh','all-cities':'All Cities',
    'farmer-search-placeholder':'Search product or farm…','consumer-search-placeholder':'Search buyer…',
    'mode-all':'All','mode-sale':'For Sale','mode-trade':'Willing to Trade','mode-both':'Both',
    'sort-name':'Name','sort-price':'Price (low→high)',
    'ai-price-btn':'Ask AI','ai-match-btn':'Find Match',
    'post-errors':'Please correct highlighted fields',
    'no-farmers':'No farmer listings match your filters yet.',
    'no-consumers':'No consumer listings match your filters yet.'
  },
  hi: {
    'tab-home':'होम','tab-farmers':'किसान','tab-consumers':'उपभोक्ता','tab-laws':'कानून','tab-ai':'एआई',
    'header-sub':'ताज़ा • स्थानीय • विश्वसनीय',
    'home-what-title':'यह बीटा क्या दिखाता है','home-what-content':'देश/राज्य/शहर स्विचिंग • किसान और उपभोक्ता • मानचित्र • PWA',
    'refresh':'ताज़ा करें','all-cities':'सभी शहर',
    'farmer-search-placeholder':'उत्पाद या खेत खोजें…','consumer-search-placeholder':'खरीदार खोजें…',
    'mode-all':'सभी','mode-sale':'बिक्री के लिए','mode-trेड':'विनिमय के लिए','mode-both':'दोनों', // note: keep your keys consistent
    'sort-name':'नाम','sort-price':'कीमत (कम→अधिक)',
    'ai-price-btn':'एआई से पूछें','ai-match-btn':'मिलान खोजें',
    'post-errors':'कृपया फ़ील्ड सुधारें',
    'no-farmers':'कोई किसान सूची नहीं मिली।',
    'no-consumers':'कोई उपभोक्ता सूची नहीं मिली।'
  }
};
let currentLang = localStorage.getItem('hq:lang') || 'en';
const t = (k) => (LANG[currentLang] && LANG[currentLang][k]) || k;

/* -------------------------
   DOM helpers & elements
   ------------------------- */
const E = id => document.getElementById(id);
const els = {
  tabs: E('tabs'), panels: {},
  country: E('countrySelect'), state: E('stateSelect'), city: E('citySelect'),
  farmerGrid: E('farmerGrid'), consumerGrid: E('consumerGrid'),
  farmerSearch: E('farmerSearch'), consumerSearch: E('consumerSearch'),
  modeFilter: E('modeFilter'), sortBy: E('sortBy'),
  postOpenBtn: E('postOpenBtn'), postModal: E('postModal'), postForm: E('postForm'),
  pfFarm: E('pfFarm'), pfProduct: E('pfProduct'), pfQty: E('pfQty'), pfPrice: E('pfPrice'), pfMode: E('pfMode'), postErrors: E('postErrors'),
  aiCrop: E('aiCrop'), aiQty: E('aiQty'), aiPriceBtn: E('aiPriceBtn'), aiPriceOut: E('aiPriceOut'),
  aiWant: E('aiWant'), aiMatchBtn: E('aiMatchBtn'), aiMatchOut: E('aiMatchOut'),
  mapEl: E('map'), mapLegend: E('mapLegend'),
  footerText: E('footer-text'), homeWarning: E('home-warning')
};
['home','farmers','consumers','laws','ai'].forEach(k=>els.panels[k]=E(`panel-${k}`));

/* -------------------------
   Data placeholders (fallbacks)
   ------------------------- */
let DATA_FARMERS = [];
let DATA_CONSUMERS = [];
const SAMPLE_FARMERS = [];
const SAMPLE_CONSUMERS = [];

/* -------------------------
   Load data (fallback to SAMPLE)
   ------------------------- */
async function loadData(){
  async function maybe(path, fallback=[]){
    try{ const r = await fetch(path, {cache:'no-store'}); if(!r.ok) throw new Error('no'); return await r.json(); }
    catch(e){ console.warn('fallback',path); return fallback; }
  }
  DATA_FARMERS = await maybe('./data/farmers.json', SAMPLE_FARMERS);
  DATA_CONSUMERS = await maybe('./data/consumers.json', SAMPLE_CONSUMERS);
}

/* -------------------------
   Tabs & language wiring
   ------------------------- */
const TABS = const TABS = [
  {id:'home'},
  {id:'farmers'},
  {id:'consumers'},
  {id:'laws'},
  {id:'medical'},  // if present
  {id:'trade'},    // if present
  {id:'ai'},
  {id:'grants'}    // ✅ New Harvest Grant tab
];

function renderTabs(){
  els.tabs.innerHTML='';
  TABS.forEach(ti=>{
    const b=document.createElement('button');
    b.className='tab'; b.dataset.id=ti.id; b.setAttribute('role','tab');
    b.textContent=t(`tab-${ti.id}`); b.onclick=()=>switchPanel(ti.id,true);
    els.tabs.appendChild(b);
  });
}
function switchPanel(id,push){
  TABS.forEach(t=>els.panels[t.id].hidden = t.id!==id);
  document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active', b.dataset.id===id));
  if(push) location.hash = `#${id}`;
  localStorage.setItem('hq:tab', id);
}
function startTab(){
  const fromHash = location.hash.replace('#','');
  const saved = localStorage.getItem('hq:tab')||'home';
  const target = TABS.some(t=>t.id===fromHash)?fromHash:saved;
  switchPanel(target);
}
function setLanguage(lang){
  currentLang=lang; localStorage.setItem('hq:lang', lang);
  E('header-sub').textContent = t('header-sub');
  E('home-what-title').textContent = t('home-what-title');
  E('home-what-content').textContent = t('home-what-content');
  els.farmerSearch.placeholder = t('farmer-search-placeholder');
  els.consumerSearch.placeholder = t('consumer-search-placeholder');
  const mops = els.modeFilter?.querySelectorAll('option'); if(mops && mops.length>=4){
    mops[0].textContent=t('mode-all'); mops[1].textContent=t('mode-sale'); mops[2].textContent=t('mode-trade'); mops[3].textContent=t('mode-both');
  }
  const sops = els.sortBy?.querySelectorAll('option'); if(sops && sops.length>=2){
    sops[0].textContent=t('sort-name'); sops[1].textContent=t('sort-price');
  }
}

/* -------------------------
   Renderers
   ------------------------- */
function emptyState(el, txt){
  const card = document.createElement('div');
  card.className='card'; card.style.textAlign='center'; card.style.color='var(--muted)';
  card.textContent = txt;
  el.innerHTML=''; el.appendChild(card);
}
function filterByGeo(arr){
  const country = els.country.value || 'US';
  const state = els.state.value || '';
  const city = els.city.value || '';
  return arr.filter(x => x.country===country && x.state===state && (!city || x.city===city));
}
function renderFarmers(){
  const src = filterByGeo(DATA_FARMERS);
  const q = (els.farmerSearch.value||'').toLowerCase();
  const mode = els.modeFilter?.value || 'all';
  const sortBy = els.sortBy?.value || 'name';

  let list = src.filter(f=>{
    const hay = (f.farm+' '+f.farmer+' '+(f.products||[]).map(p=>p.name).join(' ')).toLowerCase();
    const passQ = !q || hay.includes(q);
    const passM = mode==='all' || f.mode===mode || (mode==='both' && f.mode==='both');
    return passQ && passM;
  });

  // Sort products per farmer for display
  list = list.map(f=>{
    const prods = (f.products||[]).slice();
    if(sortBy==='name') prods.sort((a,b)=>String(a.name).localeCompare(String(b.name)));
    else if(sortBy==='priceAsc') prods.sort((a,b)=>toNumber(a.price)-toNumber(b.price));
    return {...f, products: prods};
  });

  if(!list.length) return emptyState(els.farmerGrid, t('no-farmers'));
  els.farmerGrid.innerHTML='';
  list.forEach(f=>{
    (f.products||[]).forEach(p=>{
      const imgSrc = cropImageSrc(p.name);
      const card=document.createElement('div'); card.className='card';
      card.innerHTML = `
        <img class="thumb" src="${imgSrc}" alt="${p.name}"
             style="width:100%;height:150px;object-fit:cover;border-radius:8px"
             onerror="this.onerror=null; this.src='./img/placeholder.png';">
        <h3>${p.name} — ${p.qty}</h3>
        <p><strong>Price:</strong> ${p.price}</p>
        <p><strong>Farm:</strong> ${f.farm} · <span class="muted">${f.city}, ${f.state}</span></p>
        <p><strong>Pickup:</strong> ${f.pickup||''}</p>
        <div class="flex" style="gap:6px;margin-top:8px">
          <a class="btn secondary" target="_blank" rel="noopener"
             href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(f.city+','+f.state)}">Open in Maps</a>
        </div>`;
      els.farmerGrid.appendChild(card);
    });
  });
}
function renderConsumers(){
  const list = filterByGeo(DATA_CONSUMERS);
  if(!list.length) return emptyState(els.consumerGrid, t('no-consumers'));
  els.consumerGrid.innerHTML='';
  list.forEach(c=>{
    const card=document.createElement('div'); card.className='card';
    card.innerHTML = `<h3>${c.name}</h3><p>${c.city}, ${c.state}</p><p><strong>Wants:</strong> ${c.want}</p>`;
    els.consumerGrid.appendChild(card);
  });
}

/* -------------------------
   Map wiring (Leaflet) + markets lazy load
   ------------------------- */
let map=null;
function initMap(){
  if(map) return;
  try{
    map = L.map('map').setView([10,10],2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:''}).addTo(map);
    // legend
    const legend = els.mapLegend; legend.innerHTML='';
    const mk = (color,label)=>`<div class="item"><div class="dot" style="background:${color}"></div><div class="label">${label}</div></div>`;
    legend.innerHTML = mk('var(--sale)','Sale') + mk('var(--trade)','Trade') + mk('var(--both)','Both');
    track('map_loaded');
    loadMarkets();
  }catch(e){ console.warn('map init failed', e); }
}
async function loadMarkets(){
  const legend = els.mapLegend;
  try{
    const res = await fetch('./data/us_markets.json', {cache:'no-store'});
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const list = await res.json();

    let drawn = 0;
    (list||[]).forEach(m=>{
      if(!m || typeof m.lat!=='number' || typeof m.lng!=='number') return;
      const color =
        m.mode==='sale' ? getComputedStyle(document.documentElement).getPropertyValue('--sale').trim() :
        m.mode==='trade'? getComputedStyle(document.documentElement).getPropertyValue('--trade').trim() :
                          getComputedStyle(document.documentElement).getPropertyValue('--both').trim();
      L.circleMarker([m.lat,m.lng],{radius:6,color}).addTo(map)
        .bindPopup(`<strong>${m.market}</strong><br>${m.city}, ${m.state}${m.type? `<br>${m.type}`:''}`);
      drawn++;
    });

    track('markets_loaded', { count: drawn });
    if(drawn===0){
      legend.insertAdjacentHTML('afterend',
        `<p class="muted" style="margin-top:8px">No market points available for this dataset.</p>`);
    }
  }catch(err){
    console.warn('Markets load failed:', err);
    legend.insertAdjacentHTML('afterend',
      `<p class="muted" style="margin-top:8px">Map data failed to load. Try again later.</p>`);
  }
}

/* -------------------------
   Post form: accessibility + validation
   ------------------------- */
let postOpenerBtn = null;
function trapFocus(modal){
  const q = 'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])';
  const focusables = Array.from(modal.querySelectorAll(q)).filter(el=>!el.disabled);
  if(!focusables.length) return;
  const first = focusables[0], last = focusables[focusables.length-1];
  function onKey(e){
    if(e.key==='Tab'){
      if(e.shiftKey && document.activeElement===first){ e.preventDefault(); last.focus(); }
      else if(!e.shiftKey && document.activeElement===last){ e.preventDefault(); first.focus(); }
    }
    if(e.key==='Escape'){ closePostModal(); }
  }
  modal.addEventListener('keydown', onKey);
  modal._focusTrapCleanup = () => modal.removeEventListener('keydown', onKey);
  first.focus();
}
function openPostModal(btn){
  postOpenerBtn = btn || null;
  els.postModal.hidden = false;
  els.postModal.setAttribute('aria-hidden','false');
  trapFocus(els.postModal);
  els.pfFarm?.focus();
}
function closePostModal(){
  els.postModal.hidden = true;
  els.postModal.setAttribute('aria-hidden','true');
  els.postModal._focusTrapCleanup?.();
  postOpenerBtn?.focus();
}
els.postOpenBtn?.addEventListener('click', ()=>openPostModal(els.postOpenBtn));
E('postCancel')?.addEventListener('click', closePostModal);

// Inline validation + sanitization
const errQty = E('errQty'); const errPrice = E('errPrice');
function sanitizeNumberInput(str){ return String(str||'').replace(/,/g,'').trim(); }
function requirePositiveNumber(str){
  const clean = sanitizeNumberInput(str);
  const n = Number(clean);
  if(!clean) return {ok:false, msg:'Required'};
  if(!isFinite(n) || n<=0) return {ok:false, msg:'Enter a positive number'};
  return {ok:true, value:n};
}
els.postForm?.addEventListener('submit', (ev)=>{
  ev.preventDefault();
  els.postErrors.textContent=''; if(errQty) errQty.textContent=''; if(errPrice) errPrice.textContent='';

  const rQty = requirePositiveNumber(els.pfQty.value);
  const rPrice = requirePositiveNumber(els.pfPrice.value);

  let bad=false;
  if(!rQty.ok){ if(errQty) errQty.textContent=rQty.msg; bad=true; }
  if(!rPrice.ok){ if(errPrice) errPrice.textContent=rPrice.msg; bad=true; }
  if(bad){ els.postErrors.textContent = t('post-errors'); return; }

  const country = els.country.value || 'US';
  const newRec = {
    country, state: els.state.value || '', city: els.city.value || '',
    farmer: 'You',
    farm: els.pfFarm.value,
    products: [{name: els.pfProduct.value, qty: `${rQty.value}`, price: `${rPrice.value}`}],
    pickup:'', mode: els.pfMode.value
  };
  DATA_FARMERS.unshift(newRec);
  track('listing_posted', { product: els.pfProduct.value, qty: rQty.value, price: rPrice.value, mode: els.pfMode.value, country });
  closePostModal();
  renderFarmers();
});

/* -------------------------
   Simple AI stubs (client)
   ------------------------- */
const BASE_RATES = { US:{Tomatoes:2.5}, India:{Tomatoes:30}, Nigeria:{Cassava:180} };
els.aiPriceBtn?.addEventListener('click', ()=>{
  track('ai_price_clicked', { crop: els.aiCrop.value, qty: els.aiQty.value });
  const crop = els.aiCrop.value, qty = els.aiQty.value;
  if(!crop || !qty){ els.aiPriceOut.textContent='Enter crop and quantity (e.g., Tomatoes, 40 lb).'; return; }
  const country = els.country.value || 'US';
  const base = (BASE_RATES[country] && BASE_RATES[country][crop]) || 2.0;
  const lo = (base*0.9).toFixed(2), hi = (base*1.1).toFixed(2);
  els.aiPriceOut.textContent = `Suggested range: ${CURRENCY[country]?.symbol||'$'}${lo} - ${CURRENCY[country]?.symbol||'$'}${hi} per ${CURRENCY[country]?.unit||'unit'}`;
});
els.aiMatchBtn?.addEventListener('click', ()=>{
  track('ai_match_clicked', { want: els.aiWant.value });
  const want = (els.aiWant.value||'').trim();
  if(!want){ els.aiMatchOut.textContent='Describe what you want (e.g., Peaches 20 lb).'; return; }
  const pool = DATA_FARMERS.filter(f=> (f.products||[]).some(p=>p.name.toLowerCase().includes(want.toLowerCase())));
  if(!pool.length){ els.aiMatchOut.textContent='No matches found in current filters.'; return; }
  els.aiMatchOut.textContent = pool.slice(0,5).map(f=>`${f.products[0].name} from ${f.farm} (${f.city})`).join('\n');
});

/* -------------------------
   Geo selects
   ------------------------- */
function populateCountrySelect(){
  const countries = ['US','India','Nigeria'];
  els.country.innerHTML=''; countries.forEach(c=>{ const o=document.createElement('option'); o.value=c; o.textContent=c; els.country.appendChild(o); });
}
function populateStateCities(){
  const map = {
    US:{Alabama:['Auburn','Opelika'],California:['Los Angeles','San Francisco'],Texas:['Houston','Austin']},
    India:{Punjab:['Ludhiana','Amritsar'],Maharashtra:['Mumbai','Pune'],TamilNadu:['Chennai','Coimbatore']},
    Nigeria:{Benue:['Makurdi','Gboko'],Kano:['Kano','Wudil'],Rivers:['Port Harcourt','Obio-Akpor']}
  };
  const country = els.country.value; const states = Object.keys(map[country]||{});
  els.state.innerHTML=''; states.forEach(s=>{ const o=document.createElement('option'); o.value=s; o.textContent=s; els.state.appendChild(o); });
  function updateCity(){
    const cities = (map[country] && map[country][els.state.value]) || [];
    els.city.innerHTML=''; const any=document.createElement('option'); any.value=''; any.textContent = t('all-cities'); els.city.appendChild(any);
    cities.forEach(ct=>{ const o=document.createElement('option'); o.value=ct; o.textContent=ct; els.city.appendChild(o); });
  }
  els.state.onchange = ()=>{ updateCity(); renderFarmers(); renderConsumers(); loadMarkets(); };
  updateCity();
}

/* -------------------------
   Warning (no unsafe innerHTML)
   ------------------------- */
function setStaticWarning(){
  if(!els.homeWarning) return;
  els.homeWarning.textContent='';
  const strong = document.createElement('strong'); strong.textContent='Note: ';
  const rest = document.createTextNode('Demo data for judging. Compliance cards are non-legal summaries; pair with legal counsel.');
  els.homeWarning.appendChild(strong); els.homeWarning.appendChild(rest);
}

/* -------------------------
   Boot
   ------------------------- */
async function init(){
  renderTabs();
  startTab();

  // language
  const langSel = E('langSelect');
  if(langSel){ langSel.value = currentLang; langSel.addEventListener('change', e=>setLanguage(e.target.value)); }
  setLanguage(langSel?.value || currentLang);

  // geo
  populateCountrySelect();
  populateStateCities();
  els.country.addEventListener('change', ()=>{ populateStateCities(); renderFarmers(); renderConsumers(); loadMarkets(); });

  // restore saved filters
  const savedMode = LS.get('hq:mode','all');
  const savedSort = LS.get('hq:sort','name');
  if (els.modeFilter) els.modeFilter.value = savedMode;
  if (els.sortBy)    els.sortBy.value    = savedSort;

  // filter listeners (persist)
  els.farmerSearch.addEventListener('input', debounce(renderFarmers,200));
  els.consumerSearch.addEventListener('input', debounce(renderConsumers,200));
  els.modeFilter.addEventListener('change', e=>{ LS.set('hq:mode', e.target.value); renderFarmers(); });
  els.sortBy.addEventListener('change',  e=>{ LS.set('hq:sort', e.target.value);  renderFarmers(); });

  // data + initial render
  await loadData();
  renderFarmers(); renderConsumers();

  // map
  initMap();

  // footer + warning
  els.footerText.textContent = `© Harvest Q — Stage 2 • ${new Date().toLocaleString()}`;
  setStaticWarning();
}
document.addEventListener('DOMContentLoaded', init);

// Very small demo lists (expand later)
const GEO = {
  US: { Alabama:['Auburn','Opelika'], California:['Los Angeles','San Francisco'], Texas:['Houston','Austin'] },
  India: { Punjab:['Ludhiana','Amritsar'], Maharashtra:['Mumbai','Pune'] },
  Nigeria: { Benue:['Makurdi','Gboko'], Kano:['Kano','Wudil'] },
  Russia: { Moscow:['Moscow'], Krasnodar:['Krasnodar'] },
  Canada: { Ontario:['Toronto','Ottawa'], Quebec:['Montreal','Quebec City'] },
  China: { Guangdong:['Guangzhou','Shenzhen'], Shandong:['Jinan','Qingdao'] },
  Germany: { Bavaria:['Munich','Nuremberg'], NRW:['Cologne','Düsseldorf'] },
  Brazil: { SãoPaulo:['São Paulo','Campinas'], Parana:['Curitiba','Londrina'] },
  Kenya: { Nairobi:['Nairobi'], Kiambu:['Thika'] },
  Ethiopia: { Oromia:['Adama'], Amhara:['Bahir Dar'] },
  Turkey: { Ankara:['Ankara'], Izmir:['Izmir'] },
  France: { ÎledeFrance:['Paris'], Occitanie:['Toulouse'] },
  Spain: { Andalusia:['Seville'], Catalonia:['Barcelona'] },
  Italy: { Lazio:['Rome'], Lombardy:['Milan'] },
  Guatemala: { Guatemala:['Guatemala City'], Quetzaltenango:['Xela'] }
};

function populateCountrySelect(){
  const countries = Object.keys(GEO); // auto from GEO above
  els.country.innerHTML = '';
  countries.forEach(c=>{
    const o = document.createElement('option');
    o.value = c; o.textContent = c;
    els.country.appendChild(o);
  });
  if (!countries.includes(els.country.value)) els.country.value = 'US';
}

function populateStateCities(){
  const country = els.country.value;
  const states = Object.keys(GEO[country] || {});
  els.state.innerHTML = '';
  states.forEach(s=>{
    const o = document.createElement('option');
    o.value = s; o.textContent = s;
    els.state.appendChild(o);
  });
  if (!states.includes(els.state.value)) els.state.value = states[0] || '';

  function updateCity(){
    const cities = (GEO[country] && GEO[country][els.state.value]) || [];
    els.city.innerHTML = '';
    const any = document.createElement('option');
    any.value = ''; any.textContent = (typeof t==='function' ? t('all-cities') : 'All Cities');
    els.city.appendChild(any);
    cities.forEach(ct=>{
      const o = document.createElement('option');
      o.value = ct; o.textContent = ct;
      els.city.appendChild(o);
    });
    els.city.value = '';
  }
  els.state.onchange = updateCity;
  updateCity();
}

const BASE_RATES = {
  US: {Tomatoes:2.5, Corn:1.2, "Bell peppers":2.2},
  India: {Tomatoes:30, "Basmati rice":90, Okra:30},
  Nigeria: {Cassava:180, Millet:120, Groundnuts:220},
  Russia: {Potatoes:35, Wheat:25, Carrots:28},
  Canada: {Wheat:2.1, Canola:2.4, Blueberries:4.0},
  China: {Rice:6.5, Cabbage:3.2, Tomatoes:5.0},
  Germany: {Potatoes:1.8, Apples:3.0, Barley:1.6},
  Brazil: {Soybeans:6.0, Coffee:12.0, Maize:3.2},
  Kenya: {Maize:70, Kale:60, Tomatoes:90},
  Ethiopia: {Teff:85, Maize:55, Coffee:120},
  Turkey: {Tomatoes:18, Wheat:12, Olives:25},
  France: {Wheat:1.9, Grapes:4.5, Apples:3.2},
  Spain: {Oranges:2.8, Olives:3.1, Tomatoes:2.4},
  Italy: {Tomatoes:2.7, Grapes:4.8, Olives:3.4},
  Guatemala: {Coffee:25, Bananas:12, Cardamom:40}
};

async function loadMarkets(){
  const country = els.country?.value || 'US';
  const tryFiles = [
    `./data/markets/${country}.json`,
    './data/us_markets.json'
  ];
  const legend = els.mapLegend;

  let list = null, srcUsed = '';
  for (const url of tryFiles){
    try{
      const r = await fetch(url, {cache:'no-store'});
      if (r.ok){ list = await r.json(); srcUsed = url; break; }
    }catch(_){}
  }

  if (!list || !Array.isArray(list) || !list.length){
    legend.insertAdjacentHTML('afterend',
      `<p class="muted" style="margin-top:8px">No market data available for ${country} yet.</p>`);
    return;
  }

  let drawn = 0;
  list.forEach(m=>{
    if (typeof m.lat !== 'number' || typeof m.lng !== 'number') return;
    const color =
      m.mode==='sale' ? getComputedStyle(document.documentElement).getPropertyValue('--sale').trim() :
      m.mode==='trade'? getComputedStyle(document.documentElement).getPropertyValue('--trade').trim() :
                        getComputedStyle(document.documentElement).getPropertyValue('--both').trim();
    L.circleMarker([m.lat,m.lng], {radius:6, color})
      .addTo(map)
      .bindPopup(`<strong>${m.market}</strong><br>${m.city}, ${m.state||''}${m.type?`<br>${m.type}`:''}`);
    drawn++;
  });

  if (!drawn){
    legend.insertAdjacentHTML('afterend',
      `<p class="muted" style="margin-top:8px">No market points drawn from ${srcUsed}.</p>`);
  }
}

document.querySelector('#countrySelect').addEventListener('change', ()=>{
  populateStateCities(); renderFarmers(); renderConsumers(); initMap(); // rebuild map for new country
});

function refreshAll(){
  renderFarmers(); renderConsumers(); renderLaws?.(); renderMedical?.(); renderTrade?.();
}
