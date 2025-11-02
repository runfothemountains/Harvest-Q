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
