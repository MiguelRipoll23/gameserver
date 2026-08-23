import { useState } from 'react'
import { Button, Dialog, Input, InputArea, LayerCard, useKumoToastManager } from '@cloudflare/kumo'
import { Megaphone, PencilSimple, Plus, Trash } from '@phosphor-icons/react'
import { getClient } from '../api/client'
import type { RunResult } from '../api/client'
import { errorText, useApiGet, useApiMutation } from '../hooks/useApi'
import { PageHeader } from '../components/PageHeader'
import { ResultsList } from '../components/ResultsList'
import { ConfirmDialog } from '../components/ConfirmDialog'

interface MessageRecord {
  id?: unknown
  title?: unknown
  content?: unknown
  [k: string]: unknown
}

export function MessagesPage() {
  const toast = useKumoToastManager()
  const [cursor, setCursor] = useState<number | undefined>(undefined)
  const [cursorStack, setCursorStack] = useState<number[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<MessageRecord | null>(null)
  const [deleting, setDeleting] = useState<MessageRecord | null>(null)

  const listInput = { limit: 20, ...(cursor !== undefined ? { cursor } : {}) }
  const list = useApiGet(
    ['GET /api/v1/server-messages', listInput],
    () => getClient().GET('/api/v1/server-messages', { params: { query: listInput } }),
  )

  const create = useApiMutation(
    ['POST /api/v1/server-messages'],
    (input: { title: string; content: string }) => getClient().POST('/api/v1/server-messages', { body: input }),
  )
  const update = useApiMutation(
    ['PUT /api/v1/server-messages/:id'],
    (input: { id: number; title: string; content: string }) =>
      getClient().PUT('/api/v1/server-messages/:id', {
        params: { path: { id: input.id } },
        body: { id: input.id, title: input.title, content: input.content },
      }),
  )
  const remove = useApiMutation(
    ['DELETE /api/v1/server-messages/:id'],
    (input: { id: number }) => getClient().DELETE('/api/v1/server-messages/:id', { params: { path: input } }),
  )

  const refresh = () => list.refetch()

  const body = list.data?.isJson && list.data.body ? (list.data.body as { results?: MessageRecord[]; hasMore?: boolean; nextCursor?: number }) : { results: [] as MessageRecord[] }
  const nextCursor = body.nextCursor
  // Hide the header action while there is no content so the empty state's own CTA stays the only one.
  const listEmpty = !list.isLoading && (body.results ?? []).length === 0

  const goNext = () => {
    if (nextCursor === undefined) return
    setCursorStack((s) => [...s, cursor ?? 0])
    setCursor(nextCursor)
  }
  const goPrev = () => {
    setCursorStack((s) => {
      const prev = s[s.length - 1]
      setCursor(prev)
      return s.slice(0, -1)
    })
  }

  const afterMutation = (result: RunResult, okMsg: string, refetch = true) => {
    if (result.ok) {
      toast.add({ title: okMsg, variant: 'success' })
      if (refetch) refresh()
    } else {
      toast.add({ title: `Request failed (HTTP ${result.status})`, description: errorText(result), variant: 'error' })
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      <PageHeader
        title="Server messages"
        description="Announcements shown to players after they connect to the server."
        icon={<Megaphone size={20} weight="fill" />}
        actions={
          listEmpty ? undefined : (
            <Button variant="primary" onClick={() => setShowCreate(true)} icon={<Plus size={15} weight="bold" />}>
              New message
            </Button>
          )
        }
      />

      <ResultsList
        result={list.data}
        isLoading={list.isLoading}
        isFetching={list.isFetching}
        hasMore={Boolean(body.hasMore) || nextCursor !== undefined}
        canPrev={cursorStack.length > 0}
        onNext={goNext}
        onPrev={goPrev}
        emptyLabel="No server messages yet. Create the first one to greet your players."
        emptyAction={
          <Button variant="secondary" size="sm" onClick={() => setShowCreate(true)} icon={<Plus size={14} />}>
            Create message
          </Button>
        }
        renderItem={(item, i) => <MessageRow key={i} msg={item as MessageRecord} onEdit={setEditing} onDelete={setDeleting} />}
      />

      {/* Create dialog */}
      <MessageDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        title="New server message"
        onSubmit={async (title, content) => {
          const r = await create.mutateAsync({ title, content })
          afterMutation(r, 'Message created')
          return r
        }}
      />

      {/* Edit dialog */}
      <MessageDialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title="Edit server message"
        initial={editing}
        onSubmit={async (title, content) => {
          if (!editing || editing.id === undefined) return { ok: false, status: 400, statusText: 'Missing id', durationMs: 0, contentType: null, url: '', isJson: false, bodyText: 'Message id is unknown', body: null }
          const id = Number(editing.id)
          const r = await update.mutateAsync({ id, title, content })
          afterMutation(r, 'Message updated')
          return r
        }}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete server message?"
        description={
          deleting?.title !== undefined ? (
            <>
              “{String(deleting.title)}” will be removed and players will no longer see it after connecting.
            </>
          ) : (
            <>This message will be removed and players will no longer see it after connecting.</>
          )
        }
        onConfirm={async () => {
          if (!deleting || deleting.id === undefined) return
          const r = await remove.mutateAsync({ id: Number(deleting.id) })
          afterMutation(r, 'Message deleted')
          setDeleting(null)
        }}
        loading={remove.isPending}
      />
    </div>
  )
}

function MessageRow({ msg, onEdit, onDelete }: { msg: MessageRecord; onEdit: (m: MessageRecord) => void; onDelete: (m: MessageRecord) => void }) {
  const hasShape = msg.id !== undefined && msg.title !== undefined
  return (
    <LayerCard className="p-3.5 sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {hasShape ? (
            <>
              <div className="mb-0.5 flex items-center gap-2">
                <span className="text-sm font-semibold text-kumo-strong">{String(msg.title)}</span>
                {msg.id !== undefined && <span className="token-chip rounded bg-kumo-tint px-1.5 py-0.5 text-[11px] text-kumo-subtle">#{String(msg.id)}</span>}
              </div>
              <div className="line-clamp-2 text-sm text-kumo-subtle">
                {typeof msg.content === 'string' ? msg.content : '(no content)'}
              </div>
            </>
          ) : (
            <div className="break-all font-mono text-[12px] text-kumo-subtle">
              {JSON.stringify(msg).slice(0, 160)}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="sm" shape="square" onClick={() => onEdit(msg)} aria-label="Edit message" title="Edit">
            <PencilSimple size={15} />
          </Button>
          <Button variant="ghost" size="sm" shape="square" onClick={() => onDelete(msg)} aria-label="Delete message" title="Delete" className="text-kumo-danger hover:bg-kumo-danger-tint">
            <Trash size={15} />
          </Button>
        </div>
      </div>
    </LayerCard>
  )
}

function MessageDialog({
  open,
  onOpenChange,
  title,
  initial,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  title: string
  initial?: MessageRecord | null
  onSubmit: (title: string, content: string) => Promise<RunResult>
}) {
  const [t, setT] = useState('')
  const [c, setC] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Reset fields whenever the dialog (re)opens for a given target.
  const [lastKey, setLastKey] = useState('')
  const key = open ? (initial ? `e:${String(initial.id ?? '')}` : 'c') : lastKey
  if (key !== lastKey) {
    setLastKey(key)
    if (open) {
      setT(initial && typeof initial.title === 'string' ? initial.title : '')
      setC(initial && typeof initial.content === 'string' ? initial.content : '')
      setError('')
    }
  }

  const submit = async () => {
    if (!t.trim()) {
      setError('Title is required')
      return
    }
    setSubmitting(true)
    const r = await onSubmit(t, c)
    setSubmitting(false)
    if (r.ok) onOpenChange(false)
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog className="p-6">
        <Dialog.Title className="text-lg font-semibold text-kumo-strong">{title}</Dialog.Title>
        <div className="mt-4 grid gap-3">
          <Input label="Title" required value={t} onChange={(e) => setT(e.target.value)} error={error} placeholder="e.g. Welcome to the server!" />
          <InputArea label="Content" required description="Shown to the player after connecting." value={c} onChange={(e) => setC(e.target.value)} rows={4} placeholder="e.g. Check out the #announcements channel for events." />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Dialog.Close render={(p) => <Button {...p} variant="secondary">Cancel</Button>} />
          <Button variant="primary" onClick={submit} loading={submitting} icon={<Megaphone size={15} />}>
            {initial ? 'Save changes' : 'Create message'}
          </Button>
        </div>
      </Dialog>
    </Dialog.Root>
  )
}
