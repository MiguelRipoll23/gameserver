import { useState } from 'react'
import { Badge, Button, Input, Text, useKumoToastManager } from '@cloudflare/kumo'
import { SignOut, User } from '@phosphor-icons/react'
import { clearSession, DEFAULT_BASE_URL } from '../lib/config-store'
import { useConfig } from '../lib/config'
import { authenticateWithPasskey } from '../lib/webauthn'

export function ConfigForm() {
  const { config, setConfig } = useConfig()
  const toast = useKumoToastManager()
  const [baseUrl, setBaseUrl] = useState(config.baseUrl || DEFAULT_BASE_URL)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const trimmed = baseUrl.trim().replace(/\/+$/, '')
  const signedIn = Boolean(config.token)
  const urlChanged = trimmed !== config.baseUrl

  const signIn = async () => {
    setBusy(true)
    setError('')
    try {
      const auth = await authenticateWithPasskey(trimmed)
      setConfig({
        baseUrl: trimmed,
        token: auth.accessToken,
        refreshToken: auth.refreshToken,
        userId: auth.userId,
        userDisplayName: auth.userDisplayName,
        userRoles: auth.userRoles,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
      toast.add({ id: 'auth-err', title: 'Sign in failed', description: message, variant: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const signOut = () => {
    clearSession()
    toast.add({ id: 'auth-out', title: 'Signed out', description: 'Your session has ended.', variant: 'success' })
  }

  return (
    <div className="grid gap-4">
      <Input
        label="Base URL"
        placeholder={DEFAULT_BASE_URL}
        value={baseUrl}
        onChange={(e) => setBaseUrl(e.target.value)}
        className="font-mono text-[13px]"
      />

      {signedIn && !urlChanged && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-kumo-base px-3.5 py-3 ring ring-kumo-line">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-kumo-tint text-kumo-brand">
              <User size={17} weight="fill" />
            </span>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-kumo-strong">
                {config.userDisplayName || 'Signed in'}
              </div>
              {config.userId && (
                <div className="truncate font-mono text-[11.5px] text-kumo-subtle">{config.userId}</div>
              )}
              {config.userRoles.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {config.userRoles.map((role) => (
                    <Badge key={role} variant="blue">{role}</Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut} icon={<SignOut size={15} />}>
            Sign out
          </Button>
        </div>
      )}

      {signedIn && urlChanged && (
        <div className="rounded-lg bg-kumo-base px-3.5 py-3 ring ring-kumo-line">
          <Text variant="secondary" size="sm">
            You changed the server URL — sign in again with a passkey to connect to the new server.
          </Text>
        </div>
      )}

      {(!signedIn || urlChanged) && (
        <div className="flex justify-center">
          <Button variant="primary" onClick={() => void signIn()} loading={busy} disabled={!trimmed}>
            Sign in
          </Button>
        </div>
      )}
      {error && <Text variant="error" size="sm">{error}</Text>}
    </div>
  )
}
