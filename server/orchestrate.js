import 'dotenv/config';
import express from 'express';
import { WatsonXAI } from '@ibm-cloud/watsonx-ai';
import { publishListing, enrichListing } from './agents/farmer.js';

const app = express();
app.use(express.json());

// 1) Init SDK
const wx = new WatsonXAI({
  apiKey: process.env.WATSONX_APIKEY,
  serviceUrl: process.env.WATSONX_URL,
  version: '2024-10-01'
});

// 2) Define tool specs (the model can call these)
const tools = [
  {
    type: 'function',
    function: {
      name: 'findSuppliers',
      description: 'Match a buyer need to farmer listings',
      parameters: {
        type: 'object',
        properties: {
          crop: { type: 'string' },
          minQty: { type: 'string' }
        },
        required: ['crop']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'scoreGrant',
      description: 'Score a grant request vs SDG9 criteria',
      parameters: {
        type: 'object',
        properties: { applicant: { type: 'string' }, purpose: { type: 'string' } },
        required: ['applicant', 'purpose']
      }
    }
  }
  // add more tools for your other agents
];

// 3) Implement tool logic
const toolImpl = {
  async findSuppliers({ crop, minQty }) {
    // read your Stage-3 JSON (farmers.json) and return best matches
    return [{ farmerId: 2, name: 'Aisha Bello', crop, qty: '200 kg' }];
  },
  async scoreGrant({ applicant, purpose }) {
    // trivial mock score
    return { applicant, purpose, score: 0.82, rationale: 'Reduces spoilage; community impact' };
  }
};

// 4) Chat endpoint the front-end calls
app.post('/api/agent', async (req, res) => {
  const userMsg = req.body?.message || 'Connect agents';
  const chat = await wx.chat.create({
    modelId: process.env.WATSONX_MODEL_ID,
    projectId: process.env.WATSONX_PROJECT_ID,
    input: [{ role: 'user', content: userMsg }],
    tools,                 // <-- register your tools
    tool_choice: 'auto'    // <-- allow model to choose tools
  });

  // If model requested a tool, execute it and send back tool result
  const call = chat.tool_calls?.[0];
  if (call?.function?.name) {
    const fn = toolImpl[call.function.name];
    const args = call.function.arguments || {};
    const result = await fn(args);
    // Return both the model text and our tool result for your UI
    return res.json({ text: chat.output_text, tool: call.function.name, result });
  }
  res.json({ text: chat.output_text });
});

// start
app.listen(8080, () => console.log('HarvestQ Orchestrate server on :8080'));
