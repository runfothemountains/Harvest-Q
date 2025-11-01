// --- Buyer Agent tools ---
const tools = [
  // ...keep your existing tools above...

  {
    type: 'function',
    function: {
      name: 'findSuppliers',
      description: 'Find suppliers by crop, minimum quantity, proximity, and quality tags.',
      parameters: {
        type: 'object',
        properties: {
          crop: { type: 'string', description: 'Requested crop/commodity (e.g., "Tomatoes").' },
          minQty: { type: 'string', description: 'Minimum quantity (e.g., "200 kg").' },
          location: { type: 'string', description: 'Buyer city/region to sort by proximity.' },
          maxDistanceKm: { type: 'number', description: 'Maximum acceptable distance in km.' },
          quality: { type: 'string', description: 'Optional quality tag: "organic", "Grade A", etc.' }
        },
        required: ['crop']
      }
    }
  },

  {
    type: 'function',
    function: {
      name: 'scoreMatch',
      description: 'Score a supplier candidate against buyer criteria (price, distance, quality).',
      parameters: {
        type: 'object',
        properties: {
          supplierId: { type: 'number' },
          criteria: {
            type: 'object',
            properties: {
              targetPricePerUnit: { type: 'number' },
              location: { type: 'string' },
              quality: { type: 'string' }
            }
          }
        },
        required: ['supplierId']
      }
    }
  },

  {
    type: 'function',
    function: {
      name: 'verifySpec',
      description: 'Verify basic specs for a listing (grade, certification, moisture).',
      parameters: {
        type: 'object',
        properties: {
          batchId: { type: 'string', description: 'Listing/batch identifier (or product name if simple).' },
          spec: {
            type: 'object',
            properties: {
              grade: { type: 'string' },
              certification: { type: 'string' },
              moistureMax: { type: 'number' }
            }
          }
        },
        required: ['batchId']
      }
    }
  },

  {
    type: 'function',
    function: {
      name: 'suggestPrice',
      description: 'Suggest a fair price based on crop, region, and recent reference values.',
      parameters: {
        type: 'object',
        properties: {
          crop: { type: 'string' },
          region: { type: 'string' },
          quantity: { type: 'string' }
        },
        required: ['crop']
      }
    }
  },

  {
    type: 'function',
    function: {
      name: 'planRoute',
      description: 'Suggest a simple pickup/delivery window and rough route distance.',
      parameters: {
        type: 'object',
        properties: {
          pickup: { type: 'string', description: 'Supplier location.' },
          dropoff: { type: 'string', description: 'Buyer location.' }
        },
        required: ['pickup','dropoff']
      }
    }
  },

  {
    type: 'function',
    function: {
      name: 'notify',
      description: 'Send a notification (simulated) to a user or supplier.',
      parameters: {
        type: 'object',
        properties: {
          recipient: { type: 'string' },
          message: { type: 'string' },
          channel: { type: 'string', enum: ['email','sms','app'], default: 'app' }
        },
        required: ['recipient','message']
      }
    }
  }

  // ...other tools...
];

import fs from 'node:fs/promises';
import path from 'node:path';

