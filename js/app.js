/* Harvest Q – Stage 2/3/4 front-end controller (consolidated & fixed)
 * - Tabs, i18n, grids, map
 * - Post modal with inline validation
 * - AI stubs + /api/agent bridge
 * - IBM “Connect Agent” button + status
 * - Barter Agent client helpers (find/evaluate/initiate) with safe fallbacks
 * - Medical / Laws / Trade sections
 */

/* --------------------------------
   Small helpers & constants
----------------------------------- */
const $  = (s, r=document)=>r.querySelector(s);
const $$ = (s, r=document)=>[...r.querySelectorAll(s)];
const on = (el, ev, fn)=>el && el.addEventListener(ev, fn);
const toNumber = (s)=>Number(String(s??'').replace(/[^0-9.\-]/g,''))||0;

const CURRENCY = {
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

const debounce = (fn,ms=200)=>{let t; return (...a)=>{clearTimeout(t); t=setTimeout(()=>fn(...a),ms);}};
const LS = {
  get(k, d){ try{ return JSON.parse(localStorage.getItem(k)) ?? d; }catch{ return d; } },
  set(k, v){ localStorage.setItem(k, JSON.stringify(v)); }
};
const slug = (s='')=>String(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
const cropImageSrc = name => `./img/crops/${slug(name)}.jpg`;

function toMoney(n, unitSym='$'){ const v=Number(n); return Number.isNaN(v)?String(n):`${unitSym}${v.toFixed(2)}`; }

function showErrorOverlay(msg){
  const box = $('#hq-error');
  if (!box) return alert(msg || 'Error');
  $('#hq-error-text').textContent = String(msg || 'Unknown error');
  box.hidden = false;
}

/* --------------------------------
   i18n (minimal)
----------------------------------- */
const LANG = {
  en: {
    'tab-home':'Home','tab-farmers':'Farmers','tab-consumers':'Consumers','tab-laws':'Laws',
    'tab-medical':'Medical','tab-trade':'Trade','tab-ai':'AI','tab-grants':'Grants',
    'header-sub':'Fresh • Local • Trusted',
    'home-what-title':'What this beta shows',
    'home-what-content':'Country/state/city filters • Farmers & Consumers • Map markers • PWA scaffold',
    'refresh':'Refresh','all-cities':'All Cities',
    'farmer-search-placeholder':'Search product or farm…','consumer-search-placeholder':'Search buyer…',
    'mode-all':'All','mode-sale':'For Sale','mode-trade':'Willing to Trade','mode-both':'Both',
    'sort-name':'Name','sort-price':'Price (low→high)',
    'ai-price-btn':'Ask AI','ai-match-btn':'Find Match',
    'post-errors':'Please correct highlighted fields',
    'no-farmers':'No farmer listings match your filters yet.',
    'no-consumers':'No consumer listings match your filters yet.',
    'laws-disclaimer':'High-level summaries only. Always check local rules or talk to an extension officer.',
    'trade-disclaimer':'Examples only. Agree on quality, weights, and timing before you trade.'
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
    'trade-disclaimer':'ये केवल उदाहरण हैं। विनिमय से पहले गुणवत्ता, मात्रा और समय तय करें।'
  }
};
let currentLang = localStorage.getItem('hq:lang') || 'en';
const t = (k)=> (LANG[currentLang] && LANG[currentLang][k]) || k;

/* --------------------------------
   DOM cache
----------------------------------- */
const E = (id)=>document.getElementById(id);
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
  mapEl: E('map'), mapLegend: E('map-legend'),
  lawGrid: E('lawGrid'), medGrid: E('medGrid'),
  tradePanel: E('panel-trade'), tradeDisclaimer: E('trade-disclaimer'),
  footerText: E('footer-text'), homeWarning: E('home-warning')
};
['home','farmers','consumers','laws','medical','trade','ai','grants'].forEach(k=>els.panels[k]=E(`panel-${k}`));

/* --------------------------------
   Tabs
----------------------------------- */
const TABS = [
  {id:'home'},{id:'farmers'},{id:'consumers'},{id:'laws'},
  {id:'medical'},{id:'trade'},{id:'ai'},{id:'grants'}
];

function renderTabs(){
  if (!els.tabs) return;
  els.tabs.innerHTML='';
  TABS.forEach(ti=>{
    const b=document.createElement('button');
    b.className='tab'; b.dataset.panel=ti.id; b.setAttribute('role','tab');
    b.textContent=t(`tab-${ti.id}`); 
    els.tabs.appendChild(b);
  });
  on(els.tabs,'click',(e)=>{
    const btn=e.target.closest('button[data-panel]'); if(!btn) return;
    switchPanel(btn.dataset.panel,true);
  });
}
function switchPanel(id,push){
  TABS.forEach(t=>{ const p=els.panels[t.id]; if(p) p.hidden = (t.id!==id); });
  $$('#tabs .tab').forEach(b=>b.classList.toggle('active', b.dataset.panel===id));
  if(push) location.hash = `#${id}`;
  localStorage.setItem('hq:tab', id);
}
function startTab(){
  const fromHash = location.hash.replace('#','');
  const saved = localStorage.getItem('hq:tab')||'home';
  const target = TABS.some(t=>t.id===fromHash)?fromHash:saved;
  switchPanel(target,false);
}

/* --------------------------------
   Language apply
----------------------------------- */
function setLanguage(lang){
  currentLang=lang; localStorage.setItem('hq:lang', lang);
  E('header-sub') && (E('header-sub').textContent = t('header-sub'));
  E('home-what-title') && (E('home-what-title').textContent = t('home-what-title'));
  E('home-what-content') && (E('home-what-content').textContent = t('home-what-content'));
  els.farmerSearch && (els.farmerSearch.placeholder = t('farmer-search-placeholder'));
  els.consumerSearch && (els.consumerSearch.placeholder = t('consumer-search-placeholder'));
  const mops = els.modeFilter?.querySelectorAll('option'); 
  if(mops && mops.length>=4){
    mops[0].textContent=t('mode-all'); mops[1].textContent=t('mode-sale');
    mops[2].textContent=t('mode-trade'); mops[3].textContent=t('mode-both');
  }
  const sops = els.sortBy?.querySelectorAll('option');
  if(sops && sops.length>=2){ sops[0].textContent=t('sort-name'); sops[1].textContent=t('sort-price'); }
  E('laws-disclaimer') && (E('laws-disclaimer').textContent = t('laws-disclaimer'));
  E('trade-disclaimer') && (E('trade-disclaimer').textContent = t('trade-disclaimer'));
}

/* --------------------------------
   Data loading (farmers/consumers)
----------------------------------- */
let DATA_FARMERS = [];
let DATA_CONSUMERS = [];
async function loadJSON(path, fallback=null){
  try{
    const r = await fetch(path,{cache:'no-store'});
    if(!r.ok) throw new Error(r.status);
    return await r.json();
  }catch{ return fallback; }
}
async function loadData(){
  DATA_FARMERS   = await loadJSON('./data/farmers.json',   []);
  DATA_CONSUMERS = await loadJSON('./data/consumers.json', []);
}

/* --------------------------------
   Geo selects (15+ nations)
----------------------------------- */
const GEO = {
  US: { Alabama:['Auburn','Opelika'], California:['Los Angeles','San Francisco'], Texas:['Houston','Austin'] },
  India: { Punjab:['Ludhiana','Amritsar'], Maharashtra:['Mumbai','Pune'], TamilNadu:['Chennai','Coimbatore'] },
  Nigeria: { Benue:['Makurdi','Gboko'], Kano:['Kano','Wudil'], Rivers:['Port Harcourt','Obio-Akpor'] },
  Russia: { Moscow:['Moscow'], Krasnodar:['Krasnodar'] },
  Canada: { Ontario:['Toronto','Ottawa'], Quebec:['Montreal','Quebec City'] },
  China: { Guangdong:['Guangzhou','Shenzhen'], Shandong:['Jinan','Qingdao'] },
  Germany: { Bavaria:['Munich','Nuremberg'], NRW:['Cologne','Düsseldorf'] },
  Brazil: { 'São Paulo':['São Paulo','Campinas'], Parana:['Curitiba','Londrina'] },
  Kenya: { Nairobi:['Nairobi'], Kiambu:['Thika'] },
  Ethiopia: { Oromia:['Adama'], Amhara:['Bahir Dar'] },
  Turkey: { Ankara:['Ankara'], Izmir:['Izmir'] },
  France: { 'Île-de-France':['Paris'], Occitanie:['Toulouse'] },
  Spain: { Andalusia:['Seville'], Catalonia:['Barcelona'] },
  Italy: { Lazio:['Rome'], Lombardy:['Milan'] },
  Guatemala: { Guatemala:['Guatemala City'], Quetzaltenango:['Xela'] }
};

function populateCountrySelect(){
  if (!els.country) return;
  const countries = Object.keys(GEO);
  els.country.innerHTML='';
  countries.forEach(c=>{
    const o=document.createElement('option'); o.value=c; o.textContent=c; els.country.appendChild(o);
  });
  if (!countries.includes(els.country.value)) els.country.value='US';
}

function populateStateCities(){
  if (!els.country || !els.state || !els.city) return;
  const country = els.country.value;
  const states = Object.keys(GEO[country] || {});
  els.state.innerHTML='';
  states.forEach(s=>{ const o=document.createElement('option'); o.value=s; o.textContent=s; els.state.appendChild(o); });
  if (!states.includes(els.state.value)) els.state.value = states[0] || '';
  function updateCity(){
    const cities = (GEO[country] && GEO[country][els.state.value]) || [];
    els.city.innerHTML='';
    const any=document.createElement('option'); any.value=''; any.textContent = t('all-cities'); els.city.appendChild(any);
    cities.forEach(ct=>{ const o=document.createElement('option'); o.value=ct; o.textContent=ct; els.city.appendChild(o); });
    els.city.value='';
  }
  els.state.onchange = ()=>{ updateCity(); renderFarmers(); renderConsumers(); renderLaws(); renderTrade(); loadMarkets(); };
  updateCity();
}

/* --------------------------------
   Filtering helpers & renderers
----------------------------------- */
function emptyState(el, txt){
  const card=document.createElement('div'); card.className='card'; card.style.textAlign='center'; card.style.color='var(--muted)';
  card.textContent = txt; el.innerHTML=''; el.appendChild(card);
}
function filterByGeo(arr){
  if (!els.country) return arr;
  const country = els.country.value || 'US';
  const state   = els.state?.value || '';
  const city    = els.city?.value || '';
  return arr.filter(x => x.country===country && x.state===state && (!city || x.city===city));
}
function renderFarmers(){
  if (!els.farmerGrid) return;
  const src = filterByGeo(DATA_FARMERS);
  const q = (els.farmerSearch?.value||'').toLowerCase();
  const mode = els.modeFilter?.value || 'all';
  const sortBy = els.sortBy?.value || 'name';

  let list = src.filter(f=>{
    const hay = (f.farm+' '+(f.farmer||'')+' '+(f.products||[]).map(p=>p.name).join(' ')).toLowerCase();
    const passQ = !q || hay.includes(q);
    const passM = mode==='all' || f.mode===mode || (mode==='both' && f.mode==='both');
    return passQ && passM;
  });

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
        <h3>${p.name} — ${p.qty||''}</h3>
        <p><strong>Price:</strong> ${p.price||'—'}</p>
        <p><strong>Farm:</strong> ${f.farm} · <span class="muted">${f.city||''}, ${f.state||''}</span></p>
        <p><strong>Pickup:</strong> ${f.pickup||''}</p>
        <div class="flex" style="gap:6px;margin-top:8px">
          <a class="btn secondary" target="_blank" rel="noopener"
             href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((f.city||'')+','+(f.state||''))}">Open in Maps</a>
        </div>`;
      els.farmerGrid.appendChild(card);
    });
  });
}
function renderConsumers(){
  if (!els.consumerGrid) return;
  const list = filterByGeo(DATA_CONSUMERS);
  if(!list.length) return emptyState(els.consumerGrid, t('no-consumers'));
  els.consumerGrid.innerHTML='';
  list.forEach(c=>{
    const card=document.createElement('div'); card.className='card';
    card.innerHTML = `<h3>${c.name}</h3><p>${c.city||''}, ${c.state||''}</p><p><strong>Wants:</strong> ${c.want||''}</p>`;
    els.consumerGrid.appendChild(card);
  });
}

/* --------------------------------
   Laws panel (per country)
----------------------------------- */
const LAW_INFO = {
  US: [
    {
      title: 'Direct farm sales & markets',
      points: [
        'Many states allow farmers to sell directly at farm stands and markets with simple registration.',
        'Processed foods (jams, pickles) may need a cottage food permit and basic labeling.'
      ]
    },
    {
      title: 'Weights, measures & pricing',
      points: [
        'Use reliable scales and show prices clearly per pound or kilogram.',
        'Keep simple sales records for tax and income tracking.'
      ]
    }
  ],
  India: [
    {
      title: 'Direct marketing & mandis',
      points: [
        'Several states allow farmers to sell outside APMC mandis and directly to buyers or platforms.',
        'Keep proof of landholding or FPO membership when joining new buyer programs.'
      ]
    },
    {
      title: 'Pesticide & residue rules',
      points: [
        'Use only registered pesticides as per the label and avoid banned products.',
        'Maintain a small spray diary (date, product, dose) when supplying organized buyers.'
      ]
    }
  ],
  Nigeria: [
    {
      title: 'Market levies & permits',
      points: [
        'Local councils may charge small levies at markets; request a receipt when you pay.',
        'Ask your cooperative or extension officer which permits apply in your state.'
      ]
    },
    {
      title: 'Food hygiene basics',
      points: [
        'Keep harvest containers clean and separate from chemicals and fuel.',
        'If you package food, check NAFDAC guidance before selling at scale.'
      ]
    }
  ],
  Default: [
    {
      title: 'Selling safely & legally',
      points: [
        'Know if your country requires any registration to sell at markets or online.',
        'Keep basic records: what you sold, to whom, and for how much.'
      ]
    },
    {
      title: 'Labels & transparency',
      points: [
        'Be honest about weight, grade, and whether produce is organic or sprayed.',
        'When in doubt, ask a local extension officer or farmers’ union for guidance.'
      ]
    }
  ]
};

function renderLaws(){
  if (!els.lawGrid) return;
  const country = els.country?.value || 'Default';
  const cards = LAW_INFO[country] || LAW_INFO.Default;
  els.lawGrid.innerHTML = '';
  cards.forEach(c=>{
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <h3>${c.title}</h3>
      <ul>${(c.points||[]).map(p=>`<li>${p}</li>`).join('')}</ul>
    `;
    els.lawGrid.appendChild(card);
  });
}

