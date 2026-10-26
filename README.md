<div align="center">

# Client Desk — CRM

### A CRM for a woodcraft business — orders, logistics, inventory and outreach on one dark, dense desk

Built to be read at a glance rather than browsed: every screen answers "what needs me today?"
before it shows you a table.

![React](https://img.shields.io/badge/React_19-20232a?logo=react&logoColor=61dafb)
![Vite](https://img.shields.io/badge/Vite_8-646cff?logo=vite&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind_4-0f172a?logo=tailwindcss&logoColor=38bdf8)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)
![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy_2-d71f00?logo=sqlalchemy&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169e1?logo=postgresql&logoColor=white)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

<br/>

<img src="docs/screenshots/overview.png" alt="Overview screen: in-flight orders by stage, headline numbers, orders needing a decision and the latest email" width="100%">

</div>

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