async function loadJSON(relPath) {
  try {
    const p = path.join(process.cwd(), relPath);
    const raw = await fs.readFile(p, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

// very-naive distance model
function pseudoDistance(a = '', b = '') {
  if (!a || !b) return 9999;
  return a.toLowerCase() === b.toLowerCase() ? 5 : 50; // same city ~5km, else ~50km
}

function parseQty(q) {
  const m = String(q).match(/[\d.]+/);
  return m ? Number(m[0]) : 0;
}

// --- Buyer Agent implementations ---

// find suppliers from data/farmers.json that match crop, qty, proximity, quality
async function findSuppliers({ crop, minQty = '0', location, maxDistanceKm = 200, quality }) {
  const farmers = await loadJSON('data/farmers.json');
  if (!farmers) return { suppliers: [], note: 'No farmer dataset found.' };

  const minQ = parseQty(minQty);
  const wanted = crop?.toLowerCase();

  const matches = [];

  farmers.forEach(f => {
    (f.products || []).forEach(p => {
      const name = (p.name || '').toLowerCase();
      if (!name.includes(wanted)) return;

      const qtyOk = parseQty(p.quantity) >= minQ;
      const dist = pseudoDistance(f.location, location);
      const distOk = !location || dist <= maxDistanceKm;
      const qualOk = quality ? ((p.quality || f.quality || '').toLowerCase().includes(quality.toLowerCase())) : true;

      if (qtyOk && distOk && qualOk && (p.status || '').toLowerCase() !== 'sold') {
        matches.push({
          supplierId: f.id,
          supplierName: f.name,
          location: f.location || '',
          product: p.name,
          quantity: p.quantity || '',
          priceHint: p.price_per_kg ?? p.price_per_ton ?? null,
          distanceKm: dist,
          qualityTags: [p.quality, f.quality].filter(Boolean),
          rationale: `Meets crop and quantity; ${location ? 'nearby supplier' : 'distance not considered'}.`
        });
      }
    });
  });

  matches.sort((a,b) => (a.distanceKm - b.distanceKm));
  return { suppliers: matches.slice(0, 5), note: matches.length ? 'Top supplier candidates.' : 'No matching suppliers.' };
}

// compute a simple score using price fit, distance, quality tag hit
async function scoreMatch({ supplierId, criteria = {} }) {
  const farmers = await loadJSON('data/farmers.json') || [];
  const farmer = farmers.find(f => f.id === supplierId);
  if (!farmer) return { score: 0, reasons: ['Supplier not found'] };

  const dist = criteria.location ? pseudoDistance(farmer.location, criteria.location) : 50;
  const hasQuality = criteria.quality ? ((farmer.quality || '').toLowerCase().includes(criteria.quality.toLowerCase())) : true;

  // base score out of 100
  let score = 70;

  // distance penalty
  score -= Math.min(dist, 60) * 0.5; // up to -30

  // quality boost
  score += hasQuality ? 15 : -10;

  // price fit — if any product has price ≤ targetPricePerUnit, add boost
  if (criteria.targetPricePerUnit) {
    const good = (farmer.products || []).some(p => {
      const price = p.price_per_kg ?? p.price_per_ton ?? Infinity;
      return typeof price === 'number' && price <= criteria.targetPricePerUnit;
    });
    score += good ? 15 : -10;
  }

  score = Math.max(0, Math.min(100, score));
  const reasons = [
    `Distance ~${dist}km`,
    hasQuality ? 'Quality requirement met' : 'Quality requirement not met',
    criteria.targetPricePerUnit ? 'Price constraint considered' : 'No price constraint'
  ];

  return { score, reasons };
}

// trivial spec check (always passes unless explicit mismatch fields supplied)
async function verifySpec({ batchId, spec = {} }) {
  // In a real system, batchId would map to a stored lot with lab data.
  const result = {
    batchId,
    checks: {
      grade: spec.grade ? 'ok' : 'unknown',
      certification: spec.certification ? 'ok' : 'unknown',
      moistureMax: Number.isFinite(spec.moistureMax) ? 'ok' : 'unknown'
    },
    passed: true,
    note: 'Spec check is a stub; integrate real quality data later.'
  };
  return result;
}

// simple suggestPrice using reference table + tiny region adjustment
async function suggestPrice({ crop, region, quantity }) {
  const ref = { tomatoes: 0.5, onion: 0.6, corn: 0.22, rice: 0.9, avocado: 2.1, dates: 4.0 };
  const base = ref[crop?.toLowerCase()] ?? 1.0;
  const regionAdj = /kenya|nigeria|india/i.test(region || '') ? 1.1 : 1.0;
  const qtyAdj = parseQty(quantity) >= 1000 ? 0.95 : 1.0; // bulk discount
  const price = Number((base * regionAdj * qtyAdj).toFixed(2));
  return { crop, region, quantity, suggestedPricePerUnit: price, currency: 'USD', note: 'Reference-based estimate (demo).' };
}

// return distance + window suggestion
async function planRoute({ pickup, dropoff }) {
  const distanceKm = pseudoDistance(pickup, dropoff);
  const window = distanceKm > 30 ? 'Pickup within 48 hours' : 'Pickup within 24 hours';
  return { pickup, dropoff, distanceKm, window };
}

// simulate sending a notification
async function notify({ recipient, message, channel = 'app' }) {
  return { ok: true, recipient, channel, message, timestamp: new Date().toISOString() };
}

const toolImpl = {
  // ...existing implementations...
  findSuppliers,
  scoreMatch,
  verifySpec,
  suggestPrice,
  planRoute,
  notify
};

# Find suppliers
curl -s -X POST http://localhost:8080/api/agent \
 -H "Content-Type: application/json" \
 -d '{"message":"find suppliers","tool":"findSuppliers","args":{"crop":"Tomatoes","minQty":"200 kg","location":"Kano","maxDistanceKm":60,"quality":"organic"}}' | jq

# Score a supplier
curl -s -X POST http://localhost:8080/api/agent \
 -H "Content-Type: application/json" \
 -d '{"message":"score match","tool":"scoreMatch","args":{"supplierId":2,"criteria":{"targetPricePerUnit":1.0,"location":"Kano","quality":"organic"}}}' | jq

# Verify spec
curl -s -X POST http://localhost:8080/api/agent \
 -H "Content-Type: application/json" \
 -d '{"message":"verify spec","tool":"verifySpec","args":{"batchId":"TOM-2025-0001","spec":{"grade":"A","certification":"Organic","moistureMax":12}}}' | jq

# Suggest price
curl -s -X POST http://localhost:8080/api/agent \
 -H "Content-Type: application/json" \
 -d '{"message":"suggest price","tool":"suggestPrice","args":{"crop":"Tomatoes","region":"Kenya","quantity":"250 kg"}}' | jq

# Plan route
curl -s -X POST http://localhost:8080/api/agent \
 -H "Content-Type: application/json" \
 -d '{"message":"plan route","tool":"planRoute","args":{"pickup":"Kano","dropoff":"Kano"}}' | jq

# Notify
curl -s -X POST http://localhost:8080/api/agent \
 -H "Content-Type: application/json" \
 -d '{"message":"notify","tool":"notify","args":{"recipient":"buyer@example.com","message":"RFQ sent to supplier","channel":"email"}}' | jq
