import { useEffect, useState } from 'react'
import { Badge, Button, Checkbox, Dialog, Input, InputArea, LayerCard, Select, Text, useKumoToastManager } from '@cloudflare/kumo'
import { Plus, Prohibit } from '@phosphor-icons/react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { getClient } from '../api/client'
import type { RunResult } from '../api/client'
import { errorText, useApiGet, useApiMutation } from '../hooks/useApi'
import { nameOrId } from '../lib/format'
import { PageHeader } from '../components/PageHeader'
import { ResultsList } from '../components/ResultsList'
import { ConfirmDialog } from '../components/ConfirmDialog'

type DurationUnit = 'minutes' | 'hours' | 'days' | 'weeks' | 'months' | 'years'

const DURATION_UNITS: Record<DurationUnit, string> = {
  minutes: 'Minutes',
  hours: 'Hours',
  days: 'Days',
  weeks: 'Weeks',
  months: 'Months',
  years: 'Years',
}

interface BanRecord {
  userId?: unknown
  userDisplayName?: unknown
  issuedByUserId?: unknown
  issuedByUserDisplayName?: unknown
  reason?: unknown
  createdAt?: unknown
  updatedAt?: unknown
  expiresAt?: unknown
  [k: string]: unknown
}

const failed = (msg: string): RunResult => ({ ok: false, status: 0, statusText: 'Client error', durationMs: 0, contentType: null, url: '', isJson: false, bodyText: msg, body: null })

const formatDate = (v: unknown): string => {
  if (typeof v !== 'string' || !v) return ''
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? v : d.toLocaleString()
}

export function BansPage() {
  const toast = useKumoToastManager()
  const navigate = useNavigate()
  const search = useSearch({ from: '/bans' })
  const prefillUserId = search.userId ?? ''
  const prefillReason = search.reason ?? ''
  const prefill = prefillUserId !== '' || prefillReason !== '' ? { userId: prefillUserId, reason: prefillReason } : null

  const [cursor, setCursor] = useState<number | undefined>(undefined)
  const [cursorStack, setCursorStack] = useState<number[]>([])
  // Opens with prefill when arriving from a report's "Ban" quick action.
  const [showBan, setShowBan] = useState(() => prefill !== null)
  const [confirmingUnban, setConfirmingUnban] = useState<BanRecord | null>(null)
  // Live clock for active/expired badges without calling Date.now() during render.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(t)
  }, [])

  // Re-open the dialog whenever the URL gains prefill params (e.g. same-page navigation).
  useEffect(() => {
    if (prefill !== null) setShowBan(true)
  }, [prefillUserId, prefillReason])

  const listInput = { limit: 20, ...(cursor !== undefined ? { cursor } : {}) }
  const list = useApiGet(
    ['GET /api/v1/user-moderation/bans', listInput],
    () => getClient().GET('/api/v1/user-moderation/bans', { params: { query: listInput } }),
  )
  const ban = useApiMutation(
    ['POST /api/v1/user-moderation/ban'],
    (input: { userId: string; reason: string; duration?: { value: number; unit: DurationUnit } }) =>
      getClient().POST('/api/v1/user-moderation/ban', { body: input }),
  )
  const unban = useApiMutation(
    ['DELETE /api/v1/user-moderation/ban/:userId'],
    (input: { userId: string }) => getClient().DELETE('/api/v1/user-moderation/ban/:userId', { params: { path: input } }),
  )

  const body = list.data?.isJson && list.data.body
    ? (list.data.body as { results?: BanRecord[]; hasMore?: boolean; nextCursor?: number })
    : { results: [] as BanRecord[] }
  const nextCursor = body.nextCursor

  const goFirst = () => {
    setCursor(undefined)
    setCursorStack([])
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      <PageHeader
        title="Bans"
        description="Bans placed on players across the server. Review ban history and issue or lift bans."
        icon={<Prohibit size={20} weight="fill" />}
        actions={
          <Button variant="primary" onClick={() => setShowBan(true)} icon={<Plus size={15} weight="bold" />}>
            Ban a user
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
        emptyLabel="No bans placed yet."
        renderItem={(item, i) => {
          const b = item as BanRecord
          const reason = b.reason !== undefined ? String(b.reason) : 'No reason provided'
          const expiresAt = b.expiresAt !== undefined && b.expiresAt !== null ? String(b.expiresAt) : null
          const active = expiresAt === null || new Date(expiresAt).getTime() > now
          const userId = b.userId !== undefined ? String(b.userId) : ''
          // Name where available, falling back to the raw identifier.
          const displayName = nameOrId(b.userDisplayName, userId)
          const issuedBy = nameOrId(b.issuedByUserDisplayName, b.issuedByUserId)
          return (
            <LayerCard key={i} className="p-3.5 sm:p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-kumo-strong">{reason}</span>
                    {active ? <Badge variant="red">Active</Badge> : <Badge>Expired</Badge>}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-[12.5px] text-kumo-subtle">
                    {displayName && (
                      <span className="token-chip max-w-56 truncate rounded bg-kumo-tint px-1.5 py-0.5 text-[11px] text-kumo-subtle" title={userId}>{displayName}</span>
                    )}
                    <span>
                      Banned {formatDate(b.createdAt) || 'recently'}
                      {issuedBy && <span> · by {issuedBy}</span>}
                      {expiresAt !== null && <span> · until {formatDate(expiresAt)}</span>}
                      {expiresAt === null && <span> · Permanent</span>}
                    </span>
                  </div>
                </div>
                {active && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmingUnban(b)}
                    className="shrink-0 text-kumo-danger hover:bg-kumo-danger-tint"
                  >
                    Unban
                  </Button>
                )}
              </div>
            </LayerCard>
          )
        }}
      />

      <BanDialog
        open={showBan}
        onOpenChange={(o) => {
          setShowBan(o)
          // Drop the prefill params once the dialog closes so a refresh doesn't re-open it.
          if (!o && prefill !== null) {
            // Replace (not push) so the Back button doesn't restore the prefill and re-open the dialog.
            navigate({ to: '/bans', search: { userId: undefined, reason: undefined }, replace: true })
          }
        }}
        initial={prefill}
        onSubmit={async (userId, reason, duration) => {
          if (!userId.trim()) return failed('User ID is required')
          if (!reason.trim()) return failed('Reason is required')
          const r = await ban.mutateAsync({
            userId: userId.trim(),
            reason: reason.trim(),
            ...(duration ? { duration } : {}),
          })
          if (r.ok) {
            toast.add({ title: 'User banned', variant: 'success' })
            goFirst()
            return r
          }
          toast.add({ title: `Ban failed (HTTP ${r.status})`, description: errorText(r), variant: 'error' })
          return r
        }}
      />

      <ConfirmDialog
        open={confirmingUnban !== null}
        onOpenChange={(o) => !o && setConfirmingUnban(null)}
        title="Unban this player?"
        description="The player will be able to connect again immediately."
        confirmLabel="Unban"
        onConfirm={async () => {
          const target = confirmingUnban
          setConfirmingUnban(null)
          if (!target || target.userId === undefined) return
          const r = await unban.mutateAsync({ userId: String(target.userId) })
          if (r.ok) {
            toast.add({ title: 'User unbanned', variant: 'success' })
            list.refetch()
          } else {
            toast.add({ title: `Unban failed (HTTP ${r.status})`, description: errorText(r), variant: 'error' })
          }
        }}
        loading={unban.isPending}
      />
    </div>
  )
}

