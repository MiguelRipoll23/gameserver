import { useState } from 'react'
import { Badge, Button, Dialog, Input, InputArea, LayerCard, Text, useKumoToastManager } from '@cloudflare/kumo'
import { Check, Copy, Key, PencilSimple, Plus, Robot, Shield, Trash } from '@phosphor-icons/react'
import { getClient } from '../api/client'
import type { RunResult } from '../api/client'
import { errorText, useApiGet, useApiMutation } from '../hooks/useApi'
import { PageHeader } from '../components/PageHeader'
import { ResultsList } from '../components/ResultsList'
import { ConfirmDialog } from '../components/ConfirmDialog'

interface BotRecord {
  id?: unknown
  name?: unknown
  description?: unknown
  createdBy?: unknown
  createdAt?: unknown
  [k: string]: unknown
}

export function BotsPage() {
  const toast = useKumoToastManager()
  const [cursor, setCursor] = useState<string | undefined>(undefined)
  const [cursorStack, setCursorStack] = useState<string[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<BotRecord | null>(null)
  const [deleting, setDeleting] = useState<BotRecord | null>(null)
  const [tokenFor, setTokenFor] = useState<BotRecord | null>(null)
  const [rolesFor, setRolesFor] = useState<BotRecord | null>(null)

  const listInput = { limit: 20, ...(cursor !== undefined ? { cursor } : {}) }
  const list = useApiGet(
    ['GET /api/v1/bots', listInput],
    () => getClient().GET('/api/v1/bots', { params: { query: listInput } }),
  )
  const create = useApiMutation(
    ['POST /api/v1/bots'],
    (input: { name: string; description?: string }) => getClient().POST('/api/v1/bots', { body: input }),
  )
  const update = useApiMutation(
    ['PATCH /api/v1/bots/:botId'],
    (input: { botId: string; name: string; description: string | null }) =>
      getClient().PATCH('/api/v1/bots/:botId', {
        params: { path: { botId: input.botId } },
        body: { name: input.name, description: input.description },
      }),
  )
  const remove = useApiMutation(
    ['DELETE /api/v1/bots/:botId'],
    (input: { botId: string }) => getClient().DELETE('/api/v1/bots/:botId', { params: { path: input } }),
  )

  const body = list.data?.isJson && list.data.body ? (list.data.body as { results?: BotRecord[]; hasMore?: boolean; nextCursor?: string }) : { results: [] as BotRecord[] }
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
        title="Bots"
        description="Bot accounts that can act in the game on behalf of your server. Each bot has its own long-lived token and roles."
        icon={<Robot size={20} weight="fill" />}
        actions={
          listEmpty ? undefined : (
            <Button variant="primary" onClick={() => setShowCreate(true)} icon={<Plus size={15} weight="bold" />}>
              Create bot
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
        emptyLabel="No bots yet. Create one to get started."
        emptyAction={
          <Button variant="secondary" size="sm" onClick={() => setShowCreate(true)} icon={<Plus size={14} />}>
            Create bot
          </Button>
        }
        renderItem={(item, i) => (
          <BotRow key={i} bot={item as BotRecord} onEdit={setEditing} onDelete={setDeleting} onToken={setTokenFor} onRoles={setRolesFor} />
        )}
      />

      <BotDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        title="Create bot"
        onSubmit={async (name, description) => {
          const r = await create.mutateAsync({ name, description: description || undefined })
          after(r, 'Bot created')
          return r
        }}
      />
      <BotDialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title="Edit bot"
        initial={editing}
        onSubmit={async (name, description) => {
          if (!editing || editing.id === undefined) return failed('Missing bot id')
          const r = await update.mutateAsync({ botId: String(editing.id), name, description: description || null })
          after(r, 'Bot updated')
          return r
        }}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete bot?"
        description={
          deleting?.name !== undefined ? (
            <>“{String(deleting.name)}” and all of its associated data will be permanently removed.</>
          ) : (
            <>This bot and all of its associated data will be permanently removed.</>
          )
        }
        onConfirm={async () => {
          if (!deleting || deleting.id === undefined) return
          const r = await remove.mutateAsync({ botId: String(deleting.id) })
          after(r, 'Bot deleted')
          setDeleting(null)
        }}
        loading={remove.isPending}
      />

      <BotTokenDialog bot={tokenFor} onClose={() => setTokenFor(null)} />
      <BotRolesDialog bot={rolesFor} onClose={() => setRolesFor(null)} />
    </div>
  )
}

const failed = (msg: string): RunResult => ({ ok: false, status: 0, statusText: 'Client error', durationMs: 0, contentType: null, url: '', isJson: false, bodyText: msg, body: null })

function BotRow({
  bot,
  onEdit,
  onDelete,
  onToken,
  onRoles,
}: {
  bot: BotRecord
  onEdit: (b: BotRecord) => void
  onDelete: (b: BotRecord) => void
  onToken: (b: BotRecord) => void
  onRoles: (b: BotRecord) => void
}) {
  const hasName = bot.name !== undefined
  return (
    <LayerCard className="p-3.5 sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-0.5 flex flex-wrap items-center gap-2">
          {hasName && <span className="text-sm font-semibold text-kumo-strong">{String(bot.name)}</span>}
          {bot.id !== undefined && <span className="token-chip truncate rounded bg-kumo-tint px-1.5 py-0.5 text-[11px] text-kumo-subtle">{String(bot.id)}</span>}
        </div>
        <div className="line-clamp-2 text-sm text-kumo-subtle">
          {bot.description !== undefined && bot.description !== null ? String(bot.description) : 'No description'}
        </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="sm" shape="square" onClick={() => onRoles(bot)} aria-label="Manage roles" title="Manage roles">
            <Shield size={15} />
          </Button>
          <Button variant="ghost" size="sm" shape="square" onClick={() => onToken(bot)} aria-label="Mint token" title="Mint token">
            <Key size={15} />
          </Button>
          <Button variant="ghost" size="sm" shape="square" onClick={() => onEdit(bot)} aria-label="Edit bot" title="Edit">
            <PencilSimple size={15} />
          </Button>
          <Button variant="ghost" size="sm" shape="square" onClick={() => onDelete(bot)} aria-label="Delete bot" title="Delete" className="text-kumo-danger hover:bg-kumo-danger-tint">
            <Trash size={15} />
          </Button>
        </div>
      </div>
    </LayerCard>
  )
}

function BotDialog({
  open,
  onOpenChange,
  title,
  initial,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  title: string
  initial?: BotRecord | null
  onSubmit: (name: string, description: string) => Promise<RunResult>
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const key = open ? (initial ? `e:${String(initial.id ?? '')}` : 'c') : ''
  const [lastKey, setLastKey] = useState('')
  if (key !== lastKey) {
    setLastKey(key)
    if (open) {
      setName(initial && typeof initial.name === 'string' ? initial.name : '')
      setDescription(initial && typeof initial.description === 'string' ? initial.description : '')
      setError('')
    }
  }

  const submit = async () => {
    if (!name.trim()) {
      setError('Name is required')
      return
    }
    setSubmitting(true)
    const r = await onSubmit(name.trim(), description.trim())
    setSubmitting(false)
    if (r.ok) onOpenChange(false)
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog className="p-6">
        <Dialog.Title className="text-lg font-semibold text-kumo-strong">{title}</Dialog.Title>
        <div className="mt-4 grid gap-3">
          <Input label="Name" required value={name} onChange={(e) => setName(e.target.value)} error={error} placeholder="e.g. MatchmakingBot" />
          <InputArea label="Description" description="Optional description of the bot." value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Dialog.Close render={(p) => <Button {...p} variant="secondary">Cancel</Button>} />
          <Button variant="primary" onClick={submit} loading={submitting} icon={<Robot size={15} />}>
            {initial ? 'Save changes' : 'Create bot'}
          </Button>
        </div>
      </Dialog>
    </Dialog.Root>
  )
}

function BotTokenDialog({ bot, onClose }: { bot: BotRecord | null; onClose: () => void }) {
  const toast = useKumoToastManager()
  const mint = useApiMutation(
    ['POST /api/v1/bots/token'],
    (input: { botId: string }) => getClient().POST('/api/v1/bots/token', { body: input }),
  )
  const [token, setToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const key = bot ? String(bot.id) : ''
  const [lastKey, setLastKey] = useState('')
  if (key !== lastKey) {
    setLastKey(key)
    if (bot) {
      setToken(null)
      setCopied(false)
      void mint.mutateAsync({ botId: String(bot.id) }).then((r) => {
        if (r.ok && r.isJson && r.body && typeof r.body === 'object') {
          setToken(String((r.body as { token?: unknown }).token ?? ''))
        } else {
          toast.add({ id: 'tok-err', title: `Could not mint token (HTTP ${r.status})`, description: errorText(r), variant: 'error' })
        }
      })
    }
  }

  const copy = async () => {
    if (!token) return
    try {
      await navigator.clipboard.writeText(token)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore
    }
  }

  return (
    <Dialog.Root open={bot !== null} onOpenChange={(o) => !o && onClose()}>
      <Dialog className="p-6">
        <Dialog.Title className="text-lg font-semibold text-kumo-strong">Bot token</Dialog.Title>
        <Dialog.Description className="mt-1 text-sm text-kumo-subtle">
          Long-lived JWT minted for <span className="font-mono text-[12px] text-kumo-default">{(bot?.name ?? bot?.id)?.toString() ?? ''}</span>. It reflects the bot's current roles.
        </Dialog.Description>
        <div className="mt-4">
          {token ? (
            <div className="rounded-lg bg-kumo-base p-3 ring ring-kumo-line">
              <div className="mb-2 flex items-center justify-between gap-2">
                <Text variant="secondary" size="sm">Minted token</Text>
                <Button variant="ghost" size="sm" shape="square" onClick={copy} aria-label="Copy token" title="Copy token">
                  {copied ? <Check size={14} className="text-kumo-success" /> : <Copy size={14} />}
                </Button>
              </div>
              <div className="break-all font-mono text-[12px] text-kumo-default">{token}</div>
            </div>
          ) : (
            <Text variant="secondary" size="sm">Minting…</Text>
          )}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Dialog.Close render={(p) => <Button {...p} variant="secondary">Close</Button>} />
        </div>
      </Dialog>
    </Dialog.Root>
  )
}

interface BotRole {
  botId?: unknown
  roleName?: unknown
  createdAt?: unknown
  [k: string]: unknown
}

function BotRolesDialog({ bot, onClose }: { bot: BotRecord | null; onClose: () => void }) {
  const toast = useKumoToastManager()
  const [reload, setReload] = useState(0)
  const botId = bot ? String(bot.id) : ''
  const roles = useApiGet(
    ['GET /api/v1/bots/:botId/roles', botId, reload],
    () => getClient().GET('/api/v1/bots/:botId/roles', { params: { path: { botId } } }),
    bot !== null,
  )
  const addRole = useApiMutation(
    ['POST /api/v1/bots/:botId/roles'],
    (input: { botId: string; roleName: string }) =>
      getClient().POST('/api/v1/bots/:botId/roles', { params: { path: { botId: input.botId } }, body: { roleName: input.roleName } }),
  )
  const removeRole = useApiMutation(
    ['DELETE /api/v1/bots/:botId/roles'],
    (input: { botId: string; roleName: string }) =>
      getClient().DELETE('/api/v1/bots/:botId/roles', { params: { path: { botId: input.botId } }, body: { roleName: input.roleName } }),
  )
  const [roleName, setRoleName] = useState('')
  const [error, setError] = useState('')

  const botKey = bot ? String(bot.id) : ''
  const [lastKey, setLastKey] = useState('')
  if (botKey !== lastKey) {
    setLastKey(botKey)
    setRoleName('')
    setError('')
    setReload((n) => n + 1)
  }

  const roleItems = Array.isArray(roles.data?.body) ? (roles.data.body as BotRole[]) : []
  const roleNames = roleItems.map((r) => String(r.roleName ?? '')).filter(Boolean)

  const add = async () => {
    if (!roleName.trim() || !bot) return
    const r = await addRole.mutateAsync({ botId: String(bot.id), roleName: roleName.trim() })
    if (r.ok) {
      toast.add({ id: 'role-add', title: `Role “${roleName.trim()}” added`, variant: 'success' })
      setRoleName('')
      roles.refetch()
    } else {
      toast.add({ id: 'role-add-err', title: `Failed (HTTP ${r.status})`, description: errorText(r), variant: 'error' })
    }
  }

  const remove = async (name: string) => {
    if (!bot) return
    const r = await removeRole.mutateAsync({ botId: String(bot.id), roleName: name })
    if (r.ok) {
      toast.add({ id: 'role-rm', title: `Role “${name}” removed`, variant: 'success' })
      roles.refetch()
    } else {
      toast.add({ id: 'role-rm-err', title: `Failed (HTTP ${r.status})`, description: errorText(r), variant: 'error' })
    }
  }

  return (
    <Dialog.Root open={bot !== null} onOpenChange={(o) => !o && onClose()}>
      <Dialog className="p-6" size="lg">
        <Dialog.Title className="text-lg font-semibold text-kumo-strong">Bot roles</Dialog.Title>
        <Dialog.Description className="mt-1 text-sm text-kumo-subtle">
          Roles for <span className="font-mono text-[12px] text-kumo-default">{(bot?.name ?? bot?.id)?.toString() ?? ''}</span> — minted tokens reflect these roles.
        </Dialog.Description>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {roleNames.length === 0 && <Text variant="secondary" size="sm">No roles assigned yet.</Text>}
          {roleNames.map((name) => (
            <Badge key={name} variant="blue" className="gap-1.5 pr-1">
              {name}
              <button
                type="button"
                onClick={() => void remove(name)}
                className="ml-0.5 flex size-4 cursor-pointer items-center justify-center rounded-full text-kumo-default hover:bg-kumo-base"
                aria-label={`Remove role ${name}`}
                title="Remove role"
              >
                <Trash size={11} />
              </button>
            </Badge>
          ))}
        </div>

        <div className="mt-4 flex items-end gap-2">
          <Input label="Add role" value={roleName} onChange={(e) => setRoleName(e.target.value)} error={error} placeholder="e.g. moderator" className="flex-1" onKeyDown={(e) => e.key === 'Enter' && void add()} />
          <Button variant="primary" onClick={() => void add()} loading={addRole.isPending} icon={<Plus size={15} />}>
            Add
          </Button>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Dialog.Close render={(p) => <Button {...p} variant="secondary">Close</Button>} />
        </div>
      </Dialog>
    </Dialog.Root>
  )
}
