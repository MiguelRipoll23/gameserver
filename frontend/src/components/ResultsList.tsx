import { Button, Loader, Text } from '@cloudflare/kumo'
import { CaretLeft, CaretRight, MagnifyingGlass } from '@phosphor-icons/react'
import type { ReactNode } from 'react'
import type { RunResult } from '../api/client'
import { errorText } from '../hooks/useApi'
import { RecordCard } from './RecordCard'

interface ResultsListProps {
  result?: RunResult
  isLoading: boolean
  isFetching: boolean
  hasMore: boolean
  onNext?: () => void
  onPrev?: () => void
  canPrev: boolean
  emptyLabel?: string
  emptyAction?: ReactNode
  /** Render item as a card instead of RecordCard (for custom rows) */
  renderItem?: (item: unknown, index: number) => ReactNode
  /** Render the full list body (e.g. a `<Table>`) instead of the per-item loop */
  renderList?: (items: unknown[]) => ReactNode
}

export function ResultsList({
  result,
  isLoading,
  isFetching,
  hasMore,
  onNext,
  onPrev,
  canPrev,
  emptyLabel = 'Nothing here yet.',
  emptyAction,
  renderItem,
  renderList,
}: ResultsListProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center gap-3 py-14">
        <Loader size="lg" />
        <Text variant="secondary" size="sm">Loading…</Text>
      </div>
    )
  }

  if (!result || result.status === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg bg-kumo-base px-6 py-12 text-center ring ring-kumo-line">
        <Text variant="error" size="sm">{result ? `Request failed: ${errorText(result)}` : 'No data yet.'}</Text>
        {emptyAction}
      </div>
    )
  }

  if (result.status >= 400) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg bg-kumo-base px-6 py-12 text-center ring ring-kumo-line">
        <Text variant="error" size="sm">{errorText(result)}</Text>
        <Text variant="secondary" size="sm">HTTP {result.status}</Text>
        {emptyAction}
      </div>
    )
  }

  const body = result.body as { results?: unknown[]; hasMore?: boolean } | null
  const items = Array.isArray(body?.results) ? body.results : []

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg bg-kumo-base px-6 py-12 text-center ring ring-kumo-line">
        <MagnifyingGlass size={22} className="text-kumo-inactive" />
        <Text variant="secondary" size="sm">{emptyLabel}</Text>
        {emptyAction}
      </div>
    )
  }

  const effectiveHasMore = hasMore ?? Boolean(body?.hasMore)

  return (
    <div className="flex flex-col gap-2.5">
      {isFetching && !isLoading && (
        <div className="flex items-center justify-center py-2">
          <Loader size="sm" />
        </div>
      )}
      {renderList ? (
        renderList(items)
      ) : (
        items.map((item, i) =>
          renderItem ? (
            renderItem(item, i)
          ) : item !== null && typeof item === 'object' ? (
            <RecordCard key={i} data={item as Record<string, unknown>} index={i} />
          ) : (
            <LayerCardPlaceholder key={i} value={String(item)} />
          ),
        )
      )}
      {(onNext || onPrev) && (
        <div className="flex items-center justify-between border-t border-kumo-hairline pt-3">
          <Text variant="secondary" size="sm">
            {items.length} shown
          </Text>
          <div className="flex items-center gap-1.5">
            <Button variant="secondary" size="sm" onClick={onPrev} disabled={!canPrev} icon={<CaretLeft size={14} />}>
              Previous
            </Button>
            <Button variant="secondary" size="sm" onClick={onNext} disabled={!effectiveHasMore}>
              Next <CaretRight size={14} className="inline" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function LayerCardPlaceholder({ value }: { value: string }) {
  return (
    <div className="rounded-lg bg-kumo-base px-4 py-3 ring ring-kumo-line">
      <span className="break-all font-mono text-[12.5px] text-kumo-default">{value}</span>
    </div>
  )
}
