import { useState } from 'react'
import { DELIVERY_STATUSES, deliveryMeta } from '../../lib/domain.js'
import { formatAmount, formatCompact } from '../../lib/format.js'

/**
 * The shape of the workshop in one mark: every order still in flight, sized by
 * value, ordered by how far through fulfilment it is.
 *
 * A proportional bar rather than four headline numbers, because the first
 * question is "where is the work sitting", which is a question about relative
 * size. Delivered orders are excluded: they are finished, not in flight, and
 * the header says so rather than leaving it to be inferred.
 *
 * Per mark spec: 2px gaps between segments, rounded outer ends, a legend for
 * identity, direct labels on segments wide enough to hold them, and a hover
 * tooltip carrying the exact figures.
 */
export function PipelineBar({ orders }) {
  const [hovered, setHovered] = useState(null)

  const openStatuses = DELIVERY_STATUSES.filter((s) => !deliveryMeta(s).done)
  const segments = openStatuses
    .map((status) => {
      const items = orders.filter((o) => o.delivery_status === status)
      return {
        status,
        label: deliveryMeta(status).label,
        accent: deliveryMeta(status).accent,
        count: items.length,
        value: items.reduce((sum, o) => sum + Number(o.price ?? 0), 0),
      }
    })
    .filter((segment) => segment.value > 0)

  const total = segments.reduce((sum, segment) => sum + segment.value, 0)

  if (total === 0) {
    return (
      <div className="px-4 py-6 text-ink-3">
        Nothing in flight. Every order has been delivered.
      </div>
    )
  }

  return (
    <figure className="px-4 py-4">
      <figcaption className="flex items-baseline gap-3">
        <h2 className="text-sm text-ink">In flight by stage</h2>
        <span className="tnum text-sm text-ink">{formatAmount(total)}</span>
        <span className="text-xs text-ink-3">excludes delivered</span>
      </figcaption>

      <div
        className="mt-3 flex h-9 w-full gap-[2px]"
        role="img"
        aria-label={
          'Orders in flight totalling ' +
          formatAmount(total) +
          '. ' +
          segments
            .map((s) => s.label + ' ' + formatAmount(s.value) + ' across ' + s.count + ' orders')
            .join('. ')
        }
      >
        {segments.map((segment, index) => {
          const share = segment.value / total
          const wide = share > 0.13
          return (
            <div
              key={segment.status}
              onMouseEnter={() => setHovered(segment.status)}
              onMouseLeave={() => setHovered(null)}
              style={{
                width: share * 100 + '%',
                backgroundColor: segment.accent,
                borderTopLeftRadius: index === 0 ? 4 : 0,
                borderBottomLeftRadius: index === 0 ? 4 : 0,
                borderTopRightRadius: index === segments.length - 1 ? 4 : 0,
                borderBottomRightRadius: index === segments.length - 1 ? 4 : 0,
                opacity: hovered && hovered !== segment.status ? 0.45 : 1,
                boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.18)',
              }}
              className="relative flex items-center justify-center overflow-hidden transition-opacity"
            >
              {wide && (
                <span className="tnum px-1 text-2xs text-[#15111f]">
                  {formatCompact(segment.value)}
                </span>
              )}
              {hovered === segment.status && (
                <div className="pointer-events-none absolute -top-1 left-1/2 z-20 w-max -translate-x-1/2 -translate-y-full rounded-control border border-rule-strong bg-raised px-2 py-1.5 shadow-xl">
                  <div className="text-xs text-ink">{segment.label}</div>
                  <div className="tnum text-xs text-ink-2">{formatAmount(segment.value)}</div>
                  <div className="text-2xs text-ink-3">
                    {segment.count} {segment.count === 1 ? 'order' : 'orders'} ·{' '}
                    {Math.round(share * 100)}% in flight
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1">
        {segments.map((segment) => (
          <li key={segment.status} className="flex items-center gap-1.5 text-xs">
            <span
              aria-hidden="true"
              className="h-2 w-2 rounded-[2px]"
              style={{ backgroundColor: segment.accent }}
            />
            <span className="text-ink-2">{segment.label}</span>
            <span className="tnum text-ink-3">{segment.count}</span>
          </li>
        ))}
      </ul>
    </figure>
  )
}
