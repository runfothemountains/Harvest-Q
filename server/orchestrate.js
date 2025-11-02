import 'dotenv/config';
import express from 'express';
import { WatsonXAI } from '@ibm-cloud/watsonx-ai';
import { publishListing, enrichListing } from './agents/farmer.js';

import fs from 'node:fs/promises';
import path from 'node:path';

// Utility: load JSON safely
async function loadJSON(relPath) {
  try {
    const p = path.join(process.cwd(), relPath);
    const raw = await fs.readFile(p, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

// naive distance placeholder (string compare only)
function pseudoDistance(a = '', b = '') {
  if (!a || !b) return 9999;
  return a.toLowerCase() === b.toLowerCase() ? 5 : 50; // same city ~5km, else ~50km
}

// extract barter-ready items from a farmer record
function listBarterables(farmer) {
  // Expecting your farmer schema to have products; optionally mark barter true.
  // We’ll treat all products as barterable if status !== "Sold".
  const products = Array.isArray(farmer.products) ? farmer.products : [];
  return products
    .filter(p => (p.status || '').toLowerCase() !== 'sold')
    .map(p => ({
      farmerId: farmer.id,
      farmerName: farmer.name,
      location: farmer.location || '',
      name: p.name,
      qty: p.quantity || '',
      // optional tag if you later add p.barter === true
      barter: p.barter !== false
    }));
}


const app = express();
app.use(express.json());

// 1) Init SDK
const wx = new WatsonXAI({
  apiKey: process.env.WATSONX_APIKEY,
  serviceUrl: process.env.WATSONX_URL,
  version: '2024-10-01'
});

// 2) Define tool specs (the model can call these)
const tools = [
  {
    type: 'function',
    function: {
      name: 'findSuppliers',
      description: 'Match a buyer need to farmer listings',
      parameters: {
        type: 'object',
        properties: {
          crop: { type: 'string' },
          minQty: { type: 'string' }
        },
        required: ['crop']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'scoreGrant',
      description: 'Score a grant request vs SDG9 criteria',
      parameters: {
        type: 'object',
        properties: { applicant: { type: 'string' }, purpose: { type: 'string' } },
        required: ['applicant', 'purpose']
      }
    }
  }
  // add more tools for your other agents
];

// 3) Implement tool logic
const toolImpl = {
  async findSuppliers({ crop, minQty }) {
    // read your Stage-3 JSON (farmers.json) and return best matches
    return [{ farmerId: 2, name: 'Aisha Bello', crop, qty: '200 kg' }];
  },
  async scoreGrant({ applicant, purpose }) {
    // trivial mock score
    return { applicant, purpose, score: 0.82, rationale: 'Reduces spoilage; community impact' };
  }
};

// 4) Chat endpoint the front-end calls
app.post('/api/agent', async (req, res) => {
  const userMsg = req.body?.message || 'Connect agents';
  const chat = await wx.chat.create({
    modelId: process.env.WATSONX_MODEL_ID,
    projectId: process.env.WATSONX_PROJECT_ID,
    input: [{ role: 'user', content: userMsg }],
    tools,                 // <-- register your tools
    tool_choice: 'auto'    // <-- allow model to choose tools
  });

  // If model requested a tool, execute it and send back tool result
  const call = chat.tool_calls?.[0];
  if (call?.function?.name) {
    const fn = toolImpl[call.function.name];
    const args = call.function.arguments || {};
    const result = await fn(args);
    // Return both the model text and our tool result for your UI
    return res.json({ text: chat.output_text, tool: call.function.name, result });
  }
  res.json({ text: chat.output_text });
});

// start
app.listen(8080, () => console.log('HarvestQ Orchestrate server on :8080'));

// ------------------------------------------------------------
//  server/orchestrate.js
//  Central backend for all Harvest Q Agents (IBM Hackathon)
// ------------------------------------------------------------

// 1️⃣  Existing imports / setup
import fs from "fs";  // or const fs = require('fs');
import path from "path";
// ... your helper functions like loadJSON, parseQty, pseudoDistance, etc.

// 2️⃣  Existing tools array
const tools = [
  // earlier agents: pricing, logistics, risk, translator, etc.
];

// 3️⃣  Append the Barter Agent tools here
// (this is the first big section I gave you)
tools.push(
  {
    type: 'function',
    function: {
      name: 'findBarterMatch',
      description: 'Find compatible barter partners by crop, quantity, and proximity.',
      parameters: {
        type: 'object',
        properties: {
          itemOffered:   { type: 'string' },
          itemWanted:    { type: 'string' },
          location:      { type: 'string' },
          maxDistanceKm: { type: 'number' },
          minQuantity:   { type: 'string' }
        },
        required: ['itemOffered','itemWanted']
      }
    }
  },
  // ... evaluateTradeValue + initiateExchange tools ...
);

// 4️⃣  Add the Barter Agent function implementations right below
// (this is the second big section I gave you)
async function findBarterMatch({ itemOffered, itemWanted, location, maxDistanceKm, minQuantity }) {
  // full implementation code here...
}

async function evaluateTradeValue({ itemsA, itemsB }) {
  // full implementation code here...
}

async function initiateExchange({ partnerId, terms }) {
  // full implementation code here...
}

// 5️⃣  Add the functions to the toolImpl mapping
const toolImpl = {
  // existing agents...
  findBarterMatch,
  evaluateTradeValue,
  initiateExchange
};

// 6️⃣  Export or register (depending on your setup)
export { tools, toolImpl };
// or:  module.exports = { tools, toolImpl };  ← if using CommonJS

// --- Barter Agent implementations ---

// Helpers (safe, local fallbacks if your shared utils aren’t present)
function _has(fn){ return typeof fn === 'function'; }

// parse "120 kg" → { value:120, unit:'kg' } (supports kg, ton, t, l, liter, liters, g)
const _UNIT = {
  kg: 1, kilogram: 1, kilograms: 1,
  g: 0.001, gram: 0.001, grams: 0.001,
  t: 1000, ton: 1000, tons: 1000, tonne: 1000, tonnes: 1000,
  l: 1, liter: 1, liters: 1, litre: 1, litres: 1  // treat liters as base for liquids; handled by per-unit price field below
};
function _parseQty(s='') {
  const m = String(s).trim().toLowerCase().match(/([\d.,]+)\s*([a-z]+)?/i);
  if (!m) return { value: 0, unit: '' };
  const raw = Number(m[1].replace(/,/g,'')) || 0;
  const u = (m[2] || '').toLowerCase();
  return { value: raw, unit: u };
}
function _toKg({ value, unit }) {
  if (!unit) return { value, unit: 'kg' };
  const factor = _UNIT[unit];
  if (!factor) return { value, unit }; // unknown, pass through
  // liters are NOT mass; we leave liters as-is (handled by price_per_liter)
  if (['l','liter','liters','litre','litres'].includes(unit)) return { value, unit: 'liter' };
  return { value: Number((value * factor).toFixed(3)), unit: 'kg' };
}

// rough distance (replace with real geocoder later)
function _pseudoDistance(a='', b=''){
  if (!a || !b) return 0;
  const h = (str) => [...str.toLowerCase()].reduce((s,c)=>s+c.charCodeAt(0),0);
  const diff = Math.abs(h(a) - h(b));
  return 5 + (diff % 200); // 5..205 km
}

// numeric price reference
function _priceOf(p) {
  const n = Number(
    p.price_per_kg ?? p.price_per_liter ?? p.price_per_ton
  );
  return Number.isFinite(n) ? n : null;
}

// (A) findBarterMatch — now also checks optional partner "wants" list,
//    prefers partners who want the user's offered item, and normalizes quantities.
async function findBarterMatch({ itemOffered, itemWanted, location, maxDistanceKm = 150, minQuantity }) {
  const farmers = await loadJSON('data/farmers.json') || [];
  const offeredL = (itemOffered || '').toLowerCase();
  const wantedL  = (itemWanted  || '').toLowerCase();

  const minQ = minQuantity ? _parseQty(minQuantity) : null;
  const minQkg = minQ ? _toKg(minQ) : null; // compare in kg when possible

  const out = [];
  for (const f of farmers) {
    const fLoc = String(f.location || '');
    const distanceKm = location ? _pseudoDistance(location, fLoc) : 0;
    if (location && distanceKm > maxDistanceKm) continue;

    for (const p of (f.products || [])) {
      const nameL = (p.name || '').toLowerCase();
      const status = (p.status || 'available').toLowerCase();
      const barterable = (p.barter === true) || status === 'available';
      if (!barterable) continue;

      // They must have the thing we want:
      if (!nameL.includes(wantedL)) continue;

      // Quantity filter (only apply if minQuantity provided and product uses mass units)
      const pq = _parseQty(p.quantity);
      const pqkg = _toKg(pq);
      if (minQkg && pqkg.unit === 'kg' && pqkg.value < minQkg.value) continue;

      // bonus: partner "wants" (optional array on farmer) should match our offered item
      const wants = (f.wants || []).map(x => String(x).toLowerCase());
      const wantsOffered = wants.length ? wants.some(w => offeredL.includes(w) || w.includes(offeredL)) : false;

      out.push({
        partnerId: f.id || f.name || fLoc,
        partnerName: f.name || 'Farmer',
        partnerLocation: fLoc,
        productId: p.id || `${(p.name||'').slice(0,8)}-${Math.random().toString(36).slice(2,6)}`,
        productName: p.name,
        quantity: p.quantity,
        unitPriceRef: _priceOf(p),
        distanceKm,
        wantsOffered,
        score: 0
      });
    }
  }

  // score: proximity (65%), price ref available (20%), partner wants our offered item (15%)
  for (const m of out) {
    const proximity = location ? (1 - Math.min(1, m.distanceKm / maxDistanceKm)) : 1;
    const priceRef  = m.unitPriceRef ? 1 : 0.7;
    const intent    = m.wantsOffered ? 1 : 0.5;
    m.score = Number((0.65*proximity + 0.20*priceRef + 0.15*intent).toFixed(2));
  }
  out.sort((a,b)=>b.score - a.score);

  return {
    requested: { itemWanted, minQuantity: minQuantity || null, location: location || null },
    offered:   { itemOffered },
    matches:   out.slice(0, 10),
    note: out.length ? 'Top matches ranked by distance, price reference, and partner interest.'
                     : 'No matches. Try a wider distance or lower minimum quantity.'
  };
}

// (B) evaluateTradeValue — normalizes kg/ton; uses per-liter when quantity is liquid.
async function evaluateTradeValue({ itemsA = [], itemsB = [] }) {
  const farmers = await loadJSON('data/farmers.json') || [];

  function _median(arr){
    if (!arr.length) return null;
    const s = [...arr].sort((a,b)=>a-b);
    const m = Math.floor(s.length/2);
    return s.length % 2 ? s[m] : (s[m-1]+s[m])/2;
  }

  function _collectPrices(cropName){
    const cropL = (cropName || '').toLowerCase();
    const prices = [];
    for (const f of farmers) {
      for (const p of (f.products || [])) {
        if ((p.status || 'available').toLowerCase() === 'sold') continue;
        if (!(p.name || '').toLowerCase().includes(cropL)) continue;
        const val = _priceOf(p);
        if (Number.isFinite(val)) prices.push(val);
      }
    }
    return prices;
  }

  function _unitOf(qtyStr){
    const u = _parseQty(qtyStr).unit;
    if (['l','liter','liters','litre','litres'].includes(u)) return 'liter';
    // default mass
    return 'kg';
  }

  async function _value(items) {
    let sum = 0;
    const detail = [];
    for (const it of items) {
      const parsed = _parseQty(it.qty);
      const unitType = _unitOf(it.qty);
      const normalized = unitType === 'kg' ? _toKg(parsed) : { value: parsed.value, unit: 'liter' };

      // choose the right reference field
      let unitPrice = Number(it.refPricePerUnit);
      if (!Number.isFinite(unitPrice)) {
        const pool = _collectPrices(it.name);
        unitPrice = pool.length ? _median(pool) : null;
      }

      const line = Number.isFinite(unitPrice) ? unitPrice * normalized.value : 0;
      sum += line;
      detail.push({
        name: it.name,
        qty: it.qty,
        normalizedQty: `${normalized.value} ${normalized.unit}`,
        unitPriceRef: Number.isFinite(unitPrice) ? Number(unitPrice.toFixed(2)) : null,
        lineValue: Number(line.toFixed(2))
      });
    }
    return { total: Number(sum.toFixed(2)), detail };
  }

  const a = await _value(itemsA);
  const b = await _value(itemsB);

  let ratio = null, fairness = 'unknown';
  if (a.total > 0 && b.total > 0) {
    ratio = Number((a.total / b.total).toFixed(2));
    fairness = ratio > 1.15 ? 'A offers more value' : ratio < 0.85 ? 'B offers more value' : 'balanced';
  }

  return {
    partyA: a, partyB: b,
    suggestedRatioAtoB: ratio,  // 1.05 ≈ A gives ~5% more value
    fairness,
    note: 'Guidance only. Adjust for quality, perishability, and transport.'
  };
}

// (C) initiateExchange — notifies both sides when Notify tools exist
async function initiateExchange({ partnerId, terms }) {
  const exchangeId = `BX-${Date.now()}`;
  const ts = new Date().toISOString();

  try {
    if (_has(pushAlert)) {
      await pushAlert({
        recipientId: partnerId,
        title: 'Barter request',
        message: `Proposed: ${terms.offered} ↔ ${terms.requested} @ ${terms.ratio}. Window: ${terms.pickupWindow || 'TBD'}.`
      });
    }
    if (_has(sendEmail) && terms.locationB) {
      await sendEmail({
        to: `${partnerId}@example.com`,
        subject: 'Harvest Q Barter — Proposal',
        body: `Exchange ${exchangeId}\n\nOffered: ${terms.offered}\nRequested: ${terms.requested}\nRatio: ${terms.ratio}\nPickup: ${terms.pickupWindow || 'TBD'}\nLocation: ${terms.locationA || 'A'} ↔ ${terms.locationB}\n\nReply in-app to confirm.`
      });
    }
  } catch(_) { /* non-fatal for demo */ }

  return {
    exchangeId,
    partnerId,
    terms,
    status: 'provisional',
    createdAt: ts,
    nextSteps: [
      'Confirm quantities/units on both sides.',
      'Pick a pickup/delivery window and location.',
      'Optionally plan route (Logistics) and check spoilage risk (Risk).'
    ]
  };
    }

// --- Register Barter Agent implementations ---
toolImpl.findBarterMatch    = findBarterMatch;
toolImpl.evaluateTradeValue = evaluateTradeValue;
toolImpl.initiateExchange   = initiateExchange;
