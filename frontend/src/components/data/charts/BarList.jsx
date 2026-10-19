/**
 * Horizontal bars for a single measure across categories.
 *
 * One hue, not a categorical palette: these charts encode MAGNITUDE, and a
 * different colour per row would imply the categories are unrelated identities
 * rather than sizes of the same thing.
 *
 * Every row is directly labelled with its own value, so nothing here depends
 * on reading a colour, and the list doubles as its own table view.
 */
export function BarList({ rows, format, accent = '#ffb03a', emptyLabel = 'Nothing to show' }) {
  if (!rows || rows.length === 0) {
    return <p className="px-4 py-6 text-ink-3">{emptyLabel}</p>
  }

  const max = Math.max(...rows.map((r) => r.value), 0) || 1

  return (
    <ul className="space-y-1.5 px-4 py-3">
      {rows.map((row) => (
        <li key={row.key ?? row.label} className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3">
          <span className="truncate text-xs text-ink-2" title={row.label}>
            {row.label}
          </span>
          <span className="h-4 w-full overflow-hidden rounded-[3px] bg-raised">
            <span
              className="block h-full rounded-[3px]"
              style={{
                width: Math.max((row.value / max) * 100, row.value > 0 ? 2 : 0) + '%',
                // A row can carry its own colour when the category already
                // means something elsewhere - a Negotiation bar should be the
                // colour Negotiation is on the pipeline board.
                backgroundColor: row.color ?? accent,
                boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.16)',
              }}
            />
          </span>
          <span className="tnum w-24 text-right text-xs text-ink">
            {format ? format(row.value) : row.value}
            {row.count != null && <span className="ml-2 text-ink-3">{row.count}</span>}
          </span>
        </li>
      ))}
    </ul>
  )
}

/**
 * The pipeline funnel. Each step is drawn to scale against the widest step, so
 * the drop-off between stages is the thing you see first. The percentage shown
 * is conversion from the previous step, which is the number a sales desk acts
 * on - not the percentage of the original total.
 */
export function Funnel({ steps, accent = '#ffb03a' }) {
  if (!steps || steps.length === 0) {
    return <p className="px-4 py-6 text-ink-3">Nothing in this range.</p>
  }
  const max = Math.max(...steps.map((s) => s.count), 0) || 1

  return (
    <ul className="space-y-1.5 px-4 py-3">
      {steps.map((step, i) => {
        const previous = i === 0 ? null : steps[i - 1].count
        const conversion = previous ? Math.round((step.count / previous) * 100) : null
        return (
          <li key={step.stage} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3">
            <span className="truncate text-xs text-ink-2">{step.label}</span>
            <span className="h-5 w-full overflow-hidden rounded-[3px] bg-raised">
              <span
                className="flex h-full items-center justify-end rounded-[3px] px-1.5"
                style={{
                  width: Math.max((step.count / max) * 100, step.count > 0 ? 6 : 0) + '%',
                  // The funnel IS the pipeline, so each step wears the stage
                  // colour it already has on the board.
                  backgroundColor: step.color ?? accent,
                  boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.18)',
                }}
              >
                <span className="tnum text-2xs text-[#06121f]">{step.count}</span>
              </span>
            </span>
            <span className="tnum w-16 text-right text-xs text-ink-3">
              {conversion == null ? '—' : conversion + '%'}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
