import { makeResource } from './client.js'

const resource = makeResource('organisations', 'Organisation')

export const listOrganisations = resource.list
export const getOrganisation = resource.get
export const createOrganisation = resource.create
export const updateOrganisation = resource.update
export const deleteOrganisation = resource.remove
