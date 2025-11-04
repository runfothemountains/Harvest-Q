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
    'tab-home':'होम','tab-farmers':'किसान','tab-consumers':'উপभोक्ता','tab-laws':'कानून',
    'tab-medical':'स्वास्थ्य','tab-trade':'विनिमय','tab-ai':'एआई','tab-grants':'अनुदान',
    'header-sub':'ताज़ा
