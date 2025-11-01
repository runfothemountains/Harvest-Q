// --- Grant Agent tools ---
const tools = [
  // ...keep your existing tools above...

  {
    type: 'function',
    function: {
      name: 'scoreGrant',
      description: 'Score a grant application for impact, feasibility, and SDG9 alignment.',
      parameters: {
        type: 'object',
        properties: {
          applicant:   { type: 'string', description: 'Person or organization name.' },
          purpose:     { type: 'string', description: 'Short project description.' },
          amountUSD:   { type: 'number', description: 'Requested amount in USD.' },
          category:    { type: 'string', description: 'e.g., cold storage, logistics, equipment, community program.' },
          location:    { type: 'string', description: 'City/region.' },
          impactAreas: {
            type: 'array',
            description: 'Areas impacted (e.g., access, innovation, infrastructure).',
            items: { type: 'string' }
          }
        },
        required: ['applicant','purpose']
      }
    }
  },

  {
    type: 'function',
    function: {
      name: 'verifyDocs',
      description: 'Check if required documents are present for the grant application.',
      parameters: {
        type: 'object',
        properties: {
          applicant: { type: 'string' },
          docs: {
            type: 'array',
            description: 'List of provided docs by name.',
            items: { type: 'string' }
          }
        },
        required: ['applicant','docs']
      }
    }
  },

  {
    type: 'function',
    function: {
      name: 'suggestImprovements',
      description: 'Suggest edits that strengthen a weak grant application.',
      parameters: {
        type: 'object',
        properties: {
          purpose:    { type: 'string' },
          weaknesses: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional hints, e.g., ["budget unclear","no metrics"].'
          }
        },
        required: ['purpose']
      }
    }
  }

  // (notify tool already exists in your tools; if not, add it here)
];

