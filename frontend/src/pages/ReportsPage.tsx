import { useMemo, useState } from 'react'
import { Badge, Button, Dialog, Input, InputArea, LayerCard, Table, Text, useKumoToastManager } from '@cloudflare/kumo'
import { Flag, Plus, Prohibit } from '@phosphor-icons/react'
import { useNavigate } from '@tanstack/react-router'
import { getClient } from '../api/client'
import type { RunResult } from '../api/client'
import { errorText, useApiGet, useApiMutation } from '../hooks/useApi'
import { nameOrId } from '../lib/format'
import { PageHeader } from '../components/PageHeader'
import { ResultsList } from '../components/ResultsList'

interface ManualReportRecord {
  userId?: unknown
  userDisplayName?: unknown
  issuedByUserId?: unknown
  issuedByUserDisplayName?: unknown
  reason?: unknown
  createdAt?: unknown
  updatedAt?: unknown
  [k: string]: unknown
}

interface AutomaticReportRecord {
  userId?: unknown
  userDisplayName?: unknown
  issuedByUserId?: unknown
  issuedByUserDisplayName?: unknown
  ruleId?: unknown
  createdAt?: unknown
  updatedAt?: unknown
  [k: string]: unknown
}

interface ReportRow {
  key: string
  kind: 'manual' | 'automatic'
  reported: string
  reportedId: string
  reason: string
  reportedBy: string
  banReason: string
  sortKey: number
}

// There is no merged pagination endpoint, so page both sources with the same
// cursor semantics and combine the current page of each, newest first. A
// source that runs out is marked "done" and stops contributing to later pages.
const LIMIT = 20

interface ReportsPageState {
  manualCursor?: number
  autoCursor?: number
  manualDone: boolean
  autoDone: boolean
}

const failed = (msg: string): RunResult => ({ ok: false, status: 0, statusText: 'Client error', durationMs: 0, contentType: null, url: '', isJson: false, bodyText: msg, body: null })

const timestamp = (v: unknown): number => {
  if (typeof v !== 'string' || !v) return 0
  const t = new Date(v).getTime()
  return Number.isNaN(t) ? 0 : t
}

