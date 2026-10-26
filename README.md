<div align="center">

<img src="docs/assets/banner.png" alt="Client Desk" height="72">

<br/>

![React](https://img.shields.io/badge/React-19-20232A?labelColor=30363d&logo=react&logoColor=white) ![Vite](https://img.shields.io/badge/Vite-8-646CFF?labelColor=30363d&logo=vite&logoColor=white) ![Tailwind](https://img.shields.io/badge/Tailwind-4-0F172A?labelColor=30363d&logo=tailwindcss&logoColor=white) ![FastAPI](https://img.shields.io/badge/FastAPI-SQLAlchemy_2-009688?labelColor=30363d&logo=fastapi&logoColor=white) ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Alembic-4169E1?labelColor=30363d&logo=postgresql&logoColor=white) [![License](https://img.shields.io/badge/License-MIT-3B82F6?labelColor=30363d)](LICENSE)

<br/>

<img src="docs/assets/card.png" alt="14 screens — runs with or without a backend" height="60">

<br/><br/>

[Features](#features) | [Screenshots](#screenshots) | [Design](#design) | [Architecture](#architecture) | [Getting started](#getting-started)

</div>

---

# Client Desk: A CRM for a Woodcraft Business

Orders, logistics, inventory and outreach on one dark, dense desk — built to be read at a glance rather than browsed, so every screen answers "what needs me today?" before it shows you a table.

## News

- [2026-10] **Full stack connected:** the frontend now reads and writes PostgreSQL through FastAPI, and the stock rule moved server-side into a single transaction.
- [2026-10] **New frontend:** 14 screens — orders, returns, logistics board, inventory, insights, statistics — with a per-screen colour system and sample data so it runs without a backend.
- [2026-08] **Data model:** leads, organisations, customers and emails with a CRUD layer and Alembic migrations.

<img src="docs/screenshots/overview.png" alt="Overview screen: in-flight orders by stage, headline numbers, orders needing a decision and the latest email" width="100%">


---

## Features

| | |
|---|---|
| **Overview** | Money in flight by stage, delivered revenue, return rate, new leads, unopened email — and the orders that need a decision next. |
| **Orders & Returns** | One table, two views. A return is the same row with `kind = 'return'`, so refunds, exchanges and modifications stay linked to the original sale. |
| **Logistics** | A board from *Processing* to *Delivered*, for deliveries and returns alike, with due dates, priority and "not in stock, needs making" flags. |
| **Inventory** | Stock levels with a server-side stock rule: placing an order checks and decrements stock inside a single transaction. |
| **Leads, Customers, Organisations** | The sales pipeline and account records, tagged by acquisition source (website, Instagram, Facebook, direct). |
| **Emails & Campaigns** | Outreach tracking with priority and open status. |
| **Insights & Statistics** | Prospects with full carts, closed-won sales and why things came back; a fulfilment funnel, lead times, and revenue by source, category, wood and account. |
| **Todo & People** | Tasks linked to the records they're about, and the team behind them. |

## Screenshots

<table>
  <tr>
    <td width="50%"><img alt="Logistics board with delivery and return columns" src="docs/screenshots/logistics.png"></td>
    <td width="50%"><img alt="Orders table" src="docs/screenshots/orders.png"></td>
  </tr>
  <tr>
    <td align="center"><sub><b>Logistics</b> — deliveries and returns on one board</sub></td>
    <td align="center"><sub><b>Orders</b> — filterable, sortable, editable in a drawer</sub></td>
  </tr>
  <tr>
    <td width="50%"><img alt="Insights: prospects, closed won and returns" src="docs/screenshots/insights.png"></td>
    <td width="50%"><img alt="Statistics charts" src="docs/screenshots/statistics.png"></td>
  </tr>
  <tr>
    <td align="center"><sub><b>Insights</b> — who's about to buy, and what came back</sub></td>
    <td align="center"><sub><b>Statistics</b> — funnel, lead times and revenue breakdowns</sub></td>
  </tr>
</table>

<details>
<summary><b>Inventory</b></summary>
<br/>
<img alt="Inventory screen" src="docs/screenshots/inventory.png" width="100%">
</details>

## Design

Each screen owns a hue — Orders green, Logistics violet, Insights magenta — that tints only the *chrome*
(sidebar, header, hover states) and never a data cell. Status and priority use their own ordered colour
ramps, and blue always means "you can act on this". Because the encodings never share a place, a coloured
thing is never ambiguous. The full system — tokens, tint ladder, grain, glow and lift — is documented in
[`frontend/DESIGN-SPEC.md`](frontend/DESIGN-SPEC.md) so it can be ported to other projects.

## Architecture

```mermaid
flowchart LR
  UI[React 19 + Vite<br/>14 screens] --> API[src/api/client.js]
  API -->|VITE_API_BASE_URL unset| MOCK[In-memory sample data<br/>src/mocks/db.js]
  API -->|VITE_API_BASE_URL set| BE[FastAPI<br/>routers · schemas · CRUD]
  BE --> DB[(PostgreSQL<br/>SQLAlchemy 2 + Alembic)]
```

The frontend reads everything through one client module. Leave `VITE_API_BASE_URL` unset and it runs
on sample data that mirrors the backend's seed, so the demo works with no server at all. Set it and every
screen reads and writes the real database through FastAPI.

## Getting started

**Frontend only** (sample data, no backend needed)

```bash
cd frontend
npm install
npm run dev                          # http://localhost:5173
```

**Full stack**

```bash
# 1. Backend
python -m venv .venv && source .venv/bin/activate    # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cd backend/app
cp .env.example .env                 # set DATABASE_URL to your Postgres database
alembic upgrade head                 # create the tables
python seed.py                       # optional: load the woodcraft sample data
uvicorn main:app --reload            # http://127.0.0.1:8000/docs

# 2. Frontend, pointed at the API
cd ../../frontend
cp .env.example .env.local           # VITE_API_BASE_URL=http://127.0.0.1:8000
npm run dev
```

## Project structure

```
backend/app/
├── main.py            # FastAPI app, CORS, routers
├── models/            # SQLAlchemy models with Postgres enums
├── schemas/           # Pydantic request/response models
├── crud/              # data access, incl. the transactional stock rule
├── routers/           # one router per entity
├── alembic/           # migrations
└── seed.py            # sample data
frontend/src/
├── api/               # one module per entity + client.js (the swap point)
├── mocks/             # sample data used without a backend
├── components/        # layout, ui and data components (DataTable, FormDrawer, …)
├── pages/             # one per screen
└── lib/               # formatting, domain vocabulary, colour encoding
```

More detail on the frontend, its data layer and what the backend still needs is in
[`frontend/README.md`](frontend/README.md).

## Roadmap

- Authentication and password hashing
- A `/stats` endpoint instead of browser-side aggregation
- Server-side search, sorting, filtering and pagination
- Multi-item orders

## License

[MIT](LICENSE) © Barnak Roy Nandy
