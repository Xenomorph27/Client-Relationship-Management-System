/**
 * Aggregates for the Statistics screen.
 *
 * Computed here, over the full lists, because the backend has no aggregate
 * endpoint yet - models/analytics.py is still an empty stub. The function
 * names and return shapes are the contract a future /stats endpoint should
 * honour, so wiring it later is a change to this file only.
 *
 * Doing this in SQL is the right end state: GROUP BY over a few thousand rows
 * beats shipping every row to the browser to be reduced.
 */
import { listCampaigns } from './campaigns.js'
import { listCarts } from './carts.js'
import { listCustomers } from './customers.js'
import { listEmails } from './emails.js'
import { listInventory } from './inventory.js'
import { listLeads } from './leads.js'
import { listOrders } from './orders.js'
import { listTasks } from './tasks.js'
import { listUsers } from './users.js'
import { DELIVERY_STATUSES, deliveryMeta, isLowStock, returnMeta, sourceMeta } from '../lib/domain.js'

const LIMIT = { limit: 500 }
const num = (v) => Number(v ?? 0)
const withinDays = (value, days) => {
  if (days == null) return true
  if (!value) return false
  return Date.now() - new Date(value).getTime() <= days * 86400000
}

/** One fetch of everything, so every section stays mutually consistent. */
export async function loadStatsSource() {
  const [orders, inventory, leads, customers, emails, campaigns, users, tasks, carts] =
    await Promise.all([
      listOrders(LIMIT),
      listInventory(LIMIT),
      listLeads(LIMIT),
      listCustomers(LIMIT),
      listEmails(LIMIT),
      listCampaigns(LIMIT),
      listUsers(LIMIT),
      listTasks(LIMIT),
      listCarts(LIMIT),
    ])
  return { orders, inventory, leads, customers, emails, campaigns, users, tasks, carts }
}

const deliveriesOf = (orders, days) =>
  orders.filter((o) => o.kind === 'delivery' && withinDays(o.ordered_at, days))
const returnsOf = (orders, days) =>
  orders.filter((o) => o.kind === 'return' && withinDays(o.ordered_at, days))

/**
 * Fulfilment, not a sales pipeline. The funnel counts how many orders have
 * reached at least each stage, so the drop-off between steps is what shows.
 */
export function fulfilmentStats({ orders }, days) {
  const deliveries = deliveriesOf(orders, days)
  const returns = returnsOf(orders, days)

  const reached = (order) => DELIVERY_STATUSES.indexOf(order.delivery_status)
  const funnel = DELIVERY_STATUSES.map((status, i) => ({
    stage: status,
    label: deliveryMeta(status).label,
    count: deliveries.filter((o) => reached(o) >= i).length,
  }))

  const delivered = deliveries.filter((o) => o.delivery_status === 'delivered')
  const inFlight = deliveries.filter((o) => !deliveryMeta(o.delivery_status).done)

  // Real cycle time, derivable at last because orders carry delivered_at.
  const cycles = delivered
    .filter((o) => o.ordered_at && o.delivered_at)
    .map((o) => (new Date(o.delivered_at) - new Date(o.ordered_at)) / 86400000)

  const byType = returns.reduce((acc, r) => {
    const key = r.return_type ?? 'unset'
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})

  return {
    funnel,
    orderCount: deliveries.length,
    totalValue: deliveries.reduce((s, o) => s + num(o.price), 0),
    inFlightCount: inFlight.length,
    inFlightValue: inFlight.reduce((s, o) => s + num(o.price), 0),
    deliveredCount: delivered.length,
    deliveredValue: delivered.reduce((s, o) => s + num(o.price), 0),
    averageOrder: deliveries.length === 0 ? 0 : deliveries.reduce((s, o) => s + num(o.price), 0) / deliveries.length,
    averageLeadTime: cycles.length === 0 ? null : Math.round(cycles.reduce((s, d) => s + d, 0) / cycles.length),
    returnCount: returns.length,
    returnValue: returns.reduce((s, o) => s + num(o.price), 0),
    returnRate: deliveries.length === 0 ? null : Math.round((returns.length / deliveries.length) * 100),
    returnsByType: Object.entries(byType).map(([key, count]) => ({
      key,
      label: returnMeta(key).label,
      value: count,
    })),
    depositsTaken: deliveries.reduce((s, o) => s + num(o.deposit_paid), 0),
    outstanding: deliveries.reduce((s, o) => s + (num(o.price) - num(o.deposit_paid)), 0),
  }
}

/** Where the money comes from, three ways: status, category, and account. */
export function revenueStats({ orders, inventory, customers }, days) {
  const deliveries = deliveriesOf(orders, days)
  const itemById = new Map(inventory.map((i) => [i.id, i]))
  const customerById = new Map(customers.map((c) => [c.id, c]))

  const byStatus = DELIVERY_STATUSES.map((status) => {
    const items = deliveries.filter((o) => o.delivery_status === status)
    return {
      key: status,
      label: deliveryMeta(status).label,
      value: items.reduce((s, o) => s + num(o.price), 0),
      count: items.length,
    }
  }).filter((row) => row.count > 0)

  const group = (keyOf, labelOf = (k) => k) => {
    const map = new Map()
    for (const order of deliveries) {
      const key = keyOf(order) ?? 'Unattributed'
      const row = map.get(key) ?? { key, label: labelOf(key), value: 0, count: 0 }
      row.value += num(order.price)
      row.count += 1
      map.set(key, row)
    }
    return [...map.values()].sort((a, b) => b.value - a.value)
  }

  const titled = (k) => String(k).replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())

  return {
    byStatus,
    byCategory: group((o) => itemById.get(o.inventory_id)?.category ?? null, titled),
    byWood: group((o) => itemById.get(o.inventory_id)?.wood_type ?? null),
    bySource: group((o) => o.source ?? null, (k) => sourceMeta(k).label),
    topAccounts: group((o) => customerById.get(o.customer_id)?.name ?? null).slice(0, 8),
    total: deliveries.reduce((s, o) => s + num(o.price), 0),
  }
}

