// --- Risk Agent tools ---
const tools = [
  // …keep existing tools…

  {
    type: 'function',
    function: {
      name: 'priceVolatility',
      description: 'Estimate recent price volatility and trend for a crop/region over a period.',
      parameters: {
        type: 'object',
        properties: {
          crop:   { type: 'string' },
          region: { type: 'string', description: 'Optional region filter.' },
          period: { type: 'string', description: 'e.g., "7d","30d","90d".', default: '30d' }
        },
        required: ['crop']
      }
    }
  },

  {
    type: 'function',
    function: {
      name: 'deliveryDelayRisk',
      description: 'Heuristic risk of delivery delay based on distance and mode.',
      parameters: {
        type: 'object',
        properties: {
          distanceKm: { type: 'number' },
          mode: { type: 'string', enum: ['bike','van','truck','lorry'], default: 'truck' },
          windowHours: { type: 'number', description: 'Required delivery window (hours).' },
          region: { type: 'string', description: 'Optional region for road/heat assumptions.' }
        },
        required: ['distanceKm']
      }
    }
  },

  {
    type: 'function',
    function: {
      name: 'aggregateRisk',
      description: 'Combine multiple risk factors into a single score and label.',
      parameters: {
        type: 'object',
        properties: {
          factors: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                score: { type: 'number', description: '0–1 where 1=highest risk' },
                weight: { type: 'number', description: '0–1; default 0.25' }
              },
              required: ['name','score']
            }
          }
        },
        required: ['factors']
      }
    }
  },

  {
    type: 'function',
    function: {
      name: 'recommendMitigation',
      description: 'Suggest concrete mitigation actions from risk context.',
      parameters: {
        type: 'object',
        properties: {
          crop: { type: 'string' },
          riskLevel: { type: 'string', enum: ['low','medium','high'] },
          context: {
            type: 'object',
            properties: {
              distanceKm: { type: 'number' },
              storageType: { type: 'string' },
              volatilityPct: { type: 'number' },
              delayRiskPct: { type: 'number' }
            }
          }
        },
        required: ['riskLevel']
      }
    }
  }
];

// --- Risk Agent implementations ---

// helpers
function _avg(xs){ return xs.length ? xs.reduce((a,b)=>a+b,0)/xs.length : 0; }
function _std(xs){ const m=_avg(xs); return xs.length ? Math.sqrt(_avg(xs.map(x=>(x-m)**2))) : 0; }
function _fmt2(n){ return Number(n.toFixed(2)); }

// 1) priceVolatility — derive volatility from current listings (demo)
async function priceVolatility({ crop, region, period = '30d' }) {
  const farmers = await loadJSON('data/farmers.json') || [];
  const cropL = (crop||'').toLowerCase();
  const regionL = (region||'').toLowerCase();

  const listings = farmers
    .filter(f => !region || String(f.location||'').toLowerCase().includes(regionL))
    .flatMap(f => (f.products||[]))
    .filter(p => (p.name||'').toLowerCase().includes(cropL))
    .filter(p => (p.status||'').toLowerCase() !== 'sold');

  const prices = listings
    .map(p => Number(p.price_per_kg ?? p.price_per_liter ?? p.price_per_ton))
    .filter(Number.isFinite);

  if (!prices.length) {
    return { crop, region: region || 'all', period, volatilityPct: null, trend: 'unknown', note: 'No price data.' };
  }

  // demo approach: use current dispersion as proxy for volatility
  const mean = _avg(prices);
  const sd = _std(prices);
  const volPct = mean ? _fmt2((sd/mean)*100) : 0;

  // crude trend: compare median lower vs upper quartile
  const sorted = [...prices].sort((a,b)=>a-b);
  const mid = Math.floor(sorted.length/2);
  const q1 = sorted[Math.floor(sorted.length*0.25)];
  const q3 = sorted[Math.floor(sorted.length*0.75)];
  const trend = (q3 - q1) > 0 ? 'up' : (q3 - q1) < 0 ? 'down' : 'flat';

  return {
    crop, region: region || 'all', period,
    meanPrice: _fmt2(mean),
    sampleSize: prices.length,
    volatilityPct: volPct,
    trend,
    note: 'Volatility derived from listing dispersion (demo).'
  };
}

