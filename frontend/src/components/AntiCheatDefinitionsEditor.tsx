import { useState } from 'react'
import { Button, Input, LayerCard, Loader, Text, useKumoToastManager } from '@cloudflare/kumo'
import { ArrowClockwise, FloppyDisk, Plus, Tag, Trash } from '@phosphor-icons/react'
import { getClient } from '../api/client'
import { errorText, useApiMutation } from '../hooks/useApi'
import type { AntiCheatDefinitions, RuleFieldDefinition, RuleTypeDefinition } from '../lib/anti-cheat'

/* ------------------------------------------------------------------ */
/* Draft shapes — one entry per row, keyed by a stable client-side id  */
/* so rows can be added/removed/reordered without losing focus.        */
/* ------------------------------------------------------------------ */

interface RuleTypeDraft {
  id: string
  key: string
  label: string
  description: string
}

interface RuleFieldDraft {
  id: string
  parentKey: string
  key: string
  label: string
  hint: string
}

interface NameDraft {
  id: string
  key: string
  label: string
}

interface DefinitionsDraft {
  ruleTypes: RuleTypeDraft[]
  ruleFields: RuleFieldDraft[]
  eventNames: NameDraft[]
  entityNames: NameDraft[]
  valueTypes: NameDraft[]
}

const uid = () => Math.random().toString(36).slice(2, 10)

const emptyDraft = (): DefinitionsDraft => ({
  ruleTypes: [],
  ruleFields: [],
  eventNames: [],
  entityNames: [],
  valueTypes: [],
})

function documentToDraft(defs: AntiCheatDefinitions): DefinitionsDraft {
  return {
    ruleTypes: Object.entries(defs.ruleTypes ?? {}).map(([key, v]) => ({
      id: uid(),
      key,
      label: v.label ?? '',
      description: v.description ?? '',
    })),
    ruleFields: Object.entries(defs.ruleFields ?? {}).flatMap(([parentKey, fields]) =>
      Object.entries(fields ?? {}).map(([key, v]) => ({
        id: uid(),
        parentKey,
        key,
        label: v.label ?? '',
        hint: v.hint ?? '',
      })),
    ),
    eventNames: Object.entries(defs.eventNames ?? {}).map(([key, label]) => ({
      id: uid(),
      key,
      label: label ?? '',
    })),
    entityNames: Object.entries(defs.entityNames ?? {}).map(([key, label]) => ({
      id: uid(),
      key,
      label: label ?? '',
    })),
    valueTypes: Object.entries(defs.valueTypes ?? {}).map(([key, label]) => ({
      id: uid(),
      key,
      label: label ?? '',
    })),
  }
}

function draftToDocument(draft: DefinitionsDraft): AntiCheatDefinitions {
  const ruleTypes: Record<string, RuleTypeDefinition> = {}
  for (const r of draft.ruleTypes) {
    ruleTypes[r.key.trim()] = { label: r.label, description: r.description }
  }

  const ruleFields: Record<string, Record<string, RuleFieldDefinition>> = {}
  for (const f of draft.ruleFields) {
    const fields = (ruleFields[f.parentKey.trim()] ??= {})
    fields[f.key.trim()] = { label: f.label, hint: f.hint }
  }

  const eventNames: Record<string, string> = {}
  for (const e of draft.eventNames) eventNames[e.key.trim()] = e.label

  const entityNames: Record<string, string> = {}
  for (const e of draft.entityNames) entityNames[e.key.trim()] = e.label

  const valueTypes: Record<string, string> = {}
  for (const e of draft.valueTypes) valueTypes[e.key.trim()] = e.label

  return { ruleTypes, ruleFields, eventNames, entityNames, valueTypes }
}

/** Returns the first duplicate key, or null when every key is unique. */
function duplicateKey(keys: string[]): string | null {
  const seen = new Set<string>()
  for (const key of keys) {
    if (seen.has(key)) return key
    seen.add(key)
  }
  return null
}

