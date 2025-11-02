I// --- Quality Agent tools ---
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

// --- Quality Agent implementations ---

// Simple in-memory issue log (demo)
const _qualityIssues = []; // {id, lotId, issue, detail, severity, ts}

// Utility: basic crop-specific moisture thresholds (demo values)
const _moistureLimits = {
  rice: 12.0, maize: 13.5, corn: 13.5, wheat: 13.0, tomatoes: 0, onion: 0 // 0 = fresh produce, use defects/temp instead
};

// Heuristic grading
function _gradeFrom(attrs = {}, crop = '') {
  const c = (crop || '').toLowerCase();
  const limit = _moistureLimits[c] ?? null;

  const m = Number(attrs.moisturePct ?? NaN);
  const u = Number(attrs.sizeUniformity ?? NaN); // 0–100
  const d = Number(attrs.defectsPct ?? NaN);     // 0–100
  const hasCert = Boolean(attrs.certification);

  // Start at B, move up/down by conditions
  let grade = 'B';
  const reasons = [];

  // Cereals/legumes: moisture critical
  if (Number.isFinite(m) && limit !== null && limit > 0) {
    if (m <= limit) {
      reasons.push(`Moisture ${m}% ≤ limit ${limit}%`);
      grade = 'A';
    } else if (m <= limit + 1.0) {
      reasons.push(`Moisture slightly high (${m}% > ${limit}%)`);
      grade = 'B';
    } else {
      reasons.push(`Moisture high (${m}% > ${limit}%)`);
      grade = 'C';
    }
  }

  // Fresh produce: defects/size matter more
  if (['tomatoes','onion','onions','avocado','greens','grape','strawberry'].includes(c)) {
    if (Number.isFinite(d)) {
      if (d <= 5) { reasons.push('Defects ≤5%'); grade = 'A'; }
      else if (d <= 12) { reasons.push('Defects 6–12%'); grade = (grade === 'C' ? 'C' : 'B'); }
      else { reasons.push('Defects >12%'); grade = 'C'; }
    }
    if (Number.isFinite(u)) {
      if (u >= 85 && grade !== 'C') { reasons.push('High size uniformity'); grade = 'A'; }
      else if (u < 60) { reasons.push('Low size uniformity'); grade = 'C'; }
    }
  }

  if (hasCert && grade !== 'C') {
    reasons.push(`Certification present (${attrs.certification})`);
    if (grade === 'B') grade = 'A';
  }

  return { grade, reasons };
}

// 1) gradeProduct
async function gradeProduct({ lotId, crop, attributes = {} }) {
  const { grade, reasons } = _gradeFrom(attributes, crop);
  const provisional = {
    lotId, crop, provisionalGrade: grade,
    checks: {
      moisturePct: attributes.moisturePct ?? null,
      sizeUniformity: attributes.sizeUniformity ?? null,
      defectsPct: attributes.defectsPct ?? null,
      certification: attributes.certification ?? null
    },
    rationale: reasons,
    note: 'Provisional grade based on simple heuristics; confirm with verifySpec if required.'
  };
  return provisional;
}

// 2) flagIssue
async function flagIssue({ lotId, issue, detail = '', severity = 'medium' }) {
  const id = `QI-${Date.now()}`;
  const ts = new Date().toISOString();
  const entry = { id, lotId, issue, detail, severity, ts };
  _qualityIssues.unshift(entry);
  if (_qualityIssues.length > 200) _qualityIssues.pop();
  return { ok: true, id, lotId, severity, issue, detail, ts };
}

// 3) recommendHandling
async function recommendHandling({ lotId, crop, region = 'unspecified', storageType = 'ambient', attributes = {} }) {
  // Pull a simple delivery-risk heuristic from your existing evaluateRisk
  let risk = 'medium';
  try {
    const evalRes = await evaluateRisk({ crop, region, storageType, distanceKm: 50 });
    risk = evalRes?.risk || 'medium';
  } catch (_) { /* ignore if not wired */ }

  const actions = [];
  const notes = [];

  const m = Number(attributes.moisturePct ?? NaN);
  const d = Number(attributes.defectsPct ?? NaN);
  const cropLower = (crop || '').toLowerCase();
  const limit = _moistureLimits[cropLower] ?? null;

  // Moisture-driven actions (grains/legumes)
  if (Number.isFinite(m) && limit !== null && limit > 0) {
    if (m > limit) {
      actions.push('Dry to target moisture before sale (aeration/sun-curing).');
      notes.push(`Moisture ${m}% exceeds ${limit}% for ${crop}.`);
    }
  }

  // Fresh produce handling
  if (['tomatoes','onion','onions','avocado','greens','grape','strawberry'].includes(cropLower)) {
    if (storageType !== 'cold') {
      actions.push('Move to cold storage or shade to slow spoilage.');
      notes.push('Perishable crop stored in non-cold environment.');
    }
    if (Number.isFinite(d) && d > 10) {
      actions.push('Sort & re-grade to remove damaged units; consider “seconds” pricing.');
      notes.push(`Visible defects at ${d}%.`);
    }
  }

  // Risk-based logistics
  if (risk === 'high') {
    actions.push('Advance pickup to next 24 hours; avoid mid-day heat.');
    actions.push('Use insulated transport or cold chain if available.');
  } else if (risk === 'medium') {
    actions.push('Schedule morning pickup within 48 hours.');
  }

  // Commercial options
  actions.push('Option: co-op blending to meet buyer spec if partial lot fails.');
  actions.push('Option: adjust price band if quality is below Grade A.');

  // De-duplicate
  const unique = Array.from(new Set(actions));

  return {
    lotId, crop, region, storageType,
    riskLevel: risk,
    recommendations: unique,
    notes
  };
}

const toolImpl = {
  // …existing implementations…
  gradeProduct,
  flagIssue,
  recommendHandling
};
