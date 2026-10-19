import { useMemo, useState } from 'react'
import { Plus, Users } from 'lucide-react'
import { createUser, deleteUser, listUsers, updateUser } from '../api/users.js'
import { useAsync } from '../hooks/useAsync.js'
import { PageHeader, Panel, Screen } from '../components/layout/PageHeader.jsx'
import { DataTable } from '../components/data/DataTable.jsx'
import { PriorityFilter, SearchInput, Toolbar } from '../components/data/Toolbar.jsx'
import { FormDrawer, optionsFrom } from '../components/data/FormDrawer.jsx'
import { Button } from '../components/ui/Button.jsx'
import { PriorityChip } from '../components/ui/Chips.jsx'
import { DetailList, DetailRow, Drawer } from '../components/ui/Drawer.jsx'
import { ConfirmDialog } from '../components/ui/ConfirmDialog.jsx'
import { EmptyState } from '../components/ui/EmptyState.jsx'
import { PRIORITIES, priorityMeta } from '../lib/domain.js'
import { formatDate, initialsOf, relativeTime } from '../lib/format.js'

const BLANK = { username: '', full_name: '', email: '', priority_lvl: 'medium_priority' }

export default function People() {
  const users = useAsync(() => listUsers({ limit: 200 }), [])

  const [query, setQuery] = useState('')
  const [priority, setPriority] = useState('')
  const [selected, setSelected] = useState(null)
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [busy, setBusy] = useState(false)

  const rows = users.data ?? []

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return rows.filter((row) => {
      if (priority && row.priority_lvl !== priority) return false
      if (!needle) return true
      return [row.full_name, row.username, row.email]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(needle))
    })
  }, [rows, query, priority])

  const columns = [
    {
      key: 'full_name',
      header: 'Name',
      width: '28%',
      render: (row) => (
        <span className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-raised-2 text-2xs text-ink-2"
          >
            {initialsOf(row.full_name || row.username)}
          </span>
          <span className="text-ink">{row.full_name || row.username}</span>
        </span>
      ),
    },
    {
      key: 'username',
      header: 'Username',
      width: '18%',
      mono: true,
      render: (row) => <span className="text-ink-2">{row.username}</span>,
    },
    {
      key: 'email',
      header: 'Email',
      width: '26%',
      render: (row) => <span className="text-ink-2">{row.email}</span>,
    },
    {
      key: 'priority_lvl',
      header: 'Priority',
      width: '12%',
      sortValue: (row) => priorityMeta(row.priority_lvl).rank,
      render: (row) => <PriorityChip value={row.priority_lvl} />,
    },
    {
      key: 'created_at',
      header: 'Joined',
      align: 'right',
      sortValue: (row) => new Date(row.created_at ?? 0).getTime(),
      render: (row) => <span className="text-ink-2">{relativeTime(row.created_at)}</span>,
    },
  ]

  async function save(values) {
    setBusy(true)
    try {
      if (editing?.id) await updateUser(editing.id, values)
      else await createUser(values)
      setEditing(null)
      users.reload()
    } finally {
      setBusy(false)
    }
  }

  async function confirmDelete() {
    setBusy(true)
    try {
      await deleteUser(deleting.id)
      setDeleting(null)
      setSelected(null)
      users.reload()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen>
      <PageHeader
        title="People"
        count={users.loading ? null : rows.length}
        description="Everyone with an account on this desk"
        actions={
          <Button variant="primary" onClick={() => setEditing({ ...BLANK })}>
            <Plus size={14} />
            Add person
          </Button>
        }
      />

      <Panel>
        <Toolbar count={filtered.length} total={rows.length}>
          <SearchInput value={query} onChange={setQuery} placeholder="Search name or username" />
          <PriorityFilter value={priority} onChange={setPriority} />
        </Toolbar>

        <DataTable
          columns={columns}
          rows={filtered}
          loading={users.loading}
          error={users.error}
          onRetry={users.reload}
          onRowClick={setSelected}
          activeId={selected?.id}
          initialSort={{ key: 'full_name', dir: 'asc' }}
          empty={
            <EmptyState
              icon={Users}
              title={rows.length === 0 ? 'Nobody here yet' : 'Nothing matches those filters'}
              body={
                rows.length === 0
                  ? 'People are the colleagues who make and sell on this desk.'
                  : 'Widen the search or clear the priority filter.'
              }
              action={
                rows.length === 0 ? (
                  <Button variant="primary" onClick={() => setEditing({ ...BLANK })}>
                    Add the first person
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
        title={selected?.full_name || selected?.username || ''}
        subtitle={selected?.email ?? ''}
        footer={
          <>
            <Button variant="dangerGhost" onClick={() => setDeleting(selected)}>
              Delete
            </Button>
            <Button variant="primary" onClick={() => setEditing({ ...selected })}>
              Edit person
            </Button>
          </>
        }
      >
        {selected && (
          <DetailList>
            <DetailRow label="Username" mono>
              {selected.username}
            </DetailRow>
            <DetailRow label="Email">
              <a className="text-accent hover:underline" href={'mailto:' + selected.email}>
                {selected.email}
              </a>
            </DetailRow>
            <DetailRow label="Priority">
              <PriorityChip value={selected.priority_lvl} />
            </DetailRow>
            <DetailRow label="Joined" mono>
              {formatDate(selected.created_at)}
            </DetailRow>
          </DetailList>
        )}
      </Drawer>

      <FormDrawer
        value={editing}
        busy={busy}
        onCancel={() => setEditing(null)}
        onSave={save}
        titleNew="Add person"
        titleEdit="Edit person"
        submitNew="Add person"
        subtitle={editing?.id ? editing.full_name : 'A colleague working this desk'}
        fields={[
          { name: 'full_name', label: 'Full name', required: true, placeholder: 'Given and family name' },
          { name: 'username', label: 'Username', required: true, span: 1, placeholder: 'first.last' },
          {
            name: 'priority_lvl',
            label: 'Priority',
            type: 'select',
            span: 1,
            options: optionsFrom(PRIORITIES, (p) => priorityMeta(p).label),
          },
          {
            name: 'email',
            label: 'Email',
            type: 'email',
            required: true,
            placeholder: 'name@ourcrm.example',
          },
        ]}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
        busy={busy}
        title={'Remove ' + (deleting?.full_name ?? 'this person') + '?'}
        body="They lose access to this desk. Their leads and orders are not deleted."
      />
    </Screen>
  )
}