function validateDraft(draft: DefinitionsDraft): string | null {
  if (draft.ruleTypes.some((r) => r.key.trim() === '')) {
    return 'Every rule type needs a numeric key.'
  }
  const ruleTypeDup = duplicateKey(draft.ruleTypes.map((r) => r.key.trim()))
  if (ruleTypeDup !== null) return `Duplicate rule type key "${ruleTypeDup}".`

  if (draft.ruleFields.some((f) => f.parentKey.trim() === '' || f.key.trim() === '')) {
    return 'Every rule field needs a rule type key and a field key.'
  }
  const ruleFieldDup = duplicateKey(draft.ruleFields.map((f) => `${f.parentKey.trim()}:${f.key.trim()}`))
  if (ruleFieldDup !== null) return `Duplicate rule field (${ruleFieldDup.replace(':', ' → ')}).`

  if (draft.eventNames.some((e) => e.key.trim() === '')) return 'Every event name needs a numeric key.'
  if (draft.entityNames.some((e) => e.key.trim() === '')) return 'Every entity name needs a numeric key.'
  if (draft.valueTypes.some((e) => e.key.trim() === '')) return 'Every value type needs a numeric key.'

  const eventDup = duplicateKey(draft.eventNames.map((e) => e.key.trim()))
  if (eventDup !== null) return `Duplicate event key "${eventDup}".`
  const entityDup = duplicateKey(draft.entityNames.map((e) => e.key.trim()))
  if (entityDup !== null) return `Duplicate entity key "${entityDup}".`
  const valueDup = duplicateKey(draft.valueTypes.map((e) => e.key.trim()))
  if (valueDup !== null) return `Duplicate value type key "${valueDup}".`

  return null
}

interface NameSectionProps {
  title: string
  entries: NameDraft[]
  onAdd: () => void
  onChange: (id: string, patch: Partial<NameDraft>) => void
  onRemove: (id: string) => void
}

function NameSection({ title, entries, onAdd, onChange, onRemove }: NameSectionProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <Text variant="secondary" size="sm">
          {title}
        </Text>
        <Button variant="ghost" size="sm" onClick={onAdd} icon={<Plus size={13} weight="bold" />}>
          Add
        </Button>
      </div>
      {entries.map((entry, index) => (
        <div
          key={entry.id}
          className="grid grid-cols-1 items-end gap-2 rounded-lg bg-kumo-base p-2 ring ring-kumo-line focus-within:ring-2 focus-within:ring-kumo-focus sm:grid-cols-[minmax(0,0.6fr)_minmax(0,1.4fr)_auto]"
        >
          <Input
            size="sm"
            value={entry.key}
            onChange={(e) => onChange(entry.id, { key: e.target.value })}
            placeholder="ID"
            inputMode="numeric"
            className="font-mono text-[12.5px]"
            aria-label={`${title} ${index + 1} ID`}
          />
          <Input
            size="sm"
            value={entry.label}
            onChange={(e) => onChange(entry.id, { label: e.target.value })}
            placeholder="Name"
            aria-label={`${title} ${index + 1} name`}
          />
          <Button
            variant="ghost"
            size="sm"
            shape="square"
            onClick={() => onRemove(entry.id)}
            aria-label={`Remove ${title} ${index + 1}`}
            title="Remove"
            className="text-kumo-subtle hover:text-kumo-danger"
          >
            <Trash size={14} />
          </Button>
        </div>
      ))}
      {entries.length === 0 && (
        <div className="rounded-lg bg-kumo-base px-4 py-3 text-center ring ring-kumo-line">
          <Text variant="secondary" size="sm">None yet.</Text>
        </div>
      )}
    </div>
  )
}

export interface AntiCheatDefinitionsEditorProps {
  value: AntiCheatDefinitions | undefined
  loading: boolean
  loadError: string | null
  onRefresh: () => void
}