/* --------------------------------
   Medical panel (farmer wellbeing)
----------------------------------- */
const MED_TIPS = [
  {
    title: 'Heat & hydration on harvest days',
    points: [
      'Harvest early in the morning or late afternoon when possible.',
      'Drink small amounts of clean water often; avoid working long hours without breaks.',
      'Use hats, light clothing, and shaded rest spots to prevent heat exhaustion.'
    ]
  },
  {
    title: 'Safe pesticide handling',
    points: [
      'Always read the label and mix only the recommended dose.',
      'Wear basic protection: long sleeves, gloves, closed shoes, and a mask if available.',
      'Wash hands, face, and clothing after spraying; keep chemicals away from children.'
    ]
  }
];

function renderMedical(){
  if (!els.medGrid) return;
  els.medGrid.innerHTML = '';
  MED_TIPS.forEach(tip=>{
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <h3>${tip.title}</h3>
      <ul>${tip.points.map(p=>`<li>${p}</li>`).join('')}</ul>
    `;
    els.medGrid.appendChild(card);
  });
}

/* --------------------------------
   Trade / Barter panel
----------------------------------- */
const TRADE_EXAMPLES = [
  {
    title: 'Crop-for-crop swaps',
    items: [
      '50 kg onions ↔ 30 kg rice between neighboring farms.',
      '2 crates of tomatoes ↔ 1 crate of peppers to balance mixed orders.'
    ]
  },
  {
    title: 'Crop ↔ services',
    items: [
      'Maize or cassava in exchange for tractor ploughing or transport to town.',
      'Vegetable boxes in exchange for cold-room storage space.'
    ]
  },
  {
    title: 'Community trades',
    items: [
      'Surplus produce swapped for help with weeding or harvest.',
      'Fruit or grain given to schools, churches, or elder homes in return for future labor or small cash top-ups.'
    ]
  }
];

function renderTrade(){
  const panel = els.tradePanel;
  if (!panel) return;

  // ensure disclaimer text is set by language
  els.tradeDisclaimer && (els.tradeDisclaimer.textContent = t('trade-disclaimer'));

  // create / reuse grid inside panel
  let grid = panel.querySelector('#tradeGrid');
  if (!grid){
    grid = document.createElement('div');
    grid.id = 'tradeGrid';
    grid.className = 'grid';
    panel.appendChild(grid);
  }
  grid.innerHTML = '';

  TRADE_EXAMPLES.forEach(ex=>{
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <h3>${ex.title}</h3>
      <ul>${ex.items.map(i=>`<li>${i}</li>`).join('')}</ul>
    `;
    grid.appendChild(card);
  });
}

