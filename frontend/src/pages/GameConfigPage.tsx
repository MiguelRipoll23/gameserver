import { useMemo, useState } from 'react'
import { Button, Input, LayerCard, Select, Text, useKumoToastManager } from '@cloudflare/kumo'
import { FloppyDisk, Plus, SlidersHorizontal, Trash } from '@phosphor-icons/react'
import { getClient } from '../api/client'
import { errorText, useApiGet, useApiMutation } from '../hooks/useApi'
import { PageHeader } from '../components/PageHeader'
import { JsonView } from '../components/JsonView'

type ValueType = 'number' | 'string'

interface ConfigRow {
  id: string
  key: string
  value: string
  valueType: ValueType
}

const uid = () => Math.random().toString(36).slice(2, 10)

/** Normalizes an API body (object or JSON string) into a plain record. */
function toRecord(body: unknown): Record<string, unknown> | null {
  if (body !== null && typeof body === 'object') return body as Record<string, unknown>
  if (typeof body === 'string') {
    try {
      const parsed = JSON.parse(body) as unknown
      if (parsed !== null && typeof parsed === 'object') return parsed as Record<string, unknown>
    } catch {
      // fall through
    }
  }
  return null
}

function recordToRows(body: Record<string, unknown>): ConfigRow[] {
  return Object.entries(body).map(([key, value]) => {
    const valueType: ValueType = typeof value === 'number' ? 'number' : 'string'
    const raw =
      typeof value === 'number'
        ? String(value)
        : typeof value === 'string'
          ? value
          : JSON.stringify(value ?? null)
    return { id: uid(), key, value: raw, valueType }
  })
}

export function GameConfigPage() {
  const toast = useKumoToastManager()
  const current = useApiGet(
    ['GET /api/v1/game-configuration'],
    () => getClient().GET('/api/v1/game-configuration'),
  )
  const set = useApiMutation(
    ['POST /api/v1/game-configuration'],
    (input: Record<string, number | string>) => getClient().POST('/api/v1/game-configuration', { body: input }),
  )

  const [rows, setRows] = useState<ConfigRow[]>([])
  const [draftError, setDraftError] = useState('')
  const [saving, setSaving] = useState(false)

  // Initialize the editor whenever fresh data arrives.
  const [initKey, setInitKey] = useState('')
  const dataKey = current.data ? `${current.data.status}:${JSON.stringify(current.data.body ?? null)}` : ''
  if (dataKey !== initKey && dataKey) {
    setInitKey(dataKey)
    if (current.data?.ok) {
      const record = toRecord(current.data.body)
      setRows(record ? recordToRows(record) : [])
    }
  }
  const updateRow = (id: string, patch: Partial<ConfigRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
    setDraftError('')
  }
  const addRow = () => {
    setRows((prev) => [...prev, { id: uid(), key: '', value: '', valueType: 'number' }])
    setDraftError('')
  }
  const removeRow = (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id))
    setDraftError('')
  }

  /** Live preview of the object that would be sent, for transparency. */
  const preview = useMemo(() => {
    const out: Record<string, unknown> = {}
    for (const row of rows) {
      const key = row.key.trim()
      if (!key) continue
      out[key] =
        row.valueType === 'number' && row.value.trim() !== '' && Number.isFinite(Number(row.value))
          ? Number(row.value)
          : row.value
    }
    return out
  }, [rows])

  const submitConfig = async () => {
    const seen = new Set<string>()
    const out: Record<string, number | string> = {}
    for (const row of rows) {
      const key = row.key.trim()
      if (!key) continue
      if (seen.has(key)) {
        setDraftError(`Duplicate key “${key}” — each key can only appear once.`)
        return
      }
      seen.add(key)
      if (row.valueType === 'number') {
        if (row.value.trim() === '' || !Number.isFinite(Number(row.value))) {
          setDraftError(`“${key}” must be a valid number.`)
          return
        }
        out[key] = Number(row.value)
      } else {
        out[key] = row.value
      }
    }
    setSaving(true)
    const r = await set.mutateAsync(out)
    setSaving(false)
    if (r.ok) {
      toast.add({ id: 'cfg-saved', title: 'Game configuration updated', variant: 'success' })
      setDraftError('')
      current.refetch()
    } else {
      toast.add({ id: 'cfg-err', title: `Save failed (HTTP ${r.status})`, description: errorText(r), variant: 'error' })
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      <PageHeader
        title="Configuration"
        description="Cloud configuration that game clients download and apply at startup. Each entry is a key with a number or string value."
        icon={<SlidersHorizontal size={20} weight="fill" />}
      />

      <div className="grid gap-4">
        <LayerCard className="flex flex-col gap-4 p-4 sm:p-5">
          <div className="grid gap-2">
            {current.isLoading ? (
              <Text variant="secondary" size="sm">Loading current configuration…</Text>
            ) : current.data && !current.data.ok ? (
              <Text variant="error" size="sm">Could not load configuration (HTTP {current.data.status}).</Text>
            ) : null}

            <div className="hidden items-center gap-2 px-2 text-[11px] font-medium tracking-wide text-kumo-subtle uppercase sm:flex">
              <span className="flex-1">Key</span>
              <span className="w-[44%]">Value</span>
              <span className="w-[110px]">Type</span>
              <span className="w-8" />
            </div>

            <div className="flex flex-col gap-2">
              {rows.map((row, i) => (
                <div
                  key={row.id}
                  className="grid grid-cols-1 items-center gap-2 rounded-lg bg-kumo-base p-2 ring ring-kumo-line focus-within:ring-2 focus-within:ring-kumo-focus sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_110px_auto]"
                >
                  <Input
                    size="sm"
                    value={row.key}
                    onChange={(e) => updateRow(row.id, { key: e.target.value })}
                    placeholder="Key, e.g. 44CFA650"
                    className="font-mono text-[12.5px]"
                    aria-label={`Key ${i + 1}`}
                  />
                  <Input
                    size="sm"
                    value={row.value}
                    onChange={(e) => updateRow(row.id, { value: e.target.value })}
                    placeholder={row.valueType === 'number' ? '60' : 'Base64 payload…'}
                    className="font-mono text-[12.5px]"
                    aria-label={`Value ${i + 1}`}
                  />
                  <Select
                    size="sm"
                    value={row.valueType}
                    onValueChange={(v) => updateRow(row.id, { valueType: v === 'number' ? 'number' : 'string' })}
                    items={{ number: 'Number', string: 'String' }}
                    aria-label={`Value type ${i + 1}`}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    shape="square"
                    onClick={() => removeRow(row.id)}
                    aria-label="Remove entry"
                    title="Remove entry"
                    className="text-kumo-subtle hover:text-kumo-danger"
                  >
                    <Trash size={14} />
                  </Button>
                </div>
              ))}
              {rows.length === 0 && (
                <div className="rounded-lg bg-kumo-base px-4 py-6 text-center ring ring-kumo-line">
                  <Text variant="secondary" size="sm">No configuration entries yet — add the first key.</Text>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" size="sm" onClick={addRow} icon={<Plus size={14} weight="bold" />}>
                Add entry
              </Button>
              {draftError && (
                <span className="text-sm text-kumo-danger">{draftError}</span>
              )}
            </div>

            <JsonView value={preview} label="Resulting JSON (preview)" maxHeight="220px" />

            <div className="flex justify-end">
              <Button variant="primary" onClick={() => void submitConfig()} loading={saving} icon={<FloppyDisk size={15} />}>
                Save configuration
              </Button>
            </div>
          </div>
        </LayerCard>
      </div>
    </div>
  )
}
