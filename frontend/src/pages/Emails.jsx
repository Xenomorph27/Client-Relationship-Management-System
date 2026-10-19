import { useMemo, useState } from 'react'
import { Mail, MailOpen, Plus } from 'lucide-react'
import { createEmail, deleteEmail, listEmails } from '../api/emails.js'
import { listCustomers } from '../api/customers.js'
import { listLeads } from '../api/leads.js'
import { useAsync } from '../hooks/useAsync.js'
import { PageHeader, Panel, Screen } from '../components/layout/PageHeader.jsx'
import { FilterSelect, SearchInput, Toolbar } from '../components/data/Toolbar.jsx'
import { FormDrawer, optionsFrom } from '../components/data/FormDrawer.jsx'
import { Button } from '../components/ui/Button.jsx'
import { PriorityChip } from '../components/ui/Chips.jsx'
import { ConfirmDialog } from '../components/ui/ConfirmDialog.jsx'
import { EmptyState, ErrorState } from '../components/ui/EmptyState.jsx'
import { LoadingPanel } from '../components/ui/Spinner.jsx'
import { PRIORITIES, priorityMeta } from '../lib/domain.js'
import { formatDateShort, formatDateTime } from '../lib/format.js'

const BLANK = {
  subject: '',
  body: '',
  sender: 'sarah.chen@ourcrm.example',
  recipient: '',
  lead_id: '',
  customer_id: '',
  priority_lvl: 'low_priority',
}

