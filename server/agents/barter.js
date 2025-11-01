// --- Barter Agent tools ---
const tools = [
  // ...keep your existing tools above...

  {
    type: 'function',
    function: {
      name: 'findBarterMatch',
      description: 'Find compatible barter partners by crop, quantity, and proximity.',
      parameters: {
        type: 'object',
        properties: {
          itemOffered: { type: 'string', description: 'What the user can trade (e.g., "Tomatoes").' },
          itemWanted:  { type: 'string', description: 'What the user wants in return (e.g., "Onions").' },
            // optional filters
          location:    { type: 'string', description: 'City/region string used for proximity sorting.' },
          maxDistanceKm:{ type: 'number', description: 'Maximum distance in kilometers.' },
          minQuantity: { type: 'string', description: 'Minimum quantity the user wants to trade, e.g., "100 kg".' }
        },
        required: ['itemOffered', 'itemWanted']
      }
    }
  },

  {
    type: 'function',
    function: {
      name: 'evaluateTradeValue',
      description: 'Estimate a fair barter ratio using recent price signals.',
      parameters: {
        type: 'object',
        properties: {
          itemsA: {
            type: 'array',
            description: 'Items offered by party A.',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                qty:  { type: 'string' },       // e.g., "100 kg"
                refPricePerUnit: { type: 'number', description: 'Optional reference price per unit (USD/kg, etc.)' }
              },
              required: ['name','qty']
            }
          },
          itemsB: {
            type: 'array',
            description: 'Items requested from party B.',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                qty:  { type: 'string' },
                refPricePerUnit: { type: 'number' }
              },
              required: ['name','qty']
            }
          }
        },
        required: ['itemsA','itemsB']
      }
    }
  },

  {
    type: 'function',
    function: {
      name: 'initiateExchange',
      description: 'Open a provisional barter exchange and notify both parties.',
      parameters: {
        type: 'object',
        properties: {
          partnerId: { type: 'string', description: 'The matched partner’s ID (farmer or business).' },
          terms: {
            type: 'object',
            properties: {
              offered:  { type: 'string', description: 'Summary of items offered.' },
              requested:{ type: 'string', description: 'Summary of items requested.' },
              ratio:    { type: 'string', description: 'Proposed ratio, e.g., "1 crate : 2 sacks".' },
              pickupWindow: { type: 'string', description: 'Preferred pickup/delivery window.' },
              locationA: { type: 'string' },
              locationB: { type: 'string' }
            },
            required: ['offered','requested','ratio']
          }
        },
        required: ['partnerId','terms']
      }
    }
  }

  // ...you can add more tools below...
];

