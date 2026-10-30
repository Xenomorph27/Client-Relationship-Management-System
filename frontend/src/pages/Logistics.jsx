import { useMemo, useState } from 'react'
import { Truck } from 'lucide-react'
import { listOrders, setDeliveryStatus } from '../api/orders.js'
import { listCustomers } from '../api/customers.js'
import { useAsync } from '../hooks/useAsync.js'
import { PageHeader, Panel, Screen } from '../components/layout/PageHeader.jsx'
import { OrderCard } from '../components/data/OrderCard.jsx'
import { FilterSelect, Toolbar } from '../components/data/Toolbar.jsx'
import { DetailList, DetailRow, Drawer } from '../components/ui/Drawer.jsx'
import { EmptyState, ErrorState } from '../components/ui/EmptyState.jsx'
import { LoadingPanel } from '../components/ui/Spinner.jsx'
import { ItemImage } from '../components/ui/ItemImage.jsx'
import {
  DELIVERY_STATUSES,
  ORDER_KINDS,
  SOURCES,
  deliveryMeta,
  kindMeta,
  returnMeta,
  sourceMeta,
} from '../lib/domain.js'
import { formatAmount, formatCompact, formatDate } from '../lib/format.js'
import { ShopOrderDetails } from '../components/data/ShopOrderDetails.jsx'

/**
 * The fulfilment board.
 *
 * Two lanes - what is going out, and what is coming back - each split across
 * the four statuses. Both lanes read the SAME orders table that the Orders and
 * Returns screens read, so the board and the ledgers cannot drift apart.
 */
