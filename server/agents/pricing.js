// --- Pricing Agent tools ---
const tools = [
  // …keep existing tools…

  {
    type: 'function',
    function: {
      name: 'priceBands',
      description: 'Return low/median/high price bands for a crop in a region.',
      parameters: {
        type: 'object',
        properties: {
          crop:   { type: 'string' },
          region: { type: 'string', description: 'City/region to filter by (optional).' },
          quality:{ type: 'string', description: 'Optional quality tag to bias bands (e.g., "organic","Grade A").' }
        },
        required: ['crop']
      }
    }
  },

  {
    type: 'function',
    function: {
      name: 'calcBreakeven',
      description: 'Estimate farmer breakeven price per unit from simple cost inputs.',
      parameters: {
        type: 'object',
        properties: {
          unit:        { type: 'string', description: 'kg|ton|crate|liter, used for labeling only.' },
          quantity:    { type: 'number', description: 'Quantity for this lot (in unit above).' },
          seed:        { type: 'number', description: 'Cost in USD.' },
          fertilizer:  { type: 'number' },
          labor:       { type: 'number' },
          transport:   { type: 'number' },
          storage:     { type: 'number' },
          overhead:    { type: 'number' }
        },
        required: ['unit','quantity','labor']
      }
    }
  },

  {
    type: 'function',
    function: {
      name: 'compareMarketRates',
      description: 'Compare median prices for a crop across multiple regions.',
      parameters: {
        type: 'object',
        properties: {
          crop:    { type: 'string' },
          regions: { type: 'array', items: { type: 'string' }, description: 'Array of region names.' }
        },
        required: ['crop','regions']
      }
    }
  }
];

// --- Pricing Agent implementations ---

// helper: collect numeric prices from listings
function _collectPrices(listings){
  return listings.map(p => Number(p.price_per_kg ?? p.price_per_liter ?? p.price_per_ton))
                 .filter(Number.isFinite)
                 .filter(v => v > 0);
}
function _median(arr){
  if (!arr.length) return null;
  const s = [...arr].sort((a,b)=>a-b);
  const m = Math.floor(s.length/2);
  return s.length % 2 ? s[m] : (s[m-1] + s[m]) / 2;
}

// 1) priceBands — compute low/median/high with optional quality bias
async function priceBands({ crop, region, quality }) {
  const { farmers = [] } = { farmers: await loadJSON('data/farmers.json') || [] };

  // filter by crop & region
  const cropLower = (crop || '').toLowerCase();
  const regionLower = (region || '').toLowerCase();

  const listings = farmers
    .filter(f => !region || String(f.location||'').toLowerCase().includes(regionLower))
    .flatMap(f => (f.products || []).map(p => ({ f, p })))
    .filter(fp => (fp.p.name || '').toLowerCase().includes(cropLower))
    .filter(fp => (fp.p.status || '').toLowerCase() !== 'sold');

  let prices = _collectPrices(listings.map(fp => fp.p));

  if (!prices.length) {
    return {
      crop, region: region || 'all',
      low: null, median: null, high: null,
      note: 'No price data found for this crop/region.'
    };
  }

  // basic bands
  const sorted = [...prices].sort((a,b)=>a-b);
  const lowIdx = Math.max(0, Math.floor(sorted.length * 0.25) - 1);
  const highIdx = Math.min(sorted.length-1, Math.floor(sorted.length * 0.75));
  let low = sorted[lowIdx];
  let median = _median(sorted);
  let high = sorted[highIdx];

  // quality bias (simple +8% for premium, -5% for unspecified)
  if (quality) {
    const q = quality.toLowerCase();
    const premium = /organic|grade a|export/.test(q);
    const discount = /grade c|seconds|blemish/.test(q);
    const factor = premium ? 1.08 : discount ? 0.95 : 1.0;
    low = Number((low * factor).toFixed(2));
    median = Number((median * factor).toFixed(2));
    high = Number((high * factor).toFixed(2));
  }

  return {
    crop, region: region || 'all',
    low: Number(low.toFixed(2)),
    median: Number(Number(median).toFixed(2)),
    high: Number(high.toFixed(2)),
    examples: Math.min(prices.length, listings.length),
    note: 'Bands derived from current listings; quality bias applied if provided.'
  };
}

// 2) calcBreakeven — sum costs / quantity with guardrails
async function calcBreakeven({ unit, quantity, seed = 0, fertilizer = 0, labor, transport = 0, storage = 0, overhead = 0 }) {
  const qty = Math.max(1, Number(quantity || 0)); // avoid divide-by-zero
  const totalCost = Number(seed + fertilizer + labor + transport + storage + overhead);
  const perUnit = Number((totalCost / qty).toFixed(2));
  return {
    unit, quantity: qty,
    totalCost: Number(totalCost.toFixed(2)),
    breakevenPerUnit: perUnit,
    note: 'Simple breakeven = total costs ÷ quantity (excludes profit margin).'
  };
}

// 3) compareMarketRates — medians across regions
async function compareMarketRates({ crop, regions = [] }) {
  const farmers = await loadJSON('data/farmers.json') || [];
  const cropLower = (crop || '').toLowerCase();

  const byRegion = {};
  for (const r of regions) {
    const rLower = (r || '').toLowerCase();
    const listings = farmers
      .filter(f => String(f.location||'').toLowerCase().includes(rLower))
      .flatMap(f => (f.products || []).map(p => p))
      .filter(p => (p.name || '').toLowerCase().includes(cropLower))
      .filter(p => (p.status || '').toLowerCase() !== 'sold');

    const prices = _collectPrices(listings);
    byRegion[r] = {
      median: _median(prices),
      sampleSize: prices.length
    };
  }

  // Build a compact comparison with deltas vs. first region (if any)
  const regionsList = Object.keys(byRegion);
  if (!regionsList.length) return { crop, comparisons: {}, note: 'No regions provided.' };
  const base = byRegion[regionsList[0]].median || 0;

  const comparisons = {};
  for (const r of regionsList) {
    const m = byRegion[r].median || 0;
    const delta = base ? Number(((m - base) / base * 100).toFixed(2)) : 0;
    comparisons[r] = { median: m ? Number(m.toFixed(2)) : null, sampleSize: byRegion[r].sampleSize, deltaVsBasePct: delta };
  }

  return { crop, comparisons, note: 'Medians computed from current listings in each region.' };
}

const toolImpl = {
  // …existing implementations…
  priceBands,
  calcBreakeven,
  compareMarketRates
};

# priceBands
curl -s -X POST http://localhost:8080/api/agent \
 -H "Content-Type: application/json" \
 -d '{"tool":"priceBands","args":{"crop":"Tomatoes","region":"Kano","quality":"Organic"}}' | jq

# calcBreakeven
curl -s -X POST http://localhost:8080/api/agent \
 -H "Content-Type: application/json" \
 -d '{"tool":"calcBreakeven","args":{"unit":"kg","quantity":500,"seed":60,"fertilizer":80,"labor":120,"transport":70,"storage":30,"overhead":20}}' | jq

# compareMarketRates
curl -s -X POST http://localhost:8080/api/agent \
 -H "Content-Type: application/json" \
 -d '{"tool":"compareMarketRates","args":{"crop":"Tomatoes","regions":["Kano","Abuja","Lagos"]}}' | jq
