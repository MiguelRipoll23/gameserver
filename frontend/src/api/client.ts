import createClient, { defaultPathSerializer } from 'openapi-fetch'
import type { paths } from './schema'
import { clearSession, getConfigSnapshot, saveConfig } from '../lib/config-store'
import { refreshTokens } from '../lib/webauthn'

type ApiClient = ReturnType<typeof createClient<paths>>

export interface RunResult {
  ok: boolean
  status: number
  statusText: string
  durationMs: number
  contentType: string | null
  url: string
  isJson: boolean
  bodyText: string
  body: unknown
}

let cached: { key: string; client: ApiClient } | null = null

/**
 * Returns a cached openapi-fetch client bound to the current base URL + token.
 * The instance is recreated whenever either changes, so the authorization
 * header always matches the stored configuration.
 */
export function getClient(): ApiClient {
  const cfg = getConfigSnapshot()
  const key = `${cfg.baseUrl}::${cfg.token}`
  if (cached && cached.key === key) return cached.client
  const client = createClient<paths>({
    baseUrl: cfg.baseUrl,
    headers: cfg.token ? { Authorization: `Bearer ${cfg.token}` } : {},
    // Never serve API responses from the browser's HTTP cache: refresh buttons
    // must hit the server even when the data is identical.
    cache: 'no-store',
    // The spec declares path params with `:name` (e.g. `/api/v1/users/:userId`),
    // but openapi-fetch substitutes `{name}` placeholders. Normalize before serializing.
    pathSerializer: (pathname, pathParams) =>
      defaultPathSerializer(pathname.replace(/:([A-Za-z0-9_]+)/g, '{$1}'), pathParams),
  })
  // Short-lived access tokens expire: rotate once and retry the request transparently.
  client.use({
    async onResponse({ request, response }) {
      if (response.status !== 401 || !(await tryRefresh())) return
      const headers = new Headers(request.headers)
      headers.set('Authorization', `Bearer ${getConfigSnapshot().token}`)
      return fetch(new Request(request, { headers }))
    },
  })
  cached = { key, client }
  return client
}

/* ------------------------------------------------------------------ */
/* Token refresh on 401                                                */
/* ------------------------------------------------------------------ */

/** In-flight refresh so concurrent 401s share a single token rotation. */
let refreshPromise: Promise<boolean> | null = null

/**
 * Rotates the refresh token once. Resolves true when a new access token
 * was stored, false when there was nothing to refresh or it failed (the
 * session is cleared so the welcome page is shown again).
 */
async function tryRefresh(): Promise<boolean> {
  const cfg = getConfigSnapshot()
  if (!cfg.baseUrl || !cfg.refreshToken) return false

  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const pair = await refreshTokens(cfg.baseUrl, cfg.refreshToken)
        saveConfig({ token: pair.accessToken, refreshToken: pair.refreshToken })
        return true
      } catch {
        // Refresh token is invalid or expired — end the session.
        clearSession()
        return false
      } finally {
        refreshPromise = null
      }
    })()
  }
  return refreshPromise
}

/* ------------------------------------------------------------------ */
/* Result formatting                                                   */
/* ------------------------------------------------------------------ */

/**
 * Normalizes an openapi-fetch outcome into the display shape used across the UI.
 * `startMs` is a `performance.now()` captured before the request was issued.
 */
export function toRunResult(
  startMs: number,
  data: unknown,
  error: unknown,
  response: Response,
): RunResult {
  const body = data !== undefined ? data : error
  const isJson = typeof body === 'object' && body !== null
  const bodyText =
    isJson ? JSON.stringify(body, null, 2)
    : typeof body === 'string' ? body
    : body === null || body === undefined ? ''
    : String(body)
  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    durationMs: Math.round(performance.now() - startMs),
    contentType: response.headers.get('content-type'),
    url: response.url,
    isJson,
    bodyText,
    body: body ?? null,
  }
}

/** Normalizes a thrown network error into the same display shape. */
export function networkError(startMs: number, err: unknown): RunResult {
  const message = err instanceof Error ? err.message : String(err)
  return {
    ok: false,
    status: 0,
    statusText: 'Network error',
    durationMs: Math.round(performance.now() - startMs),
    contentType: null,
    url: '',
    isJson: false,
    bodyText: message,
    body: null,
  }
}
