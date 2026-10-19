import { useMemo, useState } from 'react'
import { Plus, UserRound } from 'lucide-react'
import { createLead, deleteLead, listLeads, updateLead } from '../api/leads.js'
import { listOrganisations } from '../api/organisations.js'
import { useAsync } from '../hooks/useAsync.js'
import { PageHeader, Panel, Screen } from '../components/layout/PageHeader.jsx'
import { DataTable } from '../components/data/DataTable.jsx'
import { FilterSelect, PriorityFilter, SearchInput, Toolbar } from '../components/data/Toolbar.jsx'
import { Button } from '../components/ui/Button.jsx'
import { LeadStatus, PriorityChip } from '../components/ui/Chips.jsx'
import { DetailList, DetailRow, Drawer } from '../components/ui/Drawer.jsx'
import { ConfirmDialog } from '../components/ui/ConfirmDialog.jsx'
import { RelatedTasks } from '../components/data/RelatedTasks.jsx'
import { EmptyState } from '../components/ui/EmptyState.jsx'
import { formatDate, relativeTime } from '../lib/format.js'
import { LEAD_STATUSES, PRIORITIES, leadStatusMeta, priorityMeta } from '../lib/domain.js'
import { FormDrawer, optionsFrom } from '../components/data/FormDrawer.jsx'

const BLANK = {
  name: '',
  email: '',
  phone: '',
  status: 'new',
  organisation_id: '',
  priority_lvl: 'low_priority',
}

