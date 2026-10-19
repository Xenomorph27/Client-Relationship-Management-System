import { useMemo, useState } from 'react'
import { useAsync } from '../hooks/useAsync.js'
import {
  fulfilmentStats,
  leadTimeStats,
  loadStatsSource,
  outreachStats,
  repeatCustomerStats,
  revenueStats,
  stockStats,
  teamStats,
} from '../api/stats.js'
import { PageHeader, Panel, Screen } from '../components/layout/PageHeader.jsx'
import { FilterSelect } from '../components/data/Toolbar.jsx'
import { BarList, Funnel } from '../components/data/charts/BarList.jsx'
import { TrendChart } from '../components/data/charts/TrendChart.jsx'
import { StatRow, StatTile } from '../components/data/StatTile.jsx'
import { ErrorState } from '../components/ui/EmptyState.jsx'
import { LoadingPanel } from '../components/ui/Spinner.jsx'
import { deliveryMeta, sourceMeta, unitMeta } from '../lib/domain.js'
import { categorical } from '../lib/chartPalette.js'
import { formatAmount, formatCompact, relativeTime } from '../lib/format.js'

const RANGES = [
  { value: '', label: 'All time' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '180', label: 'Last 6 months' },
  { value: '365', label: 'Last year' },
]

function Section({ title, question, children, className = '' }) {
  return (
    <section className={'border-t border-rule ' + className}>
      <header className="px-4 pt-4 pb-1">
        <h2 className="text-sm text-ink">{title}</h2>
        {question && <p className="mt-0.5 text-xs text-ink-3">{question}</p>}
      </header>
      {children}
    </section>
  )
}

