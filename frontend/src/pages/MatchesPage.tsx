import { useState } from 'react'
import { Badge, Button, LayerCard, useKumoToastManager } from '@cloudflare/kumo'
import { ArrowClockwise, Sword, Trash } from '@phosphor-icons/react'
import { getClient } from '../api/client'
import { errorText, useApiGet, useApiMutation } from '../hooks/useApi'
import { nameOrId } from '../lib/format'
import { PageHeader } from '../components/PageHeader'
import { ResultsList } from '../components/ResultsList'
import { ConfirmDialog } from '../components/ConfirmDialog'

interface MatchRecord {
  id?: unknown
  hostUserId?: unknown
  hostUserDisplayName?: unknown
  clientVersion?: unknown
  totalSlots?: unknown
  availableSlots?: unknown
  pingMedianMilliseconds?: unknown
  createdAt?: unknown
  [k: string]: unknown
}

const formatDate = (v: unknown): string => {
  if (typeof v !== 'string' || !v) return ''
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? v : d.toLocaleString()
}

export function MatchesPage() {
  const toast = useKumoToastManager()
  const [cursor, setCursor] = useState<number | undefined>(undefined)
  const [cursorStack, setCursorStack] = useState<number[]>([])
  const [deleting, setDeleting] = useState<MatchRecord | null>(null)

  const listInput = { limit: 20, ...(cursor !== undefined ? { cursor } : {}) }
  const removeById = useApiMutation(
    ['DELETE /api/v1/matches/:matchId'],
    (input: { matchId: number }) => getClient().DELETE('/api/v1/matches/:matchId', { params: { path: input } }),
  )

  const list = useApiGet(
    ['GET /api/v1/matches', listInput],
    () => getClient().GET('/api/v1/matches', { params: { query: listInput } }),
  )

  const body = list.data?.isJson && list.data.body && typeof list.data.body === 'object'
    ? (list.data.body as { results?: MatchRecord[]; hasMore?: boolean; nextCursor?: number })
    : { results: [] as MatchRecord[] }
  const nextCursor = body.nextCursor

  const confirmDelete = async () => {
    if (!deleting || deleting.id === undefined) return
    const id = Number(deleting.id)
    const r = await removeById.mutateAsync({ matchId: id })
    if (r.ok) {
      toast.add({ id: 'del-ok', title: `Match ${id} deleted`, variant: 'success' })
      list.refetch()
    } else {
      toast.add({ id: 'del-err', title: `Delete failed (HTTP ${r.status})`, description: errorText(r), variant: 'error' })
    }
    setDeleting(null)
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      <PageHeader
        title="Matches"
        description="Browse all matches on the server and remove ones that are no longer needed."
        icon={<Sword size={20} weight="fill" />}
        actions={
          <Button variant="ghost" size="sm" shape="square" onClick={() => list.refetch()} aria-label="Refresh matches" title="Refresh">
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
          setCursorStack((s) => [...s, cursor ?? 0])
          setCursor(nextCursor)
        }}
        onPrev={() => {
          setCursorStack((s) => {
            const prev = s[s.length - 1]
            setCursor(prev)
            return s.slice(0, -1)
          })
        }}
        emptyLabel="No matches on the server right now."
        renderItem={(item, i) => {
          const m = item as MatchRecord
          const available = typeof m.availableSlots === 'number' ? m.availableSlots : undefined
          const total = typeof m.totalSlots === 'number' ? m.totalSlots : undefined
          const used = available !== undefined && total !== undefined ? total - available : undefined
          const hostId = m.hostUserId !== undefined ? String(m.hostUserId) : ''
          // Name where available, falling back to the raw identifier.
          const host = nameOrId(m.hostUserDisplayName, hostId)
          const version = m.clientVersion !== undefined ? String(m.clientVersion) : ''
          const ping = typeof m.pingMedianMilliseconds === 'number' ? m.pingMedianMilliseconds : undefined
          const joinable = available !== undefined && available > 0
          return (
            <LayerCard key={i} className="p-3.5 sm:p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <dl className="grid gap-x-6 gap-y-1 text-[12px] sm:grid-cols-2">
                    <div className="flex min-w-0 items-baseline gap-2">
                      <dt className="w-20 shrink-0 text-[11px] text-kumo-inactive">Slots</dt>
                      <dd className="min-w-0 truncate text-kumo-subtle">
                        {used !== undefined && total !== undefined ? `${used}/${total}` : '—'}
                        {available !== undefined && total !== undefined && (
                          <Badge variant={joinable ? 'green' : undefined} className="ml-1.5">
                            {joinable ? 'Open' : 'Full'}
                          </Badge>
                        )}
                      </dd>
                    </div>
                    <div className="flex min-w-0 items-baseline gap-2">
                      <dt className="w-20 shrink-0 text-[11px] text-kumo-inactive">Host</dt>
                      <dd className="min-w-0 truncate">
                        {host ? (
                          <span className="token-chip inline-block max-w-56 truncate rounded bg-kumo-tint px-1.5 py-0.5 text-[11px] text-kumo-subtle" title={hostId}>{host}</span>
                        ) : (
                          <span className="text-kumo-subtle">—</span>
                        )}
                      </dd>
                    </div>
                    <div className="flex min-w-0 items-baseline gap-2">
                      <dt className="w-20 shrink-0 text-[11px] text-kumo-inactive">Version</dt>
                      <dd className="min-w-0 truncate text-kumo-subtle">{version ? `v${version}` : '—'}</dd>
                    </div>
                    <div className="flex min-w-0 items-baseline gap-2">
                      <dt className="w-20 shrink-0 text-[11px] text-kumo-inactive">Ping</dt>
                      <dd className="min-w-0 truncate text-kumo-subtle">{ping !== undefined ? `${ping} ms` : '—'}</dd>
                    </div>
                    <div className="flex min-w-0 items-baseline gap-2">
                      <dt className="w-20 shrink-0 text-[11px] text-kumo-inactive">Created</dt>
                      <dd className="min-w-0 truncate text-kumo-subtle">{formatDate(m.createdAt) || 'recently'}</dd>
                    </div>
                  </dl>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    shape="square"
                    disabled={m.id === undefined}
                    onClick={() => setDeleting(m)}
                    aria-label={`Delete match ${String(m.id ?? '')}`}
                    title="Delete match"
                    className="text-kumo-danger hover:bg-kumo-danger-tint"
                  >
                    <Trash size={15} />
                  </Button>
                </div>
              </div>
            </LayerCard>
          )
        }}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this match?"
        description={
          deleting?.id !== undefined ? (
            <>Match #{String(deleting.id)} will be removed from the matchmaking pool. Players will no longer be able to find or join it.</>
          ) : (
            <>This match will be removed from the matchmaking pool. Players will no longer be able to find or join it.</>
          )
        }
        onConfirm={() => void confirmDelete()}
        loading={removeById.isPending}
      />
    </div>
  )
}
