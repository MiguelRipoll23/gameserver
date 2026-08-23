import { useState } from 'react'
import { Button, Dialog, LayerCard } from '@cloudflare/kumo'
import { ArrowUpRight } from '@phosphor-icons/react'
import { JsonView } from './JsonView'

const MAX_ROWS = 5

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return 'null'
  if (typeof v === 'object') {
    if (Array.isArray(v)) return `[${v.length} item${v.length === 1 ? '' : 's'}]`
    return `{${Object.keys(v as object).length} fields}`
  }
  const s = String(v)
  return s.length > 72 ? `${s.slice(0, 69)}…` : s
}

const PREFERRED_KEYS = ['id', 'userId', 'title', 'name', 'displayName', 'roleName', 'word', 'createdAt', 'updatedAt', 'status']

export function RecordCard({ data, index }: { data: Record<string, unknown>; index?: number }) {
  const [open, setOpen] = useState(false)
  const keys = Object.keys(data)
  const ordered = [...keys].sort((a, b) => {
    const ia = PREFERRED_KEYS.indexOf(a)
    const ib = PREFERRED_KEYS.indexOf(b)
    if (ia === -1 && ib === -1) return 0
    if (ia === -1) return 1
    if (ib === -1) return -1
    return ia - ib
  })
  const visible = ordered.slice(0, MAX_ROWS)
  const hasMore = ordered.length > MAX_ROWS

  return (
    <LayerCard className="p-3.5 sm:p-4">
      <div className="grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
        {visible.map((k) => (
          <div key={k} className="flex min-w-0 items-baseline gap-2">
            <span className="w-28 shrink-0 truncate text-sm text-kumo-subtle">{k}</span>
            <span className="min-w-0 truncate text-sm font-medium text-kumo-strong">{formatValue(data[k])}</span>
          </div>
        ))}
        {!hasMore && visible.length % 2 === 1 && <span />}
      </div>
      {(hasMore || keys.length > 0) && (
        <div className="mt-2.5 flex items-center gap-2">
          {hasMore && (
            <Button variant="ghost" size="sm" onClick={() => setOpen(true)} icon={<ArrowUpRight size={13} />}>
              View full record
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
            Inspect JSON
          </Button>
        </div>
      )}

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog className="p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <Dialog.Title className="text-lg font-semibold text-kumo-strong">
              Record{index !== undefined ? ` #${index + 1}` : ''}
            </Dialog.Title>
            <Dialog.Close aria-label="Close" render={(p) => <Button {...p} variant="ghost" shape="square" aria-label="Close">✕</Button>} />
          </div>
          <JsonView value={data} label="Record JSON" maxHeight="60vh" />
        </Dialog>
      </Dialog.Root>
    </LayerCard>
  )
}
