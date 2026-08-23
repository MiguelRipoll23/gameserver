import { consumeMagicLink } from './magic-link'

export const DEFAULT_BASE_URL = 'http://127.0.0.1:8787'
const STORAGE_KEY = 'gameserver-manager.config.v1'

export interface AppConfig {
  /** Base URL of the OpenAPI game server (no trailing slash). */
  baseUrl: string
  /** JWT access token sent as `Authorization: Bearer <token>`. */
  token: string
  /** Opaque refresh token used to rotate and issue new access tokens. */
  refreshToken: string
  /** User info returned by passkey authentication (display only). */
  userId: string
  userDisplayName: string
  userRoles: string[]
}

const defaultConfig: AppConfig = {
  baseUrl: DEFAULT_BASE_URL,
  token: '',
  refreshToken: '',
  userId: '',
  userDisplayName: '',
  userRoles: [],
}

function normalizeConfig(cfg: Partial<AppConfig> | null | undefined): AppConfig {
  const baseUrl = (cfg?.baseUrl ?? '').trim().replace(/\/+$/, '')
  return {
    baseUrl: baseUrl || DEFAULT_BASE_URL,
    token: cfg?.token ?? '',
    refreshToken: cfg?.refreshToken ?? '',
    userId: cfg?.userId ?? '',
    userDisplayName: cfg?.userDisplayName ?? '',
    userRoles: Array.isArray(cfg?.userRoles) ? [...cfg.userRoles] : [],
  }
}

export function loadConfig(): AppConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultConfig
    return normalizeConfig(JSON.parse(raw) as Partial<AppConfig>)
  } catch {
    return defaultConfig
  }
}

/**
 * If the page was opened via a magic link (tokens in the URL hash), adopt that
 * session before the first read and persist it so the rest of the app signs in
 * without a passkey.
 */
function applyMagicLink(): void {
  const magic = consumeMagicLink()
  if (!magic) return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeConfig({ ...loadConfig(), ...magic })))
  } catch {
    // Storage unavailable — fall back to the existing (possibly empty) config.
  }
}

applyMagicLink()

/** Module-level mutable store so non-React code (the API client) can read config synchronously. */
let configSnapshot: AppConfig = loadConfig()
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

export function getConfigSnapshot(): AppConfig {
  return configSnapshot
}

export function subscribeConfig(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function saveConfig(next: Partial<AppConfig>): AppConfig {
  configSnapshot = normalizeConfig({ ...configSnapshot, ...next })
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(configSnapshot))
  } catch {
    // Storage unavailable (private mode, etc.) — keep in-memory config only.
  }
  emit()
  return configSnapshot
}

/**
 * Ends the authenticated session while keeping the server base URL.
 * Used by the "Sign out" action and when token refresh fails.
 */
export function clearSession(): AppConfig {
  return saveConfig({
    token: '',
    refreshToken: '',
    userId: '',
    userDisplayName: '',
    userRoles: [],
  })
}

export function resetConfig(): AppConfig {
  configSnapshot = defaultConfig
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
  emit()
  return configSnapshot
}

export function isConfigured(cfg: AppConfig): boolean {
  return Boolean(cfg.baseUrl && cfg.baseUrl !== DEFAULT_BASE_URL)
}
