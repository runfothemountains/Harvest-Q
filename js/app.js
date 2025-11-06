/* ============================================================
   Harvest Q – Stage 3 Front-End Controller (IBM Ready)
   - Tabs + i18n
   - Geo filters + farmers/consumers grids
   - Leaflet maps + spinners + legends
   - Post listing modal with validation
   - AI helpers + /api/agent bridge (backend or demo fallback)
   Updated: 2025-11-06
============================================================ */

/* -----------------------------
   Small helpers & constants
----------------------------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const on = (el, ev, fn) => el && el.addEventListener(ev, fn);
const debounce = (fn, ms = 250) => {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
};
const LS = {
  get(key, def) {
    try {
      const v = localStorage.getItem(key);
      return v == null ? def : JSON.parse(v);
    } catch {
      return def;
    }
  },
  set(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch {
      /* ignore */
    }
  }
};
const slug = (s = "") =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/* ------------ i18n ------------ */
const LANG = {
  en: {
    "tab-home": "Home",
    "tab-farmers": "Farmers",
    "tab-consumers": "Consumers",
    "tab-laws": "Laws",
    "tab-medical": "Medical",
    "tab-trade": "Trade",
    "tab-ai": "AI",
    "tab-grants": "Grants",

    "header-sub":
      "Connecting farms, communities, and AI for sustainable food systems.",
    "home-what-title": "What this beta shows",
    "home-what-content":
      "Country/state/city filters • Farmers & Consumers • Map markers • PWA scaffold.",
    "farmer-search": "Search farmers or products...",
    "consumer-search": "Search buyers or requests...",
    "mode-all": "All",
    "mode-sale": "For Sale",
    "mode-trade": "Trade",
    "mode-both": "Both",
    "sort-name": "Name",
    "sort-price": "Price (Low to High)",
    "laws-disclaimer":
      "Provided for education only. Always verify local laws before trading or exporting.",
    "trade-disclaimer":
      "Harvest Q promotes fair barter to reduce waste and build community resilience.",
    "post-errors": "Please correct the highlighted fields.",
    "no-farmers": "No farmers match your filters yet.",
    "no-consumers": "No consumer listings match your filters yet.",
    "ai-price-hint": "Enter crop and quantity to get AI pricing.",
    "ai-match-hint": "Describe your trade to find matches."
  },
  hi: {
    "tab-home": "होम",
    "tab-farmers": "किसान",
    "tab-consumers": "उपभोक्ता",
    "tab-laws": "कानून",
    "tab-medical": "स्वास्थ्य",
    "tab-trade": "विनिमय",
    "tab-ai": "एआई",
    "tab-grants": "अनुदान",

    "header-sub":
      "फार्म, समुदाय और एआई को जोड़कर टिकाऊ खाद्य प्रणाली बनाना।",
    "home-what-title": "यह बीटा क्या दिखाता है",
    "home-what-content":
      "देश/राज्य/शहर फ़िल्टर • किसान/उपभोक्ता • नक्शा मार्कर • PWA ढांचा।",
    "farmer-search": "किसान या उत्पाद खोजें...",
    "consumer-search": "खरीदार या माँग खोजें...",
    "mode-all": "सभी",
    "mode-sale": "बिक्री के लिए",
    "mode-trade": "विनिमय",
    "mode-both": "दोनों",
    "sort-name": "नाम",
    "sort-price": "कीमत (कम से ज़्यादा)",
    "laws-disclaimer":
      "केवल शिक्षा के लिए। व्यापार या निर्यात से पहले स्थानीय कानून अवश्य जाँचें।",
    "trade-disclaimer":
      "हार्वेस्ट क्यू निष्पक्ष विनिमय को बढ़ावा देता है ताकि बर्बादी कम हो और समुदाय मजबूत हों।",
    "post-errors": "कृपया हाइलाइट किए गए फ़ील्ड सुधारें।",
    "no-farmers": "फ़िल्टर के अनुसार कोई किसान सूची नहीं मिली।",
    "no-consumers": "फ़िल्टर के अनुसार कोई उपभोक्ता सूची नहीं मिली।",
    "ai-price-hint": "एआई मूल्य अनुमान के लिए फसल और मात्रा दर्ज करें।",
    "ai-match-hint": "विनिमय खोजने के लिए अपना प्रस्ताव लिखें।"
  }
};
let currentLang = localStorage.getItem("hq:lang") || "en";
const t = (key) =>
  (LANG[currentLang] && LANG[currentLang][key]) || LANG.en[key] || key;

