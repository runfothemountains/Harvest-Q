// --- Coop Agent tools ---
const tools = [
  // ...keep existing tools above...

  {
    type: 'function',
    function: {
      name: 'groupByCrop',
      description: 'Cluster nearby farmers with the same crop and overlapping harvest windows.',
      parameters: {
        type: 'object',
        properties: {
          crop: { type: 'string' },
          location: { type: 'string', description: 'Optional center to sort by proximity.' },
          maxDistanceKm: { type: 'number', default: 150 },
          minQty: { type: 'string', description: 'Minimum per-farmer quantity, e.g., "50 kg".' },
          quality: { type: 'string', description: 'Optional quality tag to filter (e.g., "organic").' }
        },
        required: ['crop']
      }
    }
  },

  {
    type: 'function',
    function: {
      name: 'analyzeVolume',
      description: 'Compute combined volume, contributions, and gap against a target quantity.',
      parameters: {
        type: 'object',
        properties: {
          farmerIds: {
            type: 'array',
            items: { type: 'number' }
          },
          targetQty: { type: 'string', description: 'Target buyer quantity, e.g., "1 ton".' },
          crop: { type: 'string' }
        },
        required: ['farmerIds','targetQty','crop']
      }
    }
  },

  {
    type: 'function',
    function: {
      name: 'createBulkLot',
      description: 'Create a provisional cooperative listing/bid for a buyer.',
      parameters: {
        type: 'object',
        properties: {
          farmerIds: { type: 'array', items: { type: 'number' } },
          crop: { type: 'string' },
          buyerId: { type: 'string' },
          totalQty: { type: 'string' },
          blendedPrice: { type: 'number', description: 'Optional indicative blended price per unit.' }
        },
        required: ['farmerIds','crop','totalQty']
      }
    }
  }
  // ...you already have planRoute/suggestPrice/notify/verifySpec elsewhere...
];

// --- Coop Agent implementations ---

// helper: get all listings for a crop for a farmer (returns array of {qty, price, quality})
function _cropLotsForFarmer(farmer, crop) {
  const wanted = (crop || '').toLowerCase();
  const lots = (farmer.products || []).filter(p =>
    (p.name || '').toLowerCase().includes(wanted) &&
    (p.status || '').toLowerCase() !== 'sold'
  );
  return lots.map(p => ({
    name: p.name,
    qty: p.quantity || '0',
    price: p.price_per_kg ?? p.price_per_ton ?? null,
    quality: p.quality || farmer.quality || null
  }));
}

// 1) groupByCrop: cluster nearby farmers with same crop (+optional quality/qty filters)
async function groupByCrop({ crop, location, maxDistanceKm = 150, minQty = '0', quality }) {
  const farmers = await loadJSON('data/farmers.json');
  if (!farmers) return { groups: [], note: 'No farmer dataset found.' };

  const minQ = parseQty(minQty);
  const pool = [];

  for (const f of farmers) {
    const dist = location ? pseudoDistance(f.location, location) : 0;
    if (location && dist > maxDistanceKm) continue;

    const lots = _cropLotsForFarmer(f, crop);
    if (!lots.length) continue;

    // sum their available qty for the crop
    const sumQty = lots.reduce((s, l) => s + parseQty(l.qty), 0);
    const hasQuality = quality ? lots.some(l => (l.quality || '').toLowerCase().includes(quality.toLowerCase())) : true;

    if (sumQty >= minQ && hasQuality) {
      pool.push({
        farmerId: f.id,
        farmerName: f.name,
        location: f.location || '',
        distanceKm: location ? dist : null,
        totalQty: sumQty,
        lots
      });
    }
  }

  // Sort nearest-first if location provided
  pool.sort((a,b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));

  // Return a single suggested cluster (top 3–6 farmers), caller can refine
  const cluster = pool.slice(0, 6);
  const combinedQty = cluster.reduce((s, x) => s + x.totalQty, 0);

  return {
    groups: [{
      crop,
      members: cluster,
      combinedQty,
      note: cluster.length ? 'Suggested cooperative cluster.' : 'No nearby compatible farmers.'
    }]
  };
}

// 2) analyzeVolume: compute combined volume vs target, member contributions, shortfall/excess
async function analyzeVolume({ farmerIds = [], targetQty, crop }) {
  const farmers = await loadJSON('data/farmers.json') || [];
  const target = parseQty(targetQty);

  const members = [];
  for (const id of farmerIds) {
    const f = farmers.find(x => x.id === id);
    if (!f) continue;
    const lots = _cropLotsForFarmer(f, crop);
    const qty = lots.reduce((s, l) => s + parseQty(l.qty), 0);
    if (qty > 0) {
      members.push({
        farmerId: f.id,
        farmerName: f.name,
        qty,
        lots
      });
    }
  }

  const combinedQty = members.reduce((s, m) => s + m.qty, 0);
  const gap = Number((combinedQty - target).toFixed(2)); // negative = shortfall

  // proportional shares
  const shares = members.map(m => ({
    farmerId: m.farmerId,
    farmerName: m.farmerName,
    contribution: m.qty,
    pct: combinedQty ? Number(((m.qty / combinedQty) * 100).toFixed(1)) : 0
  }));

  return {
    crop,
    targetQty,
    combinedQty,
    gap, // >0 excess, <0 shortfall
    shares
  };
}

// 3) createBulkLot: snapshot a provisional co-op listing (persist later)
async function createBulkLot({ farmerIds = [], crop, buyerId, totalQty, blendedPrice }) {
  const lotId = `BULK-${Date.now()}`;
  const summary = {
    lotId,
    crop,
    buyerId: buyerId || null,
    totalQty,
    blendedPrice: blendedPrice ?? null,
    farmerIds,
    status: 'pending-spec-and-price',
    createdAt: new Date().toISOString()
  };
  // TODO: persist to Cloudant + notify members/buyer
  return { ok: true, bulkLot: summary };
}

const toolImpl = {
  // ...existing tool implementations...
  groupByCrop,
  analyzeVolume,
  createBulkLot
};
