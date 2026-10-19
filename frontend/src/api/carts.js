import { makeResource } from './client.js'

const resource = makeResource('carts', 'Cart')

export const listCarts = resource.list
export const getCart = resource.get
export const createCart = resource.create
export const updateCart = resource.update
export const deleteCart = resource.remove

/** Insights treats a cart holding two or more items as worth chasing. */
export const PROSPECT_MIN_ITEMS = 2
