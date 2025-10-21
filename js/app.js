/* Stage-2 app.js
 - i18n (EN/HI only)
 - UI orchestration
 - Map (Leaflet) lazy-load / markets
 - Post modal + validation
 - AI price & match stubs
*/

/* -------------------------
   Small helpers & constants
   ------------------------- */
const CURRENCY = { US:{symbol:'$',unit:'lb'}, India:{symbol:'₹',unit:'kg'}, Nigeria:{symbol:'₦',unit:'kg'} };
const toNumber = s => Number(String(s||'').replace(/[^0-9.\-]/g,'')) || 0;
const debounce = (fn,ms=200)=>{let t; return (...a)=>{clearTimeout(t); t=setTimeout(()=>fn(...a),ms);}};

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
    'post-errors':'Please correct highlighted fields'
  },
  hi: {
    'tab-home':'होम','tab-farmers':'किसान','tab-consumers':'उपभोक्ता','tab-laws':'कानून','tab-ai':'एआई',
    'header-sub':'ताज़ा • स्थानीय • विश्वसनीय',
    'home-what-title':'यह बीटा क्या दिखाता है','home-what-content':'देश/राज्य/शहर स्विचिंग • किसान और उपभोक्ता • मानचित्र • PWA',
    'refresh':'ताज़ा करें','all-cities':'सभी शहर',
    'farmer-search-placeholder':'उत्पाद या खेत खोजें…','consumer-search-placeholder':'खरीदार खोजें…',
    'mode-all':'सभी','mode-sale':'बिक्री के लिए','mode-trade':'विनिमय के लिए','mode-both':'दोनों',
    'sort-name':'नाम','sort-price':'कीमत (कम→अधिक)',
    'ai-price-btn':'एआई से पूछें','ai-match-btn':'मिलान खोजें',
    'post-errors':'कृपया फ़ील्ड सुधारें'
  }
};

let currentLang = localStorage.getItem('hq:lang') || 'en';
const t = (k) => (LANG[currentLang] && LANG[currentLang][k]) || k;

/* -------------------------
   DOM helpers & elements
   ------------------------- */
const E = id => document.getElementById(id);
const els = {
  tabs: E('tabs'), panels: {}, country: E('countrySelect'), state: E('stateSelect'), city: E('citySelect'),
  farmerGrid: E('farmerGrid'), consumerGrid: E('consumerGrid'),
  farmerSearch: E('farmerSearch'), consumerSearch: E('consumerSearch'),
  modeFilter: E('modeFilter'), sortBy: E('sortBy'),
  postOpenBtn: E('postOpenBtn'), postModal: E('postModal'), postForm: E('postForm'),
  pfFarm: E('pfFarm'), pfProduct: E('pfProduct'), pfQty: E('pfQty'), pfPrice: E('pfPrice'), pfMode: E('pfMode'), postErrors: E('postErrors'),
  aiCrop: E('aiCrop'), aiQty: E('aiQty'), aiPriceBtn: E('aiPriceBtn'), aiPriceOut: E('aiPriceOut'),
  aiWant: E('aiWant'), aiMatchBtn: E('aiMatchBtn'), aiMatchOut: E('aiMatchOut'),
  mapEl: E('map'), mapLegend: E('map-legend'), footerText: E('footer-text')
};

['home','farmers','consumers','laws','ai'].forEach(k=>els.panels[k]=E(`panel-${k}`));

/* -------------------------
   Data placeholders (fallbacks)
   ------------------------- */
let DATA_FARMERS = [];
let DATA_CONSUMERS = [];
const SAMPLE_FARMERS = []; // kept small on purpose; you can add full SAMPLE arrays or point to ./data/farmers.json
const SAMPLE_CONSUMERS = [];

/* -------------------------
   Load data (fallback to SAMPLE)
   ------------------------- */
async function loadData(){
  async function maybe(path, fallback=[]){
    try{ const r = await fetch(path, {cache:'no-store'}); if(!r.ok) throw new Error('no'); const j = await r.json(); return j; }
    catch(e){ console.warn('fallback',path); return fallback; }
  }
  DATA_FARMERS = await maybe('./data/farmers.json', SAMPLE_FARMERS);
  DATA_CONSUMERS = await maybe('./data/consumers.json', SAMPLE_CONSUMERS);
}

/* -------------------------
   Tabs & language wiring
   ------------------------- */
