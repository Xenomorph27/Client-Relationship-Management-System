import { useMemo, useState } from 'react'
import { Plus, Undo2 } from 'lucide-react'
import { deleteOrder, listOrders, recordReturn, updateOrder } from '../api/orders.js'
import { listCustomers } from '../api/customers.js'
import { listInventory } from '../api/inventory.js'
import { listUsers } from '../api/users.js'
import { useAsync } from '../hooks/useAsync.js'
import { PageHeader, Panel, Screen } from '../components/layout/PageHeader.jsx'
import { DataTable } from '../components/data/DataTable.jsx'
import { FilterSelect, SearchInput, Toolbar } from '../components/data/Toolbar.jsx'
import { FormDrawer, optionsFrom } from '../components/data/FormDrawer.jsx'
import { Button } from '../components/ui/Button.jsx'
import { ItemImage } from '../components/ui/ItemImage.jsx'
import { DetailList, DetailRow, Drawer } from '../components/ui/Drawer.jsx'
import { ConfirmDialog } from '../components/ui/ConfirmDialog.jsx'
import { EmptyState } from '../components/ui/EmptyState.jsx'
import {
  DELIVERY_STATUSES,
  RETURN_TYPES,
  SOURCES,
  deliveryMeta,
  returnMeta,
  sourceMeta,
} from '../lib/domain.js'
import { formatAmount, formatDate } from '../lib/format.js'

const BLANK = {
  name: '',
  returns_order_id: '',
  inventory_id: '',
  price: '',
  return_type: 'refund',
  remarks: '',
  delivery_status: 'processing',
  source: 'website',
  customer_id: '',
  owner_id: '',
  delivery_due: '',
}

const toDateInput = (v) => (v ? String(v).slice(0, 10) : '')

