// --- Insights Agent tools ---
const tools = [
  // …keep existing tools…

  {
    type: 'function',
    function: {
      name: 'summarizeKPI',
      description: 'Compute core KPIs for a period and scope (farmers, buyers, grants, barter, co-op).',
      parameters: {
        type: 'object',
        properties: {
          period: { type: 'string', description: 'e.g., "7d", "30d", "this-week".' },
          scope:  { type: 'string', description: 'farmers|buyers|grants|barter|coop|all', default: 'all' },
          region: { type: 'string', description: 'Optional region/city filter.' }
        },
        required: ['period']
      }
    }
  },

  {
    type: 'function',
    function: {
      name: 'analyzeTrends',
      description: 'Return trend direction and percent change for a metric.',
      parameters: {
        type: 'object',
        properties: {
          metric: { type: 'string', description: 'e.g., "matchRate","avgPrice","grantApprovals".' },
          period: { type: 'string', description: 'Comparison window, e.g., "7d","30d".' },
          region: { type: 'string' }
        },
        required: ['metric','period']
      }
    }
  },

  {
    type: 'function',
    function: {
      name: 'priceTrends',
      description: 'Summarize price movement for a crop over a period.',
      parameters: {
        type: 'object',
        properties: {
          crop:   { type: 'string' },
          period: { type: 'string' },
          region: { type: 'string' }
        },
        required: ['crop','period']
      }
    }
  },

  {
    type: 'function',
    function: {
      name: 'climateImpact',
      description: 'Estimate simple climate/storage risk (heat, distance proxy) for the period/region.',
      parameters: {
        type: 'object',
        properties: {
          period: { type: 'string' },
          region: { type: 'string' }
        },
        required: ['period']
      }
    }
  },

  {
    type: 'function',
    function: {
      name: 'sdgScore',
      description: 'Compute an SDG9 alignment score (0–100) across specified dimensions.',
      parameters: {
        type: 'object',
        properties: {
          period: { type: 'string' },
          dimensions: {
            type: 'array',
            items: { type: 'string' },
            description: 'e.g., ["access","infrastructure","innovation"]'
          }
        },
        required: ['period']
      }
    }
  },

  {
    type: 'function',
    function: {
      name: 'generateReport',
      description: 'Assemble a short, formatted insights brief from sections.',
      parameters: {
        type: 'object',
        properties: {
          format:   { type: 'string', enum: ['text','markdown','json'], default: 'markdown' },
          sections: { type: 'array', items: { type: 'string' }, description: 'e.g., ["summary","kpis","highlights","recs"]' },
          audience: { type: 'string', description: 'farmer|buyer|program|exec', default: 'exec' }
        }
      }
    }
  }
];

// --- Insights Agent implementations ---

// naive rolling “activity” counters using current seed JSON (demo-grade)
async function _loadAll() {
  const [farmers, businesses, consumers, grants] = await Promise.all([
    loadJSON('data/farmers.json'),
    loadJSON('data/business.json'),
    loadJSON('data/consumers.json'),
    loadJSON('data/grants.json')
  ]);
  return { farmers: farmers || [], businesses: businesses || [], consumers: consumers || [], grants: grants || [] };
}

function _avg(arr) { return arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0; }
function _pct(a,b){ return b ? ((a-b)/b)*100 : 0; }
function _fmt(n){ return Number(n.toFixed(2)); }

// 1) summarize core KPIs
async function summarizeKPI({ period = '7d', scope = 'all', region }) {
  const { farmers, businesses, consumers, grants } = await _loadAll();

  // Filter by region (string contains) if provided
  const fsel = region ? farmers.filter(f => String(f.location||'').toLowerCase().includes(region.toLowerCase())) : farmers;

  const listings = fsel.flatMap(f => f.products || []);
  const activeListings = listings.filter(p => (p.status||'').toLowerCase() !== 'sold').length;
  const totalQty = _fmt(listings.reduce((s,p)=> s + (parseQty(p.quantity)||0), 0));
  const prices = listings.map(p => Number(p.price_per_kg ?? p.price_per_liter ?? p.price_per_ton)).filter(Number.isFinite);
  const avgPrice = _fmt(_avg(prices));

  const bizNeeds = (region ? businesses.filter(b => (b.location||'').toLowerCase().includes(region.toLowerCase())) : businesses)
                    .reduce((s,b)=> s + (b.responses?.length||0), 0);

  const grantApproved = (region ? grants.filter(g => (g.applicant||'').toLowerCase().includes(region.toLowerCase())) : grants)
                        .filter(g => (g.updates||[]).some(u => /approved|scheduled/i.test(u.status))).length;

  const barterable = listings.filter(p => p.barter === true || (p.status||'').toLowerCase() === 'available').length;

  const kpi = {
    period,
    region: region || 'all',
    farmers: fsel.length,
    activeListings,
    totalQty,
    avgListingPrice: avgPrice || null,
    businessNeeds: bizNeeds,
    grantPositiveUpdates: grantApproved,
    barterReadyListings: barterable
  };

  const summary = `Activity snapshot: ${kpi.farmers} farmers, ${kpi.activeListings} active listings `
                + `(${kpi.totalQty} units total). Avg price ~ ${kpi.avgListingPrice ?? 'n/a'}. `
                + `${kpi.businessNeeds} open business needs; ${kpi.grantPositiveUpdates} grants progressing.`;

  return { summary, kpi };
}

