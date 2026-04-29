import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api.js'
import 'monaco-editor/esm/vs/basic-languages/bat/bat.contribution.js'
import 'monaco-editor/esm/vs/basic-languages/cpp/cpp.contribution.js'
import 'monaco-editor/esm/vs/basic-languages/csharp/csharp.contribution.js'
import 'monaco-editor/esm/vs/basic-languages/css/css.contribution.js'
import 'monaco-editor/esm/vs/basic-languages/dockerfile/dockerfile.contribution.js'
import 'monaco-editor/esm/vs/basic-languages/go/go.contribution.js'
import 'monaco-editor/esm/vs/basic-languages/html/html.contribution.js'
import 'monaco-editor/esm/vs/basic-languages/ini/ini.contribution.js'
import 'monaco-editor/esm/vs/basic-languages/java/java.contribution.js'
import 'monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution.js'
import 'monaco-editor/esm/vs/basic-languages/less/less.contribution.js'
import 'monaco-editor/esm/vs/basic-languages/lua/lua.contribution.js'
import 'monaco-editor/esm/vs/basic-languages/markdown/markdown.contribution.js'
import 'monaco-editor/esm/vs/basic-languages/php/php.contribution.js'
import 'monaco-editor/esm/vs/basic-languages/powershell/powershell.contribution.js'
import 'monaco-editor/esm/vs/basic-languages/python/python.contribution.js'
import 'monaco-editor/esm/vs/basic-languages/ruby/ruby.contribution.js'
import 'monaco-editor/esm/vs/basic-languages/rust/rust.contribution.js'
import 'monaco-editor/esm/vs/basic-languages/scss/scss.contribution.js'
import 'monaco-editor/esm/vs/basic-languages/shell/shell.contribution.js'
import 'monaco-editor/esm/vs/basic-languages/sql/sql.contribution.js'
import 'monaco-editor/esm/vs/basic-languages/typescript/typescript.contribution.js'
import 'monaco-editor/esm/vs/basic-languages/xml/xml.contribution.js'
import 'monaco-editor/esm/vs/basic-languages/yaml/yaml.contribution.js'
import 'monaco-editor/min/vs/editor/editor.main.css'
import { LoaderCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { DEFAULT_APP_SETTINGS } from '@shared/constants'
import { isHighContrastTheme, isHighContrastThemeId, type ThemeDefinition } from '@shared/themes'
import { queryKeys } from '@/features/shared/query-keys'
import { settingsClient } from '@/features/settings/api/settings-client'
import { sftpClient } from '@/features/sftp/api/sftp-client'
import { themesClient } from '@/features/themes/api/themes-client'
import { usePrefersDark } from '@/hooks/use-prefers-dark'
import {
  formatTerminalFontFamily,
  resolveTerminalAppearance,
  resolveThemeDefinition
} from '@/lib/theme'
import type { SftpFileEditorDocument } from '@/lib/workbench'
import { getSftpFileEditorFormId } from '@/lib/workbench'
import { actionIcons } from '@/lib/action-icons'
import { getRemoteFileLanguage, getRemoteFileName } from '@/lib/remote-file-language'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useSessionsStore } from '@/store/sessions-store'

type MonacoEnvironmentTarget = typeof globalThis & {
  MonacoEnvironment?: {
    getWorker: (_moduleId?: string, label?: string) => Worker
  }
}

const monacoEnvironmentTarget = globalThis as MonacoEnvironmentTarget

if (typeof Worker !== 'undefined' && !monacoEnvironmentTarget.MonacoEnvironment) {
  monacoEnvironmentTarget.MonacoEnvironment = {
    getWorker: () =>
      new Worker(new URL('monaco-editor/esm/vs/editor/editor.worker.js', import.meta.url), {
        type: 'module'
      })
  }
}

if (!monaco.languages.getLanguages().some((language) => language.id === 'json')) {
  monaco.languages.register({
    id: 'json',
    extensions: ['.json', '.jsonc'],
    aliases: ['JSON', 'json'],
    mimetypes: ['application/json']
  })
}

