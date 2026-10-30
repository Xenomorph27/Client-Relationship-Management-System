import { useMemo, useState } from 'react'
import { Package, Plus } from 'lucide-react'
import { balanceOf, deleteOrder, listOrders, placeOrder, updateOrder } from '../api/orders.js'
import { listCustomers } from '../api/customers.js'
import { listInventory } from '../api/inventory.js'
import { listUsers } from '../api/users.js'
import { useAsync } from '../hooks/useAsync.js'
import { PageHeader, Panel, Screen } from '../components/layout/PageHeader.jsx'
import { DataTable } from '../components/data/DataTable.jsx'
import { FilterSelect, PriorityFilter, SearchInput, Toolbar } from '../components/data/Toolbar.jsx'
import { FormDrawer, optionsFrom } from '../components/data/FormDrawer.jsx'
import { Button } from '../components/ui/Button.jsx'
import { PriorityChip } from '../components/ui/Chips.jsx'
import { ItemImage } from '../components/ui/ItemImage.jsx'
import { DetailList, DetailRow, Drawer } from '../components/ui/Drawer.jsx'
import { ConfirmDialog } from '../components/ui/ConfirmDialog.jsx'
import { EmptyState } from '../components/ui/EmptyState.jsx'
import {
  DELIVERY_STATUSES,
  PRIORITIES,
  SOURCES,
  deliveryMeta,
  priorityMeta,
  sourceMeta,
  stockMeta,
} from '../lib/domain.js'
import { formatAmount, formatAmountExact, formatDate, relativeTime } from '../lib/format.js'
import { ShopOrderDetails } from '../components/data/ShopOrderDetails.jsx'

const BLANK = {
  name: '',
  inventory_id: '',
  price: '',
  deposit_paid: '',
  delivery_status: 'processing',
  source: 'website',
  customer_id: '',
  owner_id: '',
  priority_lvl: 'medium_priority',
  delivery_due: '',
}

const toDateInput = (v) => (v ? String(v).slice(0, 10) : '')