/* --------------------------------
   Map (Leaflet) + markets
----------------------------------- */
let map=null;
function initMap(){
  if (!els.mapEl || map) return;
  try{
    map = L.map('map',{zoomControl:true}).setView([10,10],2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:''}).addTo(map);

    if (els.mapLegend){
      const mk = (color,label)=>`<div class="item"><div class="dot" style="background:${color}"></div><div class="label">${label}</div></div>`;
      const cs = getComputedStyle(document.documentElement);
      els.mapLegend.innerHTML = mk(cs.getPropertyValue('--sale'),'Sale') + mk(cs.getPropertyValue('--trade'),'Trade') + mk(cs.getPropertyValue('--both'),'Both');
    }
    loadMarkets();
  }catch(e){ console.warn('map init failed', e); }
}
async function loadMarkets(){
  if (!map) return;
  const country = els.country?.value || 'US';
  const candidates = [`./data/markets/${country}.json`, './data/us_markets.json'];
  let list=null;
  for (const url of candidates){
    try{ const r=await fetch(url,{cache:'no-store'}); if(r.ok){ list=await r.json(); break; } }catch{}
  }
  // clear existing circle markers
  map.eachLayer(l=>{ if (l instanceof L.CircleMarker) map.removeLayer(l); });

  if (!Array.isArray(list) || !list.length){
    return;
  }
  const cs = getComputedStyle(document.documentElement);
  list.forEach(m=>{
    if (typeof m.lat!=='number' || typeof m.lng!=='number') return;
    const color = m.mode==='sale' ? cs.getPropertyValue('--sale').trim()
                 : m.mode==='trade'? cs.getPropertyValue('--trade').trim()
                 : cs.getPropertyValue('--both').trim();
    L.circleMarker([m.lat,m.lng],{radius:6,color})
      .addTo(map)
      .bindPopup(`<strong>${m.market}</strong><br>${m.city||''}, ${m.state||''}${m.type?`<br>${m.type}`:''}`);
  });
}

