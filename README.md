# SupplyLah

AI-powered supply chain automation for Malaysian SME wholesalers. Converts unstructured WhatsApp messages (text, voice notes, handwritten images) into end-to-end automated order workflows using a multi-agent GLM pipeline.

Built for **UMHackathon 2026**.

---

## Architecture

```
WhatsApp / Mock Chat UI
        │
        ▼
  FastAPI Webhook  ←── Twilio
        │
        ▼
  Orchestrator (stateful state machine)
    ├── [NEW order] ──► Intake Agent (GLM-5.1) ──► Inventory Agent (GLM-5.1)
    │                        ↕ MCP Tools                  ↕ MCP Tools
    │                   lookup_catalog           get_inventory / business_rules
    │
    └── [AWAITING CONFIRMATION] ──► confirm? ──► Logistics Agent (GLM-4.7-Flash)
                                                      ↕ MCP Tools
                                                 book_lalamove / deduct_inventory
        │
        ▼
  Supabase (PostgreSQL + pgvector)
        │
        ▼
  Next.js Dashboard (Kanban + Alerts + Inventory)
```

### AI Models (Ilmu.ai GLM)

| Model | Role |
|---|---|
| `ilmu-glm-5.1` | Core reasoning — order parsing, inventory logic, substitutions |
| `ilmu-glm-5.1` | Fast tasks — logistics booking, confirmation messages |
| `ilmu-glm-5.1` | Speech-to-text — voice notes and call transcription |
| `ilmu-glm-5.1` | Vision — handwritten order image OCR |

---

## Quick Start

### 1. Backend

```bash
cd backend
cp .env.example .env
# Edit .env — at minimum set ZAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY

pip install -r requirements.txt
uvicorn app.main:app --reload
```

### 2. Frontend

```bash
cd frontend
cp .env.local.example .env.local
# Edit .env.local — set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY

npm install
npm run dev
```

### 3. Database

Run the migration in your Supabase project:

```bash
# Via Supabase CLI
supabase db push

# Or paste supabase/migrations/001_initial_schema.sql directly into the Supabase SQL Editor
```

### 4. Docker (all-in-one)

```bash
cp backend/.env.example backend/.env
cp frontend/.env.local.example frontend/.env.local
# Edit both .env files

docker compose up --build
```

---

## Demo

1. Open `http://localhost:3000`
2. Click **Demo Chat** tab
3. Send a message like:

   > `boss nak 3 botol minyak masak n 2 bag beras, hantar ke Jalan Ampang KL`

4. Watch the AI parse the order, check inventory, and return a quote
5. Reply `YA` to confirm — the Logistics Agent will book delivery and respond with tracking
6. Switch to **Command Centre** to see the live Kanban update

---

## Key Features

- **Multi-modal ingestion** — Text, voice notes (ASR), handwritten images (OCR)
- **Bahasa Rojak support** — GLM-5.1 handles mixed Malay/English/slang naturally
- **MCP tool calling** — Agents interact with inventory and logistics strictly via declared tools (no hardcoded API calls in prompts)
- **Serial write queue** — Prevents overselling via `asyncio.Queue` serialising all inventory deductions
- **30-minute confirmation loop** — Stateful order session persisted in Supabase
- **Human-in-the-loop** — Low-confidence orders surfaced to staff dashboard with one-click approve/reject
- **Mock-first** — WhatsApp, Lalamove, and Google Sheets mocked by default; flip `USE_MOCK_*=false` in `.env` for real APIs

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description |
|---|---|
| `ILMU_API_KEY` | Ilmu.ai API key |
| `ILMU_BASE_URL` | Ilmu.ai API base URL |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Supabase service role key |
| `USE_MOCK_WHATSAPP` | `true` to log instead of send (default: true) |
| `USE_MOCK_LALAMOVE` | `true` for mock logistics (default: true) |
| `TWILIO_ACCOUNT_SID` | Only needed when `USE_MOCK_WHATSAPP=false` |

### Frontend (`frontend/.env.local`)

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `NEXT_PUBLIC_BACKEND_URL` | FastAPI URL (default: `http://localhost:8000`) |

---

## Project Structure

```
SupplyLah/
├── backend/
│   └── app/
│       ├── agents/          # Intake, Inventory, Logistics agents + Orchestrator
│       ├── mcp/             # Tool schemas + executor factories
│       ├── models/          # Pydantic schemas for inter-agent handoffs
│       ├── prompts/         # GLM system prompts (Markdown)
│       ├── services/        # GLM client, Supabase, Twilio, S3, Sheets, Lalamove
│       ├── main.py          # FastAPI app
│       ├── webhook.py       # Twilio + mock chat endpoints
│       └── routes.py        # Dashboard API
├── frontend/
│   └── src/
│       ├── app/             # Next.js App Router pages
│       ├── components/      # KanbanBoard, OrderCard, AlertsPanel, InventoryPanel, MockChat
│       └── lib/             # Supabase client, TypeScript types
├── supabase/
│   └── migrations/          # PostgreSQL schema + seed data
└── docker-compose.yml
```