export default function Orders() {
  const orders = useAsync(() => listOrders({ limit: 500 }), [])
  const customers = useAsync(() => listCustomers({ limit: 200 }), [])
  const users = useAsync(() => listUsers({ limit: 200 }), [])
  const inventory = useAsync(() => listInventory({ limit: 500 }), [])

  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [source, setSource] = useState('')
  const [priority, setPriority] = useState('')
  const [selected, setSelected] = useState(null)
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [busy, setBusy] = useState(false)

  // Deliveries only. Returns have their own screen; both read this table.
  const rows = (orders.data ?? []).filter((o) => o.kind === 'delivery')
  const customerName = (id) => customers.data?.find((c) => c.id === id)?.name ?? null
  const ownerName = (id) => users.data?.find((u) => u.id === id)?.full_name ?? null
  const products = (inventory.data ?? []).filter((i) => i.item_class === 'product')

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return rows.filter((order) => {
      if (status && order.delivery_status !== status) return false
      if (source && order.source !== source) return false
      if (priority && order.priority_lvl !== priority) return false
      if (!needle) return true
      return [order.order_ref, order.name, customerName(order.customer_id)]
        .filter(Boolean)
        .some((f) => f.toLowerCase().includes(needle))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, query, status, source, priority, customers.data])

  const outstanding = rows.reduce((sum, o) => sum + balanceOf(o), 0)

  const columns = [
    {
      // Sl no is the row's position in the current view, computed here rather
      // than stored. A stored serial develops gaps the first time a row is
      // deleted, and lies the first time the table is re-sorted.
      key: 'sl',
      header: '#',
      width: '4%',
      align: 'right',
      mono: true,
      sortable: false,
      render: (row) => (
        <span className="text-ink-3">{filtered.indexOf(row) + 1}</span>
      ),
    },
    {
      key: 'image',
      header: '',
      width: '5%',
      sortable: false,
      render: (row) => <ItemImage file={row.image} name={row.name} size={26} />,
    },
    { key: 'order_ref', header: 'Order ID', width: '9%', mono: true },
    { key: 'name', header: 'Item', width: '20%' },
    {
      key: 'customer_id',
      header: 'Customer',
      width: '13%',
      sortValue: (row) => customerName(row.customer_id),
      render: (row) => customerName(row.customer_id) ?? <span className="text-ink-3">—</span>,
    },
    {
      key: 'price',
      header: 'Price',
      width: '9%',
      align: 'right',
      mono: true,
      sortValue: (row) => Number(row.price ?? 0),
      render: (row) => formatAmount(row.price),
    },
    {
      key: 'source',
      header: 'Source',
      width: '9%',
      sortValue: (row) => sourceMeta(row.source).label,
      render: (row) => (
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: sourceMeta(row.source).accent }}
          />
          <span className="text-ink-2">{sourceMeta(row.source).label}</span>
        </span>
      ),
    },
    {
      key: 'ordered_at',
      header: 'Ordered',
      width: '9%',
      mono: true,
      sortValue: (row) => new Date(row.ordered_at ?? 0).getTime(),
      render: (row) => <span className="text-ink-2">{formatDate(row.ordered_at)}</span>,
    },
    {
      key: 'delivery_due',
      header: 'Delivery',
      width: '9%',
      mono: true,
      sortValue: (row) => new Date(row.delivery_due ?? 0).getTime(),
      render: (row) => <span className="text-ink-2">{formatDate(row.delivery_due)}</span>,
    },
    {
      key: 'delivery_status',
      header: 'Status',
      width: '13%',
      sortValue: (row) => DELIVERY_STATUSES.indexOf(row.delivery_status),
      render: (row) => {
        const meta = deliveryMeta(row.delivery_status)
        return (
          <span className="inline-flex items-center gap-2">
            <span
              className="inline-flex h-[19px] items-center rounded-control px-1.5 text-2xs"
              style={{
                color: meta.accent,
                backgroundColor: meta.accent + '1f',
                boxShadow: 'inset 0 0 0 1px ' + meta.accent + '3d',
              }}
            >
              {meta.label}
            </span>
            {row.stock_status === 'shortfall' && (
              <span
                title="Accepted with nothing in stock - needs making"
                className={'inline-flex h-[19px] items-center rounded-control px-1.5 text-2xs ' + stockMeta('shortfall').chip}
              >
                Make
              </span>
            )}
          </span>
        )
      },
    },
  ]

  async function save(values) {
    setBusy(true)
    try {
      const asId = (v) => (v === '' || v == null ? null : Number(v))
      const payload = {
        ...values,
        inventory_id: asId(values.inventory_id),
        customer_id: asId(values.customer_id),
        owner_id: asId(values.owner_id),
        price: values.price == null ? null : String(values.price),
        deposit_paid: values.deposit_paid == null || values.deposit_paid === '' ? '0.00' : String(values.deposit_paid),
        delivery_due: values.delivery_due || null,
      }
      if (editing?.id) {
        await updateOrder(editing.id, payload)
      } else {
        // placeOrder runs the stock rule: take it off the shelf if it is
        // there, otherwise accept the order anyway and raise a shortfall.
        await placeOrder({ ...payload, ordered_at: new Date().toISOString().replace('Z', '') })
      }
      setEditing(null)
      orders.reload()
      inventory.reload()
    } finally {
      setBusy(false)
    }
  }

  async function confirmDelete() {
    setBusy(true)
    try {
      await deleteOrder(deleting.id)
      setDeleting(null)
      setSelected(null)
      orders.reload()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen>
      <PageHeader
        title="Orders"
        count={orders.loading ? null : rows.length}
        description={outstanding > 0 ? formatAmount(outstanding) + ' outstanding' : 'All paid up'}
        actions={
          <Button variant="primary" onClick={() => setEditing({ ...BLANK })}>
            <Plus size={14} />
            New order
          </Button>
        }
      />

      <Panel>
        <Toolbar count={filtered.length} total={rows.length}>
          <SearchInput value={query} onChange={setQuery} placeholder="Search order, item, customer" />
          <FilterSelect value={status} onChange={setStatus} label="Filter by status">
            <option value="">Any status</option>
            {DELIVERY_STATUSES.map((s) => (
              <option key={s} value={s}>
                {deliveryMeta(s).label}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect value={source} onChange={setSource} label="Filter by source">
            <option value="">Any source</option>
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                {sourceMeta(s).label}
              </option>
            ))}
          </FilterSelect>
          <PriorityFilter value={priority} onChange={setPriority} />
        </Toolbar>

        <DataTable
          columns={columns}
          rows={filtered}
          loading={orders.loading}
          error={orders.error}
          onRetry={orders.reload}
          onRowClick={setSelected}
          activeId={selected?.id}
          initialSort={{ key: 'ordered_at', dir: 'desc' }}
          empty={
            <EmptyState
              icon={Package}
              title={rows.length === 0 ? 'No orders yet' : 'Nothing matches those filters'}
              body={
                rows.length === 0
                  ? 'An order is a piece someone has bought and is waiting on.'
                  : 'Widen the search or clear a filter.'
              }
              action={
                rows.length === 0 ? (
                  <Button variant="primary" onClick={() => setEditing({ ...BLANK })}>
                    Take the first order
                  </Button>
                ) : (
                  <Button
                    onClick={() => {
                      setQuery('')
                      setStatus('')
                      setSource('')
                      setPriority('')
                    }}
                  >
                    Clear filters
                  </Button>
                )
              }
            />
          }
        />
      </Panel>

      <Drawer
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.name ?? ''}
        subtitle={selected ? selected.order_ref + ' · ' + (customerName(selected.customer_id) ?? 'No customer') : ''}
        footer={
          <>
            <Button variant="dangerGhost" onClick={() => setDeleting(selected)}>
              Delete
            </Button>
            <Button
              variant="primary"
              onClick={() =>
                setEditing({
                  ...selected,
                  inventory_id: selected.inventory_id ?? '',
                  customer_id: selected.customer_id ?? '',
                  owner_id: selected.owner_id ?? '',
                  delivery_due: toDateInput(selected.delivery_due),
                })
              }
            >
              Edit order
            </Button>
          </>
        }
      >
        {selected && (
          <>
            <div className="flex items-center gap-3 border-b border-rule px-4 py-3">
              <ItemImage file={selected.image} name={selected.name} size={56} rounded="rounded-panel" />
              <div className="min-w-0">
                <div className="tnum text-base text-ink">{formatAmountExact(selected.price)}</div>
                <div className="text-xs text-ink-3">
                  {formatAmountExact(selected.deposit_paid)} paid ·{' '}
                  <span className={balanceOf(selected) > 0 ? 'text-heat-3' : 'text-won'}>
                    {balanceOf(selected) > 0
                      ? formatAmount(balanceOf(selected)) + ' outstanding'
                      : 'settled'}
                  </span>
                </div>
              </div>
            </div>

            <DetailList>
              <DetailRow label="Status">
                <span style={{ color: deliveryMeta(selected.delivery_status).accent }}>
                  {deliveryMeta(selected.delivery_status).label}
                </span>
              </DetailRow>
              <DetailRow label="Stock">
                <span className={stockMeta(selected.stock_status).text}>
                  {stockMeta(selected.stock_status).label}
                </span>
              </DetailRow>
              <DetailRow label="Priority">
                <PriorityChip value={selected.priority_lvl} />
              </DetailRow>
              <DetailRow label="Source">
                <span style={{ color: sourceMeta(selected.source).accent }}>
                  {sourceMeta(selected.source).label}
                </span>
              </DetailRow>
              <DetailRow label="Customer">{customerName(selected.customer_id)}</DetailRow>
              <DetailRow label="Made by">{ownerName(selected.owner_id)}</DetailRow>
              <DetailRow label="Ordered" mono>
                {formatDate(selected.ordered_at)}
                <span className="ml-2 text-ink-3">{relativeTime(selected.ordered_at)}</span>
              </DetailRow>
              <DetailRow label="Delivery due" mono>
                {formatDate(selected.delivery_due)}
              </DetailRow>
              <DetailRow label="Delivered" mono>
                {selected.delivered_at ? formatDate(selected.delivered_at) : null}
              </DetailRow>
            </DetailList>
            <ShopOrderDetails webOrderId={selected.web_order_id ?? null} />
          </>
        )}
      </Drawer>

      <FormDrawer
        value={editing}
        busy={busy}
        onCancel={() => setEditing(null)}
        onSave={save}
        titleNew="New order"
        titleEdit="Edit order"
        submitNew="Place order"
        subtitle={
          editing?.id
            ? editing.order_ref
            : 'Stock is checked on save; if the piece is not on the shelf the order still stands'
        }
        width="max-w-lg"
        fields={[
          {
            name: 'inventory_id',
            label: 'Piece',
            type: 'select',
            nullable: true,
            hint: 'Links the order to stock',
            options: [
              { value: '', label: 'Not from the catalogue' },
              ...products.map((p) => ({
                value: p.id,
                label: p.name + '  (' + p.quantity + ' in stock)',
              })),
            ],
          },
          { name: 'name', label: 'Item name', required: true, placeholder: 'Oak dining table, 6 seat' },
          { name: 'price', label: 'Price', type: 'number', span: 1, placeholder: '0.00' },
          { name: 'deposit_paid', label: 'Deposit paid', type: 'number', span: 1, placeholder: '0.00' },
          {
            name: 'customer_id',
            label: 'Customer',
            type: 'select',
            span: 1,
            nullable: true,
            options: [
              { value: '', label: 'None' },
              ...(customers.data ?? []).map((c) => ({ value: c.id, label: c.name })),
            ],
          },
          {
            name: 'owner_id',
            label: 'Made by',
            type: 'select',
            span: 1,
            nullable: true,
            options: [
              { value: '', label: 'Unassigned' },
              ...(users.data ?? []).map((u) => ({ value: u.id, label: u.full_name })),
            ],
          },
          {
            name: 'source',
            label: 'Source',
            type: 'select',
            span: 1,
            options: optionsFrom(SOURCES, (s) => sourceMeta(s).label),
          },
          {
            name: 'delivery_status',
            label: 'Status',
            type: 'select',
            span: 1,
            options: optionsFrom(DELIVERY_STATUSES, (s) => deliveryMeta(s).label),
          },
          { name: 'delivery_due', label: 'Delivery due', type: 'date', span: 1, nullable: true },
          {
            name: 'priority_lvl',
            label: 'Priority',
            type: 'select',
            span: 1,
            options: optionsFrom(PRIORITIES, (p) => priorityMeta(p).label),
          },
        ]}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
        busy={busy}
        title={'Delete ' + (deleting?.order_ref ?? 'this order') + '?'}
        body="The order is removed. Stock already taken off the shelf is not put back automatically."
      />
    </Screen>
  )
}