/* ------------ DOM cache ------------ */
const E = (id) => document.getElementById(id);
const els = {
  tabs: null,
  panels: {},
  // filters
  country: null,
  state: null,
  city: null,
  // grids
  farmerGrid: null,
  consumerGrid: null,
  // search + filters
  farmerSearch: null,
  consumerSearch: null,
  modeFilter: null,
  sortBy: null,
  // modal
  postOpenBtn: null,
  postModal: null,
  postForm: null,
  pfFarm: null,
  pfProduct: null,
  pfQty: null,
  pfPrice: null,
  pfMode: null,
  postErrors: null,
  errQty: null,
  errPrice: null,
  // maps
  mapEl: null,
  mapLoading: null,
  mapLegend: null,
  consumerMapEl: null,
  consumerMapLoading: null,
  consumerMapLegend: null,
  // other panels
  lawGrid: null,
  medGrid: null,
  tradeDisclaimer: null,
  homeWarning: null,
  // AI
  aiCrop: null,
  aiQty: null,
  aiPriceBtn: null,
  aiPriceOut: null,
  aiWant: null,
  aiMatchBtn: null,
  aiMatchOut: null,
  connectAgentBtn: null,
  agentStatus: null,
  toolSelect: null,
  runToolBtn: null,
  agentTrace: null,
  // footer
  footerText: null
};

const TABS = [
  { id: "home" },
  { id: "farmers" },
  { id: "consumers" },
  { id: "laws" },
  { id: "medical" },
  { id: "trade" },
  { id: "ai" },
  { id: "grants" }
];

/* ------------ Geo model ------------ */
const GEO = {
  US: {
    Alabama: ["Auburn", "Opelika"],
    California: ["Los Angeles", "San Francisco"],
    Texas: ["Houston", "Austin"]
  },
  India: {
    Punjab: ["Ludhiana", "Amritsar"],
    Maharashtra: ["Mumbai", "Pune"],
    TamilNadu: ["Chennai", "Coimbatore"]
  },
  Nigeria: {
    Benue: ["Makurdi", "Gboko"],
    Kano: ["Kano", "Wudil"],
    Rivers: ["Port Harcourt", "Obio-Akpor"]
  },
  Russia: {
    Moscow: ["Moscow"],
    Krasnodar: ["Krasnodar"]
  },
  Canada: {
    Ontario: ["Toronto", "Ottawa"],
    Quebec: ["Montreal", "Quebec City"]
  },
  China: {
    Guangdong: ["Guangzhou", "Shenzhen"],
    Shandong: ["Jinan", "Qingdao"]
  },
  Germany: {
    Bavaria: ["Munich", "Nuremberg"],
    NRW: ["Cologne", "Düsseldorf"]
  },
  Brazil: {
    "São Paulo": ["São Paulo", "Campinas"],
    Parana: ["Curitiba", "Londrina"]
  },
  Kenya: {
    Nairobi: ["Nairobi"],
    Kiambu: ["Thika"]
  },
  Ethiopia: {
    Oromia: ["Adama"],
    Amhara: ["Bahir Dar"]
  },
  Turkey: {
    Ankara: ["Ankara"],
    Izmir: ["Izmir"]
  },
  France: {
    "Île-de-France": ["Paris"],
    Occitanie: ["Toulouse"]
  },
  Spain: {
    Andalusia: ["Seville"],
    Catalonia: ["Barcelona"]
  },
  Italy: {
    Lazio: ["Rome"],
    Lombardy: ["Milan"]
  },
  Guatemala: {
    Guatemala: ["Guatemala City"],
    Quetzaltenango: ["Xela"]
  }
};

/* ------------ Data & fetch helpers ------------ */
let DATA_FARMERS = [];
let DATA_CONSUMERS = [];

async function loadJSON(path, fallback = null) {
  try {
    const res = await fetch(path, { cache: "no-store" });
    if (!res.ok) throw new Error(res.statusText || "HTTP " + res.status);
    return await res.json();
  } catch (e) {
    console.warn("loadJSON failed:", path, e);
    return fallback;
  }
}

async function loadData() {
  DATA_FARMERS = (await loadJSON("./data/farmers.json", [])) || [];
  DATA_CONSUMERS = (await loadJSON("./data/consumers.json", [])) || [];
}

/* ============================================================
   Tabs
============================================================ */
function renderTabs() {
  const tabsEl = els.tabs;
  if (!tabsEl) return;

  const btns = $$("button[data-panel]", tabsEl);
  btns.forEach((btn) => {
    const id = btn.dataset.panel || "";
    btn.classList.add("tab");
    btn.setAttribute("role", "tab");
    btn.setAttribute("aria-selected", "false");
    btn.setAttribute("tabindex", "-1");
    btn.textContent = t(`tab-${id}`);
  });

  on(tabsEl, "click", (ev) => {
    const btn = ev.target.closest("button[data-panel]");
    if (!btn) return;
    const id = btn.dataset.panel;
    switchPanel(id, true);
  });
}

