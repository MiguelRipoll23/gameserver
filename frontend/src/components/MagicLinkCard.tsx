import { useState } from 'react'
import { Button, Text, useKumoToastManager } from '@cloudflare/kumo'
import { Check, Copy, Link } from '@phosphor-icons/react'
import { useConfig } from '../lib/config'
import { buildMagicLink } from '../lib/magic-link'

/**
 * Generates a shareable "magic link" that signs the opener in with the current
 * session. Shown only when signed in, since a link without a token is useless.
 */
export function MagicLinkCard() {
  const { config } = useConfig()
  const toast = useKumoToastManager()
  const [copied, setCopied] = useState(false)

  if (!config.token) return null

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(buildMagicLink(config))
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
      toast.add({ id: 'magic-copy', title: 'Magic link copied', variant: 'success' })
    } catch {
      toast.add({
        id: 'magic-copy-err',
        title: 'Could not copy link',
        description: 'Clipboard access was denied by the browser.',
        variant: 'error',
      })
    }
  }

  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-2">
        <Link size={16} className="text-kumo-brand" />
        <span className="text-sm font-semibold text-kumo-strong">Magic link</span>
      </div>
      <Text variant="secondary" size="sm">
        Share a link that signs anyone into this console with your access token — no passkey registration needed. It
        carries only your short-lived access token, so it stops working when the token expires and can't rotate your
        session.
      </Text>
      <div>
        <Button variant="secondary" onClick={() => void copy()} icon={copied ? <Check size={15} /> : <Copy size={15} />}>
          {copied ? 'Copied' : 'Copy magic link'}
        </Button>
      </div>
    </div>
  )
}
