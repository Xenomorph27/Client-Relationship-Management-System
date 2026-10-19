import { makeResource } from './client.js'
import { tables } from '../mocks/db.js'

const resource = makeResource('inventory', 'Item')

export const listInventory = resource.list
export const getItem = resource.get
export const createItem = resource.create
export const updateItem = resource.update
export const deleteItem = resource.remove

/**
 * Move stock by a signed amount, clamped at zero.
 *
 * Returns whether the full amount was available. Callers use that answer to
 * decide whether an order is fulfilled from stock or has to be made, so it
 * reports the shortfall rather than throwing: an order is accepted either way.
 */
export function adjustStock(inventoryId, delta) {
  const item = tables.inventory.find((row) => row.id === Number(inventoryId))
  if (!item) return { ok: false, reason: 'missing', item: null }

  if (delta < 0 && item.quantity < Math.abs(delta)) {
    // Not enough on the shelf. Take what there is and report the gap.
    const taken = item.quantity
    item.quantity = 0
    return { ok: false, reason: 'insufficient', item, taken }
  }

  item.quantity = Math.max(0, item.quantity + delta)
  return { ok: true, reason: null, item, taken: Math.abs(delta) }
}