/** Stock health: what is short, and how much is sitting on the shelves. */
export function stockStats({ inventory, orders }) {
  const low = inventory.filter(isLowStock)
  const shortfalls = orders.filter((o) => o.stock_status === 'shortfall')
  const valueOf = (rows) =>
    rows.reduce((s, i) => s + Number(i.quantity) * num(i.unit_price), 0)

  return {
    itemCount: inventory.length,
    lowCount: low.length,
    lowItems: [...low].sort((a, b) => a.quantity - b.quantity),
    shortfallCount: shortfalls.length,
    heldValue: valueOf(inventory),
    productValue: valueOf(inventory.filter((i) => i.item_class === 'product')),
    materialValue: valueOf(inventory.filter((i) => i.item_class === 'material')),
  }
}

/**
 * Lead time by category: average days from order to delivery, per kind of
 * piece. Tells you which things consistently run late, which is the workshop
 * question a single average hides.
 */
export function leadTimeStats({ orders, inventory }, days) {
  const itemById = new Map(inventory.map((i) => [i.id, i]))
  const delivered = deliveriesOf(orders, days).filter(
    (o) => o.delivery_status === 'delivered' && o.ordered_at && o.delivered_at,
  )

  const map = new Map()
  for (const order of delivered) {
    const key = itemById.get(order.inventory_id)?.category ?? 'Unattributed'
    const row = map.get(key) ?? { key, label: key, total: 0, count: 0 }
    row.total += (new Date(order.delivered_at) - new Date(order.ordered_at)) / 86400000
    row.count += 1
    map.set(key, row)
  }

  return [...map.values()]
    .map((row) => ({
      key: row.key,
      label: String(row.key).replace(/^./, (c) => c.toUpperCase()),
      value: Math.round(row.total / row.count),
      count: row.count,
    }))
    .sort((a, b) => b.value - a.value)
}

export function outreachStats({ emails, leads, campaigns }, days) {
  const inRange = emails.filter((e) => withinDays(e.sent_at, days))
  const opened = inRange.filter((e) => e.is_opened)

  const weeks = new Map()
  for (const email of inRange) {
    if (!email.sent_at) continue
    const d = new Date(email.sent_at)
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
    const key = d.toISOString().slice(0, 10)
    const row = weeks.get(key) ?? { key, date: d, sent: 0, opened: 0 }
    row.sent += 1
    if (email.is_opened) row.opened += 1
    weeks.set(key, row)
  }

  const lastContact = new Map()
  for (const email of emails) {
    if (!email.lead_id || !email.sent_at) continue
    const t = new Date(email.sent_at).getTime()
    if (!lastContact.has(email.lead_id) || lastContact.get(email.lead_id) < t) {
      lastContact.set(email.lead_id, t)
    }
  }
  const quiet = leads
    .filter((lead) => {
      const last = lastContact.get(lead.id)
      return last == null || Date.now() - last > 30 * 86400000
    })
    .map((lead) => ({ lead, lastContact: lastContact.get(lead.id) ?? null }))
    .sort((a, b) => (a.lastContact ?? 0) - (b.lastContact ?? 0))

  return {
    sent: inRange.length,
    opened: opened.length,
    openRate: inRange.length === 0 ? null : Math.round((opened.length / inRange.length) * 100),
    weekly: [...weeks.values()].sort((a, b) => a.date - b.date),
    quietLeads: quiet,
    runningCampaigns: campaigns.filter((c) => {
      const now = Date.now()
      const start = c.start_date ? new Date(c.start_date).getTime() : null
      const end = c.end_date ? new Date(c.end_date).getTime() : null
      return (!start || now >= start) && (!end || now <= end)
    }).length,
    totalCampaigns: campaigns.length,
  }
}

/** Share of customers who have ordered more than once. */
export function repeatCustomerStats({ orders, customers }, days) {
  const deliveries = deliveriesOf(orders, days)
  const counts = new Map()
  for (const order of deliveries) {
    if (!order.customer_id) continue
    counts.set(order.customer_id, (counts.get(order.customer_id) ?? 0) + 1)
  }
  const buyers = counts.size
  const repeat = [...counts.values()].filter((n) => n > 1).length
  return {
    buyers,
    repeat,
    rate: buyers === 0 ? null : Math.round((repeat / buyers) * 100),
    totalCustomers: customers.length,
  }
}

export function teamStats({ orders, users, tasks }, days) {
  const deliveries = deliveriesOf(orders, days)
  return users
    .map((user) => {
      const owned = deliveries.filter((o) => o.owner_id === user.id)
      const assigned = tasks.filter((t) => t.assignee_id === user.id)
      return {
        user,
        madeValue: owned.reduce((s, o) => s + num(o.price), 0),
        deliveredValue: owned
          .filter((o) => o.delivery_status === 'delivered')
          .reduce((s, o) => s + num(o.price), 0),
        orderCount: owned.length,
        openTasks: assigned.filter((t) => !t.is_done).length,
        doneTasks: assigned.filter((t) => t.is_done).length,
      }
    })
    .sort((a, b) => b.madeValue - a.madeValue)
}