/* --------------------------------
   Post modal + validation
----------------------------------- */
let postOpenerBtn=null;
function trapFocus(modal){
  const q='button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])';
  const f=Array.from(modal.querySelectorAll(q)).filter(el=>!el.disabled);
  if(!f.length) return;
  const first=f[0], last=f[f.length-1];
  function onKey(e){
    if(e.key==='Tab'){
      if(e.shiftKey && document.activeElement===first){ e.preventDefault(); last.focus(); }
      else if(!e.shiftKey && document.activeElement===last){ e.preventDefault(); first.focus(); }
    }
    if(e.key==='Escape'){ closePostModal(); }
  }
  modal.addEventListener('keydown', onKey);
  modal._focusTrapCleanup = ()=>modal.removeEventListener('keydown', onKey);
  first.focus();
}
function openPostModal(btn){ postOpenerBtn=btn||null; els.postModal.hidden=false; els.postModal.setAttribute('aria-hidden','false'); trapFocus(els.postModal); els.pfFarm?.focus(); }
function closePostModal(){ els.postModal.hidden=true; els.postModal.setAttribute('aria-hidden','true'); els.postModal._focusTrapCleanup?.(); postOpenerBtn?.focus(); }
on(els.postOpenBtn,'click',()=>openPostModal(els.postOpenBtn));
on(E('postCancel'),'click',closePostModal);