function switchPanel(id, pushHash) {
  if (!id) return;

  // hide/show panels
  TABS.forEach((tab) => {
    const p = els.panels[tab.id];
    if (p) {
      const isActive = tab.id === id;
      p.hidden = !isActive;
    }
  });

  // aria + active state on tabs
  const btns = $$("nav#tabs button[data-panel]");
  btns.forEach((btn) => {
    const isActive = btn.dataset.panel === id;
    btn.setAttribute("aria-selected", isActive ? "true" : "false");
    btn.setAttribute("tabindex", isActive ? "0" : "-1");
  });

  if (pushHash) {
    try {
      location.hash = "#" + id;
    } catch {
      /* ignore */
    }
  }
  LS.set("hq:tab", id);
}

function startTab() {
  const fromHash = (location.hash || "").replace("#", "");
  const saved = LS.get("hq:tab", "home");
  const target = TABS.some((t) => t.id === fromHash) ? fromHash : saved;
  switchPanel(target, false);
}

/* ============================================================
   Language
============================================================ */
function applyLanguageToUI() {
  const headerSub = E("header-sub");
  if (headerSub) headerSub.textContent = t("header-sub");

  const hwt = E("home-what-title");
  const hwc = E("home-what-content");
  if (hwt) hwt.textContent = t("home-what-title");
  if (hwc) hwc.textContent = t("home-what-content");

  if (els.farmerSearch) els.farmerSearch.placeholder = t("farmer-search");
  if (els.consumerSearch)
    els.consumerSearch.placeholder = t("consumer-search");

  if (els.modeFilter) {
    const opts = els.modeFilter.options;
    if (opts.length >= 4) {
      opts[0].textContent = t("mode-all");
      opts[1].textContent = t("mode-sale");
      opts[2].textContent = t("mode-trade");
      opts[3].textContent = t("mode-both");
    }
  }
  if (els.sortBy) {
    const opts = els.sortBy.options;
    if (opts.length >= 2) {
      opts[0].textContent = t("sort-name");
      opts[1].textContent = t("sort-price");
    }
  }

  const lawDisc = E("laws-disclaimer");
  if (lawDisc) lawDisc.textContent = t("laws-disclaimer");
  const tradeDisc = E("trade-disclaimer");
  if (tradeDisc) tradeDisc.textContent = t("trade-disclaimer");

  if (els.aiPriceOut && !els.aiPriceOut.textContent.trim()) {
    els.aiPriceOut.textContent = t("ai-price-hint");
  }
  if (els.aiMatchOut && !els.aiMatchOut.textContent.trim()) {
    els.aiMatchOut.textContent = t("ai-match-hint");
  }

  // re-label tab buttons
  const btns = $$("nav#tabs button[data-panel]");
  btns.forEach((btn) => {
    const id = btn.dataset.panel;
    btn.textContent = t(`tab-${id}`);
  });
}

function setLanguage(lang) {
  currentLang = lang;
  LS.set("hq:lang", lang);
  applyLanguageToUI();
}

/* ============================================================
   Geo selects
============================================================ */
function populateStateAndCities() {
  if (!els.country || !els.state || !els.city) return;
  const country = els.country.value || "US";
  const states = Object.keys(GEO[country] || {});

  // states
  els.state.innerHTML = "";
  states.forEach((s) => {
    const o = document.createElement("option");
    o.value = s;
    o.textContent = s;
    els.state.appendChild(o);
  });
  if (!states.includes(els.state.value)) {
    els.state.value = states[0] || "";
  }

  const updateCities = () => {
    const st = els.state.value;
    const cities = (GEO[country] && GEO[country][st]) || [];
    els.city.innerHTML = "";
    const any = document.createElement("option");
    any.value = "";
    any.textContent = "All Cities";
    els.city.appendChild(any);
    cities.forEach((ct) => {
      const o = document.createElement("option");
      o.value = ct;
      o.textContent = ct;
      els.city.appendChild(o);
    });
    els.city.value = "";
  };

  updateCities();

  on(els.state, "change", () => {
    updateCities();
    renderFarmers();
    renderConsumers();
    loadMarkets();
    loadConsumerMarkets();
  });
}

/* ============================================================
   Filtering & rendering (farmers / consumers)
============================================================ */
function emptyState(el, msg) {
  el.innerHTML = "";
  const card = document.createElement("div");
  card.className = "card";
  card.style.textAlign = "center";
  card.textContent = msg;
  el.appendChild(card);
}

function filterByGeo(list) {
  if (!els.country) return list;
  const country = els.country.value || "US";
  const state = els.state ? els.state.value : "";
  const city = els.city ? els.city.value : "";

  return list.filter((x) => {
    if (x.country && x.country !== country) return false;
    if (state && x.state && x.state !== state) return false;
    if (city && x.city && x.city !== city) return false;
    return true;
  });
}

