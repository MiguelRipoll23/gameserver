import { LayerCard } from '@cloudflare/kumo'
import { Gear } from '@phosphor-icons/react'
import { PageHeader } from '../components/PageHeader'
import { ConfigForm } from '../components/ConfigForm'
import { MagicLinkCard } from '../components/MagicLinkCard'

export function SettingsPage() {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader
        title="Settings"
        description="Point the console at your game server and sign in with a passkey to manage it."
        icon={<Gear size={20} weight="fill" />}
      />

      <LayerCard className="p-4 sm:p-5">
        <ConfigForm />
      </LayerCard>

      <LayerCard className="mt-4 p-4 sm:p-5">
        <MagicLinkCard />
      </LayerCard>
    </div>
  )
}
