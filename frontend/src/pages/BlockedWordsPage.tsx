import { useState } from 'react'
import { Button, Dialog, Input, InputArea, LayerCard, useKumoToastManager } from '@cloudflare/kumo'
import { MagnifyingGlass, PencilSimple, Plus, TextT, Trash } from '@phosphor-icons/react'
import { getClient } from '../api/client'
import type { RunResult } from '../api/client'
import { errorText, useApiGet, useApiMutation } from '../hooks/useApi'
import { PageHeader } from '../components/PageHeader'
import { ResultsList } from '../components/ResultsList'
import { ConfirmDialog } from '../components/ConfirmDialog'

interface WordRecord {
  id?: unknown
  word?: unknown
  notes?: unknown
  [k: string]: unknown
}

const failed = (msg: string): RunResult => ({ ok: false, status: 0, statusText: 'Client error', durationMs: 0, contentType: null, url: '', isJson: false, bodyText: msg, body: null })

export function BlockedWordsPage() {
  const toast = useKumoToastManager()
  const [search, setSearch] = useState('')
  const [cursor, setCursor] = useState<number | undefined>(undefined)
  const [cursorStack, setCursorStack] = useState<number[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<WordRecord | null>(null)
  const [deleting, setDeleting] = useState<WordRecord | null>(null)

  const listInput = { limit: 20, ...(cursor !== undefined ? { cursor } : {}), ...(search.trim() ? { word: search.trim() } : {}) }
  const list = useApiGet(
    ['GET /api/v1/text-moderation/blocked-words', listInput],
    () => getClient().GET('/api/v1/text-moderation/blocked-words', { params: { query: listInput } }),
  )
  const add = useApiMutation(
    ['POST /api/v1/text-moderation/block-word'],
    (input: { word: string; notes?: string }) =>
      getClient().POST('/api/v1/text-moderation/block-word', { body: input }),
  )
  const update = useApiMutation(
    ['PATCH /api/v1/text-moderation/blocked-words/:wordId'],
    (input: { wordId: number; word: string; notes?: string }) =>
      getClient().PATCH('/api/v1/text-moderation/blocked-words/:wordId', {
        params: { path: { wordId: input.wordId } },
        body: { word: input.word, ...(input.notes ? { notes: input.notes } : {}) },
      }),
  )
  const remove = useApiMutation(
    ['DELETE /api/v1/text-moderation/blocked-words/{word}'],
    (input: { word: string }) =>
      getClient().DELETE('/api/v1/text-moderation/blocked-words/{word}', { params: { path: input } }),
  )

  const body = list.data?.isJson && list.data.body ? (list.data.body as { results?: WordRecord[]; hasMore?: boolean; nextCursor?: number }) : { results: [] as WordRecord[] }
  const nextCursor = body.nextCursor
  // Hide the header action while there is no content so the empty state's own CTA stays the only one.
  const listEmpty = !list.isLoading && (body.results ?? []).length === 0

  const refresh = () => list.refetch()
  const after = (r: RunResult, okMsg: string) => {
    if (r.ok) {
      toast.add({ title: okMsg, variant: 'success' })
      refresh()
    } else {
      toast.add({ title: `Request failed (HTTP ${r.status})`, description: errorText(r), variant: 'error' })
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      <PageHeader
        title="Blocked words"
        description="Words that are rejected by text moderation. Chat and profiles containing them are blocked for players."
        icon={<TextT size={20} weight="fill" />}
        actions={
          listEmpty ? undefined : (
            <Button variant="primary" onClick={() => setShowAdd(true)} icon={<Plus size={15} weight="bold" />}>
              Block a word
            </Button>
          )
        }
      />

      <div className="relative mb-4 max-w-md">
        <MagnifyingGlass size={14} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-kumo-subtle" />
        <Input
          size="sm"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setCursor(undefined)
            setCursorStack([])
          }}
          placeholder="Filter by word…"
          className="pl-8"
          aria-label="Filter blocked words"
        />
      </div>

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
        emptyLabel={search.trim() ? `No blocked words match “${search}”.` : 'No blocked words yet. Block the first one to get started.'}
        emptyAction={
          <Button variant="secondary" size="sm" onClick={() => setShowAdd(true)} icon={<Plus size={14} />}>
            Block a word
          </Button>
        }
        renderItem={(item, i) => {
          const w = item as WordRecord
          const word = w.word !== undefined ? String(w.word) : undefined
          return (
            <LayerCard key={i} className="p-3.5 sm:p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-kumo-danger-tint text-kumo-danger">
                    <TextT size={15} />
                  </span>
                  <div className="min-w-0">
                    <span className="text-sm font-semibold text-kumo-strong">{word ?? JSON.stringify(w).slice(0, 60)}</span>
                    {w.notes !== undefined && w.notes !== null && (
                      <div className="truncate text-sm text-kumo-subtle">{String(w.notes)}</div>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button variant="ghost" size="sm" shape="square" onClick={() => setEditing(w)} aria-label="Edit word" title="Edit">
                    <PencilSimple size={15} />
                  </Button>
                  <Button variant="ghost" size="sm" shape="square" onClick={() => setDeleting(w)} aria-label="Unblock word" title="Unblock" className="text-kumo-danger hover:bg-kumo-danger-tint">
                    <Trash size={15} />
                  </Button>
                </div>
              </div>
            </LayerCard>
          )
        }}
      />

      <WordDialog
        open={showAdd}
        onOpenChange={setShowAdd}
        title="Block a word"
        onSubmit={async (word, notes) => {
          const r = await add.mutateAsync({ word, ...(notes ? { notes } : {}) })
          after(r, `“${word}” is now blocked`)
          return r
        }}
      />
      <WordDialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title="Update blocked word"
        initial={editing}
        onSubmit={async (_word, notes, newWord) => {
          if (!newWord?.trim()) return failed('New word is required')
          if (editing?.id === undefined || editing.id === null) return failed('This word has no ID to update.')
          const r = await update.mutateAsync({
            wordId: Number(editing.id),
            word: newWord.trim(),
            ...(notes ? { notes } : {}),
          })
          after(r, 'Word updated')
          return r
        }}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Unblock this word?"
        description="The word will be allowed again in chat and profiles."
        confirmLabel="Unblock"
        onConfirm={async () => {
          if (!deleting || deleting.word === undefined) return
          const r = await remove.mutateAsync({ word: String(deleting.word) })
          after(r, 'Word unblocked')
          setDeleting(null)
        }}
        loading={remove.isPending}
      />
    </div>
  )
}

function WordDialog({
  open,
  onOpenChange,
  title,
  initial,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  title: string
  initial?: WordRecord | null
  onSubmit: (word: string, notes: string, newWord?: string) => Promise<RunResult>
}) {
  const [word, setWord] = useState('')
  const [newWord, setNewWord] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const key = open ? (initial ? `e:${String(initial.word ?? '')}` : 'c') : ''
  const [lastKey, setLastKey] = useState('')
  if (key !== lastKey) {
    setLastKey(key)
    if (open) {
      setWord(initial && initial.word !== undefined ? String(initial.word) : '')
      setNewWord(initial && initial.word !== undefined ? String(initial.word) : '')
      setNotes(initial && typeof initial.notes === 'string' ? initial.notes : '')
      setError('')
    }
  }

  const submit = async () => {
    const w = word.trim()
    if (!w) {
      setError('Word is required')
      return
    }
    setSubmitting(true)
    const r = await onSubmit(w, notes.trim(), initial ? newWord.trim() : undefined)
    setSubmitting(false)
    if (r.ok) onOpenChange(false)
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog className="p-6">
        <Dialog.Title className="text-lg font-semibold text-kumo-strong">{title}</Dialog.Title>
        <div className="mt-4 grid gap-3">
          {initial ? (
            <>
              <Input label="Current word" required value={word} disabled />
              <Input label="New word" required value={newWord} onChange={(e) => setNewWord(e.target.value)} error={error} />
            </>
          ) : (
            <Input label="Word" required value={word} onChange={(e) => setWord(e.target.value)} error={error} placeholder="e.g. badword" />
          )}
          <InputArea label="Notes" description="Optional reason why this word is blocked." value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="e.g. Contains inappropriate content" />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Dialog.Close render={(p) => <Button {...p} variant="secondary">Cancel</Button>} />
          <Button variant="primary" onClick={() => void submit()} loading={submitting} icon={<TextT size={15} />}>
            {initial ? 'Save changes' : 'Block word'}
          </Button>
        </div>
      </Dialog>
    </Dialog.Root>
  )
}
