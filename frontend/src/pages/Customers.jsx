import { useMemo, useState } from 'react'
import { Plus, Users } from 'lucide-react'
import { createCustomer, deleteCustomer, listCustomers, updateCustomer } from '../api/customers.js'
import { listOrders } from '../api/orders.js'
import { listEmails } from '../api/emails.js'
import { useAsync } from '../hooks/useAsync.js'
import { PageHeader, Panel, Screen } from '../components/layout/PageHeader.jsx'
import { DataTable } from '../components/data/DataTable.jsx'
import { PriorityFilter, SearchInput, Toolbar } from '../components/data/Toolbar.jsx'
import { FormDrawer, optionsFrom } from '../components/data/FormDrawer.jsx'
import { Button } from '../components/ui/Button.jsx'
import { PriorityChip } from '../components/ui/Chips.jsx'
import { DetailList, DetailRow, DetailSection, Drawer } from '../components/ui/Drawer.jsx'
import { ConfirmDialog } from '../components/ui/ConfirmDialog.jsx'
import { RelatedTasks } from '../components/data/RelatedTasks.jsx'
import { EmptyState } from '../components/ui/EmptyState.jsx'
import { PRIORITIES, priorityMeta } from '../lib/domain.js'
import { formatAmount, formatDate, formatDateShort, relativeTime } from '../lib/format.js'

const BLANK = { name: '', email: '', phone: '', priority_lvl: 'low_priority' }

