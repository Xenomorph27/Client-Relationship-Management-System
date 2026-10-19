import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

/**
 * Two series over time: emails sent, and how many were opened.
 *
 * Both are counts of the same unit, so they share one axis. There is no second
 * y-axis here and there should never be: a dual-axis chart lets you imply any
 * relationship you like by rescaling one side.
 *
 * The pair measures deltaE 24 apart under deuteranopia, and a legend is always
 * present, so identity never rests on colour alone.
 */
const SENT = '#5B8FF9'
const OPENED = '#3FD4A2'

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-control border border-rule-strong bg-raised px-2.5 py-2 shadow-xl">
      <div className="mb-1 text-xs text-ink">{label}</div>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2 text-xs">
          <span
            aria-hidden="true"
            className="h-2 w-2 rounded-[2px]"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-ink-2">{entry.name}</span>
          <span className="tnum ml-auto text-ink">{entry.value}</span>
        </div>
      ))}
    </div>
  )
}

export function TrendChart({ data, height = 200 }) {
  if (!data || data.length === 0) {
    return <p className="px-4 py-6 text-ink-3">No email in this range.</p>
  }

  const rows = data.map((week) => ({
    label: new Date(week.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
    Sent: week.sent,
    Opened: week.opened,
  }))

  return (
    <div className="px-2 py-3" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={{ top: 4, right: 12, bottom: 0, left: -18 }}>
          <defs>
            <linearGradient id="sentFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={SENT} stopOpacity={0.28} />
              <stop offset="100%" stopColor={SENT} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="openedFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={OPENED} stopOpacity={0.28} />
              <stop offset="100%" stopColor={OPENED} stopOpacity={0} />
            </linearGradient>
          </defs>
          {/* Grid and axes stay recessive: the data is the loud part. */}
          <CartesianGrid stroke="#2C3849" strokeDasharray="2 4" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: '#8093B0', fontSize: 11 }}
            axisLine={{ stroke: '#2C3849' }}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: '#8093B0', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={38}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#40506A' }} />
          <Legend
            iconType="square"
            iconSize={8}
            wrapperStyle={{ fontSize: 11, color: '#B4C4DC', paddingTop: 4 }}
          />
          <Area
            type="monotone"
            dataKey="Sent"
            stroke={SENT}
            strokeWidth={2}
            fill="url(#sentFill)"
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: '#0D121B' }}
          />
          <Area
            type="monotone"
            dataKey="Opened"
            stroke={OPENED}
            strokeWidth={2}
            fill="url(#openedFill)"
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: '#0D121B' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
