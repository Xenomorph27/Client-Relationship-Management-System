import { makeResource } from './client.js'

const resource = makeResource('leads', 'Lead')

export const listLeads = resource.list
export const getLead = resource.get
export const createLead = resource.create
export const updateLead = resource.update
export const deleteLead = resource.remove