export default function Customers() {
  const customers = useAsync(() => listCustomers({ limit: 200 }), [])
  const orders = useAsync(() => listOrders({ limit: 500 }), [])
  const emails = useAsync(() => listEmails({ limit: 200 }), [])

  const [query, setQuery] = useState('')
  const [priority, setPriority] = useState('')
  const [selected, setSelected] = useState(null)
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [busy, setBusy] = useState(false)

  const rows = customers.data ?? []
  const ordersFor = (id) =>
    (orders.data ?? []).filter((o) => o.customer_id === id && o.kind === 'delivery')
  const emailsFor = (id) => (emails.data ?? []).filter((e) => e.customer_id === id)

  const valueFor = (id) =>
    ordersFor(id).reduce((sum, order) => sum + Number(order.price ?? 0), 0)

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return rows.filter((row) => {
      if (priority && row.priority_lvl !== priority) return false
      if (!needle) return true
      return [row.name, row.email, row.phone]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(needle))
    })
  }, [rows, query, priority])

  const columns = [
    { key: 'name', header: 'Customer', width: '24%' },
    {
      key: 'email',
      header: 'Billing contact',
      width: '24%',
      render: (row) => <span className="text-ink-2">{row.email || '—'}</span>,
    },
    { key: 'phone', header: 'Phone', width: '13%', mono: true },
    {
      key: 'orders',
      header: 'Orders',
      width: '9%',
      align: 'right',
      mono: true,
      sortValue: (row) => ordersFor(row.id).length,
      render: (row) => ordersFor(row.id).length || <span className="text-ink-3">0</span>,
    },
    {
      key: 'value',
      header: 'Total value',
      width: '14%',
      align: 'right',
      mono: true,
      sortValue: (row) => valueFor(row.id),
      render: (row) => formatAmount(valueFor(row.id)),
    },
    {
      key: 'priority_lvl',
      header: 'Priority',
      width: '10%',
      sortValue: (row) => priorityMeta(row.priority_lvl).rank,
      render: (row) => <PriorityChip value={row.priority_lvl} />,
    },
    {
      key: 'created_at',
      header: 'Since',
      align: 'right',
      sortValue: (row) => new Date(row.created_at ?? 0).getTime(),
      render: (row) => <span className="text-ink-2">{relativeTime(row.created_at)}</span>,
    },
  ]

  async function save(values) {
    setBusy(true)
    try {
      if (editing?.id) await updateCustomer(editing.id, values)
      else await createCustomer(values)
      setEditing(null)
      customers.reload()
    } finally {
      setBusy(false)
    }
  }

  async function confirmDelete() {
    setBusy(true)
    try {
      await deleteCustomer(deleting.id)
      setDeleting(null)
      setSelected(null)
      customers.reload()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen>
      <PageHeader
        title="Customers"
        count={customers.loading ? null : rows.length}
        actions={
          <Button variant="primary" onClick={() => setEditing({ ...BLANK })}>
            <Plus size={14} />
            Add customer
          </Button>
        }
      />

      <Panel>
        <Toolbar count={filtered.length} total={rows.length}>
          <SearchInput value={query} onChange={setQuery} placeholder="Search customers" />
          <PriorityFilter value={priority} onChange={setPriority} />
        </Toolbar>

        <DataTable
          columns={columns}
          rows={filtered}
          loading={customers.loading}
          error={customers.error}
          onRetry={customers.reload}
          onRowClick={setSelected}
          activeId={selected?.id}
          initialSort={{ key: 'value', dir: 'desc' }}
          empty={
            <EmptyState
              icon={Users}
              title={rows.length === 0 ? 'No customers yet' : 'Nothing matches those filters'}
              body={
                rows.length === 0
                  ? 'A customer is an account that has bought something.'
                  : 'Widen the search or clear the priority filter.'
              }
              action={
                rows.length === 0 ? (
                  <Button variant="primary" onClick={() => setEditing({ ...BLANK })}>
                    Add the first customer
                  </Button>
                ) : (
                  <Button
                    onClick={() => {
                      setQuery('')
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
        subtitle={selected ? formatAmount(valueFor(selected.id)) + ' across all orders' : ''}
        footer={
          <>
            <Button variant="dangerGhost" onClick={() => setDeleting(selected)}>
              Delete
            </Button>
            <Button variant="primary" onClick={() => setEditing({ ...selected })}>
              Edit customer
            </Button>
          </>
        }
      >
        {selected && (
          <>
            <DetailList>
              <DetailRow label="Priority">
                <PriorityChip value={selected.priority_lvl} />
              </DetailRow>
              <DetailRow label="Billing contact">
                {selected.email && (
                  <a className="text-accent hover:underline" href={'mailto:' + selected.email}>
                    {selected.email}
                  </a>
                )}
              </DetailRow>
              <DetailRow label="Phone" mono>
                {selected.phone}
              </DetailRow>
              <DetailRow label="Customer since" mono>
                {formatDate(selected.created_at)}
              </DetailRow>
            </DetailList>

            <RelatedTasks kind="customer" id={selected.id} />

            <DetailSection title={'Orders (' + ordersFor(selected.id).length + ')'}>
              {ordersFor(selected.id).length === 0 ? (
                <p className="px-4 pb-3 text-ink-3">No orders recorded against this customer.</p>
              ) : (
                <ul className="divide-y divide-rule/70 border-t border-rule/70">
                  {ordersFor(selected.id).map((order) => (
                    <li key={order.id} className="flex items-center gap-3 px-4 py-2">
                      <span className="min-w-0 flex-1 truncate text-ink">{order.name}</span>
                      <span className="text-ink-3">{order.order_ref}</span>
                      <span className="tnum w-20 text-right text-ink">
                        {formatAmount(order.price)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </DetailSection>

            <DetailSection title={'Emails (' + emailsFor(selected.id).length + ')'}>
              {emailsFor(selected.id).length === 0 ? (
                <p className="px-4 pb-3 text-ink-3">Nothing sent to this customer yet.</p>
              ) : (
                <ul className="divide-y divide-rule/70 border-t border-rule/70">
                  {emailsFor(selected.id).map((email) => (
                    <li key={email.id} className="flex items-baseline gap-3 px-4 py-2">
                      <span className="min-w-0 flex-1 truncate text-ink">{email.subject}</span>
                      <span className="tnum shrink-0 text-xs text-ink-3">
                        {formatDateShort(email.sent_at)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </DetailSection>
          </>
        )}
      </Drawer>

      <FormDrawer
        value={editing}
        busy={busy}
        onCancel={() => setEditing(null)}
        onSave={save}
        titleNew="Add customer"
        titleEdit="Edit customer"
        submitNew="Add customer"
        subtitle={editing?.id ? editing.name : 'An account that has bought something'}
        fields={[
          { name: 'name', label: 'Customer name', required: true, placeholder: 'Company name' },
          { name: 'email', label: 'Billing contact', type: 'email', placeholder: 'billing@company.com' },
          { name: 'phone', label: 'Phone', span: 1, placeholder: '555-0100' },
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
        title={'Delete ' + (deleting?.name ?? 'this customer') + '?'}
        body="The customer record is removed. Their orders and emails stay, but lose this link."
      />
    </Screen>
  )
}