function renderFarmers() {
  const grid = els.farmerGrid;
  if (!grid) return;
  let list = filterByGeo(DATA_FARMERS || []);

  const q = (els.farmerSearch?.value || "").toLowerCase();
  const mode = els.modeFilter?.value || "all";
  const sortBy = els.sortBy?.value || "name";

  list = list.filter((f) => {
    const hay =
      (f.farm || "") +
      " " +
      (f.farmer || "") +
      " " +
      (f.city || "") +
      " " +
      (f.state || "") +
      " " +
      (f.products || []).map((p) => p.name).join(" ");
    const hayL = hay.toLowerCase();
    const passQ = !q || hayL.includes(q);
    const fMode = f.mode || "sale";
    let passM = true;
    if (mode === "sale") passM = fMode === "sale";
    else if (mode === "trade") passM = fMode === "trade";
    else if (mode === "both") passM = fMode === "both";
    return passQ && passM;
  });

  if (!list.length) {
    emptyState(grid, t("no-farmers"));
    return;
  }

  grid.innerHTML = "";
  list.forEach((f) => {
    const products = (f.products || []).slice();

    if (sortBy === "name") {
      products.sort((a, b) => String(a.name).localeCompare(String(b.name)));
    } else if (sortBy === "priceAsc") {
      products.sort(
        (a, b) =>
          (parseFloat(a.price) || Number.MAX_VALUE) -
          (parseFloat(b.price) || Number.MAX_VALUE)
      );
    }

    products.forEach((p) => {
      const card = document.createElement("div");
      card.className = "card";

      const imgSrc = `./img/crops/${slug(p.name || "crop")}.jpg`;
      const price = p.price ? String(p.price) : "—";

      card.innerHTML = `
        <img class="thumb" src="${imgSrc}"
             alt="${p.name || "Crop"}"
             style="width:100%;height:150px;object-fit:cover;border-radius:8px;margin-bottom:8px"
             onerror="this.onerror=null;this.src='./img/placeholder.png';">
        <h3>${p.name || "Crop"} — ${p.qty || ""}</h3>
        <p><strong>Price:</strong> ${price}</p>
        <p><strong>Farm:</strong> ${f.farm || "Farm"} · 
           <span class="muted">${f.city || ""}${
        f.state ? ", " + f.state : ""
      }</span></p>
        <p><strong>Pickup:</strong> ${f.pickup || "Arrange with farmer"}</p>
      `;

      grid.appendChild(card);
    });
  });
}

function renderConsumers() {
  const grid = els.consumerGrid;
  if (!grid) return;

  let list = filterByGeo(DATA_CONSUMERS || []);
  const q = (els.consumerSearch?.value || "").toLowerCase();

  list = list.filter((c) => {
    const hay =
      (c.name || "") +
      " " +
      (c.want || "") +
      " " +
      (c.city || "") +
      " " +
      (c.state || "");
    const hayL = hay.toLowerCase();
    return !q || hayL.includes(q);
  });

  if (!list.length) {
    emptyState(grid, t("no-consumers"));
    return;
  }

  grid.innerHTML = "";
  list.forEach((c) => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <h3>${c.name || "Buyer"}</h3>
      <p class="muted">${c.city || ""}${c.state ? ", " + c.state : ""}</p>
      <p><strong>Wants:</strong> ${c.want || ""}</p>
    `;
    grid.appendChild(card);
  });
}

/* ============================================================
   Laws + Medical (augment static HTML)
============================================================ */
const MED_TIPS = [
  {
    title: "Heat & hydration on harvest days",
    points: [
      "Harvest early in the morning or late afternoon when possible.",
      "Drink small amounts of clean water often; avoid working long hours without breaks.",
      "Use hats, light clothing, and shaded rest spots to prevent heat exhaustion."
    ]
  },
  {
    title: "Safe pesticide handling",
    points: [
      "Always read the label and mix only the recommended dose.",
      "Wear long sleeves, gloves, closed shoes, and a mask if available.",
      "Wash hands, face, and clothing after spraying; keep chemicals away from children."
    ]
  }
];

function renderMedical() {
  const grid = els.medGrid;
  if (!grid) return;
  grid.innerHTML = "";
  MED_TIPS.forEach((tip) => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <h4>${tip.title}</h4>
      <ul>${tip.points.map((p) => `<li>${p}</li>`).join("")}</ul>
    `;
    grid.appendChild(card);
  });
}

/* ============================================================
   Maps (Leaflet) + markets
============================================================ */
let map = null;
let consumerMap = null;