monaco.languages.setMonarchTokensProvider('json', {
  brackets: [
    { close: '}', open: '{', token: 'delimiter.bracket' },
    { close: ']', open: '[', token: 'delimiter.array' }
  ],
  tokenizer: {
    root: [
      [/[{}[\]]/, '@brackets'],
      [/[,:]/, 'delimiter'],
      [/"(?:[^"\\]|\\.)*"(?=\s*:)/, 'string.key'],
      [/"(?:[^"\\]|\\.)*"/, 'string'],
      [/-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/, 'number'],
      [/\b(?:true|false|null)\b/, 'keyword'],
      [/\/\/.*$/, 'comment'],
      [/\/\*/, 'comment', '@comment']
    ],
    comment: [
      [/[^/*]+/, 'comment'],
      [/\*\//, 'comment', '@pop'],
      [/[/*]/, 'comment']
    ]
  }
})

function clampChannel(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)))
}

function toHexChannel(value: number) {
  return clampChannel(value).toString(16).padStart(2, '0')
}

function normalizeMonacoColor(value: string | undefined, fallback: string) {
  const trimmed = value?.trim()
  if (!trimmed) {
    return fallback
  }

  if (/^#[0-9a-f]{3,8}$/i.test(trimmed)) {
    return trimmed
  }

  const rgbaMatch = trimmed.match(
    /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i
  )
  if (!rgbaMatch) {
    return fallback
  }

  const [, red, green, blue, alpha] = rgbaMatch
  const alphaValue = alpha === undefined ? 1 : Math.max(0, Math.min(1, Number(alpha)))

  return `#${toHexChannel(Number(red))}${toHexChannel(Number(green))}${toHexChannel(
    Number(blue)
  )}${toHexChannel(alphaValue * 255)}`
}

function getFallbackMonacoThemeId() {
  const uiTheme = document.documentElement.dataset.themeUi
  if (
    uiTheme === 'hc-light' ||
    uiTheme === 'hc-black' ||
    isHighContrastThemeId(document.documentElement.dataset.theme ?? '')
  ) {
    return document.documentElement.dataset.themeAppearance === 'dark' ? 'hc-black' : 'hc-light'
  }

  return document.documentElement.dataset.themeAppearance === 'dark' ? 'vs-dark' : 'vs'
}

function getMonacoThemeId(theme: ThemeDefinition) {
  return `winssh-${theme.id.replace(/[^a-z0-9_-]/gi, '-')}`
}

function getMonacoBaseTheme(theme: ThemeDefinition) {
  if (isHighContrastTheme(theme)) {
    return theme.appearance === 'dark' ? 'hc-black' : 'hc-light'
  }

  return theme.appearance === 'dark' ? 'vs-dark' : 'vs'
}

function defineMonacoTheme(theme: ThemeDefinition) {
  const colors = theme.colors
  const editorBackground = normalizeMonacoColor(colors['workbench-editor'], '#ffffff')
  const editorForeground = normalizeMonacoColor(colors.foreground, '#1f2328')
  const mutedForeground = normalizeMonacoColor(colors['workbench-muted'], '#6e7781')
  const active = normalizeMonacoColor(colors['workbench-active'], '#0969da')
  const border = normalizeMonacoColor(colors['workbench-border'], '#d7dce2')
  const input = normalizeMonacoColor(colors['workbench-input'], editorBackground)
  const hover = normalizeMonacoColor(colors['workbench-hover'], border)
  const cursor = normalizeMonacoColor(theme.terminal.cursor, active)
  const selection = normalizeMonacoColor(theme.terminal.selectionBackground, `${active}66`)
  const themeId = getMonacoThemeId(theme)

  monaco.editor.defineTheme(themeId, {
    base: getMonacoBaseTheme(theme),
    inherit: true,
    rules: [],
    colors: {
      'editor.background': editorBackground,
      'editor.foreground': editorForeground,
      'editor.lineHighlightBackground': input,
      'editor.selectionBackground': selection,
      'editorCursor.foreground': cursor,
      'editorGutter.background': editorBackground,
      'editorIndentGuide.activeBackground1': active,
      'editorIndentGuide.background1': border,
      'editorLineNumber.activeForeground': editorForeground,
      'editorLineNumber.foreground': mutedForeground,
      'editorWidget.background': input,
      'editorWidget.border': border,
      focusBorder: active,
      'scrollbarSlider.activeBackground': active,
      'scrollbarSlider.background': hover,
      'scrollbarSlider.hoverBackground': hover
    }
  })

  return themeId
}

interface WorkbenchSftpFileMonacoEditorProps {
  active?: boolean
  document: SftpFileEditorDocument
}

export function WorkbenchSftpFileMonacoEditor({
  active = true,
  document
}: WorkbenchSftpFileMonacoEditorProps) {
  const { t } = useTranslation()
  const prefersDark = usePrefersDark()
  const queryClient = useQueryClient()
  const containerRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const modelRef = useRef<monaco.editor.ITextModel | null>(null)
  const [editorContent, setEditorContent] = useState('')
  const [savedContent, setSavedContent] = useState('')
  const settingsQuery = useQuery({
    queryKey: queryKeys.settings,
    queryFn: () => settingsClient.get(),
    initialData: DEFAULT_APP_SETTINGS
  })
  const themesQuery = useQuery({
    queryKey: queryKeys.themes,
    queryFn: () => themesClient.list()
  })
  const fileQueryKey = queryKeys.sftpFile(document.sessionId, document.remotePath)
  const fileQuery = useQuery({
    queryKey: fileQueryKey,
    queryFn: () => sftpClient.readFile(document.sessionId, document.remotePath),
    refetchOnWindowFocus: false
  })
  const saveMutation = useMutation({
    mutationFn: (contents: string) =>
      sftpClient.writeFile(document.sessionId, document.remotePath, contents)
  })
  const resolvedTheme = resolveThemeDefinition(
    settingsQuery.data.theme,
    themesQuery.data ?? [],
    prefersDark
  )
  const terminalAppearance = resolvedTheme
    ? resolveTerminalAppearance(settingsQuery.data, resolvedTheme)
    : {
        fontFamily: settingsQuery.data.terminalFontFamily,
        fontSize: settingsQuery.data.terminalFontSize
      }
  const language = useMemo(() => getRemoteFileLanguage(document.remotePath), [document.remotePath])
  const session = useSessionsStore(
    (state) => state.tabs.find((tab) => tab.sessionId === document.sessionId) ?? null
  )
  const SaveIcon = actionIcons.save
  const RefreshIcon = actionIcons.refresh
  const isDirty = editorContent !== savedContent

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    const modelUri = monaco.Uri.from({
      authority: document.sessionId,
      path: document.remotePath,
      scheme: 'winssh-sftp'
    })
    monaco.editor.getModel(modelUri)?.dispose()

    const model = monaco.editor.createModel('', language, modelUri)
    const editor = monaco.editor.create(container, {
      ariaLabel: t('workbench.documents.remoteFile'),
      automaticLayout: false,
      fontFamily: formatTerminalFontFamily(terminalAppearance.fontFamily),
      fontSize: terminalAppearance.fontSize,
      language,
      minimap: { enabled: false },
      model,
      scrollBeyondLastLine: false,
      theme: resolvedTheme ? defineMonacoTheme(resolvedTheme) : getFallbackMonacoThemeId()
    })
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      const form = window.document.getElementById(getSftpFileEditorFormId(document.id))
      if (form instanceof HTMLFormElement) {
        form.requestSubmit()
      }
    })
    const contentDisposable = editor.onDidChangeModelContent(() => {
      setEditorContent(editor.getValue())
    })
    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => editor.layout()) : null

    resizeObserver?.observe(container)
    editorRef.current = editor
    modelRef.current = model

    return () => {
      resizeObserver?.disconnect()
      contentDisposable.dispose()
      editor.dispose()
      model.dispose()
      editorRef.current = null
      modelRef.current = null
    }
  }, [document.id])

  useEffect(() => {
    if (fileQuery.data === undefined || !modelRef.current) {
      return
    }

    modelRef.current.setValue(fileQuery.data)
    setEditorContent(fileQuery.data)
    setSavedContent(fileQuery.data)
  }, [document.id, fileQuery.data])

  useEffect(() => {
    if (!modelRef.current) {
      return
    }

    monaco.editor.setModelLanguage(modelRef.current, language)
  }, [language])

  useEffect(() => {
    if (!resolvedTheme) {
      monaco.editor.setTheme(getFallbackMonacoThemeId())
      return
    }

    monaco.editor.setTheme(defineMonacoTheme(resolvedTheme))
  }, [resolvedTheme])

  useEffect(() => {
    editorRef.current?.updateOptions({
      fontFamily: formatTerminalFontFamily(terminalAppearance.fontFamily),
      fontSize: terminalAppearance.fontSize
    })
  }, [terminalAppearance.fontFamily, terminalAppearance.fontSize])

  useEffect(() => {
    if (!active) {
      return
    }

    const frameId = window.requestAnimationFrame(() => {
      editorRef.current?.layout()
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [active])

  const handleSave = async () => {
    if (fileQuery.isLoading || saveMutation.isPending) {
      return
    }

    const nextContent = editorRef.current?.getValue() ?? editorContent

    try {
      await saveMutation.mutateAsync(nextContent)
      setSavedContent(nextContent)
      setEditorContent(nextContent)
      queryClient.setQueryData(fileQueryKey, nextContent)
      await queryClient.invalidateQueries({ queryKey: ['sftp', document.sessionId] })
      toast.success(t('workbench.sftpFileEditor.toasts.saved'))
    } catch {
      toast.error(t('workbench.sftpFileEditor.toasts.saveFailed'))
    }
  }

  return (
    <form
      id={getSftpFileEditorFormId(document.id)}
      className="liquid-glass-page flex h-full min-h-0 flex-col bg-[var(--workbench-editor)]"
      onSubmit={(event) => {
        event.preventDefault()
        void handleSave()
      }}
    >
      <div className="liquid-glass-toolbar flex min-h-[56px] shrink-0 items-center gap-3 border-b border-[var(--workbench-border)] px-3 py-2">
        <div className="grid min-w-[220px] shrink-0 gap-1 rounded-md border border-[var(--workbench-border)] bg-[var(--workbench-input)] px-2.5 py-1.5">
          <div className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="shrink-0">
              {t('workbench.sessionEditor.serverName')}
            </span>
            <span className="truncate font-mono">
              {session?.serverName ?? document.sessionId}
            </span>
          </div>
          <div className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="shrink-0">{t('workbench.sessionEditor.serverAddress')}</span>
            <span className="truncate font-mono">
              {session ? `${session.host}` : document.sessionId}
            </span>
          </div>
        </div>
        <div className="min-w-0 flex-1 rounded-md border border-transparent px-1 py-1.5">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="shrink-0 text-[11px] text-muted-foreground">
              {t('workbench.sftpFileEditor.labels.fileName')}
            </span>
            <span className="truncate text-sm font-medium text-foreground">
              {getRemoteFileName(document.remotePath)}
            </span>
          </div>
          <div className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="shrink-0">{t('workbench.sftpFileEditor.labels.path')}</span>
            <span className="truncate font-mono">{document.remotePath}</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-sm border border-[var(--workbench-border)] bg-[var(--workbench-input)] px-2 py-1 text-[11px] text-muted-foreground">
            {language}
          </span>
          <span className="rounded-sm border border-[var(--workbench-border)] bg-[var(--workbench-input)] px-2 py-1 text-[11px] text-muted-foreground">
            {isDirty
              ? t('workbench.sftpFileEditor.labels.dirty')
              : t('workbench.sftpFileEditor.labels.saved')}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={fileQuery.isFetching}
            onClick={() => void fileQuery.refetch()}
          >
            <RefreshIcon className="size-4" />
            {t('common.actions.refresh')}
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={!isDirty || fileQuery.isLoading || saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <SaveIcon className="size-4" />
            )}
            {t('common.actions.save')}
          </Button>
        </div>
      </div>

      {fileQuery.isError ? (
        <div className="border-b border-[var(--workbench-border)] bg-[var(--workbench-input)] px-4 py-3">
          <div className="text-sm font-medium text-foreground">
            {t('workbench.sftpFileEditor.empty.title')}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {fileQuery.error instanceof Error
              ? fileQuery.error.message
              : t('workbench.sftpFileEditor.empty.description')}
          </div>
        </div>
      ) : null}

      <div className="min-h-0 flex-1">
        <div className="relative h-full overflow-hidden bg-[var(--workbench-editor)]">
          {fileQuery.isLoading ? (
            <div className="absolute inset-0 z-10 bg-[var(--workbench-editor)] p-3">
              <Skeleton className="h-full rounded-none" />
            </div>
          ) : null}
          <div ref={containerRef} className="h-full w-full" />
        </div>
      </div>
    </form>
  )
}
