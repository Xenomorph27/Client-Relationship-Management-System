import { useMemo, useState } from 'react'
import { ShoppingCart } from 'lucide-react'
import { PROSPECT_MIN_ITEMS, listCarts } from '../api/carts.js'
import { listOrders } from '../api/orders.js'
import { listCustomers } from '../api/customers.js'
import { useAsync } from '../hooks/useAsync.js'
import { PageHeader, Panel, Screen } from '../components/layout/PageHeader.jsx'
import { FilterSelect, Toolbar } from '../components/data/Toolbar.jsx'
import { ItemImage } from '../components/ui/ItemImage.jsx'
import { EmptyState, ErrorState } from '../components/ui/EmptyState.jsx'
import { LoadingPanel } from '../components/ui/Spinner.jsx'
import { SOURCES, returnMeta, sourceMeta } from '../lib/domain.js'
import { formatAmount, formatCompact, relativeTime } from '../lib/format.js'

/**
 * The commercial funnel end to end: who is close to buying, what converted,
 * and what came back. Every card carries its source, so the board reads as
 * channel performance rather than three unrelated lists.
 *
 * Prospects are fed by carts. Those are mock today, shaped the way a storefront
 * would send them, so pointing this at the live site later is a data swap
 * rather than a redesign.
 */
function SourceDot({ source }) {
  return (
    <span
      aria-hidden="true"
      className="h-1.5 w-1.5 shrink-0 rounded-full"
      style={{ backgroundColor: sourceMeta(source).accent }}
    />
  )
}

function Column({ title, subtitle, accent, count, value, children }) {
  return (
    <section className="surface-screen flex min-w-[300px] flex-1 flex-col">
      <header className="px-4 pt-4 pb-2">
        <div className="flex items-baseline gap-2">
          <h2 className="text-sm text-ink">{title}</h2>
          <span className="tnum ml-auto text-xs text-ink-3">{count}</span>
        </div>
        <div className="mt-0.5 flex items-baseline gap-2">
          <span className="text-xs text-ink-3">{subtitle}</span>
          {value != null && (
            <span className="tnum ml-auto text-xs text-ink-2">{formatCompact(value)}</span>
          )}
        </div>
        <div className="mt-2 h-[3px] w-full rounded-full" style={{ backgroundColor: accent }} />
      </header>
      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-2 pb-4 pt-1">{children}</div>
    </section>
  )
}