// 2) analyze metric trend (mock baseline compare)
async function analyzeTrends({ metric, period = '7d', region }) {
  // For demo, compute a current value using summarizeKPI and compare to a made-up baseline (90% of current)
  const { kpi } = await summarizeKPI({ period, scope: 'all', region });
  const current = (() => {
    switch ((metric||'').toLowerCase()) {
      case 'matchrate':        return _fmt((kpi.businessNeeds && kpi.activeListings) ? Math.min(1, kpi.activeListings/kpi.businessNeeds) : 0);
      case 'avgprice':         return kpi.avgListingPrice ?? 0;
      case 'grantapprovals':   return kpi.grantPositiveUpdates;
      case 'barterlistings':   return kpi.barterReadyListings;
      default:                 return kpi.activeListings;
    }
  })();
  const baseline = current * 0.9; // pretend last period
  const changePct = _fmt(_pct(current, baseline));
  const direction = changePct > 5 ? 'up' : (changePct < -5 ? 'down' : 'flat');

  return { metric, period, region: region || 'all', current, prior: _fmt(baseline), changePct, direction };
}

// 3) price trends for a crop
async function priceTrends({ crop, period = '30d', region }) {
  const { farmers } = await _loadAll();
  const listings = (region ? farmers.filter(f => (f.location||'').toLowerCase().includes(region.toLowerCase())) : farmers)
    .flatMap(f => f.products || [])
    .filter(p => (p.name||'').toLowerCase().includes((crop||'').toLowerCase()));

  const prices = listings.map(p => Number(p.price_per_kg ?? p.price_per_liter ?? p.price_per_ton)).filter(Number.isFinite);
  const avg = _fmt(_avg(prices));
  const min = prices.length ? Math.min(...prices) : null;
  const max = prices.length ? Math.max(...prices) : null;
  // Demo volatility: stdev-lite
  const mean = avg || 0;
  const variance = prices.length ? _avg(prices.map(v => (v-mean)**2)) : 0;
  const volatility = _fmt(Math.sqrt(variance));

  return { crop, period, region: region || 'all', avgPrice: avg || null, minPrice: min, maxPrice: max, volatility };
}

// 4) simple climate/storage impact (demo heuristic)
async function climateImpact({ period = '7d', region }) {
  // Without a live weather API, provide a heuristic based on quantity + distance proxy.
  const { farmers, businesses } = await _loadAll();
  const fsel = region ? farmers.filter(f => (f.location||'').toLowerCase().includes(region.toLowerCase())) : farmers;

  const perishables = (name='') => /tomato|strawberry|grape|avocado|greens/i.test(name);
  let riskCount = 0, total = 0;

  fsel.forEach(f => {
    (f.products || []).forEach(p => {
      if ((p.status||'').toLowerCase() === 'sold') return;
      total++;
      const nearAnyBiz = businesses.some(b => pseudoDistance(f.location, b.location) <= 30);
      const risky = perishables(p.name) && !nearAnyBiz;
      if (risky) riskCount++;
    });
  });

  const riskPct = total ? _fmt((riskCount/total)*100) : 0;
  const note = riskPct > 20 ? 'Consider advancing pickups and enabling cold storage.' : 'Risk appears manageable.';
  return { period, region: region || 'all', atRiskPercent: riskPct, note };
}

