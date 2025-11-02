// --- Quality Agent tools ---
const tools = [
  // …keep existing tools…

  {
    type: 'function',
    function: {
      name: 'gradeProduct',
      description: 'Assign a provisional grade (A/B/C) for a lot using simple quality attributes.',
      parameters: {
        type: 'object',
        properties: {
          lotId:      { type: 'string' },
          crop:       { type: 'string', description: 'e.g., Tomatoes, Rice' },
          attributes: {
            type: 'object',
            description: 'Measured attributes for this lot',
            properties: {
              moisturePct:   { type: 'number', description: 'e.g., 12.5' },
              sizeUniformity:{ type: 'number', description: '0–100% uniform size' },
              defectsPct:    { type: 'number', description: '0–100% visible defects/bruising' },
              certification: { type: 'string', description: 'e.g., Organic, GAP, ISO' },
              notes:         { type: 'string' }
            }
          }
        },
        required: ['lotId','crop','attributes']
      }
    }
  },

  {
    type: 'function',
    function: {
      name: 'flagIssue',
      description: 'Record an issue against a lot with severity for follow-up actions.',
      parameters: {
        type: 'object',
        properties: {
          lotId:   { type: 'string' },
          issue:   { type: 'string', description: 'Short issue title, e.g., High moisture' },
          detail:  { type: 'string', description: 'Optional detail/context' },
          severity:{ type: 'string', enum: ['low','medium','high'], default: 'medium' }
        },
        required: ['lotId','issue']
      }
    }
  },

  {
    type: 'function',
    function: {
      name: 'recommendHandling',
      description: 'Recommend handling actions (drying, cooling, faster pickup, blending) based on risk and attributes.',
      parameters: {
        type: 'object',
        properties: {
          lotId:      { type: 'string' },
          crop:       { type: 'string' },
          region:     { type: 'string' },
          storageType:{ type: 'string', description: 'ambient|cold|silo|shed' },
          attributes: {
            type: 'object',
            properties: {
              moisturePct: { type: 'number' },
              defectsPct:  { type: 'number' }
            }
          }
        },
        required: ['lotId','crop']
      }
    }
  }
];