const TABS = [{id:'home'},{id:'farmers'},{id:'consumers'},{id:'laws'},{id:'ai'}];
function renderTabs(){
  els.tabs.innerHTML=''; TABS.forEach(ti=>{
    const b=document.createElement('button'); b.className='tab'; b.dataset.id=ti.id; b.textContent=t(`tab-${ti.id}`); b.onclick=()=>switchPanel(ti.id,true);
    els.tabs.appendChild(b);
  });
}
function switchPanel(id,push){
  TABS.forEach(t=>els.panels[t.id].hidden = t.id!==id);
  document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active', b.dataset.id===id));
  if(push) location.hash = `#${id}`;
  localStorage.setItem('hq:tab', id);
}
function startTab(){ const fromHash = location.hash.replace('#',''); const saved = localStorage.getItem('hq:tab')||'home'; const target = TABS.some(t=>t.id===fromHash)?fromHash:saved; switchPanel(target); }

function setLanguage(lang){
  currentLang=lang; localStorage.setItem('hq:lang', lang);
  // static pieces
  document.querySelector('#header-sub').textContent = t('header-sub');
  document.querySelector('#home-what-title').textContent = t('home-what-title');
  document.querySelector('#home-what-content').textContent = t('home-what-content');
  // placeholders
  els.farmerSearch.placeholder = t('farmer-search-placeholder');
  els.consumerSearch.placeholder = t('consumer-search-placeholder');
  document.querySelectorAll('#modeFilter option')[0].textContent = t('mode-all');
  document.querySelectorAll('#modeFilter option')[1].textContent = t('mode-sale');
  document.querySelectorAll('#modeFilter option')[2].textContent = t('mode-trade');
  document.querySelectorAll('#modeFilter option')[3].textContent = t('mode-both');
  document.querySelectorAll('#sortBy option')[0].textContent = t('sort-name');
  document.querySelectorAll('#sortBy option')[1].textContent = t('sort-price');
  document.querySelector('#ai-price-btn-text')?.replaceWith(document.createTextNode(t('ai-price-btn'))); // fallback safe
}

/* -------------------------
   Renderers
   ------------------------- */
function emptyState(el, txt){ el.innerHTML = `<div class="card" style="text-align:center;color:var(--muted)">${txt}</div>`; }

function filterByGeo(arr){
  const country = document.querySelector('#countrySelect').value || 'US';
  const state = document.querySelector('#stateSelect').value || '';
  const city = document.querySelector('#citySelect').value || '';
  return arr.filter(x => x.country===country && x.state===state && (!city || x.city===city));
}

function renderFarmers(){
  const list = filterByGeo(DATA_FARMERS);
  const q = (els.farmerSearch.value||'').toLowerCase();
  if(!list.length) return emptyState(els.farmerGrid, t('no-farmers')||'No farmers yet.');
  els.farmerGrid.innerHTML='';
  list.forEach(f=>{
    f.products.forEach(p=>{
      const card=document.createElement('div'); card.className='card';
      card.innerHTML = `<h3>${p.name} — ${p.qty}</h3>
        <p><strong>Price:</strong> ${p.price}</p>
        <p><strong>Farm:</strong> ${f.farm} · <span class="muted">${f.city}, ${f.state}</span></p>
        <p><strong>Pickup:</strong> ${f.pickup}</p>
        <div class="flex" style="gap:6px;margin-top:8px">
          <a class="btn secondary" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(f.city+','+f.state)}">Open in Maps</a>
        </div>`;
      els.farmerGrid.appendChild(card);
    });
  });
}

function renderConsumers(){
  const list = filterByGeo(DATA_CONSUMERS);
  if(!list.length) return emptyState(els.consumerGrid, 'No consumers yet.');
  els.consumerGrid.innerHTML='';
  list.forEach(c=>{ const card=document.createElement('div'); card.className='card'; card.innerHTML=`<h3>${c.name}</h3><p>${c.city}, ${c.state}</p><p><strong>Wants:</strong> ${c.want}</p>`; els.consumerGrid.appendChild(card); });
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
    loadMarkets();
  }catch(e){ console.warn('map init failed', e); }
}
async function loadMarkets(){
  try{
    const res = await fetch('./data/us_markets.json');
    if(!res.ok) throw new Error('no markets');
    const list = await res.json();
    list.forEach(m=>{
      if(!m.lat||!m.lng) return;
      const color = m.mode==='sale' ? getComputedStyle(document.documentElement).getPropertyValue('--sale').trim() :
                    m.mode==='trade' ? getComputedStyle(document.documentElement).getPropertyValue('--trade').trim() :
                    getComputedStyle(document.documentElement).getPropertyValue('--both').trim();
      L.circleMarker([m.lat,m.lng],{radius:6,color}).addTo(map).bindPopup(`<strong>${m.market}</strong><br>${m.city}, ${m.state}<br>${m.type||''}`);
    });
  }catch(e){ console.warn('markets load fail', e); }
}

/* -------------------------
   Post form validation & flow
   ------------------------- */
