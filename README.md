# 🌾 Harvest Q — Stage 4  
> *Connecting farmers, consumers, and communities through AI-powered trade.*

**Compare:** [Stage 1](https://archive.harvestq.app) · [Stage 2](https://current.harvestq.app) · [Stage 3 (Live Demo)](https://harvest-q-2-3-4.vercel.app)

---

## 🧭 Overview
**Harvest Q** is a direct marketplace where **farmers list food products** and **consumers purchase or barter directly** — no middlemen.  
Each interaction is enhanced by **IBM watsonx AI Agents** that automate pricing, translation, risk checks, logistics, and notifications.

This submission represents **Stage 3**, where AI agents built with **IBM watsonx Orchestrate** and **watsonx.ai** begin powering real-time workflows.

---

## 🚀 Quick Demo
- **Live App:** [https://harvest-q-2-3-4.vercel.app](https://harvest-q-2-3-4.vercel.app)  
- **API Endpoint (for Agents):** `POST /api/agent`  
- **Example Call:**
  ```bash
  curl -s -X POST https://harvest-q-2-3-4.vercel.app/api/agent \
    -H "Content-Type: application/json" \
    -d '{"tool":"findBarterMatch","args":{"itemOffered":"Tomatoes","itemWanted":"Onions","location":"Kano"}}'


🧩 Key Features

Module	Description

Pricing Agent	Calculates fair-market rates & regional comparisons

Risk Agent	Evaluates spoilage, delivery delay & market volatility

Quality Agent	Grades products and recommends handling

Translator Agent	Auto-translates listings and messages across languages

Barter Agent	Matches farmers for cash-free trades and suggests ratios

Logistics Agent	Optimizes delivery routes and timelines

Notify Agent	Sends alerts to buyers & drivers

Grant Agent	Manages community micro-grants ($500 pilot)

Insights Agent	Generates weekly market and SDG-9 reports

🏗️ Tech Stack

Frontend: HTML / CSS / Vanilla JS (PWA ready)

Backend: Node 18 serverless API (Vercel)

Data: Static JSON seed (data/farmers.json, buyers.json, coops.json)

AI & Automation:

IBM watsonx Orchestrate (Agent Catalog + multi-agent flows)

IBM watsonx.ai (Prompt Lab + Granite LLMs)

IBM Code Assistant (for rapid function stubs)

🔌 API Structure

All agents share one endpoint → /api/agent

Request

{ "tool": "detectLanguage", "args": { "text": "Bonjour" } }

Response

{ "ok": true, "tool": "detectLanguage", "result": { "detected": "fr", "confidence": 0.9 } }

> Each tool in server/orchestrate.js follows the IBM Agent Development Kit (JSON-schema + function mapping).

⚙️ Run Locally

git clone https://github.com/runfothemountains/Harvest-Q.git
cd Harvest-Q
npm ci
npm start   # launches local server on http://localhost:8080

Then test:

curl -s -X POST http://localhost:8080/api/agent \
 -H "Content-Type: application/json" \
 -d '{"tool":"detectLanguage","args":{"text":"Hola"}}'
 
📂 Project Layout

index.html              → UI shell & tabs

index.js                → Front-end logic (Quick Start + IBM connect)

api/agent.js            → Single serverless endpoint for all tools

server/orchestrate.js   → Agent schemas + implementations

data/*.json             → Demo data for farmers/buyers/co-ops

css/style.css           → Global styles

docs/                   → Screenshots & architecture images

🧠 Why IBM watsonx Matters

Orchestrate brings enterprise-grade multi-agent coordination.

watsonx.ai Prompt Lab enables fine-tuned reason-and-act patterns.

Granite models provide robust classification & language understanding.

SDG-9 Impact: industrial innovation + sustainable food infrastructure.

📸 Screenshots

UI	Description

	Landing / Language Switch
	Barter Agent Quick Start
	Buyer matching interface

📅 Development Roadmap

Stage	Focus

1	Foundation + domain setup

2	Marketplace UI & core data flow

3	IBM AI Agent integration (current)

4	Trade / Health / Community modes

5	Analytics & business onboarding

6	International expansion / multi-currency support

👩🏽‍🌾 Sample Data


	  
      "barter": true
    }
  ]
}

