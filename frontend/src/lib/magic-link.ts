import type { AppConfig } from './config-store'

/*
 * Magic links embed the current session (base URL + access token + identity)
 * in the URL hash so an invited viewer is signed in without registering a
 * passkey. The refresh token is deliberately left out so an invitee can never
 * rotate (and thereby invalidate) the owner's session; the link only works for
 * as long as the short-lived access token remains valid.
 */

const PARAM = {
  baseUrl: 'baseUrl',
  token: 'token',
  userId: 'userId',
  userDisplayName: 'userDisplayName',
  userRoles: 'userRoles',
} as const

/** Builds a shareable URL that signs the opener in with the given session. */
export function buildMagicLink(config: AppConfig): string {
  const params = new URLSearchParams()
  if (config.baseUrl) params.set(PARAM.baseUrl, config.baseUrl)
  if (config.token) params.set(PARAM.token, config.token)
  if (config.userId) params.set(PARAM.userId, config.userId)
  if (config.userDisplayName) params.set(PARAM.userDisplayName, config.userDisplayName)
  if (config.userRoles.length > 0) params.set(PARAM.userRoles, config.userRoles.join(','))

  const base = typeof window !== 'undefined' ? window.location.href.split('#')[0] : ''
  return `${base}#/?${params.toString()}`
}

/**
 * Reads a magic link from the current URL hash (e.g. `#/?token=…`) and, when
 * found, strips it from the address bar so the tokens don't linger in history.
 * Returns the embedded config fields, or null when this isn't a magic link.
 */
export function consumeMagicLink(): Partial<AppConfig> | null {
  if (typeof window === 'undefined') return null
  const hash = window.location.hash
  const qIndex = hash.indexOf('?')
  if (qIndex < 0) return null

  const params = new URLSearchParams(hash.slice(qIndex + 1))
  const token = params.get(PARAM.token)
  if (!token) return null

  const userRoles = (params.get(PARAM.userRoles) ?? '')
    .split(',')
    .map((role) => role.trim())
    .filter(Boolean)

  const base = window.location.href.split('#')[0]
  const cleanHash = hash.slice(0, qIndex) || '#/'
  window.history.replaceState(null, '', `${base}${cleanHash}`)

  return {
    baseUrl: params.get(PARAM.baseUrl) ?? '',
    token,
    userId: params.get(PARAM.userId) ?? '',
    userDisplayName: params.get(PARAM.userDisplayName) ?? '',
    userRoles,
  }
}
