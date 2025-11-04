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

// --- Grant Agent implementations ---

// Simple keyword helpers for scoring
const _impactKeywords = ['access','inclusion','jobs','training','innovation','infrastructure','cold storage','logistics','transport','solar','irrigation'];
const _feasibilityKeywords = ['pilot','timeline','phase','partner','match funding','budget','quote','co-op','maintenance'];

function _scoreByKeywords(text, words) {
  const t = (text || '').toLowerCase();
  let s = 0;
  words.forEach(w => { if (t.includes(w)) s += 1; });
  return s; // raw count
}

// 1) scoreGrant: returns score (0..1), rationale, recommendation
async function scoreGrant({ applicant, purpose, amountUSD = 500, category = '', location = '', impactAreas = [] }) {
  const base = 0.4;

  // Impact: keywords in purpose + explicit impactAreas
  const impactScore = Math.min(0.3, _scoreByKeywords(purpose, _impactKeywords) * 0.05 + (impactAreas.length * 0.03));

  // Feasibility: presence of feasibility cues + modest budgets favored in demo
  const feasScore = Math.min(0.2, _scoreByKeywords(purpose, _feasibilityKeywords) * 0.05 + (amountUSD <= 1000 ? 0.05 : 0));

  // Alignment: category matches SDG9-ish themes
  const cat = (category || '').toLowerCase();
  const aligned = /(storage|infra|logistic|transport|equipment|processing|innovation)/.test(cat);
  const alignScore = aligned ? 0.1 : 0.0;

  let total = base + impactScore + feasScore + alignScore;
  total = Math.max(0, Math.min(1, total));

  // Recommendation
  let recommendation = 'Revise and resubmit';
  if (total >= 0.75) recommendation = 'Approve for funding';
  else if (total >= 0.55) recommendation = 'Eligible – refine scope';

  const rationale = [
    aligned ? 'Category aligns with SDG9.' : 'Category alignment limited.',
    impactAreas.length ? 'Impact areas provided.' : 'Impact areas unspecified.',
    amountUSD <= 1000 ? 'Budget feasible for micro-grant.' : 'Budget may exceed micro-grant scope.'
  ].join(' ');

  return {
    applicant,
    location,
    category,
    score: Number(total.toFixed(2)),
    rationale,
    recommendation
  };
}

// 2) verifyDocs: simple checklist (customize as needed)
async function verifyDocs({ applicant, docs = [] }) {
  const required = ['ID', 'Project Summary', 'Budget', 'Timeline'];
  const receivedSet = new Set(docs.map(d => d.toLowerCase()));
  const missing = required.filter(r => !receivedSet.has(r.toLowerCase()));

  return {
    applicant,
    required,
    received: docs,
    missing,
    complete: missing.length === 0,
    note: missing.length ? 'Missing required documents.' : 'All required documents present.'
  };
}

// 3) suggestImprovements: targeted tips from detected weaknesses
async function suggestImprovements({ purpose = '', weaknesses = [] }) {
  const tips = new Set();

  const t = purpose.toLowerCase();
  if (!/budget|cost|usd|\$/.test(t) || weaknesses.includes('budget unclear')) {
    tips.add('Add a clear, itemized budget with vendor quotes and totals.');
  }
  if (!/timeline|week|month|phase/.test(t) || weaknesses.includes('no timeline')) {
    tips.add('Include a simple timeline with milestones and expected completion date.');
  }
  if (!/partner|co-?op|cooperative|vendor/.test(t) || weaknesses.includes('no partners')) {
    tips.add('Name any partners (co-op, NGO, supplier) and their role.');
  }
  if (!/metric|measure|impact|benefit/.test(t) || weaknesses.includes('no metrics')) {
    tips.add('Define 2–3 measurable outcomes (e.g., spoilage reduced %, families served).');
  }
  if (!/infrastructure|storage|transport|processing|equipment/.test(t)) {
    tips.add('Clarify the infrastructure element to strengthen SDG9 alignment (e.g., storage or transport).');
  }

  return {
    purposePreview: purpose.slice(0, 140),
    suggestions: Array.from(tips),
    nextSteps: [
      'Revise the summary with the above improvements.',
      'Recalculate budget totals and attach supporting documents.',
      'Resubmit for a quick re-score.'
    ]
  };
}

const toolImpl = {
  // ...existing implementations...
  scoreGrant,
  verifyDocs,
  suggestImprovements,
  // notify   <-- already present earlier; include here if not yet mapped
};

# scoreGrant
curl -s -X POST http://localhost:8080/api/agent \
 -H "Content-Type: application/json" \
 -d '{"tool":"scoreGrant","args":{"applicant":"Food4Neighbors","purpose":"Cold storage pilot to reduce tomato spoilage with co-op partners and vendor quotes.","amountUSD":500,"category":"cold storage infrastructure","location":"Accra","impactAreas":["access","infrastructure"]}}' | jq

# verifyDocs
curl -s -X POST http://localhost:8080/api/agent \
 -H "Content-Type: application/json" \
 -d '{"tool":"verifyDocs","args":{"applicant":"Aisha Bello","docs":["ID","Project Summary","Budget"]}}' | jq

# suggestImprovements
curl -s -X POST http://localhost:8080/api/agent \
 -H "Content-Type: application/json" \
 -d '{"tool":"suggestImprovements","args":{"purpose":"We want to rent a cooler.","weaknesses":["budget unclear","no timeline"]}}' | jq