// 2) deliveryDelayRisk — distance, window, mode heuristic
async function deliveryDelayRisk({ distanceKm, mode = 'truck', windowHours = 24, region }) {
  // base failure odds per 100 km by mode (demo)
  const modeBase = { bike: 0.08, van: 0.05, truck: 0.04, lorry: 0.035 };
  const per100 = modeBase[mode] ?? 0.04;

  // distance factor
  const distFactor = distanceKm / 100;
  let risk = per100 * distFactor;

  // tight window adds risk
  if (windowHours <= 12) risk *= 1.35;
  else if (windowHours <= 24) risk *= 1.15;

  // hot-region bump (roads/heat)
  if (/kenya|nigeria|ghana|india/i.test(region||'')) risk *= 1.1;

  // clamp to 0..0.95 and express as %
  const pct = Math.max(0, Math.min(0.95, risk)) * 100;

  let label = 'low';
  if (pct >= 35) label = 'high';
  else if (pct >= 15) label = 'medium';

  return {
    distanceKm, mode, windowHours, region: region || 'unspecified',
    delayRiskPct: _fmt2(pct),
    level: label,
    note: 'Heuristic delay risk; refine with live traffic/telemetry when available.'
  };
}

// 3) aggregateRisk — weighted average → label
async function aggregateRisk({ factors = [] }) {
  if (!factors.length) return { score: 0, level: 'low', breakdown: [] };

  let totalW = 0, sum = 0;
  const breakdown = factors.map(f => {
    const w = Number.isFinite(f.weight) ? f.weight : 0.25;
    totalW += w;
    sum += (Math.max(0, Math.min(1, f.score)) * w);
    return { name: f.name, score: f.score, weight: w };
  });
  const score = totalW ? _fmt2(sum / totalW) : 0;

  let level = 'low';
  if (score >= 0.7) level = 'high';
  else if (score >= 0.4) level = 'medium';

  return { score, level, breakdown };
}

// 4) recommendMitigation — map risk/context → actions
async function recommendMitigation({ crop, riskLevel, context = {} }) {
  const actions = [];
  const notes = [];

  const perishable = /tomato|strawberry|avocado|greens|grape/i.test((crop||'').toLowerCase());
  const distanceKm = Number(context.distanceKm ?? NaN);
  const volatility = Number(context.volatilityPct ?? NaN);
  const delayRisk = Number(context.delayRiskPct ?? NaN);
  const storageType = (context.storageType || '').toLowerCase();

  // Base by level
  if (riskLevel === 'high') {
    actions.push('Advance pickup within 24 hours.');
    actions.push('Use insulated or cold chain transport where possible.');
  } else if (riskLevel === 'medium') {
    actions.push('Schedule morning pickup within 48 hours.');
    actions.push('Avoid mid-day heat for perishables.');
  } else {
    actions.push('Proceed with normal scheduling.');
  }

  // Perishability
  if (perishable && storageType !== 'cold') {
    actions.push('Move to cold storage or shade immediately.');
    notes.push('Perishable product not in cold chain.');
  }

  // Distance & delay
  if (Number.isFinite(distanceKm) && distanceKm > 80) {
    actions.push('Break route into staged pickups or choose nearest buyer.');
    notes.push(`Long haul: ~${distanceKm} km.`);
  }
  if (Number.isFinite(delayRisk) && delayRisk >= 25) {
    actions.push('Add time buffer or backup vehicle; send driver reminders.');
    notes.push(`Delay risk ~${delayRisk}%.`);
  }

  // Price volatility
  if (Number.isFinite(volatility) && volatility >= 20) {
    actions.push('Consider quick sale at market-median price.');
    notes.push(`Price volatility ~${volatility}%.`);
  }

  // De-duplicate and finalize
  const unique = Array.from(new Set(actions));
  return {
    riskLevel,
    recommendations: unique,
    notes
  };
                                   }