export default function Leads() {
  const leads = useAsync(() => listLeads({ limit: 200 }), [])
  const organisations = useAsync(() => listOrganisations({ limit: 200 }), [])

  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [priority, setPriority] = useState('')
  const [selected, setSelected] = useState(null)
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [busy, setBusy] = useState(false)

  const orgName = (id) => organisations.data?.find((o) => o.id === id)?.name ?? null
  const rows = leads.data ?? []

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return rows.filter((lead) => {
      if (status && lead.status !== status) return false
      if (priority && lead.priority_lvl !== priority) return false
      if (!needle) return true
      return [lead.name, lead.email, lead.phone, orgName(lead.organisation_id)]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(needle))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, query, status, priority, organisations.data])

  const columns = [
    {
      key: 'name',
      header: 'Name',
      width: '17%',
      render: (lead) => <span className="text-ink">{lead.name}</span>,
    },
    {
      key: 'email',
      header: 'Email',
      width: '20%',
      render: (lead) =>
        lead.email ? (
          <span className="text-ink-2">{lead.email}</span>
        ) : (
          <span className="text-ink-3">&mdash;</span>
        ),
    },
    {
      key: 'organisation_id',
      header: 'Organisation',
      width: '16%',
      sortValue: (lead) => orgName(lead.organisation_id),
      render: (lead) =>
        orgName(lead.organisation_id) ?? <span className="text-ink-3">Independent</span>,
    },
    {
      key: 'status',
      header: 'Status',
      width: '13%',
      sortValue: (lead) => leadStatusMeta(lead.status).label,
      render: (lead) => <LeadStatus value={lead.status} />,
    },
    {
      key: 'priority_lvl',
      header: 'Priority',
      width: '12%',
      // Sorts by rank, not alphabetically, so the scale reads in its real order.
      sortValue: (lead) => priorityMeta(lead.priority_lvl).rank,
      render: (lead) => <PriorityChip value={lead.priority_lvl} />,
    },
    { key: 'phone', header: 'Phone', width: '12%', mono: true },
    {
      key: 'created_at',
      header: 'Added',
      width: '13%',
      align: 'right',
      sortValue: (lead) => new Date(lead.created_at ?? 0).getTime(),
      render: (lead) => <span className="text-ink-2">{relativeTime(lead.created_at)}</span>,
    },
  ]

  async function save(values) {
    setBusy(true)
    try {
      const payload = {
        ...values,
        organisation_id: values.organisation_id ? Number(values.organisation_id) : null,
      }
      if (editing?.id) await updateLead(editing.id, payload)
      else await createLead(payload)
      setEditing(null)
      leads.reload()
    } finally {
      setBusy(false)
    }
  }

  async function confirmDelete() {
    setBusy(true)
    try {
      await deleteLead(deleting.id)
      setDeleting(null)
      setSelected(null)
      leads.reload()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen>
      <PageHeader
        title="Leads"
        count={leads.loading ? null : rows.length}
        actions={
          <Button variant="primary" onClick={() => setEditing({ ...BLANK })}>
            <Plus size={14} />
            Add lead
          </Button>
        }
      />

      <Panel>
        <Toolbar count={filtered.length} total={rows.length}>
          <SearchInput value={query} onChange={setQuery} placeholder="Search name, email, phone" />
          <FilterSelect value={status} onChange={setStatus} label="Filter by status">
            <option value="">Any status</option>
            {LEAD_STATUSES.map((s) => (
              <option key={s} value={s}>
                {leadStatusMeta(s).label}
              </option>
            ))}
          </FilterSelect>
          <PriorityFilter value={priority} onChange={setPriority} />
        </Toolbar>

        <DataTable
          columns={columns}
          rows={filtered}
          loading={leads.loading}
          error={leads.error}
          onRetry={leads.reload}
          onRowClick={setSelected}
          activeId={selected?.id}
          initialSort={{ key: 'created_at', dir: 'desc' }}
          empty={
            rows.length === 0 ? (
              <EmptyState
                icon={UserRound}
                title="No leads yet"
                body="Leads are the people who have enquired but not yet ordered."
                action={
                  <Button variant="primary" onClick={() => setEditing({ ...BLANK })}>
                    Add the first lead
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={UserRound}
                title="Nothing matches those filters"
                body="Widen the search or clear a filter to see more."
                action={
                  <Button
                    onClick={() => {
                      setQuery('')
                      setStatus('')
                      setPriority('')
                    }}
                  >
                    Clear filters
                  </Button>
                }
              />
            )
          }
        />
      </Panel>

      <Drawer
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.name ?? ''}
        subtitle={selected ? (orgName(selected.organisation_id) ?? 'Independent') : ''}
        footer={
          <>
            <Button variant="dangerGhost" onClick={() => setDeleting(selected)}>
              Delete
            </Button>
            <Button
              variant="primary"
              onClick={() =>
                setEditing({ ...selected, organisation_id: selected.organisation_id ?? '' })
              }
            >
              Edit lead
            </Button>
          </>
        }
      >
        {selected && (
          <>
          <DetailList>
            <DetailRow label="Status">
              <LeadStatus value={selected.status} />
            </DetailRow>
            <DetailRow label="Priority">
              <PriorityChip value={selected.priority_lvl} />
            </DetailRow>
            <DetailRow label="Email">
              {selected.email && (
                <a className="text-accent hover:underline" href={'mailto:' + selected.email}>
                  {selected.email}
                </a>
              )}
            </DetailRow>
            <DetailRow label="Phone" mono>
              {selected.phone}
            </DetailRow>
            <DetailRow label="Organisation">{orgName(selected.organisation_id)}</DetailRow>
            <DetailRow label="Added" mono>
              {formatDate(selected.created_at)}
            </DetailRow>
            <DetailRow label="Last updated" mono>
              {formatDate(selected.updated_at)}
            </DetailRow>
          </DetailList>

            <RelatedTasks kind="lead" id={selected.id} />
          </>
        )}
      </Drawer>

      <FormDrawer
        value={editing}
        fields={formFields(organisations.data ?? [])}
        busy={busy}
        onCancel={() => setEditing(null)}
        onSave={save}
        titleNew="Add lead"
        titleEdit="Edit lead"
        submitNew="Add lead"
        subtitle={editing?.id ? editing.name : 'Someone who has enquired but not yet ordered'}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
        busy={busy}
        title={'Delete ' + (deleting?.name ?? 'this lead') + '?'}
        body="The lead and its details are removed from the list. This cannot be undone."
      />
    </Screen>
  )
}

/** Field spec for the add/edit form. */
function formFields(organisations) {
  return [
    { name: 'name', label: 'Name', required: true, placeholder: 'Full name' },
    { name: 'email', label: 'Email', type: 'email', placeholder: 'name@company.com', span: 1 },
    { name: 'phone', label: 'Phone', placeholder: '555-0100', span: 1 },
    {
      name: 'status',
      label: 'Status',
      type: 'select',
      span: 1,
      options: optionsFrom(LEAD_STATUSES, (s) => leadStatusMeta(s).label),
    },
    {
      name: 'priority_lvl',
      label: 'Priority',
      type: 'select',
      span: 1,
      options: optionsFrom(PRIORITIES, (p) => priorityMeta(p).label),
    },
    {
      name: 'organisation_id',
      label: 'Organisation',
      type: 'select',
      hint: 'Optional',
      nullable: true,
      options: [
        { value: '', label: 'Independent' },
        ...organisations.map((org) => ({ value: org.id, label: org.name })),
      ],
    },
  ]
}