export function ReportsPage() {
  const toast = useKumoToastManager()
  const navigate = useNavigate()
  const [showReport, setShowReport] = useState(false)
  const [page, setPage] = useState<ReportsPageState>({ manualDone: false, autoDone: false })
  const [pageStack, setPageStack] = useState<ReportsPageState[]>([])

  const manualInput = { limit: LIMIT, ...(page.manualCursor !== undefined ? { cursor: page.manualCursor } : {}) }
  const manual = useApiGet(
    ['GET /api/v1/user-moderation/reports', manualInput],
    () => getClient().GET('/api/v1/user-moderation/reports', { params: { query: manualInput } }),
    !page.manualDone,
  )
  const autoInput = { limit: LIMIT, ...(page.autoCursor !== undefined ? { cursor: page.autoCursor } : {}) }
  const automatic = useApiGet(
    ['GET /api/v1/user-moderation/reports/automatic', autoInput],
    () => getClient().GET('/api/v1/user-moderation/reports/automatic', { params: { query: autoInput } }),
    !page.autoDone,
  )
  const report = useApiMutation(
    ['POST /api/v1/user-moderation/manual-report'],
    (body: { userId: string; reason: string }) =>
      getClient().POST('/api/v1/user-moderation/manual-report', { body }),
  )

  const manualBody = manual.data?.isJson && manual.data.body
    ? (manual.data.body as { results?: ManualReportRecord[]; hasMore?: boolean; nextCursor?: number })
    : { results: [] as ManualReportRecord[] }
  const autoBody = automatic.data?.isJson && automatic.data.body
    ? (automatic.data.body as { results?: AutomaticReportRecord[]; hasMore?: boolean; nextCursor?: number })
    : { results: [] as AutomaticReportRecord[] }

  const manualHasMore = !page.manualDone && (Boolean(manualBody.hasMore) || manualBody.nextCursor !== undefined)
  const autoHasMore = !page.autoDone && (Boolean(autoBody.hasMore) || autoBody.nextCursor !== undefined)
  const hasMore = manualHasMore || autoHasMore

  const goFirst = () => {
    setPage({ manualDone: false, autoDone: false })
    setPageStack([])
  }

  const onNext = () => {
    if (!hasMore) return
    setPageStack((s) => [...s, page])
    setPage({
      manualCursor: manualBody.nextCursor !== undefined ? manualBody.nextCursor : page.manualCursor,
      autoCursor: autoBody.nextCursor !== undefined ? autoBody.nextCursor : page.autoCursor,
      manualDone: page.manualDone || !manualHasMore,
      autoDone: page.autoDone || !autoHasMore,
    })
  }

  const onPrev = () => {
    setPageStack((s) => {
      const prev = s[s.length - 1] ?? { manualDone: false, autoDone: false }
      setPage(prev)
      return s.slice(0, -1)
    })
  }

  const rows = useMemo<ReportRow[]>(() => {
    const manualResults: ManualReportRecord[] = page.manualDone ? [] : manualBody.results ?? []
    const autoResults: AutomaticReportRecord[] = page.autoDone ? [] : autoBody.results ?? []

    const out: ReportRow[] = []
    let i = 0

    for (const item of manualResults) {
      const r = item as ManualReportRecord
      const reportedId = r.userId !== undefined ? String(r.userId) : ''
      const reasonRaw = r.reason !== undefined ? String(r.reason) : ''
      out.push({
        key: `m:${i++}`,
        kind: 'manual',
        reported: nameOrId(r.userDisplayName, reportedId),
        reportedId,
        reason: reasonRaw || 'No reason provided',
        reportedBy: nameOrId(r.issuedByUserDisplayName, r.issuedByUserId) || 'unknown player',
        banReason: reasonRaw,
        sortKey: timestamp(r.createdAt),
      })
    }

    for (const item of autoResults) {
      const r = item as AutomaticReportRecord
      const reportedId = r.userId !== undefined ? String(r.userId) : ''
      const issuedById = r.issuedByUserId !== undefined && r.issuedByUserId !== null ? String(r.issuedByUserId) : ''
      const host = nameOrId(r.issuedByUserDisplayName, r.issuedByUserId)
      const ruleId = r.ruleId !== undefined && r.ruleId !== null ? Number(r.ruleId) : null
      const isSelfReport = issuedById !== '' && issuedById === reportedId
      out.push({
        key: `a:${i++}`,
        kind: 'automatic',
        reported: nameOrId(r.userDisplayName, reportedId),
        reportedId,
        reason: `Rule #${ruleId ?? '?'}`,
        reportedBy: isSelfReport ? 'self-report' : host || 'unknown host',
        banReason: ruleId !== null ? `Anti-cheat rule ${ruleId}` : '',
        sortKey: timestamp(r.createdAt),
      })
    }

    out.sort((a, b) => b.sortKey - a.sortKey)
    return out
  }, [manualBody, autoBody, page.manualDone, page.autoDone])

  const isLoading = manual.isLoading || automatic.isLoading
  const isFetching = manual.isFetching || automatic.isFetching
  const failedResult =
    manual.data && !manual.data.ok ? manual.data
    : automatic.data && !automatic.data.ok ? automatic.data
    : undefined
  const mergedResult: RunResult = failedResult ?? {
    ok: true,
    status: 200,
    statusText: 'OK',
    durationMs: 0,
    contentType: 'application/json',
    url: '',
    isJson: true,
    bodyText: '',
    body: { results: rows, hasMore },
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      <PageHeader
        title="Reports"
        description="Reports filed against players across the server."
        icon={<Flag size={20} weight="fill" />}
        actions={
          <Button variant="primary" onClick={() => setShowReport(true)} icon={<Plus size={15} weight="bold" />}>
            Report a user
          </Button>
        }
      />

      <LayerCard className="flex flex-col gap-3 p-4 sm:p-5">
        <ResultsList
          result={mergedResult}
          isLoading={isLoading}
          isFetching={isFetching}
          hasMore={hasMore}
          canPrev={pageStack.length > 0}
          onNext={onNext}
          onPrev={onPrev}
          emptyLabel="No reports filed yet."
          renderList={(items) => (
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.Head className="w-24">Type</Table.Head>
                  <Table.Head>Player</Table.Head>
                  <Table.Head>Reason</Table.Head>
                  <Table.Head>Reported by</Table.Head>
                  <Table.Head className="w-24 text-right" aria-hidden>Action</Table.Head>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {items.map((item) => {
                  const row = item as ReportRow
                  return (
                    <Table.Row key={row.key}>
                      <Table.Cell>
                        {row.kind === 'manual'
                          ? <Badge variant="blue">Manual</Badge>
                          : <Badge variant="orange">Automatic</Badge>}
                      </Table.Cell>
                      <Table.Cell>
                        <span className="truncate text-kumo-default" title={row.reportedId || undefined}>
                          {row.reported || 'Unknown player'}
                        </span>
                      </Table.Cell>
                      <Table.Cell>
                        <span className="text-kumo-default">{row.reason}</span>
                      </Table.Cell>
                      <Table.Cell>
                        <span className="text-kumo-subtle">{row.reportedBy}</span>
                      </Table.Cell>
                      <Table.Cell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate({ to: '/bans', search: { userId: row.reportedId, reason: row.banReason } })}
                          disabled={!row.reportedId}
                          title={row.reportedId ? 'Ban this player' : 'No reported user to ban'}
                          className="text-kumo-danger hover:bg-kumo-danger-tint"
                          icon={<Prohibit size={15} />}
                        >
                          Ban
                        </Button>
                      </Table.Cell>
                    </Table.Row>
                  )
                })}
              </Table.Body>
            </Table>
          )}
        />
      </LayerCard>

      <ReportDialog
        open={showReport}
        onOpenChange={setShowReport}
        onSubmit={async (userId, reason) => {
          if (!userId.trim()) return failed('User ID is required')
          if (!reason.trim()) return failed('Reason is required')
          const r = await report.mutateAsync({ userId: userId.trim(), reason: reason.trim() })
          if (r.ok) {
            toast.add({ title: 'Report filed', variant: 'success' })
            goFirst()
            manual.refetch()
            automatic.refetch()
            return r
          }
          toast.add({ title: `Report failed (HTTP ${r.status})`, description: errorText(r), variant: 'error' })
          return r
        }}
      />
    </div>
  )
}

function ReportDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  onSubmit: (userId: string, reason: string) => Promise<RunResult>
}) {
  const [userId, setUserId] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const key = open ? 'r' : ''
  const [lastKey, setLastKey] = useState('')
  if (key !== lastKey) {
    setLastKey(key)
    if (open) {
      setUserId('')
      setReason('')
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
    setSubmitting(true)
    const r = await onSubmit(userId, reason)
    setSubmitting(false)
    if (r.ok) onOpenChange(false)
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog className="p-6">
        <Dialog.Title className="text-lg font-semibold text-kumo-strong">Report a user</Dialog.Title>
        <Dialog.Description className="mt-1 text-sm text-kumo-subtle">File a report against a player for breaking the rules.</Dialog.Description>
        <div className="mt-4 grid gap-3">
          <Input label="User ID" required value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="00000000-0000-0000-0000-000000000000" className="font-mono text-[12.5px]" />
          <InputArea label="Reason" required description="Short description of the rule violation." value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="e.g. Offensive language" />
          {error && <Text variant="error" size="sm">{error}</Text>}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Dialog.Close render={(p) => <Button {...p} variant="secondary">Cancel</Button>} />
          <Button variant="primary" onClick={() => void submit()} loading={submitting} icon={<Flag size={15} />}>
            File report
          </Button>
        </div>
      </Dialog>
    </Dialog.Root>
  )
}
