import { makeResource } from './client.js'

const resource = makeResource('users', 'User')

export const listUsers = resource.list
export const getUser = resource.get
export const createUser = resource.create
export const updateUser = resource.update
export const deleteUser = resource.remove