function requirePositiveNumber(str){
  const n = toNumber(str);
  if(!str || !isFinite(n) || n <= 0) return {ok:false};
  return {ok:true, value:n};
}
els.postOpenBtn?.addEventListener('click', ()=>{ els.postModal.hidden=false; els.postModal.setAttribute('aria-hidden','false'); });
E('postCancel')?.addEventListener('click', ()=>{ els.postModal.hidden=true; els.postModal.setAttribute('aria-hidden','true'); });

els.postForm?.addEventListener('submit', (ev)=>{
  ev.preventDefault(); els.postErrors.textContent='';
  const q = requirePositiveNumber(els.pfQty.value), p = requirePositiveNumber(els.pfPrice.value);
  if(!q.ok || !p.ok){
    els.postErrors.textContent = t('post-errors');
    return;
  }
  // Normalize and add to DATA_FARMERS for demo
  const newRec = {
    country: document.querySelector('#countrySelect').value || 'US',
    state: document.querySelector('#stateSelect').value || '',
    city: document.querySelector('#citySelect').value || '',
    farmer: 'You', farm: els.pfFarm.value, products: [{name: els.pfProduct.value, qty: `${q.value}`, price: `${p.value}`}], pickup:'', mode: els.pfMode.value
  };
  DATA_FARMERS.unshift(newRec);
  els.postModal.hidden=true; renderFarmers(); // simple success flow
});

/* -------------------------
   Simple AI stubs (client)
   ------------------------- */
const BASE_RATES = { US:{Tomatoes:2.5}, India:{Tomatoes:30}, Nigeria:{Cassava:180} };
els.aiPriceBtn?.addEventListener('click', ()=>{
  const crop = els.aiCrop.value, qty = els.aiQty.value;
  if(!crop || !qty){ els.aiPriceOut.textContent='Enter crop and quantity (e.g., Tomatoes, 40 lb).'; return; }
  const country = document.querySelector('#countrySelect').value || 'US';
  const base = (BASE_RATES[country] && BASE_RATES[country][crop]) || 2.0;
  const n = toNumber(qty) || 1;
  const lo = (base*0.9).toFixed(2), hi = (base*1.1).toFixed(2);
  els.aiPriceOut.textContent = `Suggested range: ${CURRENCY[country]?.symbol||'$'}${lo} - ${CURRENCY[country]?.symbol||'$'}${hi} per ${CURRENCY[country]?.unit||'unit'}`;
});

els.aiMatchBtn?.addEventListener('click', ()=>{
  const want = els.aiWant.value||'';
  if(!want){ els.aiMatchOut.textContent='Describe what you want (e.g., Peaches 20 lb).'; return; }
  // crude local match
  const pool = DATA_FARMERS.slice(0,10).filter(f=>f.products.some(p=>p.name.toLowerCase().includes(want.toLowerCase())));
  if(!pool.length){ els.aiMatchOut.textContent='No matches found.'; return; }
  els.aiMatchOut.textContent = pool.map(f=>`${f.products[0].name} from ${f.farm} (${f.city})`).join('\n');
});

/* -------------------------
   Init & wiring
   ------------------------- */
function populateCountrySelect(){
  const countries = ['US','India','Nigeria'];
  els.country.innerHTML=''; countries.forEach(c=>{ const o=document.createElement('option'); o.value=c; o.textContent=c; els.country.appendChild(o); });
}
function populateStateCities(){
  // minimal mapping; you can expand to full COUNTRIES mapping or load from ./data/countries.json
  const map = {
    US:{Alabama:['Auburn','Opelika'],California:['Los Angeles','San Francisco'],Texas:['Houston','Austin']},
    India:{Punjab:['Ludhiana','Amritsar'],Maharashtra:['Mumbai','Pune'],TamilNadu:['Chennai','Coimbatore']},
    Nigeria:{Benue:['Makurdi','Gboko'],Kano:['Kano','Wudil'],Rivers:['Port Harcourt','Obio-Akpor']}
  };
  const country = els.country.value; const states = Object.keys(map[country]||{});
  els.state.innerHTML=''; states.forEach(s=>{ const o=document.createElement('option'); o.value=s; o.textContent=s; els.state.appendChild(o); });
  // city update
  function updateCity(){ const cities = map[country][els.state.value]||[]; els.city.innerHTML=''; const any=document.createElement('option'); any.value=''; any.textContent = t('all-cities'); els.city.appendChild(any); cities.forEach(ct=>{ const o=document.createElement('option'); o.value=ct; o.textContent=ct; els.city.appendChild(o); }); }
  els.state.onchange = updateCity; updateCity();
}

/* -------------------------
   Boot
   ------------------------- */
