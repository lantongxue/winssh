import { lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import i18n from '@/i18n'
import type { SftpFileEditorDocument } from '@/lib/workbench'
import { Skeleton } from '@/components/ui/skeleton'

async function loadMonacoNls() {
  const language = i18n.resolvedLanguage ?? i18n.language

  if (language.toLowerCase().startsWith('zh')) {
    await import('monaco-editor/esm/nls.messages.zh-cn.js')
    return
  }

  await import('monaco-editor/esm/nls.messages.js')
}

const MonacoSftpFileEditor = lazy(async () => {
  await loadMonacoNls()
  return import('@/components/workbench/workbench-sftp-file-monaco-editor').then((module) => ({
    default: module.WorkbenchSftpFileMonacoEditor
  }))
})

interface WorkbenchSftpFileEditorProps {
  active?: boolean
  document: SftpFileEditorDocument
}

export function WorkbenchSftpFileEditor({ active = true, document }: WorkbenchSftpFileEditorProps) {
  const { t } = useTranslation()

  return (
    <Suspense
      fallback={
        <div className="liquid-glass-page flex h-full min-h-0 flex-col bg-[var(--workbench-editor)]">
          <div className="liquid-glass-toolbar flex h-12 shrink-0 items-center border-b border-[var(--workbench-border)] px-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-foreground">
                {document.remotePath}
              </div>
              <div className="truncate text-[11px] text-muted-foreground">
                {t('workbench.sftpFileEditor.loading')}
              </div>
            </div>
          </div>
          <div className="min-h-0 flex-1 p-3">
            <Skeleton className="h-full rounded-none" />
          </div>
        </div>
      }
    >
      <MonacoSftpFileEditor active={active} document={document} />
    </Suspense>
  )
}