export default function Returns() {
  const orders = useAsync(() => listOrders({ limit: 500 }), [])
  const customers = useAsync(() => listCustomers({ limit: 200 }), [])
  const users = useAsync(() => listUsers({ limit: 200 }), [])
  const inventory = useAsync(() => listInventory({ limit: 500 }), [])

  const [query, setQuery] = useState('')
  const [type, setType] = useState('')
  const [status, setStatus] = useState('')
  const [selected, setSelected] = useState(null)
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [busy, setBusy] = useState(false)

  const all = orders.data ?? []
  const rows = all.filter((o) => o.kind === 'return')
  const deliveries = all.filter((o) => o.kind === 'delivery')
  const customerName = (id) => customers.data?.find((c) => c.id === id)?.name ?? null
  const originalRef = (id) => all.find((o) => o.id === id)?.order_ref ?? null

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return rows.filter((row) => {
      if (type && row.return_type !== type) return false
      if (status && row.delivery_status !== status) return false
      if (!needle) return true
      return [row.order_ref, row.name, row.remarks, customerName(row.customer_id)]
        .filter(Boolean)
        .some((f) => f.toLowerCase().includes(needle))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, query, type, status, customers.data])

  const returnRate = deliveries.length === 0 ? null : Math.round((rows.length / deliveries.length) * 100)

  const columns = [
    {
      key: 'sl',
      header: '#',
      width: '4%',
      align: 'right',
      mono: true,
      sortable: false,
      render: (row) => <span className="text-ink-3">{filtered.indexOf(row) + 1}</span>,
    },
    {
      key: 'image',
      header: '',
      width: '5%',
      sortable: false,
      render: (row) => <ItemImage file={row.image} name={row.name} size={26} />,
    },
    { key: 'order_ref', header: 'Return ID', width: '9%', mono: true },
    { key: 'name', header: 'Item', width: '17%' },
    {
      key: 'returns_order_id',
      header: 'Original',
      width: '8%',
      mono: true,
      sortValue: (row) => originalRef(row.returns_order_id),
      render: (row) => (
        <span className="text-ink-3">{originalRef(row.returns_order_id) ?? '—'}</span>
      ),
    },
    {
      key: 'return_type',
      header: 'Wants',
      width: '12%',
      sortValue: (row) => RETURN_TYPES.indexOf(row.return_type),
      render: (row) => {
        const meta = returnMeta(row.return_type)
        return (
          <span className={meta.text} title={meta.restocks ? 'Goes back into stock' : 'Goes to the workshop, not back to stock'}>
            {meta.label}
          </span>
        )
      },
    },
    {
      key: 'remarks',
      header: 'Remarks',
      width: '22%',
      render: (row) =>
        row.remarks ? (
          <span className="text-ink-2" title={row.remarks}>
            {row.remarks}
          </span>
        ) : (
          <span className="text-ink-3">—</span>
        ),
    },
    {
      key: 'price',
      header: 'Value',
      width: '8%',
      align: 'right',
      mono: true,
      sortValue: (row) => Number(row.price ?? 0),
      render: (row) => formatAmount(row.price),
    },
    {
      key: 'delivery_status',
      header: 'Status',
      width: '11%',
      sortValue: (row) => DELIVERY_STATUSES.indexOf(row.delivery_status),
      render: (row) => {
        const meta = deliveryMeta(row.delivery_status)
        return (
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
        returns_order_id: asId(values.returns_order_id),
        inventory_id: asId(values.inventory_id),
        customer_id: asId(values.customer_id),
        owner_id: asId(values.owner_id),
        price: values.price == null ? null : String(values.price),
        delivery_due: values.delivery_due || null,
      }
      if (editing?.id) {
        await updateOrder(editing.id, payload)
      } else {
        // recordReturn applies the stock consequence: a refund puts the piece
        // back, an exchange swaps it, a modification sends it to the bench.
        await recordReturn({ ...payload, ordered_at: new Date().toISOString().replace('Z', '') })
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
        title="Returns"
        count={orders.loading ? null : rows.length}
        description={returnRate == null ? null : returnRate + '% of deliveries came back'}
        actions={
          <Button variant="primary" onClick={() => setEditing({ ...BLANK })}>
            <Plus size={14} />
            Log a return
          </Button>
        }
      />

      <Panel>
        <Toolbar count={filtered.length} total={rows.length}>
          <SearchInput value={query} onChange={setQuery} placeholder="Search item, remarks, customer" />
          <FilterSelect value={type} onChange={setType} label="Filter by outcome">
            <option value="">Any outcome</option>
            {RETURN_TYPES.map((t) => (
              <option key={t} value={t}>
                {returnMeta(t).label}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect value={status} onChange={setStatus} label="Filter by status">
            <option value="">Any status</option>
            {DELIVERY_STATUSES.map((s) => (
              <option key={s} value={s}>
                {deliveryMeta(s).label}
              </option>
            ))}
          </FilterSelect>
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
              icon={Undo2}
              title={rows.length === 0 ? 'Nothing has come back' : 'Nothing matches those filters'}
              body={
                rows.length === 0
                  ? 'No returns on record. That is the good outcome.'
                  : 'Widen the search or clear a filter.'
              }
            />
          }
        />
      </Panel>

      <Drawer
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.name ?? ''}
        subtitle={selected ? selected.order_ref + ' · ' + returnMeta(selected.return_type).label : ''}
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
                  returns_order_id: selected.returns_order_id ?? '',
                  inventory_id: selected.inventory_id ?? '',
                  customer_id: selected.customer_id ?? '',
                  owner_id: selected.owner_id ?? '',
                  remarks: selected.remarks ?? '',
                  delivery_due: toDateInput(selected.delivery_due),
                })
              }
            >
              Edit return
            </Button>
          </>
        }
      >
        {selected && (
          <>
            <div className="flex items-center gap-3 border-b border-rule px-4 py-3">
              <ItemImage file={selected.image} name={selected.name} size={56} rounded="rounded-panel" />
              <div className="min-w-0">
                <div className={'text-base ' + returnMeta(selected.return_type).text}>
                  {returnMeta(selected.return_type).label}
                </div>
                <div className="text-xs text-ink-3">
                  {returnMeta(selected.return_type).restocks
                    ? 'Goes back into stock'
                    : 'Goes to the workshop, not back to stock'}
                </div>
              </div>
            </div>

            <DetailList>
              <DetailRow label="Remarks">{selected.remarks}</DetailRow>
              <DetailRow label="Original order" mono>
                {originalRef(selected.returns_order_id)}
              </DetailRow>
              <DetailRow label="Value" mono>
                {formatAmount(selected.price)}
              </DetailRow>
              <DetailRow label="Status">
                <span style={{ color: deliveryMeta(selected.delivery_status).accent }}>
                  {deliveryMeta(selected.delivery_status).label}
                </span>
              </DetailRow>
              <DetailRow label="Source">
                <span style={{ color: sourceMeta(selected.source).accent }}>
                  {sourceMeta(selected.source).label}
                </span>
              </DetailRow>
              <DetailRow label="Customer">{customerName(selected.customer_id)}</DetailRow>
              <DetailRow label="Logged" mono>
                {formatDate(selected.ordered_at)}
              </DetailRow>
            </DetailList>
          </>
        )}
      </Drawer>

      <FormDrawer
        value={editing}
        busy={busy}
        onCancel={() => setEditing(null)}
        onSave={save}
        titleNew="Log a return"
        titleEdit="Edit return"
        submitNew="Log return"
        subtitle={
          editing?.id
            ? editing.order_ref
            : 'Stock is adjusted on save, according to what the customer wants'
        }
        width="max-w-lg"
        fields={[
          {
            name: 'returns_order_id',
            label: 'Original order',
            type: 'select',
            nullable: true,
            hint: 'Links the return to what was sold',
            options: [
              { value: '', label: 'Not linked to an order' },
              ...deliveries.map((d) => ({ value: d.id, label: d.order_ref + ' - ' + d.name })),
            ],
          },
          { name: 'name', label: 'Item', required: true, placeholder: 'What came back' },
          {
            name: 'return_type',
            label: 'What they want',
            type: 'select',
            span: 1,
            options: optionsFrom(RETURN_TYPES, (t) => returnMeta(t).label),
          },
          { name: 'price', label: 'Value', type: 'number', span: 1, placeholder: '0.00' },
          {
            name: 'delivery_status',
            label: 'Status',
            type: 'select',
            span: 1,
            options: optionsFrom(DELIVERY_STATUSES, (s) => deliveryMeta(s).label),
          },
          {
            name: 'source',
            label: 'Source',
            type: 'select',
            span: 1,
            options: optionsFrom(SOURCES, (s) => sourceMeta(s).label),
          },
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
            label: 'Handled by',
            type: 'select',
            span: 1,
            nullable: true,
            options: [
              { value: '', label: 'Unassigned' },
              ...(users.data ?? []).map((u) => ({ value: u.id, label: u.full_name })),
            ],
          },
          { name: 'delivery_due', label: 'Expected back', type: 'date', span: 1, nullable: true },
          {
            name: 'remarks',
            label: 'Remarks',
            type: 'textarea',
            rows: 3,
            hint: 'Why it came back, or what to change',
          },
        ]}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
        busy={busy}
        title={'Delete ' + (deleting?.order_ref ?? 'this return') + '?'}
        body="The return record is removed. Stock already adjusted is not reversed automatically."
      />
    </Screen>
  )
}
