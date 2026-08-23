import { LayerCard, Text } from '@cloudflare/kumo'
import { ConfigForm } from '../components/ConfigForm'

export function WelcomePage() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-kumo-recessed px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <Text variant="heading2" as="h1">
            Server console
          </Text>
        </div>

        <LayerCard className="p-5 sm:p-6">
          <ConfigForm />
        </LayerCard>
      </div>
    </div>
  )
}