function renderLegend(el, isConsumer = false) {
  if (!el) return;
  if (isConsumer) {
    el.innerHTML = `
      <span class="item">
        <span class="dot" style="display:inline-block;width:10px;height:10px;border-radius:999px;background:#0f766e;margin-right:4px;"></span>
        Consumer demand hubs
      </span>
    `;
  } else {
    el.innerHTML = `
      <span class="item">
        <span class="dot" style="display:inline-block;width:10px;height:10px;border-radius:999px;background:#10b981;margin-right:4px;"></span>
        For Sale
      </span>
      <span class="item">
        <span class="dot" style="display:inline-block;width:10px;height:10px;border-radius:999px;background:#f97316;margin-right:4px;"></span>
        Trade
      </span>
      <span class="item">
        <span class="dot" style="display:inline-block;width:10px;height:10px;border-radius:999px;background:#3b82f6;margin-right:4px;"></span>
        Both
      </span>
    `;
  }
}

function initMap() {
  if (!els.mapEl || typeof L === "undefined") return;
  if (map) return;

  els.mapLoading && (els.mapLoading.style.display = "block");

  map = L.map("map", { zoomControl: true }).setView([10, 10], 2);
  const tile = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: ""
  }).addTo(map);

  tile.on("load", () => {
    if (els.mapLoading) els.mapLoading.style.display = "none";
    els.mapEl.style.display = "block";
  });

  renderLegend(els.mapLegend, false);
  loadMarkets();
}

function initConsumerMap() {
  if (!els.consumerMapEl || typeof L === "undefined") return;
  if (consumerMap) return;

  els.consumerMapLoading &&
    (els.consumerMapLoading.style.display = "block");

  consumerMap = L.map("consumer-map", { zoomControl: true }).setView(
    [10, 10],
    2
  );
  const tile = L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    { attribution: "" }
  ).addTo(consumerMap);

  tile.on("load", () => {
    if (els.consumerMapLoading) els.consumerMapLoading.style.display = "none";
    els.consumerMapEl.style.display = "block";
  });

  renderLegend(els.consumerMapLegend, true);
  loadConsumerMarkets();
}

async function loadMarkets() {
  if (!map) return;
  const country = els.country?.value || "US";
  const candidates = [
    `./data/markets/${country}.json`,
    "./data/us_markets.json"
  ];
  let list = null;

  for (const url of candidates) {
    const data = await loadJSON(url, null);
    if (Array.isArray(data) && data.length) {
      list = data;
      break;
    }
  }
  // clear old markers
  map.eachLayer((layer) => {
    if (layer instanceof L.CircleMarker) map.removeLayer(layer);
  });
  if (!Array.isArray(list)) return;

  list.forEach((m) => {
    if (typeof m.lat !== "number" || typeof m.lng !== "number") return;
    let color = "#3b82f6"; // both default
    if (m.mode === "sale") color = "#10b981";
    else if (m.mode === "trade") color = "#f97316";

    L.circleMarker([m.lat, m.lng], {
      radius: 6,
      color,
      fillColor: color,
      fillOpacity: 0.85
    })
      .addTo(map)
      .bindPopup(
        `<strong>${m.market || "Market"}</strong><br>${m.city || ""}${
          m.state ? ", " + m.state : ""
        }${m.type ? "<br>" + m.type : ""}`
      );
  });
}

async function loadConsumerMarkets() {
  if (!consumerMap) return;
  const country = els.country?.value || "US";
  const candidates = [
    `./data/markets/${country}.json`,
    "./data/us_markets.json"
  ];
  let list = null;

  for (const url of candidates) {
    const data = await loadJSON(url, null);
    if (Array.isArray(data) && data.length) {
      list = data;
      break;
    }
  }
  consumerMap.eachLayer((layer) => {
    if (layer instanceof L.CircleMarker) consumerMap.removeLayer(layer);
  });
  if (!Array.isArray(list)) return;

  const color = "#0f766e";
  list.forEach((m) => {
    if (typeof m.lat !== "number" || typeof m.lng !== "number") return;

    L.circleMarker([m.lat, m.lng], {
      radius: 6,
      color,
      fillColor: color,
      fillOpacity: 0.85
    })
      .addTo(consumerMap)
      .bindPopup(
        `<strong>Consumer hub: ${
          m.market || "Hub"
        }</strong><br>${m.city || ""}${m.state ? ", " + m.state : ""}`
      );
  });
}

/* ============================================================
   Post modal + validation
============================================================ */
function showError(msg) {
  const box = E("hq-error");
  const txt = E("hq-error-text");
  if (!box || !txt) {
    alert(msg || "Error");
    return;
  }
  txt.textContent = String(msg || "Unknown error");
  box.hidden = false;
}

let postOpener = null;

