/**
 * The swap point between the UI and its data.
 *
 * Two transports live behind one interface, chosen by a single environment
 * variable:
 *
 *   VITE_API_BASE_URL unset  -> the in-memory sample tables (mocks/db.js)
 *   VITE_API_BASE_URL set    -> real HTTP calls to the FastAPI backend
 *
 * Both are kept rather than the mock being deleted, because they do different
 * jobs. The deployed demo has no backend to reach, so without the sample
 * tables it would be a wall of error states; and the frontend stays
 * developable with the API switched off. Nothing above this file knows which
 * is running - function names, arguments and return shapes are identical.
 *
 * Deliberate fidelity choices, which is what makes the swap uneventful:
 *  - list() resolves to a plain array, because FastAPI returns List[Schema]
 *    rather than a paginated envelope.
 *  - get() on a missing id rejects with status 404, matching the routers.
 *  - Every mock call is async with a small delay, so loading states are real
 *    and testable rather than theoretical.
 */

import { nextId, serverFieldsFor, tables } from '../mocks/db.js'
import { accessToken, supabase } from '../lib/supabase.js'

const LATENCY_MS = 180

/** Trailing slashes are stripped so joining paths cannot produce "//orders". */
const API_BASE = (import.meta.env?.VITE_API_BASE_URL ?? '').trim().replace(/\/+$/, '')

/** True when real HTTP is in use. Screens can show which mode they are in. */
export const USING_API = API_BASE.length > 0

export const API_BASE_URL = API_BASE

export class ApiError extends Error {
  constructor(status, message, options) {
    // options carries { cause }, so the original fetch failure is not lost
    // when this wraps it - without it the stack stops here and the real
    // reason the request died is gone.
    super(message, options)
    this.name = 'ApiError'
    this.status = status
  }
}

const settle = (value) =>
  new Promise((resolve) => setTimeout(() => resolve(value), LATENCY_MS))

/** Returned objects are copies, so a screen can never mutate the store. */
const clone = (row) => (row ? { ...row } : row)

/**
 * One fetch wrapper for every call, so error handling exists in exactly one
 * place.
 *
 * FastAPI puts its message in `detail`, so that is unwrapped here rather than
 * surfacing "[object Object]" in a toast. A 204 has no body at all, and
 * calling .json() on it throws, which is why it returns early - that bug
 * turns a successful delete into a visible error.
 */
export async function http(path, { method = 'GET', body, query } = {}) {
  let url = API_BASE + path
  if (query) {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value))
      }
    }
    const qs = params.toString()
    if (qs) url += (url.includes('?') ? '&' : '?') + qs
  }

  // Every call carries the signed-in staff member's token. The backend
  // refuses anything without one, so this is what makes the data reachable at
  // all - not a nicety.
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const token = await accessToken()
  if (token) headers.Authorization = 'Bearer ' + token

  let response
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch (cause) {
    // fetch only rejects when the request never completed - the API is down,
    // the URL is wrong, or CORS blocked it. Said plainly, because the
    // browser's own console message blames the network and sends you
    // debugging the wrong half of the app.
    throw new ApiError(
      0,
      `Cannot reach the API at ${API_BASE}. Is the backend running, and is this origin allowed by CORS?`,
      { cause },
    )
  }

  // A 401 means the session is gone (expired, revoked, or signed out in
  // another tab). Signing out here sends the user back to the login screen
  // instead of leaving every table showing the same error.
  if (response.status === 401 && supabase) {
    await supabase.auth.signOut()
  }

  if (response.status === 204) return { ok: true }

  const text = await response.text()
  let payload = null
  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      payload = text
    }
  }

  if (!response.ok) {
    const detail =
      (payload && typeof payload === 'object' && payload.detail) ||
      (typeof payload === 'string' && payload) ||
      response.statusText
    throw new ApiError(
      response.status,
      typeof detail === 'string' ? detail : JSON.stringify(detail),
    )
  }

  return payload
}

/**
 * Default page size for the real API.
 *
 * Larger than the backend's own default because these screens show whole
 * tables, and a list that silently stops at 100 rows looks like missing data
 * rather than a page boundary. It is still a cap: past this many rows the
 * screens need real pagination, and the aggregates on Statistics would start
 * under-counting. Noted in the backend contract.
 */
const DEFAULT_LIMIT = 500

function httpResource(collection, label) {
  const base = `/${collection}`

  return {
    async list({ skip = 0, limit = DEFAULT_LIMIT, ...filters } = {}) {
      return http(`${base}/`, { query: { skip, limit, ...filters } })
    },

    async get(id) {
      return http(`${base}/${id}`)
    },

    async create(payload) {
      return http(`${base}/`, { method: 'POST', body: payload })
    },

    async update(id, payload) {
      return http(`${base}/${id}`, { method: 'PATCH', body: payload })
    },

    async remove(id) {
      await http(`${base}/${id}`, { method: 'DELETE' })
      return { ok: true }
    },

    _label: label,
  }
}

function mockResource(collection, label) {
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

    async update(id, payload) {
      const row = rows().find((r) => r.id === Number(id))
      if (!row) throw new ApiError(404, label + ' not found')
      Object.assign(row, payload)
      if ('updated_at' in row) row.updated_at = new Date().toISOString().replace('Z', '')
      return settle(clone(row))
    },

    async remove(id) {
      const list = rows()
      const index = list.findIndex((r) => r.id === Number(id))
      if (index === -1) throw new ApiError(404, label + ' not found')
      list.splice(index, 1)
      return settle({ ok: true })
    },

    _label: label,
  }
}

export function makeResource(collection, label) {
  return USING_API ? httpResource(collection, label) : mockResource(collection, label)
}