const errQty = E('errQty'); const errPrice=E('errPrice');
function sanitizeNumberInput(str){ return String(str||'').replace(/,/g,'').trim(); }
function requirePositiveNumber(str){
  const clean = sanitizeNumberInput(str); const n=Number(clean);
  if(!clean) return {ok:false, msg:'Required'}; if(!isFinite(n) || n<=0) return {ok:false, msg:'Enter a positive number'};
  return {ok:true, value:n};
}
on(els.postForm,'submit', (ev)=>{
  ev.preventDefault();
  els.postErrors && (els.postErrors.textContent=''); errQty && (errQty.textContent=''); errPrice && (errPrice.textContent='');

  const rQty=requirePositiveNumber(els.pfQty.value);
  const rPrice=requirePositiveNumber(els.pfPrice.value);
  let bad=false;
  if(!rQty.ok){ errQty && (errQty.textContent=rQty.msg); bad=true; }
  if(!rPrice.ok){ errPrice && (errPrice.textContent=rPrice.msg); bad=true; }
  if(bad){ els.postErrors && (els.postErrors.textContent = t('post-errors')); return; }

  const country=els.country?.value || 'US';
  const rec={
    country, state: els.state?.value || '', city: els.city?.value || '',
    farmer:'You', farm: els.pfFarm.value,
    products:[{name: els.pfProduct.value, qty: `${rQty.value}`, price: `${rPrice.value}`}],
    pickup:'', mode: els.pfMode.value
  };
  DATA_FARMERS.unshift(rec);
  closePostModal(); renderFarmers();
});