function trapFocus(modal) {
  const focusableSel =
    'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])';
  const focusables = Array.from(modal.querySelectorAll(focusableSel)).filter(
    (el) => !el.disabled
  );
  if (!focusables.length) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];

  function onKey(e) {
    if (e.key === "Tab") {
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    if (e.key === "Escape") closePostModal();
  }

  modal.addEventListener("keydown", onKey);
  modal._focusTrapCleanup = () =>
    modal.removeEventListener("keydown", onKey);
  first.focus();
}

function openPostModal(btn) {
  if (!els.postModal) return;
  postOpener = btn || null;
  els.postModal.hidden = false;
  els.postModal.setAttribute("aria-hidden", "false");
  trapFocus(els.postModal);
}

function closePostModal() {
  if (!els.postModal) return;
  els.postModal.hidden = true;
  els.postModal.setAttribute("aria-hidden", "true");
  if (els.postModal._focusTrapCleanup) els.postModal._focusTrapCleanup();
  if (postOpener) postOpener.focus();
}

function sanitizeNumberInput(str) {
  return String(str || "").replace(/,/g, "").trim();
}

function requirePositiveNumber(str) {
  const clean = sanitizeNumberInput(str);
  if (!clean) return { ok: false, msg: "Required" };
  const n = Number(clean);
  if (!Number.isFinite(n) || n <= 0)
    return { ok: false, msg: "Enter a positive number" };
  return { ok: true, value: n };
}

/* ============================================================
   AI helpers (frontend + /api/agent bridge)
============================================================ */
const CURRENCY = {
  US: { symbol: "$", unit: "lb", code: "USD" },
  India: { symbol: "₹", unit: "kg", code: "INR" },
  Nigeria: { symbol: "₦", unit: "kg", code: "NGN" },
  Russia: { symbol: "₽", unit: "kg", code: "RUB" },
  Canada: { symbol: "$", unit: "kg", code: "CAD" },
  China: { symbol: "¥", unit: "kg", code: "CNY" },
  Germany: { symbol: "€", unit: "kg", code: "EUR" },
  Brazil: { symbol: "R$", unit: "kg", code: "BRL" },
  Kenya: { symbol: "KSh", unit: "kg", code: "KES" },
  Ethiopia: { symbol: "Br", unit: "kg", code: "ETB" },
  Turkey: { symbol: "₺", unit: "kg", code: "TRY" },
  France: { symbol: "€", unit: "kg", code: "EUR" },
  Spain: { symbol: "€", unit: "kg", code: "EUR" },
  Italy: { symbol: "€", unit: "kg", code: "EUR" },
  Guatemala: { symbol: "Q", unit: "kg", code: "GTQ" }
};

const BASE_RATES = {
  US: { Tomatoes: 2.5, Corn: 1.2, "Bell peppers": 2.2 },
  India: { Tomatoes: 30, "Basmati rice": 90, Okra: 30 },
  Nigeria: { Cassava: 180, Millet: 120, Groundnuts: 220 },
  Russia: { Potatoes: 35, Wheat: 25, Carrots: 28 },
  Canada: { Wheat: 2.1, Canola: 2.4, Blueberries: 4.0 },
  China: { Rice: 6.5, Cabbage: 3.2, Tomatoes: 5.0 },
  Germany: { Potatoes: 1.8, Apples: 3.0, Barley: 1.6 },
  Brazil: { Soybeans: 6.0, Coffee: 12.0, Maize: 3.2 },
  Kenya: { Maize: 70, Kale: 60, Tomatoes: 90 },
  Ethiopia: { Teff: 85, Maize: 55, Coffee: 120 },
  Turkey: { Tomatoes: 18, Wheat: 12, Olives: 25 },
  France: { Wheat: 1.9, Grapes: 4.5, Apples: 3.2 },
  Spain: { Oranges: 2.8, Olives: 3.1, Tomatoes: 2.4 },
  Italy: { Tomatoes: 2.7, Grapes: 4.8, Olives: 3.4 },
  Guatemala: { Coffee: 25, Bananas: 12, Cardamom: 40 }
};

function trace(step, payload) {
  if (!els.agentTrace) return;
  const row = document.createElement("pre");
  row.textContent =
    `[${new Date().toLocaleTimeString()}] ${step}: ` +
    JSON.stringify(payload, null, 2);
  els.agentTrace.prepend(row);
}

async function callAgent(tool, args) {
  trace("CALL", { tool, args });
  const t0 = performance.now();
  try {
    const res = await fetch("/api/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tool, args })
    });
    const data = await res.json().catch(() => ({}));
    const ms = Math.round(performance.now() - t0);
    trace("RESULT", { tool, ms, data });
    if (data && data.ok) return data;
    // demo fallback shape
    return { ok: false, error: data.error || "Agent returned non-ok." };
  } catch (e) {
    const ms = Math.round(performance.now() - t0);
    trace("ERROR", { tool, ms, error: String(e) });
    return { ok: false, error: String(e) };
  }
}

