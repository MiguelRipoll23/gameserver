import { useState } from 'react'
import { Button, Input, LayerCard, Text, useKumoToastManager } from '@cloudflare/kumo'
import { FloppyDisk, Package } from '@phosphor-icons/react'
import { getClient } from '../api/client'
import { errorText, useApiGet, useApiMutation } from '../hooks/useApi'
import { PageHeader } from '../components/PageHeader'

export function VersionPage() {
  const toast = useKumoToastManager()
  const version = useApiGet(
    ['GET /api/v1/game-version'],
    () => getClient().GET('/api/v1/game-version'),
  )
  const setVersion = useApiMutation(
    ['POST /api/v1/game-version'],
    (input: { minimumVersion: string }) => getClient().POST('/api/v1/game-version', { body: input }),
  )

  const [versionDraft, setVersionDraft] = useState('')
  const [versionError, setVersionError] = useState('')
  const [saving, setSaving] = useState(false)

  const versionKey = version.data ? `${version.data.status}:${JSON.stringify(version.data.body ?? null)}` : ''
  const [lastKey, setLastKey] = useState('')
  if (versionKey !== lastKey && versionKey) {
    setLastKey(versionKey)
    if (version.data?.ok && version.data.body !== null && typeof version.data.body === 'object') {
      setVersionDraft(String((version.data.body as { minimumVersion?: unknown }).minimumVersion ?? ''))
    }
  }

  const submit = async () => {
    const v = versionDraft.trim()
    if (!v) {
      setVersionError('Minimum version is required')
      return
    }
    setSaving(true)
    const r = await setVersion.mutateAsync({ minimumVersion: v })
    setSaving(false)
    if (r.ok) {
      toast.add({ id: 'ver-saved', title: 'Game version updated', variant: 'success' })
      setVersionError('')
      version.refetch()
    } else {
      toast.add({ id: 'ver-err', title: `Save failed (HTTP ${r.status})`, description: errorText(r), variant: 'error' })
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      <PageHeader
        title="Version"
        description="General version information for the game client."
        icon={<Package size={20} weight="fill" />}
      />

      <LayerCard className="flex flex-col gap-3 p-4 sm:p-5">
        <Text variant="secondary" size="sm">Clients older than this version are told to update when they connect.</Text>
        <div className="flex items-end gap-2">
          <Input
            label="Minimum version"
            value={versionDraft}
            onChange={(e) => setVersionDraft(e.target.value)}
            error={versionError}
            placeholder="1.0.0-alpha.1"
            className="flex-1 font-mono text-[13px]"
            onKeyDown={(e) => e.key === 'Enter' && void submit()}
          />
          <Button variant="secondary" onClick={() => void submit()} loading={saving} icon={<FloppyDisk size={14} />}>
            Save
          </Button>
        </div>
      </LayerCard>
    </div>
  )
}
