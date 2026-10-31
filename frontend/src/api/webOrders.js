/**
 * Shop orders (the whole purchase: address, delivery method, payment), read-only.
 *
 * Only exists against the real API. In the sample-data demo no order came
 * from the shop, so there is nothing to fetch and callers get null.
 */
import { http, USING_API } from './client.js'

export async function getWebOrder(id) {
  if (!USING_API || id == null) return null
  return http('/web-orders/' + id)
}

export async function listWebOrders(filters = {}) {
  if (!USING_API) return []
  return http('/web-orders/', { query: { limit: 500, ...filters } })
}
