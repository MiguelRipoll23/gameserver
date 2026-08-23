import { useState } from 'react'
import { Badge, Button, LayerCard, useKumoToastManager } from '@cloudflare/kumo'
import { ArrowClockwise, Broadcast, Trash } from '@phosphor-icons/react'
import { getClient } from '../api/client'
import { errorText, useApiGet, useApiMutation } from '../hooks/useApi'
import { nameOrId } from '../lib/format'
import { PageHeader } from '../components/PageHeader'
import { ResultsList } from '../components/ResultsList'
import { ConfirmDialog } from '../components/ConfirmDialog'

interface SessionRecord {
  userId?: unknown
  userDisplayName?: unknown
  token?: unknown
  publicIp?: unknown
  country?: unknown
  createdAt?: unknown
  updatedAt?: unknown
  [k: string]: unknown
}

const formatDate = (v: unknown): string => {
  if (typeof v !== 'string' || !v) return ''
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? v : d.toLocaleString()
}

export function SessionsPage() {
  const toast = useKumoToastManager()
  const [cursor, setCursor] = useState<string | undefined>(undefined)
  const [cursorStack, setCursorStack] = useState<string[]>([])
  const [deleting, setDeleting] = useState<SessionRecord | null>(null)

  const listInput = { limit: 20, ...(cursor !== undefined ? { cursor } : {}) }
  const list = useApiGet(
    ['GET /api/v1/user-sessions', listInput],
    () => getClient().GET('/api/v1/user-sessions', { params: { query: listInput } }),
  )
  const remove = useApiMutation(
    ['DELETE /api/v1/user-sessions/:userId'],
    (input: { userId: string }) => getClient().DELETE('/api/v1/user-sessions/:userId', { params: { path: input } }),
  )

  const body = list.data?.isJson && list.data.body && typeof list.data.body === 'object'
    ? (list.data.body as { results?: SessionRecord[]; hasMore?: boolean; nextCursor?: string })
    : { results: [] as SessionRecord[] }
  const nextCursor = body.nextCursor

  const confirmDelete = async () => {
    const target = deleting
    setDeleting(null)
    if (!target || target.userId === undefined) return
    const userId = String(target.userId)
    const displayName = nameOrId(target.userDisplayName, userId) || 'this user'
    const r = await remove.mutateAsync({ userId })
    if (r.ok) {
      toast.add({ id: 'sess-del-ok', title: `Sessions ended for ${displayName}`, variant: 'success' })
      list.refetch()
    } else {
      toast.add({ id: 'sess-del-err', title: `Delete failed (HTTP ${r.status})`, description: errorText(r), variant: 'error' })
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      <PageHeader
        title="Sessions"
        description="Live player connections across the server. Sessions end automatically on disconnect, or you can force a player out."
        icon={<Broadcast size={20} weight="fill" />}
        actions={
          <Button variant="ghost" size="sm" shape="square" onClick={() => list.refetch()} aria-label="Refresh sessions" title="Refresh">
            <ArrowClockwise size={14} className={list.isFetching ? 'animate-refresh' : ''} />
          </Button>
        }
      />

      <ResultsList
        result={list.data}
        isLoading={list.isLoading}
        isFetching={list.isFetching}
        hasMore={Boolean(body.hasMore) || nextCursor !== undefined}
        canPrev={cursorStack.length > 0}
        onNext={() => {
          if (nextCursor === undefined) return
          setCursorStack((s) => [...s, cursor ?? ''])
          setCursor(nextCursor)
        }}
        onPrev={() => {
          setCursorStack((s) => {
            const prev = s[s.length - 1]
            setCursor(prev)
            return s.slice(0, -1)
          })
        }}
        emptyLabel="No active sessions right now."
        renderItem={(item, i) => {
          const s = item as SessionRecord
          const userId = s.userId !== undefined ? String(s.userId) : ''
          // Name where available, falling back to the raw identifier.
          const displayName = nameOrId(s.userDisplayName, userId)
          const country = s.country !== undefined && s.country !== null ? String(s.country) : ''
          const ip = s.publicIp !== undefined && s.publicIp !== null ? String(s.publicIp) : ''
          const token = s.token !== undefined && s.token !== null ? String(s.token) : ''
          const tokenShort = token.length > 14 ? `${token.slice(0, 14)}…` : token
          return (
            <LayerCard key={i} className="p-3.5 sm:p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-semibold text-kumo-strong">{displayName || 'Unknown player'}</span>
                    {country && <Badge variant="blue">{country}</Badge>}
                  </div>
                  <dl className="grid gap-x-6 gap-y-1 text-[12px] sm:grid-cols-2">
                    <div className="flex min-w-0 items-baseline gap-2">
                      <dt className="w-20 shrink-0 text-[11px] text-kumo-inactive">User ID</dt>
                      <dd className="min-w-0 truncate font-mono text-kumo-subtle" title={userId}>{userId || '—'}</dd>
                    </div>
                    <div className="flex min-w-0 items-baseline gap-2">
                      <dt className="w-20 shrink-0 text-[11px] text-kumo-inactive">IP address</dt>
                      <dd className="min-w-0 truncate font-mono text-kumo-subtle" title={ip}>{ip || '—'}</dd>
                    </div>
                    <div className="flex min-w-0 items-baseline gap-2">
                      <dt className="w-20 shrink-0 text-[11px] text-kumo-inactive">Token</dt>
                      <dd className="min-w-0 truncate font-mono text-kumo-subtle" title={token}>{tokenShort || '—'}</dd>
                    </div>
                    <div className="flex min-w-0 items-baseline gap-2">
                      <dt className="w-20 shrink-0 text-[11px] text-kumo-inactive">Connected</dt>
                      <dd className="min-w-0 truncate text-kumo-subtle">{formatDate(s.createdAt) || 'recently'}</dd>
                    </div>
                    <div className="flex min-w-0 items-baseline gap-2 sm:col-span-2">
                      <dt className="w-20 shrink-0 text-[11px] text-kumo-inactive">Last active</dt>
                      <dd className="min-w-0 truncate text-kumo-subtle">{formatDate(s.updatedAt) || '—'}</dd>
                    </div>
                  </dl>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  shape="square"
                  disabled={!userId}
                  onClick={() => setDeleting(s)}
                  aria-label={`End all sessions for ${displayName || userId}`}
                  title="End all sessions for this user"
                  className="shrink-0 text-kumo-danger hover:bg-kumo-danger-tint"
                >
                  <Trash size={15} />
                </Button>
              </div>
            </LayerCard>
          )
        }}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="End this user's sessions?"
        description={
          deleting?.userId !== undefined ? (
            <>All active sessions for <span className="font-semibold">{nameOrId(deleting.userDisplayName, String(deleting.userId))}</span> will be terminated immediately, signing the player out on every device.</>
          ) : (
            <>All active sessions for this user will be terminated immediately, signing the player out on every device.</>
          )
        }
        confirmLabel="End sessions"
        onConfirm={() => void confirmDelete()}
        loading={remove.isPending}
      />
    </div>
  )
}
