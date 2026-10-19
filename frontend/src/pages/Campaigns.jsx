import { useMemo, useState } from 'react'
import { Megaphone, Plus } from 'lucide-react'
import {
  createCampaign,
  deleteCampaign,
  listCampaigns,
  updateCampaign,
} from '../api/campaigns.js'
import { useAsync } from '../hooks/useAsync.js'
import { PageHeader, Panel, Screen } from '../components/layout/PageHeader.jsx'
import { FilterSelect, SearchInput, Toolbar } from '../components/data/Toolbar.jsx'
import { FormDrawer, optionsFrom } from '../components/data/FormDrawer.jsx'
import { Button } from '../components/ui/Button.jsx'
import { CampaignState, PriorityChip } from '../components/ui/Chips.jsx'
import { DetailList, DetailRow, DetailSection, Drawer } from '../components/ui/Drawer.jsx'
import { ConfirmDialog } from '../components/ui/ConfirmDialog.jsx'
import { EmptyState, ErrorState } from '../components/ui/EmptyState.jsx'
import { LoadingPanel } from '../components/ui/Spinner.jsx'
import { PRIORITIES, campaignState, priorityMeta } from '../lib/domain.js'
import { formatDate, relativeTime } from '../lib/format.js'

const BLANK = {
  name: '',
  description: '',
  start_date: '',
  end_date: '',
  html_content: '',
  priority_lvl: 'medium_priority',
}

/** A date input needs YYYY-MM-DD; the API sends a full ISO timestamp. */
const toDateInput = (value) => (value ? String(value).slice(0, 10) : '')

/** How far through its run a campaign is, 0 to 1. */
function progressOf(campaign) {
  const start = campaign.start_date ? new Date(campaign.start_date).getTime() : null
  const end = campaign.end_date ? new Date(campaign.end_date).getTime() : null
  if (!start || !end || end <= start) return null
  return Math.min(1, Math.max(0, (Date.now() - start) / (end - start)))
}