// 5) SDG-9 score roll-up (very simple)
async function sdgScore({ period = '30d', dimensions = ['access','infrastructure','innovation'] }) {
  const { kpi } = await summarizeKPI({ period, scope: 'all' });
  // naive mapping of KPIs to 0–100 subscores
  const access = Math.min(100, kpi.activeListings * 2);             // more listings → better access
  const infrastructure = Math.min(100, kpi.grantPositiveUpdates * 20); // grants progressing → infra
  const innovation = Math.min(100, kpi.barterReadyListings * 5);     // barter/co-op usage → innovation

  const dimSet = new Set(dimensions.map(d => d.toLowerCase()));
  const parts = [];
  if (dimSet.has('access')) parts.push(access);
  if (dimSet.has('infrastructure')) parts.push(infrastructure);
  if (dimSet.has('innovation')) parts.push(innovation);

  const score = parts.length ? _fmt(parts.reduce((a,b)=>a+b,0)/parts.length) : 0;
  return { period, dimensions, score, breakdown: { access, infrastructure, innovation } };
}

// 6) assemble a compact, formatted report
async function generateReport({ format = 'markdown', sections = ['summary','kpis','highlights','recs'], audience = 'exec' }) {
  const { summary, kpi } = await summarizeKPI({ period: '7d', scope: 'all' });
  const trend = await analyzeTrends({ metric: 'avgPrice', period: '7d' });
  const sdg   = await sdgScore({ period: '30d' });

  const highlights = [
    `Match potential: ~${kpi.businessNeeds} buyer needs vs ${kpi.activeListings} active listings.`,
    `Avg price change: ${trend.changePct}% (${trend.direction}).`,
    `SDG-9 score: ${sdg.score} / 100 (Access/Infra/Innovation).`
  ];

  const recs = [
    'Enable co-op aggregation for small lots to meet buyer volumes.',
    'Advance pickup windows for perishables in regions with higher risk.',
    'Target grants toward cold storage and first-mile logistics.'
  ];

  if (format === 'json') {
    return { summary, kpi, highlights, recommendations: recs, sdg };
  }

  // markdown/text
  const lines = [];
  if (sections.includes('summary'))   lines.push(`**Executive Summary**\n${summary}\n`);
  if (sections.includes('kpis'))      lines.push(`**KPIs (7d)**\n- Farmers: ${kpi.farmers}\n- Active listings: ${kpi.activeListings}\n- Total qty: ${kpi.totalQty}\n- Avg price: ${kpi.avgListingPrice ?? 'n/a'}\n- Buyer needs: ${kpi.businessNeeds}\n- Grants progressing: ${kpi.grantPositiveUpdates}\n`);
  if (sections.includes('highlights'))lines.push(`**Highlights**\n- ${highlights.join('\n- ')}\n`);
  if (sections.includes('recs'))      lines.push(`**Recommendations**\n- ${recs.join('\n- ')}\n`);
  if (sections.includes('sdg'))       lines.push(`**SDG-9**\nScore: ${sdg.score} / 100`);

  return (format === 'markdown') ? lines.join('\n') : lines.join('\n').replace(/\*\*/g,'');
}

const toolImpl = {
  // …existing tool implementations…
  summarizeKPI,
  analyzeTrends,
  priceTrends,
  climateImpact,
  sdgScore,
  generateReport
};

# KPIs
curl -s -X POST http://localhost:8080/api/agent \
 -H "Content-Type: application/json" \
 -d '{"tool":"summarizeKPI","args":{"period":"7d","scope":"all"}}' | jq

# Trend
curl -s -X POST http://localhost:8080/api/agent \
 -H "Content-Type: application/json" \
 -d '{"tool":"analyzeTrends","args":{"metric":"avgPrice","period":"7d"}}' | jq

# Price trends
curl -s -X POST http://localhost:8080/api/agent \
 -H "Content-Type: application/json" \
 -d '{"tool":"priceTrends","args":{"crop":"Tomatoes","period":"30d"}}' | jq

# Climate impact
curl -s -X POST http://localhost:8080/api/agent \
 -H "Content-Type: application/json" \
 -d '{"tool":"climateImpact","args":{"period":"7d","region":"Kano"}}' | jq

# SDG9 score
curl -s -X POST http://localhost:8080/api/agent \
 -H "Content-Type: application/json" \
 -d '{"tool":"sdgScore","args":{"period":"30d","dimensions":["access","infrastructure","innovation"]}}' | jq

# Generate report (markdown)
curl -s -X POST http://localhost:8080/api/agent \
 -H "Content-Type: application/json" \
 -d '{"tool":"generateReport","args":{"format":"markdown","sections":["summary","kpis","highlights","recs","sdg"]}}' | jq -r '.result'

