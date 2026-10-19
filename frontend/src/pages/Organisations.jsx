import { useMemo, useState } from 'react'
import { Building2, Plus } from 'lucide-react'
import {
  createOrganisation,
  deleteOrganisation,
  listOrganisations,
  updateOrganisation,
} from '../api/organisations.js'
import { listLeads } from '../api/leads.js'
import { useAsync } from '../hooks/useAsync.js'
import { PageHeader, Panel, Screen } from '../components/layout/PageHeader.jsx'
import { DataTable } from '../components/data/DataTable.jsx'
import { PriorityFilter, SearchInput, Toolbar } from '../components/data/Toolbar.jsx'
import { FormDrawer, optionsFrom } from '../components/data/FormDrawer.jsx'
import { Button } from '../components/ui/Button.jsx'
import { LeadStatus, PriorityChip } from '../components/ui/Chips.jsx'
import { DetailList, DetailRow, DetailSection, Drawer } from '../components/ui/Drawer.jsx'
import { ConfirmDialog } from '../components/ui/ConfirmDialog.jsx'
import { RelatedTasks } from '../components/data/RelatedTasks.jsx'
import { EmptyState } from '../components/ui/EmptyState.jsx'
import { PRIORITIES, priorityMeta } from '../lib/domain.js'
import { formatDate, relativeTime } from '../lib/format.js'

const BLANK = {
  name: '',
  website: '',
  industry: '',
  official_email: '',
  support_contact: '',
  priority_lvl: 'low_priority',
}

