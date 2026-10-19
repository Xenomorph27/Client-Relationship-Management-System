/**
 * Orders, and the stock rule that runs when one is placed.
 *
 * WARNING, and it matters: the check-then-decrement below is correct for a
 * single-user mock and WRONG for a real deployment. Two people ordering the
 * last chair at once would both pass the check and both decrement - a textbook
 * lost update. In production this belongs in ONE server-side transaction
 * (UPDATE ... WHERE quantity >= n, then inspect rows affected). It lives here
 * only because the mock has no server. See frontend/README.md.
 */
import { makeResource } from './client.js'
import { adjustStock } from './inventory.js'
import { createTask } from './tasks.js'
import { tables } from '../mocks/db.js'
import { returnMeta } from '../lib/domain.js'

const resource = makeResource('orders', 'Order')

export const listOrders = resource.list
export const getOrder = resource.get
export const updateOrder = resource.update
export const deleteOrder = resource.remove

/** Sequential human-facing reference, separate from the row id. */
function nextRef(prefix) {
  const used = tables.orders
    .map((o) => Number(String(o.order_ref).replace(/\D/g, '')))
    .filter((n) => !Number.isNaN(n))
  return prefix + (Math.max(1000, ...used) + 1)
}

const itemById = (id) => tables.inventory.find((row) => row.id === Number(id)) ?? null

const nowIso = () => new Date().toISOString().replace('Z', '')

const blankTaskLinks = {
  lead_id: null,
  customer_id: null,
  organisation_id: null,
  campaign_id: null,
}

/**
 * Place a delivery order.
 *
 *   is the item in stock?
 *     yes -> take it off the shelf, confirm              (fulfilled)
 *     no  -> accept the order anyway, raise a shortfall  (shortfall)
 *
 * A shortfall is not a rejection. The order stands; the workshop is told to
 * make the piece, through a task on the board people already watch.
 */
export async function placeOrder(payload) {
  const item = payload.inventory_id ? itemById(payload.inventory_id) : null
  let stock_status = 'fulfilled'

  if (item) {
    const result = adjustStock(item.id, -1)
    if (!result.ok) stock_status = 'shortfall'
  } else if (payload.inventory_id) {
    stock_status = 'shortfall'
  }

  const order = await resource.create({
    ...payload,
    order_ref: payload.order_ref || nextRef('WC-'),
    kind: 'delivery',
    stock_status,
    image: payload.image ?? item?.image ?? null,
    delivered_at: payload.delivery_status === 'delivered' ? nowIso() : null,
    return_type: null,
    remarks: null,
    returns_order_id: null,
  })

  if (stock_status === 'shortfall') {
    await createTask({
      ...blankTaskLinks,
      title: 'Make ' + (item?.name ?? order.name) + ' - not in stock',
      notes: 'Raised automatically: order ' + order.order_ref + ' was accepted with nothing on the shelf.',
      due_date: order.delivery_due ?? null,
      is_done: false,
      completed_at: null,
      priority_lvl: 'high_priority',
      assignee_id: order.owner_id ?? null,
      order_id: order.id,
      customer_id: order.customer_id ?? null,
    })
  }

  return order
}

/**
 * Record a return against an existing order.
 *
 * The stock consequence depends on what the customer wants, which is exactly
 * why return_type is an enum and not a free-text note: a refund puts the piece
 * back on the shelf, an exchange swaps it, and a modification sends it to the
 * bench instead of into stock.
 */
export async function recordReturn(payload) {
  const original = payload.returns_order_id
    ? tables.orders.find((o) => o.id === Number(payload.returns_order_id))
    : null
  const inventoryId = payload.inventory_id ?? original?.inventory_id ?? null
  const meta = returnMeta(payload.return_type)

  if (inventoryId && meta.restocks) {
    adjustStock(inventoryId, +1)
    // An exchange also sends a replacement back out.
    if (payload.return_type === 'exchange') adjustStock(inventoryId, -1)
  }

  const order = await resource.create({
    ...payload,
    order_ref: payload.order_ref || nextRef('WC-R'),
    kind: 'return',
    inventory_id: inventoryId,
    deposit_paid: '0.00',
    stock_status: 'fulfilled',
    image: payload.image ?? original?.image ?? itemById(inventoryId)?.image ?? null,
    delivered_at: payload.delivery_status === 'delivered' ? nowIso() : null,
  })

  if (payload.return_type === 'exchange_modified') {
    await createTask({
      ...blankTaskLinks,
      title: 'Modify ' + order.name + ' - returned for rework',
      notes: payload.remarks || 'Returned for modification.',
      due_date: order.delivery_due ?? null,
      is_done: false,
      completed_at: null,
      priority_lvl: 'high_priority',
      assignee_id: order.owner_id ?? null,
      order_id: order.id,
      customer_id: order.customer_id ?? null,
    })
  }

  return order
}

/** Used by the Logistics board when a card is dragged between columns. */
export const setDeliveryStatus = (id, delivery_status) =>
  resource.update(id, {
    delivery_status,
    delivered_at: delivery_status === 'delivered' ? nowIso() : null,
  })

/** Outstanding money, always derived so it cannot disagree with the deposit. */
export const balanceOf = (order) =>
  Number(order?.price ?? 0) - Number(order?.deposit_paid ?? 0)
