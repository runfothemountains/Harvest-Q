// --- Logistics Agent tools ---
const tools = [
  // …keep your existing tools above…

  {
    type: 'function',
    function: {
      name: 'planRoute',
      description: 'Estimate travel distance, duration, and pickup window between two locations.',
      parameters: {
        type: 'object',
        properties: {
          pickup:   { type: 'string', description: 'Pickup location or address.' },
          dropoff:  { type: 'string', description: 'Delivery destination.' },
          crop:     { type: 'string', description: 'Optional crop or item being transported.' },
          quantity: { type: 'string', description: 'Optional load quantity, e.g., "500 kg".' }
        },
        required: ['pickup','dropoff']
      }
    }
  },

  {
    type: 'function',
    function: {
      name: 'schedulePickup',
      description: 'Schedule a pickup slot and optionally assign a carrier or co-op vehicle.',
      parameters: {
        type: 'object',
        properties: {
          loadId:      { type: 'string' },
          pickupTime:  { type: 'string', description: 'ISO date/time or relative slot.' },
          carrier:     { type: 'string', description: 'Optional carrier or driver name.' }
        },
        required: ['loadId','pickupTime']
      }
    }
  },

  {
    type: 'function',
    function: {
      name: 'optimizeDelivery',
      description: 'Sequence multiple delivery stops to minimize total distance and travel time.',
      parameters: {
        type: 'object',
        properties: {
          stops: {
            type: 'array',
            items: { type: 'object',
                     properties: { name: { type: 'string' }, location: { type: 'string' } },
                     required: ['location'] },
            description: 'List of pickup/drop-off points.'
          }
        },
        required: ['stops']
      }
    }
  },

  {
    type: 'function',
    function: {
      name: 'calculateFuel',
      description: 'Estimate fuel consumption and CO₂ output for a delivery route.',
      parameters: {
        type: 'object',
        properties: {
          distanceKm: { type: 'number' },
          loadWeight: { type: 'number', description: 'Total cargo weight in kilograms.' },
          fuelType:   { type: 'string', enum: ['diesel','petrol','electric'], default: 'diesel' }
        },
        required: ['distanceKm']
      }
    }
  },

  {
    type: 'function',
    function: {
      name: 'evaluateRisk',
      description: 'Assess delivery risk based on distance, product type, and environmental factors.',
      parameters: {
        type: 'object',
        properties: {
          crop:        { type: 'string' },
          region:      { type: 'string' },
          storageType: { type: 'string' },
          distanceKm:  { type: 'number' }
        },
        required: ['crop']
      }
    }
  }

  // (notify already exists, so no need to duplicate)
];

// --- Logistics Agent implementations ---

// 1) planRoute — basic distance & window estimator
async function planRoute({ pickup, dropoff, crop, quantity }) {
  const distanceKm = pseudoDistance(pickup, dropoff);
  const speed = 50; // km/h average for demo
  const timeHrs = distanceKm / speed;
  const duration = `${Math.ceil(timeHrs)} hour${Math.ceil(timeHrs) !== 1 ? 's' : ''}`;
  const window = distanceKm > 60 ? 'Pickup within 48 hours' : 'Pickup within 24 hours';
  const load = quantity || 'unspecified';
  const routeId = `RT-${Date.now()}`;
  return {
    routeId,
    pickup,
    dropoff,
    distanceKm,
    duration,
    window,
    load,
    crop: crop || 'unspecified',
    note: 'Estimated using basic distance model. OptimizeDelivery can improve route efficiency.'
  };
}

// 2) schedulePickup — create a pickup appointment
async function schedulePickup({ loadId, pickupTime, carrier }) {
  const confirmationId = `PU-${Date.now()}`;
  const scheduled = new Date(pickupTime).toISOString();
  return {
    confirmationId,
    loadId,
    pickupTime: scheduled,
    carrier: carrier || 'Unassigned',
    status: 'scheduled',
    note: 'Pickup scheduled; notify driver and farmer.'
  };
}

