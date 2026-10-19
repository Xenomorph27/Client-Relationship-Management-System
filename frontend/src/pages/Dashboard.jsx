import { Link } from 'react-router-dom'
import { listCampaigns } from '../api/campaigns.js'
import { listCustomers } from '../api/customers.js'
import { listOrders } from '../api/orders.js'
import { listEmails } from '../api/emails.js'
import { listLeads } from '../api/leads.js'
import { useAsync } from '../hooks/useAsync.js'
import { PageHeader, Panel, Screen } from '../components/layout/PageHeader.jsx'
import { PipelineBar } from '../components/data/PipelineBar.jsx'
import { StatRow, StatTile } from '../components/data/StatTile.jsx'
import { PriorityChip } from '../components/ui/Chips.jsx'
import { ErrorState } from '../components/ui/EmptyState.jsx'
import { LoadingPanel } from '../components/ui/Spinner.jsx'
import { campaignState, deliveryMeta, priorityMeta } from '../lib/domain.js'
import { daysUntil, formatAmount, formatCompact, formatDateShort, relativeTime } from '../lib/format.js'

export default function Dashboard() {
  const orders = useAsync(() => listOrders({ limit: 500 }), [])
  const leads = useAsync(() => listLeads({ limit: 200 }), [])
  const customers = useAsync(() => listCustomers({ limit: 200 }), [])
  const emails = useAsync(() => listEmails({ limit: 200 }), [])
  const campaigns = useAsync(() => listCampaigns({ limit: 200 }), [])

  const loading =
    orders.loading || leads.loading || customers.loading || emails.loading || campaigns.loading
  const error = orders.error ?? leads.error ?? customers.error ?? emails.error ?? campaigns.error

  const orderRows = (orders.data ?? []).filter((o) => o.kind === 'delivery')
  const leadRows = leads.data ?? []
  const emailRows = emails.data ?? []
  const campaignRows = campaigns.data ?? []

  const inFlight = orderRows.filter((o) => !deliveryMeta(o.delivery_status).done)
  const delivered = orderRows.filter((o) => o.delivery_status === 'delivered')
  const sum = (rows) => rows.reduce((total, o) => total + Number(o.price ?? 0), 0)

  const closedCount = delivered.length
  const returnCount = (orders.data ?? []).filter((o) => o.kind === 'return').length
  const returnRate = orderRows.length === 0 ? null : Math.round((returnCount / orderRows.length) * 100)

  /**
   * What needs attention: orders already past their delivery date, or due
   * inside the next month. Sorted by urgency, so the top row is the next thing
   * to act on.
   */
  const ATTENTION_DAYS = 30
  const attention = inFlight
    .map((order) => ({ deal: order, days: daysUntil(order.delivery_due) }))
    .filter(({ days }) => days != null && days <= ATTENTION_DAYS)
    .sort((a, b) => a.days - b.days)

  const newLeads = leadRows.filter((lead) => lead.status === 'new')
  const unopened = emailRows.filter((email) => !email.is_opened)
  const running = campaignRows.filter((c) => campaignState(c).key === 'running')

  const recentEmails = [...emailRows]
    .sort((a, b) => new Date(b.sent_at ?? 0) - new Date(a.sent_at ?? 0))
    .slice(0, 6)

  return (
    <Screen>
      <PageHeader title="Overview" description="Where the desk stands today" />

      <Panel className="overflow-y-auto">
        {error ? (
          <ErrorState error={error} onRetry={orders.reload} />
        ) : loading ? (
          <LoadingPanel label="Loading the desk" />
        ) : (
          <>
            <div className="border-b border-rule">
              <PipelineBar orders={inFlight} />
            </div>

            <StatRow>
              <StatTile
                label="In flight"
                value={formatCompact(sum(inFlight))}
                sub={inFlight.length + ' in flight'}
              />
              <StatTile
                label="Delivered"
                value={formatCompact(sum(delivered))}
                sub={delivered.length + ' out the door'}
                accent="#34D399"
              />
              <StatTile
                label="Return rate"
                value={returnRate == null ? '-' : returnRate + '%'}
                sub={returnCount + ' came back'}
              />
              <StatTile
                label="New leads"
                value={newLeads.length}
                sub={'of ' + leadRows.length + ' total'}
              />
              <StatTile
                label="Unopened email"
                value={unopened.length}
                sub={'of ' + emailRows.length + ' sent'}
              />
              <StatTile
                label="Running campaigns"
                value={running.length}
                sub={'of ' + campaignRows.length + ' total'}
              />
            </StatRow>

            <div className="grid gap-px bg-rule lg:grid-cols-2">
              <section className="bg-panel">
                <header className="flex items-baseline justify-between gap-2 px-4 pt-4 pb-2">
                  <h2 className="text-sm text-ink">Needs a decision</h2>
                  <Link to="/orders" className="text-xs text-accent hover:underline">
                    All orders
                  </Link>
                </header>
                {attention.length === 0 ? (
                  <p className="px-4 pb-4 text-ink-3">
                    Nothing closing in the next fortnight. The pipeline is calm.
                  </p>
                ) : (
                  <ul className="divide-y divide-rule/70 border-t border-rule">
                    {attention.map(({ deal: order, days }) => (
                      <li key={order.id} className="flex items-center gap-3 px-4 py-2">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-ink">{order.name}</span>
                          <span
                            className={
                              'text-xs ' + (days < 0 ? 'text-heat-2' : 'text-heat-3')
                            }
                          >
                            {days < 0
                              ? 'Overdue by ' + Math.abs(days) + ' days'
                              : days === 0
                                ? 'Closes today'
                                : 'Closes in ' + days + ' days'}
                          </span>
                        </span>
                        <span className="text-xs" style={{ color: deliveryMeta(order.delivery_status).accent }}>{deliveryMeta(order.delivery_status).label}</span>
                        <span className="tnum w-20 shrink-0 text-right text-ink">
                          {formatAmount(order.price)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="bg-panel">
                <header className="flex items-baseline justify-between gap-2 px-4 pt-4 pb-2">
                  <h2 className="text-sm text-ink">Latest email</h2>
                  <Link to="/emails" className="text-xs text-accent hover:underline">
                    All email
                  </Link>
                </header>
                <ul className="divide-y divide-rule/70 border-t border-rule">
                  {recentEmails.map((email) => (
                    <li key={email.id} className="flex items-center gap-3 px-4 py-2">
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
                      <PriorityChip value={email.priority_lvl} compact />
                      <span className="tnum w-14 shrink-0 text-right text-xs text-ink-3">
                        {formatDateShort(email.sent_at)}
                      </span>
                    </li>
                  ))}
                  {recentEmails.length === 0 && (
                    <li className="px-4 py-4 text-ink-3">Nothing sent yet.</li>
                  )}
                </ul>
              </section>
            </div>
          </>
        )}
      </Panel>
    </Screen>
  )
}