export default function Campaigns() {
  const campaigns = useAsync(() => listCampaigns({ limit: 200 }), [])

  const [query, setQuery] = useState('')
  const [state, setState] = useState('')
  const [selected, setSelected] = useState(null)
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [busy, setBusy] = useState(false)

  const rows = campaigns.data ?? []

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return rows.filter((row) => {
      if (state && campaignState(row).key !== state) return false
      if (!needle) return true
      return [row.name, row.description]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(needle))
    })
  }, [rows, query, state])

  async function save(values) {
    setBusy(true)
    try {
      const payload = {
        ...values,
        html_content:
          values.html_content?.trim() ||
          '<h1>' + values.name + '</h1><p>' + (values.description ?? '') + '</p>',
      }
      if (editing?.id) await updateCampaign(editing.id, payload)
      else await createCampaign(payload)
      setEditing(null)
      campaigns.reload()
    } finally {
      setBusy(false)
    }
  }

  async function confirmDelete() {
    setBusy(true)
    try {
      await deleteCampaign(deleting.id)
      setDeleting(null)
      setSelected(null)
      campaigns.reload()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen>
      <PageHeader
        title="Campaigns"
        count={campaigns.loading ? null : rows.length}
        actions={
          <Button variant="primary" onClick={() => setEditing({ ...BLANK })}>
            <Plus size={14} />
            Add campaign
          </Button>
        }
      />

      <Panel>
        <Toolbar count={filtered.length} total={rows.length}>
          <SearchInput value={query} onChange={setQuery} placeholder="Search campaigns" />
          <FilterSelect value={state} onChange={setState} label="Filter by state">
            <option value="">Any state</option>
            <option value="running">Running</option>
            <option value="upcoming">Upcoming</option>
            <option value="ended">Ended</option>
          </FilterSelect>
        </Toolbar>

        {campaigns.error ? (
          <ErrorState error={campaigns.error} onRetry={campaigns.reload} />
        ) : campaigns.loading ? (
          <LoadingPanel label="Loading campaigns" />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title={rows.length === 0 ? 'No campaigns yet' : 'Nothing matches those filters'}
            body={
              rows.length === 0
                ? 'A campaign is a scheduled push to a segment of your contacts.'
                : 'Widen the search or clear the state filter.'
            }
            action={
              rows.length === 0 ? (
                <Button variant="primary" onClick={() => setEditing({ ...BLANK })}>
                  Add the first campaign
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    setQuery('')
                    setState('')
                  }}
                >
                  Clear filters
                </Button>
              )
            }
          />
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((campaign) => {
                const progress = progressOf(campaign)
                const current = campaignState(campaign)
                return (
                  <li key={campaign.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(campaign)}
                      className="lift flex h-full w-full flex-col rounded-panel bg-raised p-3 text-left ring-1 ring-inset ring-rule hover:ring-rule-strong"
                    >
                      <div className="flex items-start gap-2">
                        <h2 className="min-w-0 flex-1 text-sm text-ink">{campaign.name}</h2>
                        <PriorityChip value={campaign.priority_lvl} compact />
                      </div>

                      <p className="mt-1.5 line-clamp-2 flex-1 text-xs text-ink-3">
                        {campaign.description}
                      </p>

                      <div className="mt-3 flex items-baseline justify-between text-2xs">
                        <CampaignState campaign={campaign} />
                        <span className="tnum text-ink-3">
                          {formatDate(campaign.start_date)}
                        </span>
                      </div>

                      {/* Run length as a bar: where this campaign is in its window. */}
                      <div className="mt-2 h-1 overflow-hidden rounded-full bg-ground">
                        <div
                          className={
                            'h-full rounded-full ' +
                            (current.key === 'ended'
                              ? 'bg-rule-strong'
                              : current.key === 'upcoming'
                                ? 'bg-accent/40'
                                : 'bg-accent')
                          }
                          style={{ width: progress == null ? '0%' : progress * 100 + '%' }}
                        />
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </Panel>

      <Drawer
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.name ?? ''}
        subtitle={selected?.description ?? ''}
        width="max-w-2xl"
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
                  start_date: toDateInput(selected.start_date),
                  end_date: toDateInput(selected.end_date),
                })
              }
            >
              Edit campaign
            </Button>
          </>
        }
      >
        {selected && (
          <>
            <DetailList>
              <DetailRow label="State">
                <CampaignState campaign={selected} />
              </DetailRow>
              <DetailRow label="Priority">
                <PriorityChip value={selected.priority_lvl} />
              </DetailRow>
              <DetailRow label="Starts" mono>
                {formatDate(selected.start_date)}
                <span className="ml-2 text-ink-3">{relativeTime(selected.start_date)}</span>
              </DetailRow>
              <DetailRow label="Ends" mono>
                {formatDate(selected.end_date)}
                <span className="ml-2 text-ink-3">{relativeTime(selected.end_date)}</span>
              </DetailRow>
            </DetailList>

            <DetailSection title="Email preview">
              {/*
                Campaign HTML is author-supplied, so it is rendered inside a
                sandboxed iframe with no scripts and no same-origin access
                rather than injected into this page.
              */}
              <div className="p-4 pt-2">
                <iframe
                  title={'Preview of ' + selected.name}
                  sandbox=""
                  srcDoc={
                    '<style>body{font-family:system-ui,sans-serif;color:#1a1a1a;background:#fff;' +
                    'margin:0;padding:20px;line-height:1.5}h1{font-size:20px;margin:0 0 10px}' +
                    'p{margin:0;font-size:14px}</style>' +
                    (selected.html_content ?? '')
                  }
                  className="h-64 w-full rounded-control border border-rule bg-white"
                />
              </div>
            </DetailSection>
          </>
        )}
      </Drawer>

      <FormDrawer
        value={editing}
        busy={busy}
        onCancel={() => setEditing(null)}
        onSave={save}
        titleNew="Add campaign"
        titleEdit="Edit campaign"
        submitNew="Add campaign"
        subtitle={editing?.id ? editing.name : 'A scheduled push to a segment of contacts'}
        width="max-w-lg"
        fields={[
          { name: 'name', label: 'Campaign name', required: true, placeholder: 'Q4 Enterprise Push' },
          {
            name: 'description',
            label: 'Description',
            placeholder: 'Who this reaches and why',
          },
          { name: 'start_date', label: 'Starts', type: 'date', span: 1, nullable: true },
          { name: 'end_date', label: 'Ends', type: 'date', span: 1, nullable: true },
          {
            name: 'priority_lvl',
            label: 'Priority',
            type: 'select',
            span: 1,
            options: optionsFrom(PRIORITIES, (p) => priorityMeta(p).label),
          },
          {
            name: 'html_content',
            label: 'Email HTML',
            type: 'textarea',
            rows: 6,
            hint: 'Left blank, one is generated',
          },
        ]}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
        busy={busy}
        title={'Delete ' + (deleting?.name ?? 'this campaign') + '?'}
        body="The campaign and its email content are removed. This cannot be undone."
      />
    </Screen>
  )
}
