import { useState } from 'react'
import { Button, Input, LayerCard, Loader, Select, Tabs, Text, useKumoToastManager } from '@cloudflare/kumo'
import { ArrowClockwise, FloppyDisk, Plus, ShieldCheck, Trash } from '@phosphor-icons/react'
import { getClient } from '../api/client'
import { errorText, useApiGet, useApiMutation } from '../hooks/useApi'
import { PageHeader } from '../components/PageHeader'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { AntiCheatDefinitionsEditor } from '../components/AntiCheatDefinitionsEditor'
import { toNestedNumberMap, toNumberMap, type AntiCheatDefinitions } from '../lib/anti-cheat'

/** Builds a Select items map, adding the current value if it is not a known option. */
function itemsWithCurrent(base: Record<number, string>, current: string | undefined): Record<string, string> {
  const items: Record<string, string> = {}
  for (const [key, label] of Object.entries(base)) items[key] = label
  if (current !== undefined && current.trim() !== '' && !(current.trim() in items)) {
    items[current.trim()] = `Custom (${current.trim()})`
  }
  return items
}

interface FieldDraft {
  id: string
  fieldId: string
  valueType: string
  value: string
}

interface RuleDraft {
  id: string
  ruleId: string
  ruleType: string
  fields: FieldDraft[]
}

interface BuiltField {
  fieldId: number
  valueType: number
  value: number
}

interface BuiltRule {
  ruleId: number
  ruleType: number
  fields: BuiltField[]
}

const uid = () => Math.random().toString(36).slice(2, 10)

function rulesToDrafts(rules: unknown[]): RuleDraft[] {
  return rules.map((raw) => {
    const rule = (raw ?? {}) as Record<string, unknown>
    const fields = Array.isArray(rule.fields) ? (rule.fields as Record<string, unknown>[]) : []
    return {
      id: uid(),
      ruleId: rule.ruleId !== undefined && rule.ruleId !== null ? String(rule.ruleId) : '',
      ruleType: rule.ruleType !== undefined && rule.ruleType !== null ? String(rule.ruleType) : '',
      fields: fields.map((f) => ({
        id: uid(),
        fieldId: f.fieldId !== undefined && f.fieldId !== null ? String(f.fieldId) : '',
        valueType: f.valueType !== undefined && f.valueType !== null ? String(f.valueType) : '',
        value: f.value !== undefined && f.value !== null ? String(f.value) : '',
      })),
    }
  })
}

/** Parses the server rule set into `{ results, byId }`. */
function parseRules(body: unknown): { results: unknown[]; byId: Record<string, boolean> } {
  const results = Array.isArray((body as { results?: unknown[] } | undefined)?.results)
    ? ((body as { results: unknown[] }).results)
    : []
  const byId: Record<string, boolean> = {}
  for (const raw of results) {
    const ruleId = (raw as Record<string, unknown>).ruleId
    if (ruleId !== undefined && ruleId !== null) byId[String(ruleId)] = true
  }
  return { results, byId }
}

/** Validates a single draft rule and produces the payload for the API. Throws on invalid input. */
function buildRule(draft: RuleDraft): BuiltRule {
  const ruleId = Number(draft.ruleId.trim())
  const ruleType = Number(draft.ruleType.trim())
  if (draft.ruleId.trim() === '' || !Number.isInteger(ruleId) || ruleId < 0 || ruleId > 65535) {
    throw new Error('Rule needs a ruleId between 0 and 65535.')
  }
  if (draft.ruleType.trim() === '' || !Number.isInteger(ruleType) || ruleType < 0 || ruleType > 255) {
    throw new Error('Rule needs a valid rule type.')
  }
  const fields: BuiltField[] = draft.fields.map((f) => {
    const fieldId = Number(f.fieldId.trim())
    const value = Number(f.value.trim())
    if (f.fieldId.trim() === '' || !Number.isInteger(fieldId) || fieldId < 0 || fieldId > 255) {
      throw new Error('Every field needs a fieldId between 0 and 255.')
    }
    if (f.value.trim() === '' || !Number.isFinite(value)) {
      throw new Error('Every field needs a numeric value.')
    }
    const valueType = Number(f.valueType.trim())
    if (f.valueType.trim() === '' || !Number.isInteger(valueType) || valueType < 0 || valueType > 255) {
      throw new Error('Every field needs a valid value type (uint16 = 0, float32 = 1).')
    }
    return { fieldId, valueType, value }
  })
  return { ruleId, ruleType, fields }
}

