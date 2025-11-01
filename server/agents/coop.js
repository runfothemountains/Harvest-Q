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