let ORCH_CONNECTED = false;

async function watsonxOrchestrate() {
  if (els.agentStatus)
    els.agentStatus.textContent = "Connecting to IBM watsonx…";
  try {
    const res = await fetch("/api/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Initialize Harvest Q agents" })
    });
    await res.json().catch(() => ({}));
    ORCH_CONNECTED = true;
    if (els.agentStatus)
      els.agentStatus.textContent = "✅ Connected. Agents are ready (demo).";
  } catch {
    ORCH_CONNECTED = false;
    if (els.agentStatus)
      els.agentStatus.textContent =
        "❌ IBM connection failed. Using local demo logic.";
  }
}

/* ------------ AI UI wiring ------------ */
function setupAI() {
  // price helper
  on(els.aiPriceBtn, "click", () => {
    const crop = els.aiCrop?.value;
    const qty = els.aiQty?.value;
    if (!crop || !qty) {
      if (els.aiPriceOut)
        els.aiPriceOut.textContent =
          "Enter crop and quantity, e.g., Tomatoes, 40 lb.";
      return;
    }
    const country = els.country?.value || "US";
    const base =
      (BASE_RATES[country] && BASE_RATES[country][crop]) ||
      (BASE_RATES.US && BASE_RATES.US[crop]) ||
      2.0;

    const lo = (base * 0.9).toFixed(2);
    const hi = (base * 1.1).toFixed(2);
    const unitSym = CURRENCY[country]?.symbol || "$";
    const unit = CURRENCY[country]?.unit || "unit";
    if (els.aiPriceOut)
      els.aiPriceOut.textContent = `Suggested range: ${unitSym}${lo} - ${unitSym}${hi} per ${unit}`;
  });

  // barter match
  on(els.aiMatchBtn, "click", async () => {
    const want = (els.aiWant?.value || "").trim();
    if (!want) {
      if (els.aiMatchOut)
        els.aiMatchOut.textContent =
          "Describe what you want to trade, e.g., swap tomatoes for onions.";
      return;
    }
    const location = els.country?.value || "US";
    if (els.aiMatchOut) els.aiMatchOut.textContent = "Searching demo partners…";

    const res = await callAgent("findBarterMatch", {
      itemOffered: want,
      itemWanted: want,
      location,
      maxDistanceKm: 150
    });

    if (!res.ok) {
      if (els.aiMatchOut)
        els.aiMatchOut.textContent =
          "No matches or agent offline (demo mode).";
      return;
    }

    const result = res.result || res;
    if (els.aiMatchOut)
      els.aiMatchOut.textContent = JSON.stringify(
        result,
        null,
        2
      );
  });

  // agent tool playground
  on(els.runToolBtn, "click", async () => {
    const tool = els.toolSelect?.value || "priceBands";
    let args = {};
    const country = els.country?.value || "US";

    if (tool === "priceBands") {
      args = { product: "Tomatoes", quantity: "100 kg", location: country };
    } else if (tool === "findSuppliers") {
      args = { crop: "Tomatoes", minQty: "200 kg", location: country };
    } else if (tool === "scoreMatch") {
      args = { supplierId: "demo-1", criteria: { distanceKm: 50 } };
    } else if (tool === "planRoute") {
      args = { pickup: "Farm A", dropoff: "Market B" };
    } else if (tool === "suggestPrice") {
      args = { crop: "Tomatoes", region: country, quantity: "50 kg" };
    }

    const res = await callAgent(tool, args);
    if (!res.ok) showError(res.error || "Tool call failed");
  });

  on(els.connectAgentBtn, "click", watsonxOrchestrate);
}

/* ============================================================
   Misc
============================================================ */
function setStaticWarning() {
  if (!els.homeWarning) return;
  els.homeWarning.textContent = "";
  const strong = document.createElement("strong");
  strong.textContent = "Note: ";
  const rest = document.createTextNode(
    "This beta uses demo data only. Laws & trade cards are high-level summaries, not legal advice."
  );
  els.homeWarning.appendChild(strong);
  els.homeWarning.appendChild(rest);
}