/* --------------------------------
   AI bridge (/api/agent) + stubs
----------------------------------- */
function trace(step, payload){
  const el = $('#agentTrace'); if(!el) return;
  const row = document.createElement('pre');
  row.textContent = `[${new Date().toLocaleTimeString()}] ${step}: ` + JSON.stringify(payload, null, 2);
  el.prepend(row);
}
async function callAgent(tool, args){
  trace('CALL',{tool,args});
  const t0=performance.now();
  try{
    const r = await fetch('/api/agent',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tool,args})});
    const out = await r.json();
    trace('RESULT',{tool, ms:Math.round(performance.now()-t0), ...out});
    if(out?.ok) return out;
    return out;
  }catch(e){
    trace('ERROR',{tool, error:String(e)});
    throw e;
  }
}
async function callTool(tool, args={}){ return callAgent(tool, args); } // alias for flows

/* AI: price + match (client hint) */
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

on(els.aiPriceBtn,'click', ()=>{
  const crop=els.aiCrop?.value, qty=els.aiQty?.value;
  if(!crop || !qty){ els.aiPriceOut && (els.aiPriceOut.textContent='Enter crop and quantity (e.g., Tomatoes, 40 lb).'); return; }
  const country=els.country?.value || 'US';
  const base = (BASE_RATES[country] && BASE_RATES[country][crop]) || 2.0;
  const lo=(base*0.9).toFixed(2), hi=(base*1.1).toFixed(2);
  els.aiPriceOut && (els.aiPriceOut.textContent = `Suggested range: ${CURRENCY[country]?.symbol||'$'}${lo} - ${CURRENCY[country]?.symbol||'$'}${hi} per ${CURRENCY[country]?.unit||'unit'}`);
});

on(els.aiMatchBtn,'click', async ()=>{
  const want=(els.aiWant?.value||'').trim();
  if(!want){ els.aiMatchOut && (els.aiMatchOut.textContent='Describe what you want (e.g., Peaches 20 lb).'); return; }
  try{
    const res = await callAgent('findBarterMatch', { itemOffered: want, itemWanted: want, location: els.country?.value || 'US' });
    els.aiMatchOut && (els.aiMatchOut.textContent = JSON.stringify(res?.result || res, null, 2));
  }catch(e){
    els.aiMatchOut && (els.aiMatchOut.textContent = 'No matches found in current filters.');
  }
});

/* --------------------------------
   IBM Connect button + status
----------------------------------- */
window.ORCH_CONNECTED = false;

