import { Button, Dialog } from '@cloudflare/kumo'
import { Warning } from '@phosphor-icons/react'
import type { ReactNode } from 'react'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: ReactNode
  confirmLabel?: string
  confirmVariant?: 'destructive' | 'secondary-destructive' | 'primary'
  onConfirm: () => void
  loading?: boolean
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Delete',
  confirmVariant = 'destructive',
  onConfirm,
  loading,
}: ConfirmDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog className="p-6" size="sm">
        <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-kumo-danger-tint text-kumo-danger">
          <Warning size={20} weight="fill" />
        </div>
        <Dialog.Title className="text-lg font-semibold text-kumo-strong">{title}</Dialog.Title>
        {description && <Dialog.Description className="mt-1.5 text-sm text-kumo-subtle">{description}</Dialog.Description>}
        <div className="mt-5 flex justify-end gap-2">
          <Dialog.Close render={(p) => <Button {...p} variant="secondary">Cancel</Button>} />
          <Button variant={confirmVariant} loading={loading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </Dialog>
    </Dialog.Root>
  )
}