export function AntiCheatPage() {
  const toast = useKumoToastManager()
  const [tab, setTab] = useState('definitions')
  const current = useApiGet(
    ['GET /api/v1/anti-cheat-rules'],
    () => getClient().GET('/api/v1/anti-cheat-rules', { params: { query: { limit: 100 } } }),
    tab === 'rules',
  )
  const definitions = useApiGet(
    ['GET /api/v1/anti-cheat-definitions'],
    () => getClient().GET('/api/v1/anti-cheat-definitions'),
    tab === 'definitions',
  )

  const defs: AntiCheatDefinitions | undefined =
    definitions.data?.isJson && definitions.data.body && typeof definitions.data.body === 'object'
      ? (definitions.data.body as AntiCheatDefinitions)
      : undefined

  const ruleTypes = toNumberMap(defs?.ruleTypes)
  const ruleTypeLabels: Record<number, string> = Object.fromEntries(
    Object.entries(ruleTypes).map(([k, v]) => [k, v.label]),
  )
  const ruleFields = toNestedNumberMap(defs?.ruleFields)
  const eventNames = toNumberMap(defs?.eventNames)
  const entityNames = toNumberMap(defs?.entityNames)
  const valueTypes = toNumberMap(defs?.valueTypes)

  const create = useApiMutation(
    ['POST /api/v1/anti-cheat-rules'],
    (input: BuiltRule) => getClient().POST('/api/v1/anti-cheat-rules', { body: input }),
  )
  const update = useApiMutation(
    ['PUT /api/v1/anti-cheat-rules/:ruleId'],
    (input: { ruleId: number; ruleType: number; fields: BuiltField[] }) =>
      getClient().PUT('/api/v1/anti-cheat-rules/:ruleId', {
        params: { path: { ruleId: input.ruleId } },
        body: { ruleType: input.ruleType, fields: input.fields },
      }),
  )
  const remove = useApiMutation(
    ['DELETE /api/v1/anti-cheat-rules/:ruleId'],
    (input: { ruleId: number }) => getClient().DELETE('/api/v1/anti-cheat-rules/:ruleId', { params: { path: input } }),
  )

  const [rules, setRules] = useState<RuleDraft[]>([])
  /** Per-draft validation/request errors keyed by draft id. */
  const [errors, setErrors] = useState<Record<string, string>>({})
  /** Draft id of the rule currently being saved. */
  const [savingId, setSavingId] = useState<string | null>(null)
  /** Draft awaiting delete confirmation. */
  const [deleting, setDeleting] = useState<RuleDraft | null>(null)
  /** Server-side rule ids captured when the draft list was last synced. */
  const [loadedIds, setLoadedIds] = useState<Record<string, boolean>>({})

  const dataKey = current.data ? `${current.data.status}:${JSON.stringify(current.data.body ?? null)}` : ''
  const [lastKey, setLastKey] = useState('')
  if (dataKey !== lastKey && dataKey) {
    setLastKey(dataKey)
    if (current.data?.ok && current.data.body !== null) {
      const { results, byId } = parseRules(current.data.body)
      setRules(rulesToDrafts(results))
      setLoadedIds(byId)
      setErrors({})
      setSavingId(null)
      setDeleting(null)
    }
  }

  const updateRule = (id: string, patch: Partial<RuleDraft>) => {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
    setErrors((prev) => ({ ...prev, [id]: '' }))
  }
  const addRule = () => {
    setRules((prev) => [...prev, { id: uid(), ruleId: '', ruleType: '', fields: [] }])
  }
  const addField = (ruleId: string) => {
    setRules((prev) =>
      prev.map((r) => (r.id === ruleId ? { ...r, fields: [...r.fields, { id: uid(), fieldId: '', valueType: '', value: '' }] } : r)),
    )
    setErrors((prev) => ({ ...prev, [ruleId]: '' }))
  }
  const updateField = (ruleId: string, fieldId: string, patch: Partial<FieldDraft>) => {
    setRules((prev) =>
      prev.map((r) =>
        r.id === ruleId ? { ...r, fields: r.fields.map((f) => (f.id === fieldId ? { ...f, ...patch } : f)) } : r,
      ),
    )
    setErrors((prev) => ({ ...prev, [ruleId]: '' }))
  }
  const removeField = (ruleId: string, fieldId: string) => {
    setRules((prev) => prev.map((r) => (r.id === ruleId ? { ...r, fields: r.fields.filter((f) => f.id !== fieldId) } : r)))
    setErrors((prev) => ({ ...prev, [ruleId]: '' }))
  }

  /** Saves one rule: creates it if the server does not know the ruleId yet, otherwise updates it. */
  const saveRule = async (draft: RuleDraft) => {
    let built: BuiltRule
    try {
      built = buildRule(draft)
    } catch (err) {
      setErrors((prev) => ({ ...prev, [draft.id]: err instanceof Error ? err.message : String(err) }))
      return
    }
    const duplicate = rules.some((r) => r.id !== draft.id && r.ruleId.trim() === String(built.ruleId))
    if (duplicate) {
      setErrors((prev) => ({
        ...prev,
        [draft.id]: `Duplicate ruleId ${built.ruleId} — each rule needs a unique identifier.`,
      }))
      return
    }
    setErrors((prev) => ({ ...prev, [draft.id]: '' }))
    setSavingId(draft.id)
    try {
      const exists = loadedIds[String(built.ruleId)] === true
      const r = exists
        ? await update.mutateAsync({ ruleId: built.ruleId, ruleType: built.ruleType, fields: built.fields })
        : await create.mutateAsync(built)
      if (!r.ok) throw new Error(errorText(r) || `HTTP ${r.status}`)
      setLoadedIds((prev) => ({ ...prev, [String(built.ruleId)]: true }))
      toast.add({
        id: `ac-saved-${draft.id}`,
        title: exists ? 'Rule updated' : 'Rule created',
        description: `Rule ${built.ruleId} saved, configuration updated and pushed to connected clients.`,
        variant: 'success',
      })
      current.refetch()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setErrors((prev) => ({ ...prev, [draft.id]: message }))
      toast.add({ id: `ac-err-${draft.id}`, title: 'Save failed', description: message, variant: 'error' })
    } finally {
      setSavingId(null)
    }
  }

  /** Removes a draft locally, or asks for confirmation when the rule exists on the server. */
  const onRemoveRule = (draft: RuleDraft) => {
    const onServer = draft.ruleId.trim() !== '' && loadedIds[draft.ruleId.trim()] === true
    if (onServer) {
      setDeleting(draft)
    } else {
      setRules((prev) => prev.filter((r) => r.id !== draft.id))
      setErrors((prev) => {
        const next = { ...prev }
        delete next[draft.id]
        return next
      })
    }
  }

  /** Deletes a rule that exists on the server. */
  const confirmDelete = async () => {
    if (!deleting) return
    const ruleId = Number(deleting.ruleId.trim())
    try {
      const r = await remove.mutateAsync({ ruleId })
      if (!r.ok) throw new Error(errorText(r) || `HTTP ${r.status}`)
      setLoadedIds((prev) => {
        const next = { ...prev }
        delete next[String(ruleId)]
        return next
      })
      toast.add({
        id: `ac-del-${deleting.id}`,
        title: 'Rule deleted',
        description: `Rule ${ruleId} removed, configuration updated and pushed to connected clients.`,
        variant: 'success',
      })
      current.refetch()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setErrors((prev) => ({ ...prev, [deleting.id]: message }))
      toast.add({ id: 'ac-del-err', title: 'Delete failed', description: message, variant: 'error' })
    } finally {
      setDeleting(null)
    }
  }

  const count = current.data?.isJson && current.data.body && typeof current.data.body === 'object'
    ? parseRules(current.data.body).results.length
    : 0

  const tabs = [
    { value: 'definitions', label: 'Definitions' },
    { value: 'rules', label: 'Rules' },
  ]

  return (
    <div className="mx-auto w-full max-w-4xl">
      <PageHeader
        title="Anti-cheat"
        description="Runtime rules evaluated against player behaviour — event rate limits track how often players fire events, movement speed limits track how far entities move. Each rule saves individually: creating, updating or deleting it applies the change to the game configuration and pushes the new rules to connected clients."
        icon={<ShieldCheck size={20} weight="fill" />}
      />

      <div className="mb-4">
        <Tabs tabs={tabs} value={tab} onValueChange={setTab} variant="underline" size="sm" />
      </div>

      {tab === 'definitions' && (
        <AntiCheatDefinitionsEditor
          value={defs}
          loading={definitions.isFetching}
          loadError={definitions.data && !definitions.data.ok ? `HTTP ${definitions.data.status}` : null}
          onRefresh={() => definitions.refetch()}
        />
      )}

      {tab === 'rules' && (
      <LayerCard className="flex flex-col gap-4 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-kumo-tint text-kumo-brand">
              <ShieldCheck size={16} weight="fill" />
            </span>
            <Text variant="heading3" as="h3">
              Rule set {current.data?.ok ? `(${count} active)` : ''}
            </Text>
          </div>
          <Button variant="ghost" size="sm" shape="square" onClick={() => current.refetch()} aria-label="Reload rules" title="Reload">
            <ArrowClockwise size={14} className={current.isFetching ? 'animate-refresh' : ''} />
          </Button>
        </div>

        {current.isLoading ? (
          <div className="flex flex-col items-center gap-3 py-14">
            <Loader size="lg" />
            <Text variant="secondary" size="sm">Loading…</Text>
          </div>
        ) : (
          <>
            {current.data && !current.data.ok && (
              <Text variant="error" size="sm">Could not load rules (HTTP {current.data.status}).</Text>
            )}

            <div className="flex flex-col gap-3">
          {rules.map((rule, ruleIndex) => {
            const ruleTypeNum = rule.ruleType.trim() !== '' ? Number(rule.ruleType) : Number.NaN
            const typeMeta = Number.isInteger(ruleTypeNum) ? ruleTypes[ruleTypeNum] : undefined
            const isNew = !loadedIds[rule.ruleId.trim()]
            const saving = savingId === rule.id
            return (
              <LayerCard key={rule.id} className="flex flex-col gap-3 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <Text variant="heading3" as="h3">Rule {ruleIndex + 1}{isNew ? ' (new)' : ''}</Text>
                    {typeMeta && (
                      <Text variant="secondary" size="sm">{typeMeta.label}</Text>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemoveRule(rule)}
                    className="text-kumo-danger hover:bg-kumo-danger-tint"
                    icon={<Trash size={14} />}
                    disabled={saving}
                  >
                    Remove rule
                  </Button>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Input
                    label="ID"
                    description="Unique identifier for this rule"
                    value={rule.ruleId}
                    onChange={(e) => updateRule(rule.id, { ruleId: e.target.value })}
                    placeholder="0 – 65535"
                    inputMode="numeric"
                    className="font-mono text-[13px]"
                  />
                  <Select
                    label="Type"
                    description={typeMeta?.description ?? 'Type of behaviour this rule monitors'}
                    size="sm"
                    value={rule.ruleType}
                    onValueChange={(v) => updateRule(rule.id, { ruleType: v ?? '' })}
                    items={itemsWithCurrent(ruleTypeLabels, rule.ruleType)}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <Text variant="secondary" size="sm">Fields</Text>
                    <Button variant="ghost" size="sm" onClick={() => addField(rule.id)} icon={<Plus size={13} weight="bold" />} disabled={saving}>
                      Add field
                    </Button>
                  </div>

                  {rule.fields.map((field, fieldIndex) => {
                    const fieldIdNum = field.fieldId.trim() !== '' ? Number(field.fieldId) : Number.NaN
                    const meta =
                      Number.isInteger(ruleTypeNum) && Number.isInteger(fieldIdNum)
                        ? ruleFields[ruleTypeNum]?.[fieldIdNum]
                        : undefined
                    const useEventSelect = ruleTypeNum === 0 && fieldIdNum === 0
                    const useEntitySelect = ruleTypeNum === 1 && fieldIdNum === 2
                    return (
                      <div
                        key={field.id}
                        className="grid grid-cols-1 items-end gap-2 rounded-lg bg-kumo-base p-2 ring ring-kumo-line focus-within:ring-2 focus-within:ring-kumo-focus sm:grid-cols-[minmax(0,1.15fr)_minmax(0,0.75fr)_minmax(0,0.9fr)_minmax(0,1.5fr)_auto]"
                      >
                        <div className="min-w-0 sm:pb-1">
                          <div className="truncate text-[12.5px] font-medium text-kumo-strong">{meta?.label ?? `Field ${field.fieldId || fieldIndex + 1}`}</div>
                          <div className="truncate text-[11px] text-kumo-subtle">{meta?.hint ?? 'Custom parameter'}</div>
                        </div>
                        <Input
                          size="sm"
                          value={field.fieldId}
                          onChange={(e) => updateField(rule.id, field.id, { fieldId: e.target.value })}
                          placeholder="Field ID"
                          inputMode="numeric"
                          className="font-mono text-[12.5px]"
                          aria-label={`Rule ${ruleIndex + 1} field ${fieldIndex + 1} ID`}
                        />
                        <Select
                          size="sm"
                          value={field.valueType}
                          onValueChange={(v) => updateField(rule.id, field.id, { valueType: v ?? '' })}
                          items={itemsWithCurrent(valueTypes, field.valueType)}
                          aria-label={`Rule ${ruleIndex + 1} field ${fieldIndex + 1} value type`}
                        />
                        {useEventSelect || useEntitySelect ? (
                          <Select
                            size="sm"
                            value={field.value}
                            onValueChange={(v) => updateField(rule.id, field.id, { value: v ?? '' })}
                            items={itemsWithCurrent(useEventSelect ? eventNames : entityNames, field.value)}
                            aria-label={`Rule ${ruleIndex + 1} field ${fieldIndex + 1} value`}
                            className="font-mono text-[12.5px]"
                          />
                        ) : (
                          <Input
                            size="sm"
                            value={field.value}
                            onChange={(e) => updateField(rule.id, field.id, { value: e.target.value })}
                            placeholder={field.valueType === '1' ? '0.0' : '0'}
                            inputMode="decimal"
                            className="font-mono text-[12.5px]"
                            aria-label={`Rule ${ruleIndex + 1} field ${fieldIndex + 1} value`}
                          />
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          shape="square"
                          onClick={() => removeField(rule.id, field.id)}
                          aria-label={`Remove field ${fieldIndex + 1}`}
                          title="Remove field"
                          className="text-kumo-subtle hover:text-kumo-danger"
                          disabled={saving}
                        >
                          <Trash size={14} />
                        </Button>
                      </div>
                    )
                  })}
                  {rule.fields.length === 0 && (
                    <div className="rounded-lg bg-kumo-base px-4 py-4 text-center ring ring-kumo-line">
                      <Text variant="secondary" size="sm">No fields yet — add the first one.</Text>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-kumo-hairline pt-3">
                  {errors[rule.id] ? (
                    <Text variant="error" size="sm">{errors[rule.id]}</Text>
                  ) : (
                    <Text variant="secondary" size="sm">
                      {isNew ? 'Not saved yet — will be created on save.' : 'Saved on the server — changes apply when you save this rule.'}
                    </Text>
                  )}
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => void saveRule(rule)}
                    loading={saving}
                    disabled={savingId !== null && !saving}
                    icon={<FloppyDisk size={14} />}
                  >
                    Save rule
                  </Button>
                </div>
              </LayerCard>
            )
          })}
          {rules.length === 0 && (
            <div className="rounded-lg bg-kumo-base px-4 py-10 text-center ring ring-kumo-line">
              <Text variant="secondary" size="sm">No rules yet — add the first one to get started.</Text>
            </div>
          )}
        </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" onClick={addRule} icon={<Plus size={15} weight="bold" />}>
                Add rule
              </Button>
              <Text variant="secondary" size="sm">
                {rules.length} rule{rules.length === 1 ? '' : 's'} — each one is saved individually.
              </Text>
            </div>
          </>
        )}
      </LayerCard>
      )}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this rule?"
        description="The rule will be removed, the game configuration updated, and the change pushed to connected clients."
        confirmLabel="Delete rule"
        onConfirm={() => void confirmDelete()}
        loading={remove.isPending}
      />
    </div>
  )
}