async function init(){
  renderTabs();
  startTab();
  // language
  document.querySelector('#langSelect').value = localStorage.getItem('hq:lang') || 'en';
  document.querySelector('#langSelect').addEventListener('change', e=>{ setLanguage(e.target.value); });
  setLanguage(document.querySelector('#langSelect').value);

  populateCountrySelect();
  populateStateCities();
  document.querySelector('#countrySelect').addEventListener('change', ()=>{ populateStateCities(); renderFarmers(); });

  els.farmerSearch.addEventListener('input', debounce(renderFarmers,200));
  els.consumerSearch.addEventListener('input', debounce(renderConsumers,200));
  els.modeFilter.addEventListener('change', renderFarmers);
  els.sortBy.addEventListener('change', renderFarmers);

  // post modal wiring already above
  await loadData(); renderFarmers(); renderConsumers();
  initMap();
  // footer
  els.footerText.textContent = `© Harvest Q — Stage 2 • ${new Date().toLocaleString()}`;
}
document.addEventListener('DOMContentLoaded', init);

async function loadMarkets(){
  const legend = els.mapLegend;
  try{
    const res = await fetch('./data/us_markets.json', {cache:'no-store'});
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const list = await res.json();

    let drawn = 0;
    list.forEach(m=>{
      if(!m || typeof m.lat!=='number' || typeof m.lng!=='number') return;
      const color =
        m.mode==='sale' ? getComputedStyle(document.documentElement).getPropertyValue('--sale').trim() :
        m.mode==='trade'? getComputedStyle(document.documentElement).getPropertyValue('--trade').trim() :
                          getComputedStyle(document.documentElement).getPropertyValue('--both').trim();
      L.circleMarker([m.lat,m.lng],{radius:6,color}).addTo(map)
        .bindPopup(`<strong>${m.market}</strong><br>${m.city}, ${m.state}${m.type? `<br>${m.type}`:''}`);
      drawn++;
    });

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
<!-- index.html -->
<div id="postModal" class="modal" role="dialog" aria-modal="true" aria-labelledby="postTitle" hidden>
  <div class="modal-box">
    <h3 id="postTitle">Post a Listing</h3>
    <!-- form unchanged -->
  </div>
</div>

// js/app.js (near modal wiring)
let postOpenerBtn = null;

function trapFocus(modal){
  const selectors = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
  const focusables = Array.from(modal.querySelectorAll(selectors)).filter(el=>!el.disabled);
  if(!focusables.length) return;
  let first = focusables[0], last = focusables[focusables.length-1];
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

<label>Quantity
  <input id="pfQty" inputmode="decimal" step="0.01" min="0.01" placeholder="e.g., 40 kg / 100 lb" required>
  <span class="field-error" id="errQty" aria-live="polite"></span>
</label>
<label>Price
  <input id="pfPrice" inputmode="decimal" step="0.01" min="0.01" placeholder="e.g., 2.50" required>
  <span class="field-error" id="errPrice" aria-live="polite"></span>
</label>

/* css/style.css */
.field-error{ display:block; color:#b91c1c; font-size:12px; margin-top:4px }

function sanitizeNumberInput(str){
  return String(str||'').replace(/,/g,'').trim();
}
function requirePositiveNumber(str){
  const clean = sanitizeNumberInput(str);
  const n = Number(clean);
  if(!clean) return {ok:false, msg:'Required'};
  if(!isFinite(n) || n<=0) return {ok:false, msg:'Enter a positive number'};
  return {ok:true, value:n};
}

els.postForm?.addEventListener('submit', (ev)=>{
  ev.preventDefault();
  // clear errors
  E('errQty').textContent=''; E('errPrice').textContent='';
  const rQty = requirePositiveNumber(els.pfQty.value);
  const rPrice = requirePositiveNumber(els.pfPrice.value);
  let hasErr = false;
  if(!rQty.ok){ E('errQty').textContent = rQty.msg; hasErr = true; }
  if(!rPrice.ok){ E('errPrice').textContent = rPrice.msg; hasErr = true; }
  if(hasErr) return;

  // proceed (normalize if you wish)
  // ...
  closePostModal();
  renderFarmers();
});

// Replace: els.homeWarning.innerHTML = "<strong>Note:</strong> ...";
function setStaticWarning(el){
  el.textContent = ''; // clear
  const strong = document.createElement('strong'); strong.textContent = 'Note: ';
  const rest = document.createTextNode('Demo data for judging. Compliance cards are non-legal summaries; pair with legal counsel.');
  el.appendChild(strong); el.appendChild(rest);
}
setStaticWarning(els.homeWarning);

function escapeHTML(s){ return String(s).replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
// then el.innerHTML = escapeHTML(userString);
