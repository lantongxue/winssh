import { useState, type ReactNode } from 'react'
import { LoaderCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string | ReactNode
  cancelLabel?: string
  confirmLabel?: string
  confirmIcon?: ReactNode
  cancelIcon?: ReactNode
  /** Button variant for the confirm action. 'destructive' for delete actions, 'default' for confirm actions. */
  variant?: 'destructive' | 'default' | 'outline'
  /** If true, shows a spinner on the confirm button while the action is running */
  loading?: boolean
  onConfirm: () => void | Promise<void>
  className?: string
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  cancelLabel,
  confirmLabel,
  confirmIcon,
  cancelIcon,
  variant = 'destructive',
  loading = false,
  onConfirm,
  className
}: ConfirmDialogProps) {
  const { t } = useTranslation()
  const [isLoading, setIsLoading] = useState(false)

  const handleConfirm = async () => {
    setIsLoading(true)
    try {
      await onConfirm()
    } finally {
      setIsLoading(false)
    }
  }

  const spinning = loading || isLoading

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        className={cn(
          'max-w-md rounded-md border border-[var(--workbench-border)] bg-[var(--workbench-editor)] p-0 shadow-2xl',
          className
        )}
      >
        <AlertDialogHeader className="border-b border-[var(--workbench-border)] px-4 py-4">
          <AlertDialogTitle>{title}</AlertDialogTitle>
        </AlertDialogHeader>
        {description && (
          <div className="px-4 py-4">
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </div>
        )}
        <AlertDialogFooter className="border-t border-[var(--workbench-border)] px-4 py-3">
          <AlertDialogCancel asChild>
            <Button variant="ghost" disabled={spinning}>
              {cancelIcon}
              {cancelLabel ?? t('common.actions.cancel')}
            </Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button variant={variant} disabled={spinning} onClick={() => void handleConfirm()}>
              {spinning ? <LoaderCircle className="size-4 animate-spin" /> : confirmIcon}
              {confirmLabel ?? t('common.actions.delete')}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
