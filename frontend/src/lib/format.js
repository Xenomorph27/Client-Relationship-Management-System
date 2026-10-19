/** Display formatting. Nothing here touches data shape, only presentation. */

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

const moneyExact = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
})

/** Amounts arrive as decimal strings from the API, e.g. "125000.00". */
export const formatAmount = (value) =>
  value == null || value === '' ? '—' : money.format(Number(value))

export const formatAmountExact = (value) =>
  value == null || value === '' ? '—' : moneyExact.format(Number(value))

/** Compact form for chart axes and column totals. */
export function formatCompact(value) {
  const n = Number(value ?? 0)
  if (Math.abs(n) >= 1_000_000) return '$' + (n / 1_000_000).toFixed(1) + 'M'
  if (Math.abs(n) >= 1_000) return '$' + Math.round(n / 1_000) + 'k'
  return '$' + n
}

const asDate = (value) => (value ? new Date(value) : null)

export function formatDate(value) {
  const d = asDate(value)
  if (!d || Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatDateShort(value) {
  const d = asDate(value)
  if (!d || Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

export function formatDateTime(value) {
  const d = asDate(value)
  if (!d || Number.isNaN(d.getTime())) return '—'
  return (
    d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' ' +
    d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  )
}

/** Days from now: negative is past. Used for expiry urgency. */
export function daysUntil(value) {
  const d = asDate(value)
  if (!d || Number.isNaN(d.getTime())) return null
  return Math.round((d.getTime() - Date.now()) / 86400000)
}

/** Plain-language time, written the way a person would say it. */
export function relativeTime(value) {
  const days = daysUntil(value)
  if (days === null) return '—'
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  if (days === -1) return 'yesterday'
  if (days > 0) {
    if (days < 30) return 'in ' + days + ' days'
    if (days < 365) return 'in ' + Math.round(days / 30) + ' months'
    return 'in ' + (days / 365).toFixed(1) + ' years'
  }
  const ago = Math.abs(days)
  if (ago < 30) return ago + ' days ago'
  if (ago < 365) return Math.round(ago / 30) + ' months ago'
  return (ago / 365).toFixed(1) + ' years ago'
}

/** snake_case to Sentence case, for values the backend stores as free text. */
export const humanise = (value) =>
  !value ? '—' : String(value).replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())

export const initialsOf = (name) =>
  !name
    ? '?'
    : name
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0])
        .join('')
        .toUpperCase()