export default function Insights() {
  const carts = useAsync(() => listCarts({ limit: 200 }), [])
  const orders = useAsync(() => listOrders({ limit: 500 }), [])
  const customers = useAsync(() => listCustomers({ limit: 200 }), [])

  const [source, setSource] = useState('')
  const customerName = (id) => customers.data?.find((c) => c.id === id)?.name ?? 'Unknown'
  const bySource = (row) => (source ? row.source === source : true)

  const prospects = (carts.data ?? [])
    .filter((c) => c.item_count >= PROSPECT_MIN_ITEMS)
    .filter(bySource)
    .sort((a, b) => Number(b.value) - Number(a.value))

  const won = (orders.data ?? []).filter((o) => o.kind === 'delivery').filter(bySource)
  const returned = (orders.data ?? []).filter((o) => o.kind === 'return').filter(bySource)

  const sum = (rows) => rows.reduce((t, r) => t + Number(r.value ?? r.price ?? 0), 0)

  const loading = carts.loading || orders.loading
  const error = carts.error ?? orders.error

  const conversion = useMemo(() => {
    const top = prospects.length + won.length
    return top === 0 ? null : Math.round((won.length / top) * 100)
  }, [prospects.length, won.length])

  return (
    <Screen>
      <PageHeader
        title="Insights"
        description={
          conversion == null
            ? 'Carts, orders and returns in one line'
            : conversion + '% of interested buyers converted'
        }
      />

      <Panel className="overflow-hidden">
        <Toolbar
          count={prospects.length + won.length + returned.length}
          total={(orders.data ?? []).length + (carts.data ?? []).length}
        >
          <FilterSelect value={source} onChange={setSource} label="Filter by source">
            <option value="">Every source</option>
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                {sourceMeta(s).label}
              </option>
            ))}
          </FilterSelect>
        </Toolbar>

        {error ? (
          <ErrorState error={error} onRetry={orders.reload} />
        ) : loading ? (
          <LoadingPanel label="Reading the funnel" />
        ) : (
          <div className="flex min-h-0 flex-1 gap-px overflow-x-auto bg-rule">
            <Column
              title="Prospects"
              subtitle={'Carts with ' + PROSPECT_MIN_ITEMS + ' or more items'}
              accent="#6dc8ec"
              count={prospects.length}
              value={sum(prospects)}
            >
              {prospects.map((cart) => (
                <article
                  key={cart.id}
                  className="lift rounded-control bg-raised px-2.5 py-2 ring-1 ring-inset ring-rule"
                >
                  <div className="flex items-start gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm text-ink">
                      {customerName(cart.customer_id)}
                    </span>
                    <span className="tnum shrink-0 text-sm text-ink">
                      {formatAmount(cart.value)}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2 text-2xs text-ink-3">
                    <SourceDot source={cart.source} />
                    <span>{sourceMeta(cart.source).label}</span>
                    <span className="ml-auto">{cart.item_count} items</span>
                    <span>{relativeTime(cart.updated_at)}</span>
                  </div>
                </article>
              ))}
              {prospects.length === 0 && (
                <EmptyState
                  icon={ShoppingCart}
                  title="No carts waiting"
                  body="Nobody is mid-purchase right now."
                />
              )}
            </Column>

            <Column
              title="Closed won"
              subtitle="Everything ordered"
              accent="#00e093"
              count={won.length}
              value={sum(won)}
            >
              {won.map((order) => (
                <article
                  key={order.id}
                  className="lift rounded-control bg-raised px-2.5 py-2 ring-1 ring-inset ring-rule"
                >
                  <div className="flex items-start gap-2">
                    <ItemImage file={order.image} name={order.name} size={26} />
                    <span className="min-w-0 flex-1 truncate text-sm text-ink">{order.name}</span>
                    <span className="tnum shrink-0 text-sm text-ink">
                      {formatAmount(order.price)}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2 text-2xs text-ink-3">
                    <SourceDot source={order.source} />
                    <span>{sourceMeta(order.source).label}</span>
                    <span className="ml-auto truncate">{customerName(order.customer_id)}</span>
                  </div>
                </article>
              ))}
            </Column>

            <Column
              title="Returns"
              subtitle="What came back, and why"
              accent="#ff2d55"
              count={returned.length}
              value={sum(returned)}
            >
              {returned.map((order) => (
                <article
                  key={order.id}
                  className="lift rounded-control bg-raised px-2.5 py-2 ring-1 ring-inset ring-rule"
                >
                  <div className="flex items-start gap-2">
                    <ItemImage file={order.image} name={order.name} size={26} />
                    <span className="min-w-0 flex-1 truncate text-sm text-ink">{order.name}</span>
                    <span className={'shrink-0 text-2xs ' + returnMeta(order.return_type).text}>
                      {returnMeta(order.return_type).short}
                    </span>
                  </div>
                  {order.remarks && (
                    <p className="mt-1 line-clamp-2 text-xs text-ink-3">{order.remarks}</p>
                  )}
                  <div className="mt-1.5 flex items-center gap-2 text-2xs text-ink-3">
                    <SourceDot source={order.source} />
                    <span>{sourceMeta(order.source).label}</span>
                    <span className="ml-auto truncate">{customerName(order.customer_id)}</span>
                  </div>
                </article>
              ))}
              {returned.length === 0 && (
                <p className="px-1 py-3 text-xs text-ink-3">Nothing came back.</p>
              )}
            </Column>
          </div>
        )}
      </Panel>
    </Screen>
  )
}