/** The scheme is noise in a table; the domain is the identifying part. */
const hostOf = (url) => (url ? String(url).replace(/^https?:\/\//, '') : null)

export default function Organisations() {
  const organisations = useAsync(() => listOrganisations({ limit: 200 }), [])
  const leads = useAsync(() => listLeads({ limit: 200 }), [])

  const [query, setQuery] = useState('')
  const [priority, setPriority] = useState('')
  const [selected, setSelected] = useState(null)
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [busy, setBusy] = useState(false)

  const rows = organisations.data ?? []
  const leadsFor = (id) => (leads.data ?? []).filter((lead) => lead.organisation_id === id)

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return rows.filter((row) => {
      if (priority && row.priority_lvl !== priority) return false
      if (!needle) return true
      return [row.name, row.industry, row.official_email, row.website]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(needle))
    })
  }, [rows, query, priority])

  const columns = [
    { key: 'name', header: 'Organisation', width: '22%' },
    {
      key: 'industry',
      header: 'Industry',
      width: '16%',
      render: (row) => <span className="text-ink-2">{row.industry || '—'}</span>,
    },
    {
      key: 'website',
      header: 'Website',
      width: '18%',
      sortValue: (row) => hostOf(row.website),
      render: (row) =>
        row.website ? (
          <a
            href={row.website}
            target="_blank"
            rel="noreferrer"
            onClick={(event) => event.stopPropagation()}
            className="text-accent hover:underline"
          >
            {hostOf(row.website)}
          </a>
        ) : (
          <span className="text-ink-3">—</span>
        ),
    },
    {
      key: 'leads',
      header: 'Leads',
      width: '9%',
      align: 'right',
      mono: true,
      sortValue: (row) => leadsFor(row.id).length,
      render: (row) => leadsFor(row.id).length || <span className="text-ink-3">0</span>,
    },
    {
      key: 'priority_lvl',
      header: 'Priority',
      width: '11%',
      sortValue: (row) => priorityMeta(row.priority_lvl).rank,
      render: (row) => <PriorityChip value={row.priority_lvl} />,
    },
    {
      key: 'created_at',
      header: 'Added',
      align: 'right',
      sortValue: (row) => new Date(row.created_at ?? 0).getTime(),
      render: (row) => <span className="text-ink-2">{relativeTime(row.created_at)}</span>,
    },
  ]

  async function save(values) {
    setBusy(true)
    try {
      if (editing?.id) await updateOrganisation(editing.id, values)
      else await createOrganisation(values)
      setEditing(null)
      organisations.reload()
    } finally {
      setBusy(false)
    }
  }

  async function confirmDelete() {
    setBusy(true)
    try {
      await deleteOrganisation(deleting.id)
      setDeleting(null)
      setSelected(null)
      organisations.reload()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen>
      <PageHeader
        title="Organisations"
        count={organisations.loading ? null : rows.length}
        actions={
          <Button variant="primary" onClick={() => setEditing({ ...BLANK })}>
            <Plus size={14} />
            Add organisation
          </Button>
        }
      />

      <Panel>
        <Toolbar count={filtered.length} total={rows.length}>
          <SearchInput value={query} onChange={setQuery} placeholder="Search name or industry" />
          <PriorityFilter value={priority} onChange={setPriority} />
        </Toolbar>

        <DataTable
          columns={columns}
          rows={filtered}
          loading={organisations.loading}
          error={organisations.error}
          onRetry={organisations.reload}
          onRowClick={setSelected}
          activeId={selected?.id}
          initialSort={{ key: 'name', dir: 'asc' }}
          empty={
            <EmptyState
              icon={Building2}
              title={rows.length === 0 ? 'No organisations yet' : 'Nothing matches those filters'}
              body={
                rows.length === 0
                  ? 'An organisation groups the leads who work at the same company.'
                  : 'Widen the search or clear the priority filter.'
              }
              action={
                rows.length === 0 ? (
                  <Button variant="primary" onClick={() => setEditing({ ...BLANK })}>
                    Add the first organisation
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
        subtitle={selected?.industry ?? ''}
        footer={
          <>
            <Button variant="dangerGhost" onClick={() => setDeleting(selected)}>
              Delete
            </Button>
            <Button variant="primary" onClick={() => setEditing({ ...selected })}>
              Edit organisation
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
              <DetailRow label="Industry">{selected.industry}</DetailRow>
              <DetailRow label="Website">
                {selected.website && (
                  <a
                    className="text-accent hover:underline"
                    href={selected.website}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {hostOf(selected.website)}
                  </a>
                )}
              </DetailRow>
              <DetailRow label="General enquiries">{selected.official_email}</DetailRow>
              <DetailRow label="Support">{selected.support_contact}</DetailRow>
              <DetailRow label="Added" mono>
                {formatDate(selected.created_at)}
              </DetailRow>
            </DetailList>

            <RelatedTasks kind="organisation" id={selected.id} />

            <DetailSection title={'Leads here (' + leadsFor(selected.id).length + ')'}>
              {leadsFor(selected.id).length === 0 ? (
                <p className="px-4 pb-3 text-ink-3">No leads recorded at this organisation.</p>
              ) : (
                <ul className="divide-y divide-rule/70 border-t border-rule/70">
                  {leadsFor(selected.id).map((lead) => (
                    <li key={lead.id} className="flex items-center gap-3 px-4 py-2">
                      <span className="min-w-0 flex-1 truncate text-ink">{lead.name}</span>
                      <LeadStatus value={lead.status} />
                      <PriorityChip value={lead.priority_lvl} compact />
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
        titleNew="Add organisation"
        titleEdit="Edit organisation"
        submitNew="Add organisation"
        subtitle={editing?.id ? editing.name : 'A company your leads work at'}
        fields={[
          { name: 'name', label: 'Organisation name', required: true, placeholder: 'Company name' },
          { name: 'industry', label: 'Industry', span: 1, placeholder: 'Logistics' },
          { name: 'website', label: 'Website', span: 1, placeholder: 'https://company.com' },
          {
            name: 'official_email',
            label: 'General enquiries',
            type: 'email',
            span: 1,
            placeholder: 'contact@company.com',
          },
          {
            name: 'support_contact',
            label: 'Support',
            span: 1,
            placeholder: 'support@company.com',
          },
          {
            name: 'priority_lvl',
            label: 'Priority',
            type: 'select',
            options: optionsFrom(PRIORITIES, (p) => priorityMeta(p).label),
          },
        ]}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
        busy={busy}
        title={'Delete ' + (deleting?.name ?? 'this organisation') + '?'}
        body="The organisation is removed. Leads there become independent rather than being deleted."
      />
    </Screen>
  )
}
