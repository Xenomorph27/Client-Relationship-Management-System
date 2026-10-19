import { useMemo, useState } from 'react'
import { CheckCircle2, ListTodo, Plus } from 'lucide-react'
import { createTask, deleteTask, listTasks, setTaskDone, updateTask } from '../api/tasks.js'
import { listCustomers } from '../api/customers.js'
import { listOrders } from '../api/orders.js'
import { listLeads } from '../api/leads.js'
import { listOrganisations } from '../api/organisations.js'
import { listUsers } from '../api/users.js'
import { useAsync } from '../hooks/useAsync.js'
import { PageHeader, Panel, Screen } from '../components/layout/PageHeader.jsx'
import { FilterSelect, SearchInput, Toolbar } from '../components/data/Toolbar.jsx'
import { FormDrawer, optionsFrom } from '../components/data/FormDrawer.jsx'
import { TaskRow } from '../components/data/TaskRow.jsx'
import { Button } from '../components/ui/Button.jsx'
import { PriorityChip } from '../components/ui/Chips.jsx'
import { DetailList, DetailRow, Drawer } from '../components/ui/Drawer.jsx'
import { ConfirmDialog } from '../components/ui/ConfirmDialog.jsx'
import { EmptyState, ErrorState } from '../components/ui/EmptyState.jsx'
import { LoadingPanel } from '../components/ui/Spinner.jsx'
import { PRIORITIES, priorityMeta } from '../lib/domain.js'
import { daysUntil, formatDate, formatDateTime } from '../lib/format.js'

const BLANK = {
  title: '',
  notes: '',
  due_date: '',
  priority_lvl: 'medium_priority',
  assignee_id: '',
  lead_id: '',
  order_id: '',
  customer_id: '',
  organisation_id: '',
}

/** Date input wants YYYY-MM-DD; the API carries a full ISO timestamp. */
const toDateInput = (v) => (v ? String(v).slice(0, 10) : '')

/**
 * Buckets by urgency rather than one long list, because the only question a
 * todo list has to answer is "what now".
 */
const SECTIONS = [
  { key: 'overdue', label: 'Overdue', match: (d) => d != null && d < 0 },
  { key: 'today', label: 'Today', match: (d) => d === 0 },
  { key: 'week', label: 'This week', match: (d) => d != null && d > 0 && d <= 7 },
  { key: 'later', label: 'Later', match: (d) => d != null && d > 7 },
  { key: 'undated', label: 'No date', match: (d) => d == null },
]

