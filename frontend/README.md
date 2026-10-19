# CRM Frontend

React 19 + Vite 8 + Tailwind CSS 4, plain JavaScript. Dark, dense, built to be
read at a glance rather than browsed.

## Running it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build into dist/
```

## Two data sources, one switch

Every screen reads through `src/api/`. Which transport it uses is decided by a
single environment variable, read in `src/api/client.js`:

| `VITE_API_BASE_URL` | What runs |
|---|---|
| unset | The in-memory sample records in `src/mocks/db.js` |
| set, e.g. `http://127.0.0.1:8000` | Real `fetch()` calls to the FastAPI backend |

```bash
cp .env.example .env.local     # then npm run dev
```

Both are kept rather than the mock being deleted, because they do different
jobs. **The deployed demo has no backend to reach**, so without the sample
tables it would be a wall of error states; and the frontend stays developable
with the API switched off. Nothing above `client.js` knows which is running.

The mock rows are the same rows `backend/app/seeds_woodcraft.py` loads, so
switching transports should change nothing on screen. Anything that *does*
change is a wiring bug.

### The stock rule exists twice, and they are not equivalent

| Mode | Where it runs |
|---|---|
| API | `POST /orders/` - one transaction, guard inside the `UPDATE`. **Correct.** |
| mock | `placeOrder` in `src/api/orders.js` - check, then decrement. **Race-prone.** |

The mock version is fine for one person clicking around with no server, and
wrong for real use: two people ordering the last chair both pass the check and
both decrement. It is only reachable when `VITE_API_BASE_URL` is unset.

### What the backend still owes this frontend

| Missing | Why it matters |
|---|---|
| **Login, and password hashing** | `models/users.py` stores passwords in plain text and no endpoint requires authentication. Anyone with the URL can read or delete every record. |
| A `/stats` endpoint | `src/api/stats.js` computes every aggregate in the browser over full lists. Deliberately not built yet: a second implementation of the same sums could disagree with the screens it is meant to summarise. It becomes necessary once row counts outgrow the 500-row page below. |
| Server-side search, sort and filter | `get_all_*` takes `skip`/`limit` plus a few enum filters; everything else is client-side. |
| Real pagination | `client.js` asks for 500 rows and the backend caps at what it is given. Past that, tables silently truncate and the aggregates under-count. |
| A sequence for `order_ref` | `next_order_ref` reads the highest number then adds one. Two simultaneous orders can compute the same reference; the unique index turns that into a failed insert rather than a duplicate, but a Postgres sequence would remove the race. |
| Multi-item orders | One order is one line item. The stock rule is written to extend to line items without restructuring. |

Already built: `orders`, `inventory`, `carts` and `tasks` tables with real
Postgres enums; `source` on orders, leads, customers and campaigns; the stock
rule server-side in one transaction; `PATCH` and `DELETE` on every entity;
CORS; `owner_id` on orders; `delivered_at`, which is what finally makes real
cycle time derivable. Deals is deleted - model, schema, CRUD, router and table.

## Layout

```
src/
├── api/          one module per entity + client.js  <- the swap point
├── mocks/        seed-mirroring records, used when no API is configured
├── components/
│   ├── layout/   Sidebar, PageHeader, AppShell
│   ├── ui/       Button, Chips, Field, Drawer, ConfirmDialog, EmptyState
│   └── data/     DataTable, FormDrawer, Toolbar, StatTile, PipelineBar
├── pages/        one per screen (14) + NotFound
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
- **`delivery_status`** is a position in a sequence, so it reads as a
  sequential ramp that brightens as an order moves towards the door.
- **Categorical data** on charts uses the validated set in
  `src/lib/chartPalette.js`; magnitude uses a single hue, because different
  colours per row would imply different *kinds* of thing rather than different
  sizes of the same thing.

Ramps are checked with a palette validator, not by eye. An earlier
blue-and-amber set was thrown out because two adjacent steps measured deltaE
6.0 apart in normal vision, which is not a distinction at all.

### Screen identity

Each screen owns a hue, listed in `src/lib/screens.js`. `AppShell` sets it once
as the `--screen` custom property from the current route, and everything below
inherits it: page header, the tint on the working surface, row and column hover,
the selected row, the sorted-column underline, the sidebar's active item and the
brand mark. No component takes a theme prop.

| Screen | Hue | Screen | Hue |
|---|---|---|---|
| Overview | azure | Customers | emerald |
| Todo | coral | Organisations | periwinkle |
| Leads | cyan | Emails | orchid |
| Orders | green | Campaigns | rose |
| Returns | deep green | Insights | magenta |
| Logistics | violet | Statistics | amber |
| Inventory | yellow | People | lime |

Orders and Returns sit only 20 degrees apart **on purpose**: they are the same
table inverted, so the colour should say "sibling" rather than "unrelated
thing". Insights was moved to magenta because it shares a sidebar group with
Statistics - group-mates are the one case where two screens really are seen
side by side.

**Screen hues appear in chrome only, never inside a data cell.** That is what
keeps them from competing with the priority and status encodings above: those
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
