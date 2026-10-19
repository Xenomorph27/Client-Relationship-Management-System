import { makeResource } from './client.js'

const resource = makeResource('emails', 'Email')

export const listEmails = resource.list
export const getEmail = resource.get
export const createEmail = resource.create
export const updateEmail = resource.update
export const deleteEmail = resource.remove
