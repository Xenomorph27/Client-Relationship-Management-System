import { makeResource } from './client.js'

const resource = makeResource('customers', 'Customer')

export const listCustomers = resource.list
export const getCustomer = resource.get
export const createCustomer = resource.create
export const updateCustomer = resource.update
export const deleteCustomer = resource.remove
