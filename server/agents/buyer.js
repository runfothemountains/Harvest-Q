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