function BanDialog({
  open,
  onOpenChange,
  initial,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  initial?: { userId: string; reason: string } | null
  onSubmit: (userId: string, reason: string, duration: { value: number; unit: DurationUnit } | null) => Promise<RunResult>
}) {
  const [userId, setUserId] = useState('')
  const [reason, setReason] = useState('')
  const [permanent, setPermanent] = useState(true)
  const [durationValue, setDurationValue] = useState('1')
  const [durationUnit, setDurationUnit] = useState<DurationUnit>('hours')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const key = open ? `b:${initial?.userId ?? ''}|${initial?.reason ?? ''}` : ''
  const [lastKey, setLastKey] = useState('')
  if (key !== lastKey) {
    setLastKey(key)
    if (open) {
      setUserId(initial?.userId ?? '')
      setReason(initial?.reason ?? '')
      setPermanent(true)
      setDurationValue('1')
      setDurationUnit('hours')
      setError('')
    }
  }

  const submit = async () => {
    if (!userId.trim()) {
      setError('User ID is required')
      return
    }
    if (!reason.trim()) {
      setError('Reason is required')
      return
    }
    if (!permanent) {
      const n = Number(durationValue)
      if (durationValue.trim() === '' || !Number.isInteger(n) || n < 1) {
        setError('Duration must be a whole number of at least 1.')
        return
      }
    }
    setSubmitting(true)
    const r = await onSubmit(
      userId,
      reason,
      permanent ? null : { value: Number(durationValue), unit: durationUnit },
    )
    setSubmitting(false)
    if (r.ok) onOpenChange(false)
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog className="p-6">
        <Dialog.Title className="text-lg font-semibold text-kumo-strong">Ban a user</Dialog.Title>
        <Dialog.Description className="mt-1 text-sm text-kumo-subtle">Temporarily or permanently ban a player. Active bans kick the player from the game.</Dialog.Description>
        <div className="mt-4 grid gap-3">
          <Input label="User ID" required value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="00000000-0000-0000-0000-000000000000" className="font-mono text-[12.5px]" />
          <InputArea label="Reason" required description="Short description of why this user is being banned." value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="e.g. Toxic behaviour" />
          <Checkbox
            label="Permanent ban"
            checked={permanent}
            onCheckedChange={(c) => setPermanent(c === true)}
          />
          {!permanent && (
            <div className="grid grid-cols-[1fr_140px] items-end gap-2">
              <Input
                label="Duration"
                value={durationValue}
                onChange={(e) => setDurationValue(e.target.value)}
                inputMode="numeric"
                error={error}
                placeholder="1"
                className="font-mono text-[13px]"
              />
              <Select
                label="Unit"
                size="sm"
                value={durationUnit}
                onValueChange={(v) => setDurationUnit((v ?? 'hours') as DurationUnit)}
                items={DURATION_UNITS}
                aria-label="Duration unit"
              />
            </div>
          )}
          {error && <Text variant="error" size="sm">{error}</Text>}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Dialog.Close render={(p) => <Button {...p} variant="secondary">Cancel</Button>} />
          <Button variant="primary" onClick={() => void submit()} loading={submitting} icon={<Prohibit size={15} />}>
            Ban user
          </Button>
        </div>
      </Dialog>
    </Dialog.Root>
  )
}
