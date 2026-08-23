import { useEffect, useState } from 'react'
import { keepPreviousData } from '@tanstack/react-query'
import {
  Badge,
  Button,
  Dialog,
  Input,
  LayerCard,
  Tabs,
  Text,
  useKumoToastManager,
} from '@cloudflare/kumo'
import { ArrowClockwise, CaretLeft, CaretRight, CheckCircle, Flag, Prohibit, Shield, SlidersHorizontal, UserGear, Users } from '@phosphor-icons/react'
import { getClient } from '../api/client'
import type { RunResult } from '../api/client'
import { errorText, useApiGet, useApiMutation } from '../hooks/useApi'
import { nameOrId } from '../lib/format'
import { PageHeader } from '../components/PageHeader'
import { ResultsList } from '../components/ResultsList'

interface UserRecord {
  userId?: unknown
  id?: unknown
  displayName?: unknown
  [k: string]: unknown
}

const userIdOf = (u: UserRecord): string | undefined => {
  const v = u.userId ?? u.id
  return v === undefined || v === null ? undefined : String(v)
}

const displayNameOf = (u: UserRecord): string | undefined => {
  const v = u.displayName ?? u.name
  return v === undefined || v === null ? undefined : String(v)
}

export function UsersPage() {
  const [cursor, setCursor] = useState<string | undefined>(undefined)
  const [cursorStack, setCursorStack] = useState<string[]>([])
  const [selected, setSelected] = useState<UserRecord | null>(null)

  const listInput = { limit: 20, ...(cursor !== undefined ? { cursor } : {}) }
  const list = useApiGet(
    ['GET /api/v1/users', listInput],
    () => getClient().GET('/api/v1/users', { params: { query: listInput } }),
  )
  const body = list.data?.isJson && list.data.body ? (list.data.body as { results?: UserRecord[]; hasMore?: boolean; nextCursor?: string }) : { results: [] as UserRecord[] }
  const nextCursor = body.nextCursor

  return (
    <div className="mx-auto w-full max-w-4xl">
      <PageHeader
        title="Users"
        description="Player accounts registered with the server. Open a user to rename them, manage roles, and see their moderation status."
        icon={<Users size={20} weight="fill" />}
        actions={
          <Button variant="ghost" size="sm" shape="square" onClick={() => list.refetch()} aria-label="Refresh users" title="Refresh">
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
        emptyLabel="No users found. Players appear here after their first registration."
        renderItem={(item, i) => (
          <LayerCard key={i} className="p-3.5 sm:p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-kumo-tint text-kumo-brand">
                  <UserGear size={16} />
                </span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-kumo-strong">
                    {displayNameOf(item as UserRecord) ?? 'Unknown user'}
                  </div>
                  <div className="truncate font-mono text-[11.5px] text-kumo-subtle">
                    {userIdOf(item as UserRecord) ?? JSON.stringify(item).slice(0, 80)}
                  </div>
                </div>
              </div>
              <Button variant="secondary" size="sm" onClick={() => setSelected(item as UserRecord)} icon={<UserGear size={14} />}>
                Manage
              </Button>
            </div>
          </LayerCard>
        )}
      />

      <UserDetailDialog user={selected} onClose={() => setSelected(null)} />
    </div>
  )
}

const formatDate = (v: unknown): string => {
  if (typeof v !== 'string' || !v) return ''
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? v : d.toLocaleString()
}

/** Compact humanized "time ago" string, or '' when the value is not a usable timestamp. */
const relativeTime = (v: unknown): string => {
  if (v === undefined || v === null || v === '') return ''
  const d = typeof v === 'number' ? new Date(v) : new Date(String(v))
  if (Number.isNaN(d.getTime())) return ''
  const s = Math.round((Date.now() - d.getTime()) / 1000)
  if (s < 45) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  const days = Math.round(h / 24)
  if (days < 7) return `${days}d ago`
  const w = Math.round(days / 7)
  if (w < 5) return `${w}w ago`
  const mo = Math.round(days / 30)
  if (mo < 12) return `${mo}mo ago`
  return `${Math.round(days / 365)}y ago`
}

/** Humanized length of time between two timestamps, e.g. "7 days". */
const formatDuration = (fromMs: number, toMs: number): string => {
  if (toMs - fromMs <= 0) return ''
  const min = Math.round((toMs - fromMs) / 60_000)
  if (min < 60) return `${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `${h} hr${h === 1 ? '' : 's'}`
  const days = Math.round(h / 24)
  if (days < 7) return `${days} day${days === 1 ? '' : 's'}`
  const w = Math.round(days / 7)
  if (w < 5) return `${w} week${w === 1 ? '' : 's'}`
  const mo = Math.round(days / 30)
  if (mo < 12) return `${mo} month${mo === 1 ? '' : 's'}`
  const y = Math.round(days / 365)
  return `${y} year${y === 1 ? '' : 's'}`
}

function UserDetailDialog({ user, onClose }: { user: UserRecord | null; onClose: () => void }) {
  const toast = useKumoToastManager()
  const userId = user ? userIdOf(user) : undefined

  const [tab, setTab] = useState('overview')
  const [reload, setReload] = useState(0)
  const [reportCursor, setReportCursor] = useState<number | undefined>(undefined)
  const [reportStack, setReportStack] = useState<number[]>([])
  const [banCursor, setBanCursor] = useState<number | undefined>(undefined)
  const [banStack, setBanStack] = useState<number[]>([])
  const [displayName, setDisplayName] = useState('')
  const [roleName, setRoleName] = useState('')
  // Live clock for active/expired status without calling Date.now() during render.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(t)
  }, [])

  const key = userId ?? ''
  const [lastKey, setLastKey] = useState('')
  if (key !== lastKey) {
    setLastKey(key)
    setTab('overview')
    setDisplayName(displayNameOf(user ?? {}) ?? '')
    setRoleName('')
    setReportCursor(undefined)
    setReportStack([])
    setBanCursor(undefined)
    setBanStack([])
    setReload((n) => n + 1)
  }

  const roles = useApiGet(
    ['GET /api/v1/user-roles/:userId', userId, reload],
    () => getClient().GET('/api/v1/user-roles/:userId', { params: { path: { userId: userId! } } }),
    Boolean(userId),
  )
  // Overview summaries read the first 100 entries (lists are ordered oldest-first).
  const recentReports = useApiGet(
    ['GET /api/v1/user-moderation/reports', userId, reload],
    () => getClient().GET('/api/v1/user-moderation/reports', { params: { query: { userId, limit: 100 } } }),
    Boolean(userId),
  )
  const recentBans = useApiGet(
    ['GET /api/v1/user-moderation/bans', userId, reload],
    () => getClient().GET('/api/v1/user-moderation/bans', { params: { query: { userId, limit: 100 } } }),
    Boolean(userId),
  )
  // Tabs page through the full history.
  const reports = useApiGet(
    ['GET /api/v1/user-moderation/reports', userId, reportCursor, reload],
    () => getClient().GET('/api/v1/user-moderation/reports', { params: { query: { userId, limit: 10, ...(reportCursor !== undefined ? { cursor: reportCursor } : {}) } } }),
    Boolean(userId),
    { placeholderData: keepPreviousData },
  )
  const bans = useApiGet(
    ['GET /api/v1/user-moderation/bans', userId, banCursor, reload],
    () => getClient().GET('/api/v1/user-moderation/bans', { params: { query: { userId, limit: 10, ...(banCursor !== undefined ? { cursor: banCursor } : {}) } } }),
    Boolean(userId),
    { placeholderData: keepPreviousData },
  )
  // The sessions endpoint has no per-user filter, so fetch the live window and filter client-side.
  const sessions = useApiGet(
    ['GET /api/v1/user-sessions', userId, reload],
    () => getClient().GET('/api/v1/user-sessions', { params: { query: { limit: 100 } } }),
    Boolean(userId),
  )
  const rename = useApiMutation(
    ['PUT /api/v1/users/:userId'],
    (input: { userId: string; displayName: string }) =>
      getClient().PUT('/api/v1/users/:userId', { params: { path: { userId: input.userId } }, body: { displayName: input.displayName } }),
  )
  const addRole = useApiMutation(
    ['POST /api/v1/user-roles/add'],
    (input: { userId: string; roleName: string }) => getClient().POST('/api/v1/user-roles/add', { body: input }),
  )
  const removeRole = useApiMutation(
    ['DELETE /api/v1/user-roles/remove'],
    (input: { userId: string; roleName: string }) => getClient().DELETE('/api/v1/user-roles/remove', { body: input }),
  )
  const unban = useApiMutation(
    ['DELETE /api/v1/user-moderation/ban/:userId'],
    (input: { userId: string }) => getClient().DELETE('/api/v1/user-moderation/ban/:userId', { params: { path: input } }),
  )
  const deleteSessions = useApiMutation(
    ['DELETE /api/v1/user-sessions/:userId'],
    (input: { userId: string }) => getClient().DELETE('/api/v1/user-sessions/:userId', { params: { path: input } }),
  )

  // The endpoint returns a paginated body ({ results: [...] }), not a bare array.
  const roleBody = roles.data?.isJson && typeof roles.data.body === 'object' && roles.data.body !== null
    ? (roles.data.body as { results?: { roleName?: unknown; createdAt?: unknown }[] })
    : null
  const roleItems = roleBody?.results ?? []
  const recentReportsBody = recentReports.data?.isJson && typeof recentReports.data.body === 'object' && recentReports.data.body !== null ? (recentReports.data.body as { results?: Record<string, unknown>[] }) : null
  const recentReportItems = recentReportsBody?.results ?? []
  const recentBansBody = recentBans.data?.isJson && typeof recentBans.data.body === 'object' && recentBans.data.body !== null ? (recentBans.data.body as { results?: Record<string, unknown>[] }) : null
  const recentBanItems = recentBansBody?.results ?? []
  // Lists are ordered oldest-first, so the last item is the latest.
  const latestBan = recentBanItems.length > 0 ? recentBanItems[recentBanItems.length - 1] : null
  const activeBan = Boolean(
    latestBan &&
      (latestBan.expiresAt === null ||
        latestBan.expiresAt === undefined ||
        new Date(String(latestBan.expiresAt)).getTime() > now),
  )
  const lastReport = recentReportItems.length > 0 ? recentReportItems[recentReportItems.length - 1] : null
  const lastReportIssuer = nameOrId(lastReport?.issuedByUserDisplayName, lastReport?.issuedByUserId)

  const reportsBody = reports.data?.isJson && typeof reports.data.body === 'object' && reports.data.body !== null ? (reports.data.body as { results?: Record<string, unknown>[]; hasMore?: boolean; nextCursor?: number }) : null
  const reportItems = reportsBody?.results ?? []
  const reportsHaveMore = reportsBody?.hasMore === true
  const nextReportCursor = reportsBody?.nextCursor
  const bansBody = bans.data?.isJson && typeof bans.data.body === 'object' && bans.data.body !== null ? (bans.data.body as { results?: Record<string, unknown>[]; hasMore?: boolean; nextCursor?: number }) : null
  const banItems = bansBody?.results ?? []
  const sessionsBody = sessions.data?.isJson && typeof sessions.data.body === 'object' && sessions.data.body !== null ? (sessions.data.body as { results?: Record<string, unknown>[] }) : null
  const userSessions = (sessionsBody?.results ?? []).filter((s) => {
    const sid = s.userId === undefined || s.userId === null ? '' : String(s.userId)
    return sid !== '' && sid === userId
  })
  const bansHaveMore = bansBody?.hasMore === true
  const nextBanCursor = bansBody?.nextCursor
  // Unban is user-scoped, so only offer it on the newest active ban of the current page.
  const firstActiveBanIndex = banItems.findIndex((b) => {
    const exp = b.expiresAt === null || b.expiresAt === undefined ? null : String(b.expiresAt)
    return exp === null || new Date(exp).getTime() > now
  })

  const nextReports = () => {
    if (nextReportCursor === undefined) return
    setReportStack((s) => [...s, reportCursor ?? 0])
    setReportCursor(nextReportCursor)
  }
  const prevReports = () => {
    setReportStack((s) => {
      const prev = s[s.length - 1]
      setReportCursor(prev)
      return s.slice(0, -1)
    })
  }
  const nextBans = () => {
    if (nextBanCursor === undefined) return
    setBanStack((s) => [...s, banCursor ?? 0])
    setBanCursor(nextBanCursor)
  }
  const prevBans = () => {
    setBanStack((s) => {
      const prev = s[s.length - 1]
      setBanCursor(prev)
      return s.slice(0, -1)
    })
  }

  const done = (r: RunResult, okMsg: string) => {
    if (r.ok) {
      toast.add({ title: okMsg, variant: 'success' })
      setReload((n) => n + 1)
    } else {
      toast.add({ title: `Request failed (HTTP ${r.status})`, description: errorText(r), variant: 'error' })
    }
  }

  const submitRename = async () => {
    if (!userId || !displayName.trim()) return
    const r = await rename.mutateAsync({ userId, displayName: displayName.trim() })
    done(r, 'Display name updated')
  }

  const submitAddRole = async () => {
    if (!userId || !roleName.trim()) return
    const r = await addRole.mutateAsync({ userId, roleName: roleName.trim() })
    done(r, `Role “${roleName.trim()}” added`)
    if (r.ok) setRoleName('')
  }

  const submitRemoveRole = async (name: string) => {
    if (!userId) return
    const r = await removeRole.mutateAsync({ userId, roleName: name })
    done(r, `Role “${name}” removed`)
  }

  const submitUnban = async () => {
    if (!userId) return
    const r = await unban.mutateAsync({ userId })
    done(r, 'Ban lifted')
  }

  const submitEndSessions = async () => {
    if (!userId) return
    const r = await deleteSessions.mutateAsync({ userId })
    done(r, 'Sessions ended')
  }

  const tabs = [
    { value: 'overview', label: 'Overview' },
    { value: 'roles', label: 'Roles' },
    { value: 'sessions', label: 'Sessions' },
    { value: 'reports', label: 'Reports' },
    { value: 'bans', label: 'Bans' },
  ]

  return (
    <>
      <Dialog.Root open={user !== null} onOpenChange={(o) => !o && onClose()}>
        <Dialog className="p-6" size="lg">
          <Dialog.Title className="text-lg font-semibold text-kumo-strong">
            {displayNameOf(user ?? {}) ?? 'User'}
          </Dialog.Title>
          <Dialog.Description className="mt-1 break-all font-mono text-[12px] text-kumo-subtle">{userId}</Dialog.Description>

          <div className="mt-4">
            <Tabs tabs={tabs} value={tab} onValueChange={setTab} variant="underline" size="sm" />
          </div>

          <div className="mt-4 grid gap-4">
            {tab === 'overview' && (
              <div className="grid gap-4">
                <div className="flex items-end gap-2">
                  <Input label="Display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="flex-1" />
                  <Button variant="primary" onClick={() => void submitRename()} loading={rename.isPending} icon={<SlidersHorizontal size={15} />}>
                    Rename
                  </Button>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div
                    className={
                      activeBan
                        ? 'flex items-center justify-between gap-2 rounded-lg bg-kumo-danger-tint px-3 py-2.5'
                        : 'flex items-center justify-between gap-2 rounded-lg bg-kumo-base px-3 py-2.5 ring ring-kumo-line'
                    }
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className={activeBan ? 'shrink-0 text-kumo-danger' : 'shrink-0 text-kumo-success'}>
                        {activeBan ? <Prohibit size={16} weight="fill" /> : <CheckCircle size={16} weight="fill" />}
                      </span>
                      <div className="min-w-0">
                        <div className={`truncate text-sm font-semibold ${activeBan ? 'text-kumo-danger' : 'text-kumo-success'}`}>
                          {activeBan ? 'Banned' : 'Not banned'}
                        </div>
                        {activeBan && latestBan && (
                          <div className="truncate text-[11.5px] text-kumo-danger/80">
                            {String(latestBan.reason ?? '')}
                            {latestBan.expiresAt !== null && latestBan.expiresAt !== undefined && (
                              <> · until {formatDate(latestBan.expiresAt)}</>
                            )}
                            {(latestBan.expiresAt === null || latestBan.expiresAt === undefined) && ' · Permanent'}
                          </div>
                        )}
                      </div>
                    </div>
                    {activeBan && (
                      <Button variant="secondary-destructive" size="sm" onClick={() => void submitUnban()} loading={unban.isPending}>
                        Lift ban
                      </Button>
                    )}
                  </div>

                  <div className="flex items-center gap-2 rounded-lg bg-kumo-base px-3 py-2.5 ring ring-kumo-line">
                    <span className="shrink-0 text-kumo-brand">
                      <Flag size={16} weight="fill" />
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-kumo-strong">Last report</div>
                      {lastReport ? (
                        <div className="truncate text-[11.5px] text-kumo-subtle">
                          {String(lastReport.reason ?? '')}
                          {lastReportIssuer && <> · by {lastReportIssuer}</>}
                        </div>
                      ) : (
                        <div className="text-[11.5px] text-kumo-subtle">No reports on file.</div>
                      )}
                    </div>
                  </div>
                </div>

              </div>
            )}

            {tab === 'roles' && (
              <div className="grid gap-4">
                <div className="flex flex-wrap items-center gap-1.5">
                  {roleItems.length === 0 ? (
                    <Text variant="secondary" size="sm">No roles assigned.</Text>
                  ) : (
                    roleItems.map((r) => {
                      const n = String(r.roleName ?? '').trim()
                      if (!n) return null
                      const when = relativeTime(r.createdAt)
                      return (
                        <Badge key={n} variant="blue" className="gap-1 pr-1">
                          <span title={when ? `Assigned ${when}` : undefined}>{n}</span>
                          <button type="button" onClick={() => void submitRemoveRole(n)} className="ml-0.5 flex size-4 cursor-pointer items-center justify-center rounded-full text-kumo-default hover:bg-kumo-base" aria-label={`Remove ${n}`} title="Remove role">
                            <Prohibit size={10} />
                          </button>
                        </Badge>
                      )
                    })
                  )}
                </div>
                <div className="flex items-end gap-2">
                  <Input label="Add role" value={roleName} onChange={(e) => setRoleName(e.target.value)} placeholder="e.g. moderator" className="flex-1" onKeyDown={(e) => e.key === 'Enter' && void submitAddRole()} />
                  <Button variant="primary" onClick={() => void submitAddRole()} loading={addRole.isPending} icon={<Shield size={15} />}>
                    Add
                  </Button>
                </div>
              </div>
            )}

            {tab === 'reports' && (
              <div className="grid gap-2">
                {reports.isLoading ? (
                  <Text variant="secondary" size="sm">Loading reports…</Text>
                ) : reportItems.length === 0 ? (
                  <Text variant="secondary" size="sm">No reports on file.</Text>
                ) : (
                  <>
                    {reportItems.map((r, i) => {
                      const reason = String(r.reason ?? 'No reason provided')
                      // Name where available, falling back to the raw identifier.
                      const reporter = nameOrId(r.issuedByUserDisplayName, r.issuedByUserId)
                      const when = relativeTime(r.createdAt ?? r.timestamp ?? '')
                      return (
                        <div key={i} className="flex items-start justify-between gap-3 rounded-lg bg-kumo-base px-3 py-2.5 ring ring-kumo-line">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[13px] font-semibold text-kumo-strong">{reason}</span>
                            </div>
                            <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[11.5px] text-kumo-subtle">
                              {reporter ? (
                                <>
                                  <span>Reported by</span>
                                  <span className="token-chip max-w-48 truncate rounded bg-kumo-tint px-1.5 py-0.5 text-[10.5px]">{reporter}</span>
                                </>
                              ) : (
                                <span>Reported by unknown player</span>
                              )}
                            </div>
                          </div>
                          {when && <span className="shrink-0 text-[11.5px] text-kumo-subtle">{when}</span>}
                        </div>
                      )
                    })}
                    {(reportsHaveMore || reportStack.length > 0) && (
                      <div className="flex items-center justify-between border-t border-kumo-hairline pt-2.5">
                        <Text variant="secondary" size="sm">Page {reportStack.length + 1}</Text>
                        <div className="flex items-center gap-1.5">
                          <Button variant="secondary" size="sm" onClick={prevReports} disabled={reportStack.length === 0 || reports.isFetching} icon={<CaretLeft size={14} />}>
                            Previous
                          </Button>
                          <Button variant="secondary" size="sm" onClick={nextReports} disabled={!reportsHaveMore || reports.isFetching}>
                            Next <CaretRight size={14} className="inline" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {tab === 'bans' && (
              <div className="grid gap-2">
                {bans.isLoading ? (
                  <Text variant="secondary" size="sm">Loading bans…</Text>
                ) : banItems.length === 0 ? (
                  <Text variant="secondary" size="sm">No bans on file.</Text>
                ) : (
                  <>
                    {banItems.map((b, i) => {
                      const reason = String(b.reason ?? 'No reason provided')
                      const createdAt = typeof b.createdAt === 'string' ? b.createdAt : ''
                      const expiresAt = b.expiresAt === null || b.expiresAt === undefined ? null : String(b.expiresAt)
                      const active = expiresAt === null || new Date(expiresAt).getTime() > now
                      const createdMs = createdAt ? new Date(createdAt).getTime() : NaN
                      const expiresMs = expiresAt ? new Date(expiresAt).getTime() : NaN
                      const duration = Number.isFinite(createdMs) && Number.isFinite(expiresMs) ? formatDuration(createdMs, expiresMs) : ''
                      return (
                        <div key={i} className="flex items-start justify-between gap-3 rounded-lg bg-kumo-base px-3 py-2.5 ring ring-kumo-line">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[13px] font-semibold text-kumo-strong">{reason}</span>
                              {active ? <Badge variant="red">Active</Badge> : <Badge>Expired</Badge>}
                            </div>
                            <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[11.5px] text-kumo-subtle">
                              <span>Banned {relativeTime(createdAt) || formatDate(createdAt)}</span>
                              {duration && <span>· for {duration}</span>}
                              {expiresAt ? <span>· until {formatDate(expiresAt)}</span> : <span>· Permanent</span>}
                            </div>
                          </div>
                          {active && i === firstActiveBanIndex && (
                            <Button variant="ghost" size="sm" onClick={() => void submitUnban()} loading={unban.isPending} className="shrink-0 text-kumo-danger hover:bg-kumo-danger-tint">
                              Lift ban
                            </Button>
                          )}
                        </div>
                      )
                    })}
                    {(bansHaveMore || banStack.length > 0) && (
                      <div className="flex items-center justify-between border-t border-kumo-hairline pt-2.5">
                        <Text variant="secondary" size="sm">Page {banStack.length + 1}</Text>
                        <div className="flex items-center gap-1.5">
                          <Button variant="secondary" size="sm" onClick={prevBans} disabled={banStack.length === 0 || bans.isFetching} icon={<CaretLeft size={14} />}>
                            Previous
                          </Button>
                          <Button variant="secondary" size="sm" onClick={nextBans} disabled={!bansHaveMore || bans.isFetching}>
                            Next <CaretRight size={14} className="inline" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {tab === 'sessions' && (
              <div className="grid gap-2">
                {sessions.isLoading ? (
                  <Text variant="secondary" size="sm">Loading sessions…</Text>
                ) : userSessions.length === 0 ? (
                  <Text variant="secondary" size="sm">No active sessions for this user.</Text>
                ) : (
                  <>
                    {userSessions.map((s, i) => {
                      const ip = s.publicIp !== undefined && s.publicIp !== null ? String(s.publicIp) : ''
                      const country = s.country !== undefined && s.country !== null ? String(s.country) : ''
                      const token = s.token !== undefined && s.token !== null ? String(s.token) : ''
                      const tokenShort = token.length > 14 ? `${token.slice(0, 14)}…` : token
                      const connected = s.createdAt !== undefined && s.createdAt !== null ? String(s.createdAt) : ''
                      return (
                        <div key={i} className="rounded-lg bg-kumo-base px-3 py-2.5 ring ring-kumo-line">
                          <div className="flex flex-wrap items-center gap-2">
                            {country && <Badge variant="blue">{country}</Badge>}
                            <span className="text-[13px] font-semibold text-kumo-strong">Active session</span>
                          </div>
                          <dl className="mt-1.5 grid gap-x-6 gap-y-1 text-[12px] sm:grid-cols-2">
                            <div className="flex min-w-0 items-baseline gap-2">
                              <dt className="w-20 shrink-0 text-[11px] text-kumo-inactive">IP address</dt>
                              <dd className="min-w-0 truncate font-mono text-kumo-subtle" title={ip}>{ip || '—'}</dd>
                            </div>
                            <div className="flex min-w-0 items-baseline gap-2">
                              <dt className="w-20 shrink-0 text-[11px] text-kumo-inactive">Token</dt>
                              <dd className="min-w-0 truncate font-mono text-kumo-subtle" title={token}>{tokenShort || '—'}</dd>
                            </div>
                            <div className="flex min-w-0 items-baseline gap-2 sm:col-span-2">
                              <dt className="w-20 shrink-0 text-[11px] text-kumo-inactive">Connected</dt>
                              <dd className="min-w-0 truncate text-kumo-subtle">{connected ? relativeTime(connected) || formatDate(connected) : '—'}</dd>
                            </div>
                          </dl>
                        </div>
                      )
                    })}
                    <div className="flex justify-end border-t border-kumo-hairline pt-2.5">
                      <Button variant="secondary-destructive" size="sm" onClick={() => void submitEndSessions()} loading={deleteSessions.isPending} icon={<Prohibit size={14} />}>
                        End all sessions
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <Dialog.Close render={(p) => <Button {...p} variant="secondary">Close</Button>} />
          </div>
        </Dialog>
      </Dialog.Root>
    </>
  )
}
