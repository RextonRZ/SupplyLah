# SupplyLah
**From Chat. To Chain.**

## 🎬 Video Pitch
[![Watch the Pitch](https://img.shields.io/badge/Watch-Video%20Pitch-red?style=for-the-badge&logo=google-drive)](https://drive.google.com/file/d/1Io4of-N1gpotvdlsG-dt2R2u7Th_677c/view?usp=sharing)

## 📄 Project Documents

| Document | Link |
|----------|------|
| 📊 Pitching Deck | [View PDF](https://github.com/RextonRZ/SupplyLah/blob/main/Pitching%20Deck%20-%20SupplyLah.pdf) |
| 📋 Product Requirement Documentation | [View PDF](https://github.com/RextonRZ/SupplyLah/blob/main/Product%20Requirement%20Documentation.pdf) |
| ✅ Quality Assurance Testing Documentation | [View PDF](https://github.com/RextonRZ/SupplyLah/blob/main/Quality%20Assurance%20Testing%20Documentation.pdf) |
| 🏗 System Analysis Documentation | [View PDF](https://github.com/RextonRZ/SupplyLah/blob/main/System%20Analysis%20Documentation.pdf) |

---

SupplyLah is an AI-powered wholesale order automation platform built for Malaysian SME wholesalers. It transforms unstructured WhatsApp messages — text, voice notes, and images — into fully processed, logistics-ready orders with zero manual entry.

---

## Team Members

| Name | Role |
|------|------|
| Ooi Rui Zhe | Multi-Agent Orchestration, Frontend Dashboard, Mock Chat Demo |
| Vanness Liu Chuen Wei | FastAPI Backend, Supabase Schema, Voice Transcription Pipeline |
| Ong Zhao Qian | PRD, QA Testing, Prompt Engineering |

---

## Table of Contents

1. [Introduction](#introduction)
2. [Problem Statement](#problem-statement)
3. [Target Users](#target-users)
4. [Key Features](#key-features)
5. [Architecture](#architecture)
6. [AI Models](#ai-models)
7. [Technology Stack](#technology-stack)
8. [Project Structure](#project-structure)
9. [Installation & Setup](#installation--setup)

---

## Introduction

SupplyLah is a multi-agent AI system that sits between wholesale buyers and suppliers on WhatsApp. When a buyer sends an order — whether a typed message, a voice note in Bahasa Rojak, or a photo of a handwritten list — SupplyLah automatically parses the intent, checks live inventory, proposes substitutions if needed, confirms the order with the buyer, deducts stock, and books last-mile delivery. The merchant's staff monitor everything from a real-time Command Centre dashboard.

---

## Problem Statement

### Heavy Reliance on WhatsApp for Business Communication
Malaysian SME wholesalers process hundreds of orders daily through WhatsApp — a platform designed for personal messaging, not business operations. Orders arrive at all hours in unstructured formats with no automation, no tracking, and no audit trail.

### Massive Effort to Scale Unstructured Messages Daily
Each order requires a staff member to manually read, interpret, verify stock, calculate pricing, and reply. Scaling this operation means hiring more people — not building better systems.

### The Costly Margin of Human Error
Manual order processing leads to missed orders, incorrect quantities, wrong pricing, and overselling. A single error can damage supplier relationships and result in financial losses.

### Market Opportunity and Digital Gap
Over 98% of Malaysian businesses are SMEs. The vast majority still rely on manual WhatsApp order processing with no digital tooling. SupplyLah addresses this gap with an AI-first, WhatsApp-native solution requiring zero change in buyer behaviour.

---

## Target Users

- **Wholesale Suppliers** — Manage high-volume inbound orders from multiple buyers without extra headcount
- **SME Distributors** — Automate order intake, stock checking, and delivery booking in one pipeline
- **Retail Buyers** — Place orders naturally via WhatsApp in any language — no app download required
- **Warehouse Managers** — Monitor stock levels, approve flagged orders, and track fulfillment from a centralised dashboard

---

## Key Features

### WhatsApp Message & Voice Intake
Receives inbound buyer messages via Twilio WhatsApp Business API. Supports text, voice note, and image modalities. Works 24/7 with no buyer-side app installation required.

### Voice Notes Transcription to Order
Buyer voice notes are uploaded to AWS S3 and transcribed using Groq Whisper-v3. The system handles Bahasa Melayu, English, Bahasa Rojak, and mixed-language input with a wholesale-tuned vocabulary prompt for higher accuracy.

### GLM-Powered Multilingual Order Parsing and Inventory Reasoning
ILMU-GLM-5.1 powers three specialised agents — the Intake Agent parses buyer intent and extracts structured order data; the Inventory Agent checks live stock, applies business rules, and handles substitutions; the Logistics Agent books delivery and generates buyer confirmations.

### Live Inventory Read
Real-time product catalogue and stock levels are injected directly into agent prompts at call time. No caching — every order check reflects the latest warehouse state from Supabase.

### WhatsApp Order Confirmation to Buyer
An itemised order summary with pricing, delivery fee, and total is sent to the buyer via WhatsApp. The buyer confirms with a simple YES/NO reply before the order is committed.

### Inventory Deduction on Order Confirmation
Stock is deducted via a serialised write queue on order confirmation to prevent race conditions and overselling. Atomic operations ensure inventory accuracy under concurrent load.

### Wholesaler Staff Operations Dashboard and Alert Notification
A real-time Command Centre dashboard displays the full order pipeline via a Kanban board, live stock levels, exception alerts for flagged orders, and an AI Reasoning Panel that streams agent decision logs in real time.

### Order Log and Basic Reporting
Full conversation history and order logs are persisted in Supabase. The analytics dashboard provides 5 reporting modules: Revenue & Sales Velocity, AI Performance, Substitution Intelligence, Top Products by Volume, and Customer Activity.

### Logistics Booking via External API
Confirmed orders automatically trigger a Lalamove API booking. The system selects the appropriate vehicle type by weight, retrieves a price estimate, confirms the booking, and sends a real-time tracking link to the buyer.

### Customer Confirmation Loop
A stateful conversation engine manages the full buyer lifecycle — from order intake through substitution approval, address collection, order confirmation, and restock notifications — with automatic 30-minute expiry for unconfirmed orders.

---

## Architecture

SupplyLah is built on a stateful multi-agent architecture. Every inbound WhatsApp message enters a 16-step autonomous pipeline managed by a central orchestrator that tracks conversation state across 7 distinct states.

```
WhatsApp (Twilio)
        ↓
   Webhook Handler
        ↓
   Orchestrator  ←─── State Machine (Pending / Awaiting Address /
        │                Awaiting Substitution / Awaiting Confirmation /
        │                Repeat Order / Restock / Confirmed)
        ↓
 ┌──────────────────────────────────────┐
 │           Agent Pipeline             │
 │                                      │
 │  [Intake Agent]                      │
 │   • Modality detection               │
 │   • Audio → Groq Whisper             │
 │   • Image → GLM-4.6V OCR            │
 │   • Order parsing via GLM-5.1        │
 │   • Confidence gate (≥65%)           │
 │            ↓                         │
 │  [Inventory Agent]                   │
 │   • Live stock query (Supabase)      │
 │   • Business rules injection         │
 │   • Substitution logic               │
 │   • Quote generation                 │
 │            ↓                         │
 │  [Logistics Agent]                   │
 │   • Lalamove API booking             │
 │   • Tracking link generation         │
 │   • Buyer confirmation message       │
 └──────────────────────────────────────┘
        ↓
  Supabase (DB + Auth)
  AWS S3 (Media)
  SSE → Command Centre Dashboard
```

**Key architectural decisions:**
- **Serialised write queue** — asyncio queue prevents stock overselling under concurrent orders
- **Context injection over RAG** — product catalogue and business rules injected directly into prompts; no vector database needed at current scale
- **SSE streaming** — agent decision logs stream in real-time to the dashboard AI Reasoning Panel
- **Stateful conversation** — orders tracked across multiple buyer messages using DB-persisted state, with 30-minute auto-expiry

---

## AI Models

| Model | Provider | Purpose |
|-------|----------|---------|
| **ILMU-GLM-5.1** | ilmu.ai | Central reasoning engine — powers all 3 agents (order parsing, inventory evaluation, logistics confirmation) |
| **Groq Whisper-v3** | Groq | Voice note transcription — supports Bahasa Melayu, English, and Bahasa Rojak |
| **GLM-4.6V** | ilmu.ai | Vision model — OCR for handwritten and printed order lists from image messages |

**ILMU-GLM-5.1** is used for:
- **Intake Agent** — multilingual intent classification, item extraction, confidence scoring
- **Inventory Agent** — stock feasibility evaluation, substitution reasoning, pricing rule application
- **Logistics Agent** — delivery confirmation message generation in buyer's language

All models are accessed via an Anthropic-compatible API client (`glm_client.py`) with retry logic for transient 504 errors and HTTP/1.1 session override to prevent PostgREST GOAWAY crashes.

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, React, Tailwind CSS |
| Frontend Hosting | Vercel Edge Network |
| Backend | FastAPI, Python 3.11 |
| Database & Auth | Supabase (PostgreSQL + Auth) |
| Media Storage | AWS S3 |
| Queue Management | asyncio Queue (Redis planned) |
| LLM Orchestration | ILMU-GLM-5.1 (via ilmu.ai) |
| Voice Transcription | Groq Whisper-v3 |
| Vision / OCR | GLM-4.6V |
| WhatsApp API | Twilio WhatsApp Business API |
| Transactional Email | Resend |
| Logistics API | Lalamove API (mock) |
| Real-time Streaming | Server-Sent Events (SSE) |

---

## Project Structure

```
SupplyLah/
├── backend/
│   ├── app/
│   │   ├── agents/
│   │   │   ├── intake_agent.py        # Agent 1 — order parsing
│   │   │   ├── inventory_agent.py     # Agent 2 — stock & pricing
│   │   │   ├── logistics_agent.py     # Agent 3 — delivery booking
│   │   │   └── orchestrator.py        # State machine & message routing
│   │   ├── models/
│   │   │   └── schemas.py             # Pydantic data models
│   │   ├── prompts/
│   │   │   ├── intake_prompt.md       # Agent 1 system prompt
│   │   │   ├── inventory_prompt.md    # Agent 2 system prompt
│   │   │   └── logistics_prompt.md    # Agent 3 system prompt
│   │   ├── services/
│   │   │   ├── supabase_service.py    # Database access layer
│   │   │   ├── twilio_service.py      # WhatsApp messaging
│   │   │   ├── glm_client.py          # LLM API client
│   │   │   ├── transcription_service.py # Groq Whisper
│   │   │   ├── s3_service.py          # AWS S3 media storage
│   │   │   ├── lalamove_mock.py       # Logistics API mock
│   │   │   └── log_stream.py          # SSE real-time streaming
│   │   ├── routes.py                  # Dashboard API endpoints
│   │   ├── webhook.py                 # Twilio & mock chat webhooks
│   │   ├── config.py                  # Environment settings
│   │   └── main.py                    # FastAPI application entry
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── app/
│       │   ├── page.tsx               # Landing page
│       │   ├── login/                 # Login page
│       │   ├── signup/                # Sign up page
│       │   ├── get-started/           # Merchant onboarding
│       │   ├── dashboard/             # Command Centre
│       │   └── auth/callback/         # Auth + invite callback
│       ├── components/
│       │   ├── MockChat.tsx           # Demo WhatsApp chat
│       │   ├── KanbanBoard.tsx        # Order pipeline board
│       │   ├── OrderCard.tsx          # Individual order card
│       │   ├── AlertsPanel.tsx        # Exception alerts
│       │   ├── InventoryPanel.tsx     # Stock level panel
│       │   └── OrderReviewModal.tsx   # Manual review modal
│       └── lib/
│           ├── supabase.ts            # Supabase client
│           └── types.ts               # TypeScript types
└── supabase/
    └── migrations/                    # Database schema migrations
```

---

## Installation & Setup

### Prerequisites
- Python 3.11+
- Node.js 18+
- Supabase account
- ilmu.ai API key
- Groq API key
- Twilio account (or use mock mode)
- AWS S3 bucket (or use mock mode)

---

### 1. Clone the Repository

```bash
git clone https://github.com/RextonRZ/SupplyLah.git
cd SupplyLah
```

---

### 2. Backend Setup

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Mac/Linux
pip install -r requirements.txt
```

Create `backend/.env`:

```env
# LLM
ILMU_API_KEY=your_ilmu_api_key
ILMU_BASE_URL=https://api.ilmu.ai/anthropic

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key

# Twilio (set USE_MOCK_WHATSAPP=true to skip)
TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
USE_MOCK_WHATSAPP=true

# AWS S3 (leave empty to use mock)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_BUCKET_NAME=supplylah-media
AWS_REGION=ap-southeast-1

# Groq
GROQ_API_KEY=your_groq_api_key

# App
FRONTEND_URL=http://localhost:3000
DEFAULT_MERCHANT_ID=00000000-0000-0000-0000-000000000001
LOW_CONFIDENCE_THRESHOLD=0.65
```

Start the backend:

```bash
uvicorn app.main:app --reload --port 8000
```

---

### 3. Database Setup

Run the following migrations in order in your **Supabase SQL Editor**:

```
supabase/migrations/001_initial_schema.sql
supabase/migrations/002_auth_merchant_link.sql
supabase/migrations/003_add_product_fields.sql
supabase/migrations/004_add_team_contact.sql
supabase/migrations/005_kb_unique_and_team_fix.sql
supabase/migrations/006_add_awaiting_substitution.sql
supabase/migrations/007_team_auth_link.sql
supabase/migrations/008_team_invite_rpc.sql
supabase/migrations/009_get_merchant_team_rpc.sql
```

---

### 4. Frontend Setup

```bash
cd frontend
npm install
```

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
```

Start the frontend:

```bash
npm run dev
```

The app will be available at `http://localhost:3000`.

---

### 5. Supabase Auth Configuration

In your Supabase Dashboard → **Authentication → URL Configuration**:

- **Site URL:** `http://localhost:3000`
- **Redirect URLs:** Add `http://localhost:3000/auth/callback`

For production, add your Vercel deployment URL to both fields.

---

### 6. Demo Mode

The project runs in mock mode by default:
- `USE_MOCK_WHATSAPP=true` — WhatsApp messages are logged to console instead of sent via Twilio
- `USE_MOCK_LALAMOVE=true` — Lalamove delivery booking is simulated
- S3 is mocked if `AWS_ACCESS_KEY_ID` is empty — media URLs use `mock-s3.supplylah.local`

Use the **Demo Chat** tab in the dashboard to simulate buyer conversations without a real WhatsApp number.

---

> Built for UMHackathon 2026 · SupplyLah · From Chat. To Chain.