export default function Logistics() {
  const orders = useAsync(() => listOrders({ limit: 500 }), [])
  const customers = useAsync(() => listCustomers({ limit: 200 }), [])

  const [source, setSource] = useState('')
  const [selected, setSelected] = useState(null)
  const [dragOver, setDragOver] = useState(null)

  const rows = (orders.data ?? []).filter((o) => (source ? o.source === source : true))
  const customerName = (id) => customers.data?.find((c) => c.id === id)?.name ?? null

  const lanes = useMemo(
    () =>
      ORDER_KINDS.map((kind) => {
        const inLane = rows.filter((o) => o.kind === kind)
        return {
          kind,
          label: kindMeta(kind).plural,
          count: inLane.length,
          value: inLane.reduce((sum, o) => sum + Number(o.price ?? 0), 0),
          columns: DELIVERY_STATUSES.map((status) => {
            const items = inLane.filter((o) => o.delivery_status === status)
            return {
              status,
              items,
              value: items.reduce((sum, o) => sum + Number(o.price ?? 0), 0),
            }
          }),
        }
      }),
    [rows],
  )

  async function moveTo(order, status) {
    if (!order || order.delivery_status === status) return
    await setDeliveryStatus(order.id, status)
    orders.reload()
  }

  return (
    <Screen>
      <PageHeader
        title="Logistics"
        count={orders.loading ? null : rows.length}
        description="Where everything is, going out and coming back"
      />

      <Panel className="overflow-y-auto">
        <Toolbar count={rows.length} total={(orders.data ?? []).length}>
          <FilterSelect value={source} onChange={setSource} label="Filter by source">
            <option value="">Any source</option>
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                {sourceMeta(s).label}
              </option>
            ))}
          </FilterSelect>
        </Toolbar>

        {orders.error ? (
          <ErrorState error={orders.error} onRetry={orders.reload} />
        ) : orders.loading ? (
          <LoadingPanel label="Loading the board" />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Truck}
            title="Nothing in transit"
            body="Orders appear here as soon as they are taken."
          />
        ) : (
          lanes.map((lane) => (
            <section key={lane.kind} className="border-b border-rule">
              <header className="flex items-baseline gap-3 px-4 pt-4 pb-2">
                <h2 className="text-sm text-ink">{lane.label}</h2>
                <span className="tnum text-xs text-ink-3">{lane.count}</span>
                <span className="tnum text-xs text-ink-2">{formatCompact(lane.value)}</span>
              </header>

              <div className="overflow-x-auto pb-3">
                <div className="flex min-w-max gap-px bg-rule">
                  {lane.columns.map((column) => {
                    const meta = deliveryMeta(column.status)
                    const key = lane.kind + ':' + column.status
                    const isTarget = dragOver === key
                    return (
                      <section
                        key={column.status}
                        onDragOver={(event) => {
                          event.preventDefault()
                          setDragOver(key)
                        }}
                        onDragLeave={() => setDragOver((k) => (k === key ? null : k))}
                        onDrop={(event) => {
                          event.preventDefault()
                          setDragOver(null)
                          const id = Number(event.dataTransfer.getData('text/plain'))
                          moveTo(rows.find((o) => o.id === id), column.status)
                        }}
                        className={
                          'surface-screen flex w-[268px] shrink-0 flex-col transition-colors ' +
                          (isTarget ? '' : 'hover-column')
                        }
                        style={
                          isTarget
                            ? {
                                backgroundColor:
                                  'color-mix(in oklab, ' + meta.accent + ' 16%, var(--color-panel))',
                              }
                            : undefined
                        }
                      >
                        <header className="px-3 pt-3 pb-2">
                          <div className="flex items-baseline gap-2">
                            <span
                              aria-hidden="true"
                              className="h-2 w-2 shrink-0 rounded-full"
                              style={{ backgroundColor: meta.accent }}
                            />
                            <h3 className="text-sm text-ink">{meta.label}</h3>
                            <span className="tnum ml-auto text-xs text-ink-3">
                              {column.items.length}
                            </span>
                          </div>
                          <div className="tnum mt-1 pl-4 text-xs text-ink-3">
                            {formatCompact(column.value)}
                          </div>
                          <div
                            className="mt-2 h-[3px] w-full rounded-full"
                            style={{ backgroundColor: meta.accent }}
                          />
                        </header>

                        <div className="min-h-[90px] space-y-1.5 px-2 pb-3 pt-1">
                          {column.items.map((order) => (
                            <OrderCard
                              key={order.id}
                              order={order}
                              account={customerName(order.customer_id)}
                              selected={selected?.id === order.id}
                              onOpen={() => setSelected(order)}
                            />
                          ))}
                          {column.items.length === 0 && (
                            <p className="px-1 py-3 text-xs text-ink-3">
                              {isTarget ? 'Drop to move here' : 'Nothing here'}
                            </p>
                          )}
                        </div>
                      </section>
                    )
                  })}
                </div>
              </div>
            </section>
          ))
        )}
      </Panel>

      <Drawer
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.name ?? ''}
        subtitle={selected ? selected.order_ref + ' · ' + kindMeta(selected.kind).label : ''}
      >
        {selected && (
          <>
            <div className="flex items-center gap-3 border-b border-rule px-4 py-3">
              <ItemImage file={selected.image} name={selected.name} size={56} rounded="rounded-panel" />
              <div className="tnum text-base text-ink">{formatAmount(selected.price)}</div>
            </div>
            <DetailList>
              <DetailRow label="Status">
                <span style={{ color: deliveryMeta(selected.delivery_status).accent }}>
                  {deliveryMeta(selected.delivery_status).label}
                </span>
              </DetailRow>
              {selected.kind === 'return' && (
                <DetailRow label="Wants">
                  <span className={returnMeta(selected.return_type).text}>
                    {returnMeta(selected.return_type).label}
                  </span>
                </DetailRow>
              )}
              <DetailRow label="Remarks">{selected.remarks}</DetailRow>
              <DetailRow label="Source">
                <span style={{ color: sourceMeta(selected.source).accent }}>
                  {sourceMeta(selected.source).label}
                </span>
              </DetailRow>
              <DetailRow label="Customer">{customerName(selected.customer_id)}</DetailRow>
              <DetailRow label="Ordered" mono>
                {formatDate(selected.ordered_at)}
              </DetailRow>
              <DetailRow label="Due" mono>
                {formatDate(selected.delivery_due)}
              </DetailRow>
            </DetailList>
            <ShopOrderDetails webOrderId={selected.web_order_id ?? null} />
          </>
        )}
      </Drawer>
    </Screen>
  )
}
