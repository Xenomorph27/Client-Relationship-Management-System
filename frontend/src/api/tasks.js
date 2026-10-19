import { makeResource } from './client.js'

const resource = makeResource('tasks', 'Task')

export const listTasks = resource.list
export const getTask = resource.get
export const createTask = resource.create
export const updateTask = resource.update
export const deleteTask = resource.remove

/** Ticking a checkbox is a one-field update; naming it keeps call sites clear. */
export const setTaskDone = (id, done) =>
  resource.update(id, {
    is_done: done,
    completed_at: done ? new Date().toISOString().replace('Z', '') : null,
  })
