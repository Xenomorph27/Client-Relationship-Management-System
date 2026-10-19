/**
 * The swap point between the UI and its data.
 *
 * Right now every call reads the in-memory mock tables. When the FastAPI
 * backend is wired in, only this file changes: each method becomes a fetch()
 * against http://127.0.0.1:8000. Function names, arguments and return shapes
 * already match the real REST API, so no screen has to change.
 *
 * Deliberate fidelity choices:
 *  - list() resolves to a plain array, because FastAPI returns List[Schema]
 *    rather than a paginated envelope.
 *  - get() on a missing id rejects with status 404, matching the routers.
 *  - Every call is async with a small delay, so loading states are real and
 *    testable rather than theoretical.
 */

import { nextId, serverFieldsFor, tables } from '../mocks/db.js'

const LATENCY_MS = 180

export class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

const settle = (value) =>
  new Promise((resolve) => setTimeout(() => resolve(value), LATENCY_MS))

/** Returned objects are copies, so a screen can never mutate the store. */
const clone = (row) => (row ? { ...row } : row)

export function makeResource(collection, label) {
  const rows = () => tables[collection]

  return {
    async list({ skip = 0, limit = 100 } = {}) {
      const page = rows()
        .slice()
        .sort((a, b) => a.id - b.id)
        .slice(skip, skip + limit)
        .map(clone)
      return settle(page)
    },

    async get(id) {
      const row = rows().find((r) => r.id === Number(id))
      if (!row) throw new ApiError(404, label + ' not found')
      return settle(clone(row))
    },

    async create(payload) {
      const row = {
        id: nextId(collection),
        priority_lvl: 'low_priority',
        ...payload,
        ...serverFieldsFor(collection),
      }
      rows().push(row)
      return settle(clone(row))
    },

    /**
     * The real API has no PATCH yet, so wiring this up needs the backend
     * extended first. The UI is built against the shape it will have.
     */
    async update(id, payload) {
      const row = rows().find((r) => r.id === Number(id))
      if (!row) throw new ApiError(404, label + ' not found')
      Object.assign(row, payload)
      if ('updated_at' in row) row.updated_at = new Date().toISOString().replace('Z', '')
      return settle(clone(row))
    },

    /** Also absent from the real API today. See the note on update(). */
    async remove(id) {
      const list = rows()
      const index = list.findIndex((r) => r.id === Number(id))
      if (index === -1) throw new ApiError(404, label + ' not found')
      list.splice(index, 1)
      return settle({ ok: true })
    },
  }
}