// 3) optimizeDelivery — simple nearest-neighbor sequencing (demo logic)
async function optimizeDelivery({ stops = [] }) {
  if (stops.length < 2) return { optimized: stops, totalDistanceKm: 0, note: 'Less than 2 stops.' };
  const ordered = [stops[0]];
  const remaining = stops.slice(1);
  let totalDistance = 0;
  let current = stops[0];
  while (remaining.length) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i=0; i<remaining.length; i++) {
      const d = pseudoDistance(current.location, remaining[i].location);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }
    const next = remaining.splice(bestIdx,1)[0];
    totalDistance += bestDist;
    ordered.push(next);
    current = next;
  }
  return {
    optimized: ordered,
    totalDistanceKm: totalDistance,
    estTravelHours: (totalDistance / 50).toFixed(1),
    note: 'Nearest-neighbor route ordering; real API integration can refine this.'
  };
}

// 4) calculateFuel — rough fuel & emission model
async function calculateFuel({ distanceKm, loadWeight = 1000, fuelType = 'diesel' }) {
  const baseConsumption = { diesel: 0.25, petrol: 0.3, electric: 0.12 }; // liters/km or kWh/km
  const base = baseConsumption[fuelType] || 0.25;
  const loadFactor = 1 + (loadWeight / 10000); // +10% per ton
  const litersUsed = Number((distanceKm * base * loadFactor).toFixed(2));
  const co2Kg = fuelType === 'electric' ? 0 : Number((litersUsed * 2.68).toFixed(2)); // 2.68kg CO₂/l diesel
  return {
    distanceKm,
    loadWeight,
    fuelType,
    fuelUsed: litersUsed,
    co2EstimateKg: co2Kg,
    note: 'Estimated fuel use and emissions for demo purposes.'
  };
}

// 5) evaluateRisk — heuristic for transport risk
async function evaluateRisk({ crop, region, storageType, distanceKm = 50 }) {
  const perishable = /tomato|strawberry|avocado|greens|grape/i.test(crop || '');
  const hotRegion = /kenya|ghana|nigeria|india/i.test(region || '');
  let risk = 'low';
  if (perishable && distanceKm > 80) risk = 'high';
  else if (perishable || hotRegion || distanceKm > 50) risk = 'medium';
  const note = risk === 'high'
    ? 'High spoilage risk: recommend cold chain or faster pickup.'
    : (risk === 'medium'
        ? 'Moderate risk: schedule early morning delivery.'
        : 'Low risk: normal transport acceptable.');
  return { crop, region: region || 'unspecified', storageType, distanceKm, risk, note };
}

const toolImpl = {
  // …existing implementations…
  planRoute,
  schedulePickup,
  optimizeDelivery,
  calculateFuel,
  evaluateRisk
};

# planRoute
curl -s -X POST http://localhost:8080/api/agent \
 -H "Content-Type: application/json" \
 -d '{"tool":"planRoute","args":{"pickup":"Kano","dropoff":"Lagos","crop":"Tomatoes","quantity":"800 kg"}}' | jq

# schedulePickup
curl -s -X POST http://localhost:8080/api/agent \
 -H "Content-Type: application/json" \
 -d '{"tool":"schedulePickup","args":{"loadId":"LOT-123","pickupTime":"2025-11-03T09:00:00Z","carrier":"Harvest Logistics"}}' | jq

# optimizeDelivery
curl -s -X POST http://localhost:8080/api/agent \
 -H "Content-Type: application/json" \
 -d '{"tool":"optimizeDelivery","args":{"stops":[{"name":"Farm A","location":"Kano"},{"name":"Farm B","location":"Abuja"},{"name":"Buyer","location":"Lagos"}]}}' | jq

# calculateFuel
curl -s -X POST http://localhost:8080/api/agent \
 -H "Content-Type: application/json" \
 -d '{"tool":"calculateFuel","args":{"distanceKm":850,"loadWeight":1500,"fuelType":"diesel"}}' | jq

# evaluateRisk
curl -s -X POST http://localhost:8080/api/agent \
 -H "Content-Type: application/json" \
 -d '{"tool":"evaluateRisk","args":{"crop":"Tomatoes","region":"Nigeria","storageType":"ambient","distanceKm":120}}' | jq