export default function Statistics() {
  const source = useAsync(() => loadStatsSource(), [])
  const [range, setRange] = useState('')
  const days = range === '' ? null : Number(range)

  const stats = useMemo(() => {
    if (!source.data) return null
    return {
      fulfilment: fulfilmentStats(source.data, days),
      revenue: revenueStats(source.data, days),
      stock: stockStats(source.data),
      leadTime: leadTimeStats(source.data, days),
      outreach: outreachStats(source.data, days),
      repeat: repeatCustomerStats(source.data, days),
      team: teamStats(source.data, days),
    }
  }, [source.data, days])

  /** One category-to-colour scale, shared so a market keeps its hue. */
  const categoryColour = useMemo(() => {
    const order = (stats?.revenue.byCategory ?? [])
      .map((r) => r.key)
      .filter((k) => k !== 'Unattributed')
    const scale = new Map(order.map((k, i) => [k, categorical(i)]))
    return (k) => (k == null || k === 'Unattributed' ? '#6b7a91' : (scale.get(k) ?? '#6b7a91'))
  }, [stats])

  return (
    <Screen>
      <PageHeader
        title="Statistics"
        description="What the workshop actually did"
        actions={
          <FilterSelect value={range} onChange={setRange} label="Date range">
            {RANGES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </FilterSelect>
        }
      />

      <Panel className="overflow-y-auto">
        {source.error ? (
          <ErrorState error={source.error} onRetry={source.reload} />
        ) : source.loading || !stats ? (
          <LoadingPanel label="Crunching the numbers" />
        ) : (
          <>
            <StatRow>
              <StatTile
                label="Order value"
                value={formatCompact(stats.fulfilment.totalValue)}
                sub={stats.fulfilment.orderCount + ' orders'}
              />
              <StatTile
                label="Delivered"
                value={formatCompact(stats.fulfilment.deliveredValue)}
                sub={stats.fulfilment.deliveredCount + ' out the door'}
                accent="#00e093"
              />
              <StatTile
                label="Outstanding"
                value={formatCompact(stats.fulfilment.outstanding)}
                sub={formatCompact(stats.fulfilment.depositsTaken) + ' taken as deposits'}
                accent="#ffc61a"
              />
              <StatTile
                label="Return rate"
                value={stats.fulfilment.returnRate == null ? '-' : stats.fulfilment.returnRate + '%'}
                sub={stats.fulfilment.returnCount + ' came back'}
              />
              <StatTile
                label="Lead time"
                value={stats.fulfilment.averageLeadTime == null ? '-' : stats.fulfilment.averageLeadTime + 'd'}
                sub="order to delivery"
              />
              <StatTile
                label="Repeat buyers"
                value={stats.repeat.rate == null ? '-' : stats.repeat.rate + '%'}
                sub={stats.repeat.repeat + ' of ' + stats.repeat.buyers + ' customers'}
              />
              <StatTile
                label="Low stock"
                value={stats.stock.lowCount}
                sub={stats.stock.shortfallCount + ' orders need making'}
                accent={stats.stock.lowCount > 0 ? '#ff8a3d' : undefined}
              />
            </StatRow>

            <div className="grid gap-px bg-rule lg:grid-cols-2">
              <Section title="Fulfilment" question="Where do orders stop moving?" className="bg-panel">
                <Funnel
                  steps={stats.fulfilment.funnel.map((step) => ({
                    ...step,
                    color: deliveryMeta(step.stage).accent,
                  }))}
                />
                <p className="px-4 pb-3 text-2xs text-ink-3">
                  The right-hand figure is how many carried through from the step above.
                </p>
              </Section>

              <Section title="Value by status" question="How much is sold but not yet out the door?" className="bg-panel">
                <BarList
                  rows={stats.revenue.byStatus.map((row) => ({
                    ...row,
                    color: deliveryMeta(row.key).accent,
                  }))}
                  format={formatAmount}
                />
              </Section>

              <Section title="Revenue by source" question="Which channel actually produces money?" className="bg-panel">
                <BarList
                  rows={stats.revenue.bySource.map((row) => ({
                    ...row,
                    color: sourceMeta(row.key).accent,
                  }))}
                  format={formatAmount}
                />
              </Section>

              <Section title="Revenue by category" question="Which pieces pay?" className="bg-panel">
                <BarList
                  rows={stats.revenue.byCategory.map((row) => ({
                    ...row,
                    color: categoryColour(row.key),
                  }))}
                  format={formatAmount}
                />
              </Section>

              <Section title="Revenue by wood" question="What are we actually selling?" className="bg-panel">
                <BarList
                  rows={stats.revenue.byWood.map((row, i) => ({ ...row, color: categorical(i) }))}
                  format={formatAmount}
                />
              </Section>

              <Section title="Lead time by category" question="Which pieces run late?" className="bg-panel">
                <BarList
                  rows={stats.leadTime.map((row) => ({ ...row, color: categoryColour(row.key) }))}
                  format={(v) => v + ' days'}
                  emptyLabel="Nothing delivered yet in this range."
                />
              </Section>

              <Section title="Top accounts" question="Who is worth the most?" className="bg-panel">
                <BarList rows={stats.revenue.topAccounts} format={formatAmount} />
              </Section>

              <Section title="Returns" question="What comes back, and what do they want?" className="bg-panel">
                <BarList
                  rows={stats.fulfilment.returnsByType.map((row, i) => ({
                    ...row,
                    color: categorical(i + 3),
                  }))}
                  format={(v) => v + (v === 1 ? ' return' : ' returns')}
                  emptyLabel="Nothing has come back."
                />
              </Section>

              <Section title="Outreach over time" question="Are we keeping in touch?" className="bg-panel lg:col-span-2">
                <TrendChart data={stats.outreach.weekly} />
              </Section>

              <Section title="Running low" question="What needs restocking?" className="bg-panel">
                {stats.stock.lowItems.length === 0 ? (
                  <p className="px-4 py-6 text-ink-3">Everything is above its reorder level.</p>
                ) : (
                  <ul className="divide-y divide-rule/70 border-t border-rule">
                    {stats.stock.lowItems.slice(0, 8).map((item) => (
                      <li key={item.id} className="flex items-center gap-3 px-4 py-2">
                        <span className="min-w-0 flex-1 truncate text-ink">{item.name}</span>
                        <span className="tnum text-xs text-ink-3">
                          reorder at {item.reorder_level}
                        </span>
                        <span className="tnum w-20 text-right text-heat-2">
                          {item.quantity} {unitMeta(item.unit).label}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="px-4 pb-3 pt-2 text-2xs text-ink-3">
                  {formatAmount(stats.stock.heldValue)} held in stock overall.
                </p>
              </Section>

              <Section title="Team" question="Who is making what?" className="bg-panel">
                <ul className="divide-y divide-rule/70 border-t border-rule">
                  {stats.team.map((row) => (
                    <li key={row.user.id} className="px-4 py-2.5">
                      <div className="flex items-baseline gap-3">
                        <span className="min-w-0 flex-1 truncate text-ink">{row.user.full_name}</span>
                        <span className="tnum text-xs text-ink-2">
                          {formatCompact(row.madeValue)} made
                        </span>
                        <span className="tnum w-20 text-right text-xs text-won">
                          {formatCompact(row.deliveredValue)} out
                        </span>
                      </div>
                      <div className="mt-1 text-2xs text-ink-3">
                        {row.orderCount} orders, {row.openTasks} open tasks, {row.doneTasks} done
                      </div>
                    </li>
                  ))}
                </ul>
              </Section>

              <Section
                title="Gone quiet"
                question="Who has not heard from us in 30 days?"
                className="bg-panel lg:col-span-2"
              >
                {stats.outreach.quietLeads.length === 0 ? (
                  <p className="px-4 py-6 text-ink-3">Every lead has been contacted recently.</p>
                ) : (
                  <ul className="divide-y divide-rule/70 border-t border-rule">
                    {stats.outreach.quietLeads.slice(0, 6).map(({ lead, lastContact }) => (
                      <li key={lead.id} className="flex items-center gap-3 px-4 py-2">
                        <span className="min-w-0 flex-1 truncate text-ink">{lead.name}</span>
                        <span style={{ color: sourceMeta(lead.source).accent }} className="text-xs">
                          {sourceMeta(lead.source).label}
                        </span>
                        <span className="tnum w-24 shrink-0 text-right text-xs text-ink-3">
                          {lastContact == null ? 'never' : relativeTime(lastContact)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            </div>
          </>
        )}
      </Panel>
    </Screen>
  )
}