async function watsonxOrchestrate(){
  const statusEl = $('#agentStatus');
  if(statusEl) statusEl.textContent = 'Connecting to IBM watsonx…';
  try{
    const r = await fetch('/api/agent',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:'Initialize Harvest Q agents'})});
    await r.json().catch(()=>({}));
    window.ORCH_CONNECTED = true;
    if(statusEl) statusEl.innerHTML = '✅ Connected. Agents are ready.';
    setAIButtonsEnabled(true);
  }catch(e){
    window.ORCH_CONNECTED = false;
    if(statusEl) statusEl.textContent = '❌ IBM connection failed (demo fallback active).';
    setAIButtonsEnabled(false);
  }
}
function setAIButtonsEnabled(enabled){
  $$('.ai-suggest-farmers, .ai-suggest-buyers, .ai-grant-triage').forEach(b=> b.disabled = !enabled);
}
on($('#connectAgentBtn'),'click', watsonxOrchestrate);

/* --------------------------------
   Demo flows (buyers / farmers / grant)
----------------------------------- */
function renderAI(btn, html){
  const box = btn.parentElement.querySelector('.ai-result') || btn.nextElementSibling;
  if (box) box.innerHTML = html;
}
async function aiSuggestFarmersFlow(btn){
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
  scored.sort((a,b)=>b.score-a.score);

  const best = scored[0];
  const route = await callTool('planRoute', { pickup: best.location, dropoff: location });
  const plan = route.result || route;

  renderAI(btn, `
    <strong>Top match:</strong> ${best.supplierName} (${best.product})
    <br>Qty: ${best.quantity} • Distance: ${best.distanceKm}km • Score: ${best.score}
    <br>Route: ${plan.distanceKm ?? '?'}km — ${plan.window ?? 'ETA TBD'}
  `);
}
async function aiSuggestBuyersFlow(btn){
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
async function aiGrantTriageFlow(btn){
  if (!window.ORCH_CONNECTED) return alert('Connect IBM Agent first.');
  const applicant = btn.dataset.applicant;
  const purpose = btn.dataset.purpose;

  const triage = await callTool('scoreGrant', { applicant, purpose });
  const r = triage.result || triage;
  renderAI(btn, `
    <strong>Score:</strong> ${Math.round((r.score || 0) * 100)} / 100
    <br>${r.rationale || 'Triage complete.'}
  `);
}
document.addEventListener('click', (e)=>{
  if (e.target.matches('.ai-suggest-farmers')) aiSuggestFarmersFlow(e.target);
  if (e.target.matches('.ai-suggest-buyers'))  aiSuggestBuyersFlow(e.target);
  if (e.target.matches('.ai-grant-triage'))    aiGrantTriageFlow(e.target);
});

/* --------------------------------
   Barter Agent client-side helpers
----------------------------------- */
function listBarterables(farmer){
  return (farmer?.products||[])
    .filter(p=>p.barter===true || /trade|barter/i.test(p.notes||''))
    .map(p=>({
      farmerId: farmer.id || farmer.farm || farmer.name,
      farmerName: farmer.name || farmer.farm || 'Farmer',
      location: `${farmer.city||''}, ${farmer.state||''}`,
      name: p.name, qty: p.qty || p.quantity || '', price: p.price || null
    }));
}
function pseudoDistance(a='', b=''){
  const s = (String(a)+String(b));
  let h=0; for(let i=0;i<s.length;i++) h = (h*31 + s.charCodeAt(i))|0;
  return Math.abs(h%200)+10;
}
async function findBarterMatch({ itemOffered, itemWanted, location, maxDistanceKm = 100 }){
  const data = await loadJSON('data/farmers.json', []);
  const items = data.flatMap(listBarterables);
  const suppliers   = items.filter(i=> i.name.toLowerCase().includes((itemWanted||'').toLowerCase()));
  const counterparts= items.filter(i=> i.name.toLowerCase().includes((itemOffered||'').toLowerCase()));
  const pairs=[];
  for(const s of suppliers){
    for(const c of counterparts){
      if (s.farmerId===c.farmerId) continue;
      const dist = pseudoDistance(s.location, location || c.location);
      if (dist<=maxDistanceKm){
        pairs.push({
          partnerId: s.farmerId, partnerName: s.farmerName, distanceKm: dist,
          theyOffer:{name:s.name, qty:s.qty}, youOffer:{name:c.name, qty:c.qty},
          rationale:`Close proximity and reciprocal goods (${itemOffered}↔${itemWanted}).`
        });
      }
    }
  }
  pairs.sort((a,b)=>a.distanceKm-b.distanceKm);
  return { matches: pairs.slice(0,3), note: pairs.length?'Top barter candidates.':'No compatible partners found.' };
}
async function evaluateTradeValue({ itemsA=[], itemsB=[] }){
  const ref = { tomato:0.5, onion:0.6, corn:0.22, rice:0.9, avocado:2.1, dates:4.0 };
  const parseQty = (q)=>{ const m=String(q||'').match(/[\d.]+/); return m?Number(m[0]):0; };
  const u = (n,f=1)=> (ref[n?.toLowerCase()] ?? f);
  const val = (arr)=>arr.reduce((s,it)=> s + parseQty(it.qty) * (it.refPricePerUnit ?? u(it.name)), 0);
  const A = val(itemsA), B=val(itemsB), R = B?A/B:0, fair = R>0.9 && R<1.1;
  return { valueA:+A.toFixed(2), valueB:+B.toFixed(2), proposedRatioAtoB:+R.toFixed(2),
           fairness: fair?'balanced':(R<0.9?'A owes more':'B owes more'),
           note:'Naive valuation using reference prices; replace with live feed when available.' };
}
async function initiateExchange({ partnerId, terms }){
  const contractId = `BAR-${Date.now()}`;
  return { ok:true, summary:{ contractId, partnerId, terms, status:'pending-confirmation', createdAt:new Date().toISOString() } };
}

/* --------------------------------
   Misc
----------------------------------- */
function setStaticWarning(){
  if(!els.homeWarning) return;
  els.homeWarning.textContent='';
  const strong=document.createElement('strong'); strong.textContent='Note: ';
  const rest=document.createTextNode('Demo data for judging. Compliance cards are non-legal summaries; pair with legal counsel.');
  els.homeWarning.appendChild(strong); els.homeWarning.appendChild(rest);
}

/* --------------------------------
   Boot
----------------------------------- */
document.addEventListener('DOMContentLoaded', async ()=>{
  renderTabs();
  const langSel = E('langSelect'); 
  if (langSel){ 
    langSel.value=currentLang; 
    on(langSel,'change', e=>{ setLanguage(e.target.value); renderLaws(); renderMedical(); renderTrade(); }); 
  }
  setLanguage(langSel?.value || currentLang);

  populateCountrySelect();
  populateStateCities();
  on(els.country,'change', ()=>{ 
    populateStateCities(); 
    renderFarmers(); 
    renderConsumers(); 
    renderLaws(); 
    renderTrade(); 
    loadMarkets(); 
  });

  const savedMode = LS.get('hq:mode','all'); if(els.modeFilter) els.modeFilter.value=savedMode;
  const savedSort = LS.get('hq:sort','name'); if(els.sortBy)    els.sortBy.value=savedSort;

  on(els.farmerSearch,'input', debounce(renderFarmers,200));
  on(els.consumerSearch,'input', debounce(renderConsumers,200));
  on(els.modeFilter,'change', e=>{ LS.set('hq:mode', e.target.value); renderFarmers(); });
  on(els.sortBy,'change',  e=>{ LS.set('hq:sort', e.target.value);  renderFarmers(); });

  await loadData();
  renderFarmers(); 
  renderConsumers();
  renderLaws();
  renderMedical();
  renderTrade();
  initMap();

  // Playground button (if present)
  on($('#runToolBtn'),'click', async ()=>{
    const tool = $('#toolSelect')?.value || 'priceBands';
    try{ await callAgent(tool, {}); }catch(e){ showErrorOverlay(e.message); }
  });

  setAIButtonsEnabled(false);

  els.footerText && (els.footerText.textContent = `© Harvest Q — Stage 3 • ${new Date().toLocaleString()}`);
  setStaticWarning();

  startTab();
});