export default function Emails() {
  const emails = useAsync(() => listEmails({ limit: 200 }), [])
  const leads = useAsync(() => listLeads({ limit: 200 }), [])
  const customers = useAsync(() => listCustomers({ limit: 200 }), [])

  const [query, setQuery] = useState('')
  const [read, setRead] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [composing, setComposing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [busy, setBusy] = useState(false)

  const rows = emails.data ?? []
  const leadName = (id) => leads.data?.find((l) => l.id === id)?.name ?? null
  const customerName = (id) => customers.data?.find((c) => c.id === id)?.name ?? null
  const linkFor = (email) => customerName(email.customer_id) ?? leadName(email.lead_id)

  const sorted = useMemo(
    () =>
      [...rows].sort(
        (a, b) => new Date(b.sent_at ?? 0).getTime() - new Date(a.sent_at ?? 0).getTime(),
      ),
    [rows],
  )

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return sorted.filter((email) => {
      if (read === 'opened' && !email.is_opened) return false
      if (read === 'unopened' && email.is_opened) return false
      if (!needle) return true
      return [email.subject, email.body, email.recipient, linkFor(email)]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(needle))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sorted, query, read, leads.data, customers.data])

  const selected = filtered.find((e) => e.id === selectedId) ?? filtered[0] ?? null
  const unopened = rows.filter((e) => !e.is_opened).length

  async function send(values) {
    setBusy(true)
    try {
      await createEmail(values)
      setComposing(null)
      emails.reload()
    } finally {
      setBusy(false)
    }
  }

  async function confirmDelete() {
    setBusy(true)
    try {
      await deleteEmail(deleting.id)
      setDeleting(null)
      setSelectedId(null)
      emails.reload()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen>
      <PageHeader
        title="Emails"
        count={emails.loading ? null : rows.length}
        description={unopened > 0 ? unopened + ' not opened yet' : 'All opened'}
        actions={
          <Button variant="primary" onClick={() => setComposing({ ...BLANK })}>
            <Plus size={14} />
            Write email
          </Button>
        }
      />

      <Panel>
        <Toolbar count={filtered.length} total={rows.length}>
          <SearchInput value={query} onChange={setQuery} placeholder="Search subject or recipient" />
          <FilterSelect value={read} onChange={setRead} label="Filter by opened">
            <option value="">All email</option>
            <option value="unopened">Not opened</option>
            <option value="opened">Opened</option>
          </FilterSelect>
        </Toolbar>

        {emails.error ? (
          <ErrorState error={emails.error} onRetry={emails.reload} />
        ) : emails.loading ? (
          <LoadingPanel label="Loading email" />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Mail}
            title="No email yet"
            body="Email sent to a lead or customer is recorded here."
            action={
              <Button variant="primary" onClick={() => setComposing({ ...BLANK })}>
                Write the first email
              </Button>
            }
          />
        ) : (
          <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,340px)_1fr]">
            <ul className="min-h-0 overflow-y-auto border-r border-rule">
              {filtered.map((email) => {
                const active = selected?.id === email.id
                return (
                  <li key={email.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(email.id)}
                      className={
                        'block w-full border-b border-rule/60 px-3 py-2 text-left ' +
                        (active ? 'bg-accent-wash/60' : 'hover:bg-raised/70')
                      }
                    >
                      <div className="flex items-baseline gap-2">
                        {!email.is_opened && (
                          <span
                            aria-label="Not opened"
                            className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
                          />
                        )}
                        <span
                          className={
                            'min-w-0 flex-1 truncate ' +
                            (email.is_opened ? 'text-ink-2' : 'text-ink')
                          }
                        >
                          {email.subject}
                        </span>
                        <span className="tnum shrink-0 text-2xs text-ink-3">
                          {formatDateShort(email.sent_at)}
                        </span>
                      </div>
                      <div className="mt-0.5 truncate text-xs text-ink-3">
                        {linkFor(email) ?? email.recipient}
                      </div>
                    </button>
                  </li>
                )
              })}
              {filtered.length === 0 && (
                <li className="px-3 py-6 text-center text-ink-3">Nothing matches that search.</li>
              )}
            </ul>

            {selected ? (
              <article className="flex min-h-0 flex-col overflow-y-auto">
                <header className="border-b border-rule px-5 py-4">
                  <div className="flex items-start gap-3">
                    <h2 className="min-w-0 flex-1 text-base text-ink">{selected.subject}</h2>
                    <PriorityChip value={selected.priority_lvl} />
                  </div>
                  <dl className="mt-3 grid grid-cols-[4.5rem_1fr] gap-y-1 text-xs">
                    <dt className="text-ink-3">From</dt>
                    <dd className="text-ink-2">{selected.sender}</dd>
                    <dt className="text-ink-3">To</dt>
                    <dd className="text-ink-2">{selected.recipient}</dd>
                    <dt className="text-ink-3">Sent</dt>
                    <dd className="tnum text-ink-2">{formatDateTime(selected.sent_at)}</dd>
                  </dl>
                  <div className="mt-3 flex items-center gap-2">
                    <span
                      className={
                        'inline-flex items-center gap-1.5 text-xs ' +
                        (selected.is_opened ? 'text-won' : 'text-ink-3')
                      }
                    >
                      {selected.is_opened ? <MailOpen size={13} /> : <Mail size={13} />}
                      {selected.is_opened ? 'Opened by recipient' : 'Not opened yet'}
                    </span>
                    <Button
                      variant="dangerGhost"
                      size="sm"
                      className="ml-auto"
                      onClick={() => setDeleting(selected)}
                    >
                      Delete
                    </Button>
                  </div>
                </header>
                <div className="max-w-[68ch] px-5 py-4 leading-relaxed text-ink-2">
                  {selected.body}
                </div>
              </article>
            ) : (
              <div className="grid place-items-center text-ink-3">Select an email to read it.</div>
            )}
          </div>
        )}
      </Panel>

      <FormDrawer
        value={composing}
        busy={busy}
        onCancel={() => setComposing(null)}
        onSave={send}
        titleNew="Write email"
        titleEdit="Edit email"
        submitNew="Send email"
        subtitle="Recorded against a lead or customer"
        width="max-w-lg"
        fields={[
          { name: 'subject', label: 'Subject', required: true, placeholder: 'What this is about' },
          {
            name: 'recipient',
            label: 'To',
            type: 'email',
            required: true,
            placeholder: 'name@company.com',
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
            name: 'lead_id',
            label: 'Lead',
            type: 'select',
            span: 1,
            nullable: true,
            options: [
              { value: '', label: 'None' },
              ...(leads.data ?? []).map((l) => ({ value: l.id, label: l.name })),
            ],
          },
          {
            name: 'priority_lvl',
            label: 'Priority',
            type: 'select',
            span: 1,
            options: optionsFrom(PRIORITIES, (p) => priorityMeta(p).label),
          },
          { name: 'sender', label: 'From', type: 'email', span: 1 },
          { name: 'body', label: 'Message', type: 'textarea', rows: 7 },
        ]}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
        busy={busy}
        title="Delete this email?"
        body={'This removes it from the record. This cannot be undone.'}
      />
    </Screen>
  )
}
