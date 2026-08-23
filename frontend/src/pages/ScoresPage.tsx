import { useState } from 'react'
import { Button, Dialog, Input, LayerCard, Table, useKumoToastManager } from '@cloudflare/kumo'
import { PencilSimple, Trophy } from '@phosphor-icons/react'
import { getClient } from '../api/client'
import { errorText, useApiGet, useApiMutation } from '../hooks/useApi'
import { PageHeader } from '../components/PageHeader'
import { ResultsList } from '../components/ResultsList'

interface ScoreRecord {
  userId?: unknown
  userDisplayName?: unknown
  totalScore?: unknown
  [k: string]: unknown
}

export function ScoresPage() {
  const toast = useKumoToastManager()
  const [cursor, setCursor] = useState<string | undefined>(undefined)
  const [stack, setStack] = useState<string[]>([])
  const [editing, setEditing] = useState<ScoreRecord | null>(null)

  const listInput = { limit: 20, ...(cursor !== undefined ? { cursor } : {}) }
  const list = useApiGet(
    ['GET /api/v1/user-scores', listInput],
    () => getClient().GET('/api/v1/user-scores', { params: { query: listInput } }),
  )
  const update = useApiMutation(
    ['PUT /api/v1/user-scores/:userId'],
    (input: { userId: string; totalScore: number }) =>
      getClient().PUT('/api/v1/user-scores/:userId', { params: { path: { userId: input.userId } }, body: { totalScore: input.totalScore } }),
  )

  const body = list.data?.isJson && list.data.body && typeof list.data.body === 'object'
    ? (list.data.body as { results?: ScoreRecord[]; hasMore?: boolean; nextCursor?: string })
    : { results: [] as ScoreRecord[] }

  const submitEdit = async (userId: string, totalScore: number) => {
    const r = await update.mutateAsync({ userId, totalScore })
    if (r.ok) {
      toast.add({ title: 'Score updated', variant: 'success' })
      list.refetch()
    } else {
      toast.add({ title: `Update failed (HTTP ${r.status})`, description: errorText(r), variant: 'error' })
    }
    return r
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      <PageHeader
        title="Scores"
        description="Player leaderboard with total scores saved by game clients."
        icon={<Trophy size={20} weight="fill" />}
      />

      <LayerCard className="flex flex-col gap-3 p-4 sm:p-5">
        <ResultsList
          result={list.data}
          isLoading={list.isLoading}
          isFetching={list.isFetching}
          hasMore={Boolean(body.hasMore)}
          canPrev={stack.length > 0}
          onNext={() => {
            if (body.nextCursor === undefined) return
            setStack((s) => [...s, cursor ?? ''])
            setCursor(body.nextCursor)
          }}
          onPrev={() => {
            setStack((s) => {
              const prev = s[s.length - 1]
              setCursor(prev)
              return s.slice(0, -1)
            })
          }}
          emptyLabel="No scores saved yet. They appear here as game clients upload them."
          renderList={(items) => (
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.Head className="w-14">Position</Table.Head>
                  <Table.Head>Player</Table.Head>
                  <Table.Head className="text-right">Score</Table.Head>
                  <Table.Head className="w-12" aria-hidden />
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {items.map((item, i) => {
                  const rec = item as ScoreRecord
                  const userId = rec.userId !== undefined && rec.userId !== null ? String(rec.userId) : undefined
                  return (
                    <Table.Row key={i}>
                      <Table.Cell>
                        <span className="flex size-6 items-center justify-center rounded-full bg-kumo-tint text-[11.5px] font-semibold text-kumo-subtle">
                          {i + 1}
                        </span>
                      </Table.Cell>
                      <Table.Cell>
                        <span className="truncate text-kumo-default">{String(rec.userDisplayName ?? 'Unknown player')}</span>
                      </Table.Cell>
                      <Table.Cell className="text-right">
                        <span className="font-mono font-semibold text-kumo-strong">{String(rec.totalScore ?? 0)}</span>
                      </Table.Cell>
                      <Table.Cell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          shape="square"
                          onClick={() => setEditing(rec)}
                          aria-label="Edit score"
                          title="Edit score"
                          disabled={!userId}
                        >
                          <PencilSimple size={14} />
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

      <EditScoreDialog
        record={editing}
        onOpenChange={(o) => !o && setEditing(null)}
        onSubmit={submitEdit}
      />
    </div>
  )
}

function EditScoreDialog({
  record,
  onOpenChange,
  onSubmit,
}: {
  record: ScoreRecord | null
  onOpenChange: (o: boolean) => void
  onSubmit: (userId: string, totalScore: number) => Promise<{ ok: boolean }>
}) {
  const [score, setScore] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const userId = record && record.userId !== undefined && record.userId !== null ? String(record.userId) : ''

  const key = record ? `s:${userId}` : ''
  const [lastKey, setLastKey] = useState('')
  if (key !== lastKey) {
    setLastKey(key)
    if (record) {
      setScore(record.totalScore !== undefined && record.totalScore !== null ? String(record.totalScore) : '')
      setError('')
    }
  }

  const submit = async () => {
    const n = Number(score)
    if (score.trim() === '' || !Number.isFinite(n) || n < 0) {
      setError('Score must be a non-negative number.')
      return
    }
    setBusy(true)
    const r = await onSubmit(userId, n)
    setBusy(false)
    if (r.ok) onOpenChange(false)
  }

  return (
    <Dialog.Root open={record !== null} onOpenChange={onOpenChange}>
      <Dialog className="p-6">
        <Dialog.Title className="text-lg font-semibold text-kumo-strong">
          Edit score
        </Dialog.Title>
        <Dialog.Description className="mt-1 break-all font-mono text-[12px] text-kumo-subtle">
          {record?.userDisplayName !== undefined ? String(record.userDisplayName) : userId || 'Player'}
        </Dialog.Description>
        <div className="mt-4 grid gap-3">
          <Input
            label="Total score"
            required
            value={score}
            onChange={(e) => {
              setScore(e.target.value)
              setError('')
            }}
            error={error}
            inputMode="decimal"
            className="font-mono text-[13px]"
          />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Dialog.Close render={(p) => <Button {...p} variant="secondary">Cancel</Button>} />
          <Button variant="primary" onClick={() => void submit()} loading={busy} icon={<Trophy size={15} />}>
            Save score
          </Button>
        </div>
      </Dialog>
    </Dialog.Root>
  )
}