/* ============================================================
   Boot
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  // cache DOM
  els.tabs = E("tabs");
  TABS.forEach((t) => {
    els.panels[t.id] = E(`panel-${t.id}`);
  });
  els.country = E("countrySelect");
  els.state = E("stateSelect");
  els.city = E("citySelect");
  els.farmerGrid = E("farmerGrid");
  els.consumerGrid = E("consumerGrid");
  els.farmerSearch = E("farmerSearch");
  els.consumerSearch = E("consumerSearch");
  els.modeFilter = E("modeFilter");
  els.sortBy = E("sortBy");
  els.postOpenBtn = E("postOpenBtn");
  els.postModal = E("postModal");
  els.postForm = E("postForm");
  els.pfFarm = E("pfFarm");
  els.pfProduct = E("pfProduct");
  els.pfQty = E("pfQty");
  els.pfPrice = E("pfPrice");
  els.pfMode = E("pfMode");
  els.postErrors = E("postErrors");
  els.errQty = E("errQty");
  els.errPrice = E("errPrice");
  els.mapEl = E("map");
  els.mapLoading = E("map-loading");
  els.mapLegend = E("map-legend");
  els.consumerMapEl = E("consumer-map");
  els.consumerMapLoading = E("consumer-map-loading");
  els.consumerMapLegend = E("consumer-map-legend");
  els.lawGrid = E("lawGrid");
  els.medGrid = E("medGrid");
  els.tradeDisclaimer = E("trade-disclaimer");
  els.homeWarning = E("home-warning");
  els.aiCrop = E("aiCrop");
  els.aiQty = E("aiQty");
  els.aiPriceBtn = E("aiPriceBtn");
  els.aiPriceOut = E("aiPriceOut");
  els.aiWant = E("aiWant");
  els.aiMatchBtn = E("aiMatchBtn");
  els.aiMatchOut = E("aiMatchOut");
  els.connectAgentBtn = E("connectAgentBtn");
  els.agentStatus = E("agentStatus");
  els.toolSelect = E("toolSelect");
  els.runToolBtn = E("runToolBtn");
  els.agentTrace = E("agentTrace");
  els.footerText = E("footer-text");

  // Tabs + language
  renderTabs();
  const langSel = E("langSelect");
  if (langSel) {
    langSel.value = currentLang;
    on(langSel, "change", (e) => {
      setLanguage(e.target.value || "en");
    });
  }
  applyLanguageToUI();

  // Geo selects
  if (els.country) {
    // keep existing options but ensure default country exists in GEO
    if (!GEO[els.country.value]) els.country.value = "US";
    populateStateAndCities();

    on(els.country, "change", () => {
      populateStateAndCities();
      renderFarmers();
      renderConsumers();
      loadMarkets();
      loadConsumerMarkets();
    });
  }

  // Saved filters
  const savedMode = LS.get("hq:mode", "all");
  if (els.modeFilter) els.modeFilter.value = savedMode;
  const savedSort = LS.get("hq:sort", "name");
  if (els.sortBy) els.sortBy.value = savedSort;

  // Filter listeners
  on(els.farmerSearch, "input", debounce(renderFarmers, 200));
  on(els.consumerSearch, "input", debounce(renderConsumers, 200));
  on(els.modeFilter, "change", (e) => {
    LS.set("hq:mode", e.target.value);
    renderFarmers();
  });
  on(els.sortBy, "change", (e) => {
    LS.set("hq:sort", e.target.value);
    renderFarmers();
  });

  // Modal
  on(els.postOpenBtn, "click", () => openPostModal(els.postOpenBtn));
  on(E("postCancel"), "click", closePostModal);
  on(els.postForm, "submit", (ev) => {
    ev.preventDefault();
    if (!els.pfQty || !els.pfPrice) return;

    if (els.postErrors) els.postErrors.textContent = "";
    if (els.errQty) els.errQty.textContent = "";
    if (els.errPrice) els.errPrice.textContent = "";

    const rQty = requirePositiveNumber(els.pfQty.value);
    const rPrice = requirePositiveNumber(els.pfPrice.value);
    let bad = false;
    if (!rQty.ok) {
      if (els.errQty) els.errQty.textContent = rQty.msg;
      bad = true;
    }
    if (!rPrice.ok) {
      if (els.errPrice) els.errPrice.textContent = rPrice.msg;
      bad = true;
    }
    if (bad) {
      if (els.postErrors) els.postErrors.textContent = t("post-errors");
      return;
    }

    const country = els.country?.value || "US";
    const rec = {
      country,
      state: els.state?.value || "",
      city: els.city?.value || "",
      farmer: "You",
      farm: els.pfFarm?.value || "Your farm",
      products: [
        {
          name: els.pfProduct?.value || "Product",
          qty: String(rQty.value),
          price: String(rPrice.value)
        }
      ],
      pickup: "",
      mode: els.pfMode?.value || "sale"
    };
    DATA_FARMERS.unshift(rec);
    closePostModal();
    renderFarmers();
  });

  // AI
  setupAI();

  // Data + panels
  await loadData();
  renderFarmers();
  renderConsumers();
  renderMedical();

  // Maps
  initMap();
  initConsumerMap();

  // Static text / footer
  setStaticWarning();
  if (els.footerText) {
    const stamp = new Date().toLocaleString();
    els.footerText.textContent = `© Harvest Q — Connecting Farms & Communities • ${stamp}`;
  }

  // Initial tab
  startTab();
});