export function AntiCheatDefinitionsEditor({
  value,
  loading,
  loadError,
  onRefresh,
}: AntiCheatDefinitionsEditorProps) {
  const toast = useKumoToastManager()
  const save = useApiMutation(
    ['PUT /api/v1/anti-cheat-definitions'],
    (body: AntiCheatDefinitions) => getClient().PUT('/api/v1/anti-cheat-definitions', { body }),
  )

  const [draft, setDraft] = useState<DefinitionsDraft>(emptyDraft)
  const [error, setError] = useState<string | null>(null)

  /** Re-sync the draft when the server document changes. */
  const dataKey = value ? JSON.stringify(value) : ''
  const [lastKey, setLastKey] = useState('')
  if (dataKey !== lastKey && value) {
    setLastKey(dataKey)
    setDraft(documentToDraft(value))
    setError(null)
  }

  const patchList = <T extends { id: string }>(list: T[], id: string, patch: Partial<T>): T[] =>
    list.map((item) => (item.id === id ? { ...item, ...patch } : item))

  const addEntry = <T extends { id: string }>(list: T[], entry: T): T[] => [...list, entry]

  const removeEntry = <T extends { id: string }>(list: T[], id: string): T[] => list.filter((item) => item.id !== id)

  const onSave = async () => {
    const validationError = validateDraft(draft)
    if (validationError) {
      setError(validationError)
      return
    }
    setError(null)
    try {
      const r = await save.mutateAsync(draftToDocument(draft))
      if (!r.ok) throw new Error(errorText(r) || `HTTP ${r.status}`)
      toast.add({
        id: 'ac-defs-saved',
        title: 'Definitions saved',
        description: 'Anti-cheat definitions updated for the console.',
        variant: 'success',
      })
      onRefresh()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
      toast.add({ id: 'ac-defs-err', title: 'Save failed', description: message, variant: 'error' })
    }
  }

  return (
    <LayerCard className="flex flex-col gap-4 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-kumo-tint text-kumo-brand">
            <Tag size={16} weight="fill" />
          </span>
          <div>
            <Text variant="heading3" as="h3">
              Definitions
            </Text>
            <Text variant="secondary" size="sm">
              Labels, descriptions and hints used to render rules and field values.
            </Text>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          shape="square"
          onClick={onRefresh}
          aria-label="Reload definitions"
          title="Reload"
        >
          <ArrowClockwise size={14} className={loading ? 'animate-refresh' : ''} />
        </Button>
      </div>

      {loadError ? (
        <Text variant="error" size="sm">Could not load definitions ({loadError}).</Text>
      ) : !value ? (
        <div className="flex flex-col items-center gap-3 py-14">
          <Loader size="lg" />
          <Text variant="secondary" size="sm">Loading…</Text>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {/* Rule types */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <Text variant="secondary" size="sm">
                  Rule types
                </Text>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDraft((prev) => ({ ...prev, ruleTypes: addEntry(prev.ruleTypes, { id: uid(), key: '', label: '', description: '' }) }))}
                  icon={<Plus size={13} weight="bold" />}
                >
                  Add
                </Button>
              </div>
              {draft.ruleTypes.map((entry, index) => (
                <div
                  key={entry.id}
                  className="grid grid-cols-1 items-end gap-2 rounded-lg bg-kumo-base p-2 ring ring-kumo-line focus-within:ring-2 focus-within:ring-kumo-focus sm:grid-cols-[minmax(0,0.6fr)_minmax(0,1fr)_minmax(0,1.6fr)_auto]"
                >
                  <Input
                    size="sm"
                    value={entry.key}
                    onChange={(e) => setDraft((prev) => ({ ...prev, ruleTypes: patchList(prev.ruleTypes, entry.id, { key: e.target.value }) }))}
                    placeholder="Type ID"
                    inputMode="numeric"
                    className="font-mono text-[12.5px]"
                    aria-label={`Rule type ${index + 1} ID`}
                  />
                  <Input
                    size="sm"
                    value={entry.label}
                    onChange={(e) => setDraft((prev) => ({ ...prev, ruleTypes: patchList(prev.ruleTypes, entry.id, { label: e.target.value }) }))}
                    placeholder="Label"
                    aria-label={`Rule type ${index + 1} label`}
                  />
                  <Input
                    size="sm"
                    value={entry.description}
                    onChange={(e) => setDraft((prev) => ({ ...prev, ruleTypes: patchList(prev.ruleTypes, entry.id, { description: e.target.value }) }))}
                    placeholder="Description"
                    aria-label={`Rule type ${index + 1} description`}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    shape="square"
                    onClick={() => setDraft((prev) => ({ ...prev, ruleTypes: removeEntry(prev.ruleTypes, entry.id) }))}
                    aria-label={`Remove rule type ${index + 1}`}
                    title="Remove"
                    className="text-kumo-subtle hover:text-kumo-danger"
                  >
                    <Trash size={14} />
                  </Button>
                </div>
              ))}
              {draft.ruleTypes.length === 0 && (
                <div className="rounded-lg bg-kumo-base px-4 py-3 text-center ring ring-kumo-line">
                  <Text variant="secondary" size="sm">None yet.</Text>
                </div>
              )}
            </div>

            {/* Rule fields */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <Text variant="secondary" size="sm">
                  Rule fields
                </Text>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDraft((prev) => ({ ...prev, ruleFields: addEntry(prev.ruleFields, { id: uid(), parentKey: '', key: '', label: '', hint: '' }) }))}
                  icon={<Plus size={13} weight="bold" />}
                >
                  Add
                </Button>
              </div>
              {draft.ruleFields.map((entry, index) => (
                <div
                  key={entry.id}
                  className="grid grid-cols-1 items-end gap-2 rounded-lg bg-kumo-base p-2 ring ring-kumo-line focus-within:ring-2 focus-within:ring-kumo-focus sm:grid-cols-[minmax(0,0.6fr)_minmax(0,0.6fr)_minmax(0,1fr)_minmax(0,1.4fr)_auto]"
                >
                  <Input
                    size="sm"
                    value={entry.parentKey}
                    onChange={(e) => setDraft((prev) => ({ ...prev, ruleFields: patchList(prev.ruleFields, entry.id, { parentKey: e.target.value }) }))}
                    placeholder="Type"
                    inputMode="numeric"
                    className="font-mono text-[12.5px]"
                    aria-label={`Rule field ${index + 1} rule type`}
                  />
                  <Input
                    size="sm"
                    value={entry.key}
                    onChange={(e) => setDraft((prev) => ({ ...prev, ruleFields: patchList(prev.ruleFields, entry.id, { key: e.target.value }) }))}
                    placeholder="Field ID"
                    inputMode="numeric"
                    className="font-mono text-[12.5px]"
                    aria-label={`Rule field ${index + 1} ID`}
                  />
                  <Input
                    size="sm"
                    value={entry.label}
                    onChange={(e) => setDraft((prev) => ({ ...prev, ruleFields: patchList(prev.ruleFields, entry.id, { label: e.target.value }) }))}
                    placeholder="Label"
                    aria-label={`Rule field ${index + 1} label`}
                  />
                  <Input
                    size="sm"
                    value={entry.hint}
                    onChange={(e) => setDraft((prev) => ({ ...prev, ruleFields: patchList(prev.ruleFields, entry.id, { hint: e.target.value }) }))}
                    placeholder="Hint"
                    aria-label={`Rule field ${index + 1} hint`}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    shape="square"
                    onClick={() => setDraft((prev) => ({ ...prev, ruleFields: removeEntry(prev.ruleFields, entry.id) }))}
                    aria-label={`Remove rule field ${index + 1}`}
                    title="Remove"
                    className="text-kumo-subtle hover:text-kumo-danger"
                  >
                    <Trash size={14} />
                  </Button>
                </div>
              ))}
              {draft.ruleFields.length === 0 && (
                <div className="rounded-lg bg-kumo-base px-4 py-3 text-center ring ring-kumo-line">
                  <Text variant="secondary" size="sm">None yet.</Text>
                </div>
              )}
            </div>

            {/* Event / entity / value type name lists */}
            <NameSection
              title="Event names"
              entries={draft.eventNames}
              onAdd={() => setDraft((prev) => ({ ...prev, eventNames: addEntry(prev.eventNames, { id: uid(), key: '', label: '' }) }))}
              onChange={(id, patch) => setDraft((prev) => ({ ...prev, eventNames: patchList(prev.eventNames, id, patch) }))}
              onRemove={(id) => setDraft((prev) => ({ ...prev, eventNames: removeEntry(prev.eventNames, id) }))}
            />
            <NameSection
              title="Entity names"
              entries={draft.entityNames}
              onAdd={() => setDraft((prev) => ({ ...prev, entityNames: addEntry(prev.entityNames, { id: uid(), key: '', label: '' }) }))}
              onChange={(id, patch) => setDraft((prev) => ({ ...prev, entityNames: patchList(prev.entityNames, id, patch) }))}
              onRemove={(id) => setDraft((prev) => ({ ...prev, entityNames: removeEntry(prev.entityNames, id) }))}
            />
            <NameSection
              title="Value types"
              entries={draft.valueTypes}
              onAdd={() => setDraft((prev) => ({ ...prev, valueTypes: addEntry(prev.valueTypes, { id: uid(), key: '', label: '' }) }))}
              onChange={(id, patch) => setDraft((prev) => ({ ...prev, valueTypes: patchList(prev.valueTypes, id, patch) }))}
              onRemove={(id) => setDraft((prev) => ({ ...prev, valueTypes: removeEntry(prev.valueTypes, id) }))}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-kumo-hairline pt-3">
            {error ? (
              <Text variant="error" size="sm">{error}</Text>
            ) : (
              <Text variant="secondary" size="sm">Changes apply to how rules are rendered after you save.</Text>
            )}
            <Button
              variant="primary"
              size="sm"
              onClick={() => void onSave()}
              loading={save.isPending}
              icon={<FloppyDisk size={14} />}
            >
              Save definitions
            </Button>
          </div>
        </>
      )}
    </LayerCard>
  )
}
