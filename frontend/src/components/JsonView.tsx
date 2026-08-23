import { useMemo, useState } from 'react'
import { Button, Text } from '@cloudflare/kumo'
import { Check, Copy } from '@phosphor-icons/react'
import { formatBytes } from '../lib/format'

/* Lightweight JSON syntax highlighter producing React spans. */
function renderTokens(json: string, key: number) {
  const tokens: { text: string; cls: string }[] = []
  const re = /("(?:[^"\\]|\\.)*")(\s*:)?|\b(true|false)\b|\bnull\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(json)) !== null) {
    if (m.index > last) tokens.push({ text: json.slice(last, m.index), cls: '' })
    if (m[1] !== undefined) {
      tokens.push({ text: m[1], cls: m[2] ? 'json-key' : 'json-string' })
      if (m[2]) tokens.push({ text: m[2], cls: '' })
    } else if (m[3] !== undefined) {
      tokens.push({ text: m[3], cls: 'json-boolean' })
    } else if (m[4] !== undefined) {
      tokens.push({ text: m[4], cls: 'json-null' })
    } else {
      tokens.push({ text: m[0], cls: 'json-number' })
    }
    last = m.index + m[0].length
  }
  if (last < json.length) tokens.push({ text: json.slice(last), cls: '' })
  return tokens.map((t, i) =>
    t.cls ? (
      <span key={`${key}-${i}`} className={t.cls}>
        {t.text}
      </span>
    ) : (
      <span key={`${key}-${i}`}>{t.text}</span>
    ),
  )
}

interface JsonViewProps {
  value: unknown
  label?: string
  maxHeight?: string
}

export function JsonView({ value, label, maxHeight = '480px' }: JsonViewProps) {
  const [copied, setCopied] = useState(false)

  const json = useMemo(() => {
    if (typeof value === 'string') return value
    return JSON.stringify(value, null, 2)
  }, [value])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard unavailable
    }
  }

  const raw = value as unknown
  const isJsonValue = raw !== null && typeof raw === 'object'
  const size = new Blob([json]).size

  return (
    <div className="overflow-hidden rounded-lg bg-kumo-base ring ring-kumo-line">
      <div className="flex items-center justify-between gap-2 border-b border-kumo-hairline px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <div className="min-w-0 truncate">
            <Text variant="secondary" size="sm">{label ?? (isJsonValue ? 'Response body' : 'Raw body')}</Text>
          </div>
          {value === null && <Text variant="secondary" size="sm">(empty)</Text>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Text variant="secondary" size="sm">{formatBytes(size)}</Text>
          <Button variant="ghost" size="sm" shape="square" onClick={copy} icon={copied ? <Check size={14} /> : <Copy size={14} />} aria-label="Copy to clipboard" title="Copy to clipboard" />
        </div>
      </div>
      <div className="json-viewer p-3" style={{ maxHeight }} role="region" aria-label={label ?? 'Response body'}>
        {renderTokens(json, 0)}
      </div>
    </div>
  )
}
