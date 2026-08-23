export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} ms`
  return `${(ms / 1000).toFixed(2)} s`
}

export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(2)} MB`
}

/** Truncates a path keeping the meaningful tail (last segment) visible. */
export function truncatePath(path: string, max = 36): string {
  const short = path.replace(/^\/api\/v1/, '')
  if (short.length <= max) return short
  const tail = short.split('/').pop() ?? ''
  const head = short.slice(0, max - tail.length - 3)
  return `${head}…/${tail}`
}

/** Returns the display name when present, falling back to the raw identifier. */
export function nameOrId(name: unknown, id: unknown): string {
  if (name !== undefined && name !== null && String(name) !== '') return String(name)
  if (id !== undefined && id !== null) return String(id)
  return ''
}

export function sentenceCase(s: string): string {
  if (!s) return s
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

export function prettyJson(value: unknown): string {
  return JSON.stringify(value, null, 2)
}
