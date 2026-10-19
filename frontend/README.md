# CRM Frontend

React 19 + Vite 8 + Tailwind CSS 4, plain JavaScript. Dark, dense, built to be
read at a glance rather than browsed.

## Running it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build into dist/
```

## It does not talk to the backend yet

Every screen reads through `src/api/`, which currently serves the in-memory
records in `src/mocks/db.js`. Those records mirror `backend/app/seed.py` exactly,
and the field names match the Pydantic read schemas in `backend/app/schemas/`.

**To wire the real API, change only `src/api/client.js`.** Each method becomes a
`fetch()` against `http://127.0.0.1:8000`. Function names, arguments and return
shapes already match the REST API, so no screen has to change.

Before that will work, the backend needs:

| Missing | Why it matters |
|---|---|
| `PATCH` and `DELETE` on all 7 entities | The UI's edit and delete have no endpoint to call. `backend/app/crud/*` only has create / get one / get all. |
| CORS middleware in `main.py` | A browser will not call the API at all without it. |
| **`orders` and `inventory` and `carts` tables** | The woodcraft core. `delivery_status`, `return_type`, `item_class` and `source` must be **real enums**, not free text - the mistake `deals.stage` made. |
| **The stock rule must move server-side** | `placeOrder` in `src/api/orders.js` does check-then-decrement in the browser. That is correct for a single-user mock and **wrong in production**: two people ordering the last chair would both pass the check and both decrement. It belongs in one transaction (`UPDATE ... WHERE quantity >= n`, then inspect rows affected). |
| **Deals is deleted** | `models/deals.py` plus its schema, CRUD and router go; needs a follow-up Alembic revision. |
| **A `tasks` table** | The Todo screen invents this entity; nothing backs it. Needs model, schema, CRUD (including update and delete), router, and a migration. |
| **`owner_id` on `orders`** | The team section needs it: who made each piece. |
| **`closed_at` on `deals`** | Without it there is no real cycle time. `expiry_date` is when a deal lapses, not when it was won — deriving "time to close" from it reported a median of 316 days, so the screen shows average age of open deals instead. |
| **A `/stats` endpoint** | `models/analytics.py` is still an empty stub. Aggregates belong in SQL, not computed in the browser over full lists the way `src/api/stats.js` does now. |
| Server-side search, sort and filter | `get_all_*` takes only `skip`/`limit`; the UI does this client-side today. |
| `stage` as an enum on `models/deals.py` | It is free text, but the kanban needs a fixed set of columns. |
| A stats endpoint (optional) | The overview computes its figures from full lists. |

## Layout

```
src/
├── api/          one module per entity + client.js  <- the swap point
├── mocks/        seed-mirroring records, mutable for the session
├── components/
│   ├── layout/   Sidebar, PageHeader, AppShell
│   ├── ui/       Button, Chips, Field, Drawer, ConfirmDialog, EmptyState
│   └── data/     DataTable, FormDrawer, Toolbar, StatTile, PipelineBar
├── pages/        one per screen (8) + NotFound
├── hooks/        useAsync - loading / error / data, used by every screen
└── lib/          format.js (display), domain.js (vocabulary + colour encoding)
```

Two pieces carry most of the weight: `DataTable` backs four screens, and
`FormDrawer` builds every create and edit form from a declarative field list.

## The colour system

> Porting this look to another project? `DESIGN-SPEC.md` is the standalone,
> copy-paste version: every token, the tint ladder, the grain/glow/lift layers
> and the rules behind them.

Defined once as Tailwind 4 `@theme` tokens in `src/index.css`. Three encodings
that never overlap, so a coloured cell is never ambiguous:

- **Blue** means *interaction*, and appears in neither status ramp. Anything blue
  can be acted on.
- **`priority_lvl`** is ordinal, so it is one heat ramp: a solid red fill at the
  top receding to a bare outline at the bottom. Never five unrelated hues.
- **`stage`** is pipeline position, so open stages are a sequential violet ramp
  that brightens as a deal advances. The two closed outcomes sit outside it as
  status colours.

The stage ramp was checked with a palette validator, not by eye. An earlier
blue-and-amber set was replaced because Qualification and Proposal measured
deltaE 6.0 apart in normal vision, which is not a distinction at all.

### Screen identity

Each screen owns a hue, listed in `src/lib/screens.js`. `AppShell` sets it once
as the `--screen` custom property from the current route, and everything below
inherits it: page header, the tint on the working surface, row and column hover,
the selected row, the sorted-column underline, the sidebar's active item and the
brand mark. No component takes a theme prop.

| Screen | Hue | Screen | Hue |
|---|---|---|---|
| Overview | azure | Organisations | periwinkle |
| Leads | cyan | Emails | orchid |
| Deals | violet | Campaigns | rose |
| Customers | emerald | People | lime |

**Screen hues appear in chrome only, never inside a data cell.** That is what
keeps them from competing with the priority and stage encodings above: those
live in chips and marks, screen colour lives in the furniture around them, and
the two never occupy the same place.

Some of these hues sit only about 24 degrees apart, which would be too close if
they were read side by side. They never are - exactly one is visible at a time,
with the screen name written next to it.

Chrome (`--color-chrome`) is darker than the panel, not lighter. The sidebar and
header are furniture; pushing them down in value makes the data read as the lit
surface you are working on.

## Conventions

- Tables use `table-fixed`, so the declared column widths are authoritative.
  With auto layout the browser re-apportions by content and starves columns.
- Table rows never wrap. One wrapped cell doubles the height of every row.
- Numeric columns use `.tnum` (IBM Plex Mono, tabular figures) so digits align.
- Every screen handles loading, empty and error states. The mock layer has a
  180ms delay so those states are real and testable.
- Campaign HTML is author-supplied, so it renders in a sandboxed `iframe`.
