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