export default function Todo() {
  const tasks = useAsync(() => listTasks({ limit: 500 }), [])
  const users = useAsync(() => listUsers({ limit: 200 }), [])
  const leads = useAsync(() => listLeads({ limit: 200 }), [])
  const orders = useAsync(() => listOrders({ limit: 500 }), [])
  const customers = useAsync(() => listCustomers({ limit: 200 }), [])
  const organisations = useAsync(() => listOrganisations({ limit: 200 }), [])

  const [query, setQuery] = useState('')
  const [assignee, setAssignee] = useState('')
  const [priority, setPriority] = useState('')
  const [showDone, setShowDone] = useState(false)
  const [selected, setSelected] = useState(null)
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [busy, setBusy] = useState(false)
  // Ticks applied locally so the checkbox never waits on the request.
  const [pending, setPending] = useState({})

  const rows = (tasks.data ?? []).map((t) =>
    pending[t.id] === undefined ? t : { ...t, is_done: pending[t.id] },
  )

  const userById = (id) => users.data?.find((u) => u.id === id) ?? null
  const relatedOf = (task) => {
    if (task.lead_id) {
      const r = leads.data?.find((l) => l.id === task.lead_id)
      return r ? { label: r.name, kind: 'Lead' } : null
    }
    if (task.order_id) {
      const r = orders.data?.find((o) => o.id === task.order_id)
      return r ? { label: r.name, kind: 'Order' } : null
    }
    if (task.customer_id) {
      const r = customers.data?.find((c) => c.id === task.customer_id)
      return r ? { label: r.name, kind: 'Customer' } : null
    }
    if (task.organisation_id) {
      const r = organisations.data?.find((o) => o.id === task.organisation_id)
      return r ? { label: r.name, kind: 'Organisation' } : null
    }
    return null
  }

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return rows.filter((task) => {
      if (!showDone && task.is_done) return false
      if (assignee && String(task.assignee_id) !== assignee) return false
      if (priority && task.priority_lvl !== priority) return false
      if (!needle) return true
      const related = relatedOf(task)
      return [task.title, task.notes, related?.label]
        .filter(Boolean)
        .some((f) => f.toLowerCase().includes(needle))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, query, assignee, priority, showDone, leads.data, orders.data, customers.data, organisations.data])

  const open = filtered.filter((t) => !t.is_done)
  const done = filtered.filter((t) => t.is_done)

  const sections = SECTIONS.map((section) => ({
    ...section,
    items: open
      .filter((task) => section.match(daysUntil(task.due_date)))
      .sort((a, b) => priorityMeta(b.priority_lvl).rank - priorityMeta(a.priority_lvl).rank),
  })).filter((section) => section.items.length > 0)

  const overdueCount = rows.filter(
    (t) => !t.is_done && daysUntil(t.due_date) != null && daysUntil(t.due_date) < 0,
  ).length

  async function toggle(task) {
    const next = !task.is_done
    setPending((p) => ({ ...p, [task.id]: next }))
    try {
      await setTaskDone(task.id, next)
      await tasks.reload()
    } finally {
      setPending((p) => {
        const { [task.id]: _drop, ...rest } = p
        return rest
      })
    }
  }

  async function save(values) {
    setBusy(true)
    try {
      // A <select> always hands back a string, but every id here is an integer
      // and every lookup against it is a strict equality. Left as "1", a task
      // silently loses its link: it saves fine, then shows no related record
      // and never appears on that record's drawer.
      const asId = (value) => (value === '' || value == null ? null : Number(value))
      const payload = {
        ...values,
        due_date: values.due_date || null,
        assignee_id: asId(values.assignee_id),
        lead_id: asId(values.lead_id),
        order_id: asId(values.order_id),
        customer_id: asId(values.customer_id),
        organisation_id: asId(values.organisation_id),
      }
      if (editing?.id) await updateTask(editing.id, payload)
      else await createTask({ ...payload, is_done: false, completed_at: null })
      setEditing(null)
      tasks.reload()
    } finally {
      setBusy(false)
    }
  }

  async function confirmDelete() {
    setBusy(true)
    try {
      await deleteTask(deleting.id)
      setDeleting(null)
      setSelected(null)
      tasks.reload()
    } finally {
      setBusy(false)
    }
  }

  const loading = tasks.loading || users.loading

  return (
    <Screen>
      <PageHeader
        title="Todo"
        count={loading ? null : open.length}
        description={overdueCount > 0 ? overdueCount + ' overdue' : 'Nothing overdue'}
        actions={
          <Button variant="primary" onClick={() => setEditing({ ...BLANK })}>
            <Plus size={14} />
            Add task
          </Button>
        }
      />

      <Panel className="overflow-y-auto">
        <Toolbar count={filtered.length} total={rows.length}>
          <SearchInput value={query} onChange={setQuery} placeholder="Search tasks" />
          <FilterSelect value={assignee} onChange={setAssignee} label="Filter by assignee">
            <option value="">Anyone</option>
            {(users.data ?? []).map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect value={priority} onChange={setPriority} label="Filter by priority">
            <option value="">Any priority</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {priorityMeta(p).label}
              </option>
            ))}
          </FilterSelect>
          <Button
            size="sm"
            variant={showDone ? 'primary' : 'secondary'}
            onClick={() => setShowDone((v) => !v)}
          >
            {showDone ? 'Hiding nothing' : 'Show done'}
          </Button>
        </Toolbar>

        {tasks.error ? (
          <ErrorState error={tasks.error} onRetry={tasks.reload} />
        ) : loading ? (
          <LoadingPanel label="Loading tasks" />
        ) : open.length === 0 && done.length === 0 ? (
          <EmptyState
            icon={rows.length === 0 ? ListTodo : CheckCircle2}
            title={rows.length === 0 ? 'No tasks yet' : 'Nothing to do'}
            body={
              rows.length === 0
                ? 'A task is the next thing you owe a lead, an order or an account.'
                : 'Everything matching these filters is done. That is the good outcome.'
            }
            action={
              <Button variant="primary" onClick={() => setEditing({ ...BLANK })}>
                Add a task
              </Button>
            }
          />
        ) : (
          <>
            {sections.map((section) => (
              <section key={section.key}>
                <header className="flex items-baseline gap-2 px-4 pt-4 pb-1.5">
                  <h2
                    className={
                      'text-sm ' + (section.key === 'overdue' ? 'text-heat-2' : 'text-ink')
                    }
                  >
                    {section.label}
                  </h2>
                  <span className="tnum text-xs text-ink-3">{section.items.length}</span>
                </header>
                <ul className="border-t border-rule">
                  {section.items.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      related={relatedOf(task)}
                      assignee={userById(task.assignee_id)}
                      onToggle={toggle}
                      onOpen={setSelected}
                    />
                  ))}
                </ul>
              </section>
            ))}

            {showDone && done.length > 0 && (
              <section>
                <header className="flex items-baseline gap-2 px-4 pt-4 pb-1.5">
                  <h2 className="text-sm text-ink-3">Done</h2>
                  <span className="tnum text-xs text-ink-3">{done.length}</span>
                </header>
                <ul className="border-t border-rule">
                  {done.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      related={relatedOf(task)}
                      assignee={userById(task.assignee_id)}
                      onToggle={toggle}
                      onOpen={setSelected}
                    />
                  ))}
                </ul>
              </section>
            )}

            {open.length === 0 && (
              <EmptyState
                icon={CheckCircle2}
                title="Nothing left to do"
                body="Every open task matching these filters is finished."
              />
            )}
          </>
        )}
      </Panel>

      <Drawer
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.title ?? ''}
        subtitle={selected ? (relatedOf(selected)?.label ?? 'Not linked to a record') : ''}
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
                  due_date: toDateInput(selected.due_date),
                  assignee_id: selected.assignee_id ?? '',
                  lead_id: selected.lead_id ?? '',
                  order_id: selected.order_id ?? '',
                  customer_id: selected.customer_id ?? '',
                  organisation_id: selected.organisation_id ?? '',
                })
              }
            >
              Edit task
            </Button>
          </>
        }
      >
        {selected && (
          <DetailList>
            <DetailRow label="Status">
              {selected.is_done ? (
                <span className="text-won">Done</span>
              ) : (
                <span className="text-ink">Open</span>
              )}
            </DetailRow>
            <DetailRow label="Priority">
              <PriorityChip value={selected.priority_lvl} />
            </DetailRow>
            <DetailRow label="Due" mono>
              {selected.due_date ? formatDate(selected.due_date) : null}
            </DetailRow>
            <DetailRow label="Assigned to">
              {userById(selected.assignee_id)?.full_name}
            </DetailRow>
            <DetailRow label="About">
              {relatedOf(selected) &&
                relatedOf(selected).label + ' (' + relatedOf(selected).kind + ')'}
            </DetailRow>
            <DetailRow label="Notes">{selected.notes}</DetailRow>
            <DetailRow label="Created" mono>
              {formatDate(selected.created_at)}
            </DetailRow>
            {selected.completed_at && (
              <DetailRow label="Completed" mono>
                {formatDateTime(selected.completed_at)}
              </DetailRow>
            )}
          </DetailList>
        )}
      </Drawer>

      <FormDrawer
        value={editing}
        busy={busy}
        onCancel={() => setEditing(null)}
        onSave={save}
        titleNew="Add task"
        titleEdit="Edit task"
        submitNew="Add task"
        subtitle={editing?.id ? editing.title : 'The next thing you owe someone'}
        width="max-w-lg"
        fields={[
          { name: 'title', label: 'Task', required: true, placeholder: 'What needs doing' },
          { name: 'due_date', label: 'Due', type: 'date', span: 1, nullable: true },
          {
            name: 'priority_lvl',
            label: 'Priority',
            type: 'select',
            span: 1,
            options: optionsFrom(PRIORITIES, (p) => priorityMeta(p).label),
          },
          {
            name: 'assignee_id',
            label: 'Assigned to',
            type: 'select',
            nullable: true,
            options: [
              { value: '', label: 'Unassigned' },
              ...(users.data ?? []).map((u) => ({ value: u.id, label: u.full_name })),
            ],
          },
          {
            name: 'lead_id',
            label: 'Lead',
            type: 'select',
            span: 1,
            nullable: true,
            hint: 'Optional',
            options: [
              { value: '', label: 'None' },
              ...(leads.data ?? []).map((l) => ({ value: l.id, label: l.name })),
            ],
          },
          {
            name: 'order_id',
            label: 'Order',
            type: 'select',
            span: 1,
            nullable: true,
            hint: 'Optional',
            options: [
              { value: '', label: 'None' },
              ...(orders.data ?? []).map((o) => ({ value: o.id, label: o.order_ref + ' - ' + o.name })),
            ],
          },
          {
            name: 'customer_id',
            label: 'Customer',
            type: 'select',
            span: 1,
            nullable: true,
            hint: 'Optional',
            options: [
              { value: '', label: 'None' },
              ...(customers.data ?? []).map((c) => ({ value: c.id, label: c.name })),
            ],
          },
          {
            name: 'organisation_id',
            label: 'Organisation',
            type: 'select',
            span: 1,
            nullable: true,
            hint: 'Optional',
            options: [
              { value: '', label: 'None' },
              ...(organisations.data ?? []).map((o) => ({ value: o.id, label: o.name })),
            ],
          },
          { name: 'notes', label: 'Notes', type: 'textarea', rows: 4 },
        ]}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
        busy={busy}
        title="Delete this task?"
        body="The task is removed. The record it was about is not affected."
      />
    </Screen>
  )
}
