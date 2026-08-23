import { Text } from '@cloudflare/kumo'
import type { ReactNode } from 'react'

export function PageHeader({
  title,
  description,
  actions,
  icon,
}: {
  title: string
  description?: ReactNode
  actions?: ReactNode
  icon?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="mb-1 flex items-center gap-2">
          {icon && <span className="text-kumo-brand">{icon}</span>}
          <Text variant="heading2" as="h1">
            {title}
          </Text>
        </div>
        {description && (
          <div className="max-w-2xl">
            <Text variant="secondary" size="sm">
              {description}
            </Text>
          </div>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
