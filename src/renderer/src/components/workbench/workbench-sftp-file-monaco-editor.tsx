import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent
} from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api.js'
import 'monaco-editor/esm/vs/editor/editor.all.js'
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
import { formatFileSize } from '@/i18n/format'
import { Download, LoaderCircle, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import type { TransferProgressEvent } from '@shared/types'
import { DEFAULT_APP_SETTINGS } from '@shared/constants'
import { isHighContrastTheme, isHighContrastThemeId, type ThemeDefinition } from '@shared/themes'
import { queryKeys } from '@/features/shared/query-keys'
import { settingsClient } from '@/features/settings/api/settings-client'
import { sftpClient } from '@/features/sftp/api/sftp-client'
import { themesClient } from '@/features/themes/api/themes-client'
import { usePrefersDark } from '@/hooks/use-prefers-dark'
import {
  getKeyboardFontZoomAction,
  getWheelFontZoomDelta,
  resolveTemporaryFontSize,
  type FontZoomKeyboardAction
} from '@/lib/font-zoom'
import { getTerminalFontStack, loadTerminalFontStack } from '@/lib/integrated-font-loader'
import { resolveTerminalAppearance, resolveThemeDefinition } from '@/lib/theme'
import type { SftpFileEditorDocument } from '@/lib/workbench'
import { getSftpFileEditorFormId } from '@/lib/workbench'
import { actionIcons } from '@/lib/action-icons'
import { getRemoteFileLanguage, getRemoteFileName } from '@/lib/remote-file-language'
import { Button } from '@/components/ui/button'
import { useSessionsStore } from '@/store/sessions-store'
import { useWorkbenchStore } from '@/store/workbench-store'

const SFTP_FILE_SAVE_CHUNK_SIZE = 64 * 1024

function getSftpFileSaveChunkEnd(contents: string, offset: number): number {
  let end = Math.min(offset + SFTP_FILE_SAVE_CHUNK_SIZE, contents.length)
  if (end < contents.length && end > offset) {
    const lastCodeUnit = contents.charCodeAt(end - 1)
    if (lastCodeUnit >= 0xd800 && lastCodeUnit <= 0xdbff) {
      end -= 1
    }
  }

  return end
}

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
  const cursor = normalizeMonacoColor(theme.terminal.cursor, active)
  const selection = normalizeMonacoColor(theme.terminal.selectionBackground, `${active}66`)
  const themeId = getMonacoThemeId(theme)

  // Derive scrollbar slider colors with proper opacity to guarantee visibility
  const scrollbarBase = mutedForeground.slice(0, 7)
  const scrollbarSliderBg = `${scrollbarBase}44` // ~27% opacity
  const scrollbarSliderHoverBg = `${scrollbarBase}77` // ~47% opacity
  const scrollbarSliderActiveBg = `${scrollbarBase}aa` // ~66% opacity

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
      'scrollbarSlider.activeBackground': scrollbarSliderActiveBg,
      'scrollbarSlider.background': scrollbarSliderBg,
      'scrollbarSlider.hoverBackground': scrollbarSliderHoverBg
    }
  })

  return themeId
}

interface WorkbenchSftpFileMonacoEditorProps {
  active?: boolean
  document: SftpFileEditorDocument
}

type FileLoadState = 'idle' | 'loading' | 'ready' | 'error'

function appendModelText(model: monaco.editor.ITextModel, text: string) {
  if (!text) {
    return
  }

  const lineNumber = model.getLineCount()
  const column = model.getLineMaxColumn(lineNumber)
  model.applyEdits([
    {
      range: new monaco.Range(lineNumber, column, lineNumber, column),
      text,
      forceMoveMarkers: true
    }
  ])
}

export function WorkbenchSftpFileMonacoEditor({
  active = true,
  document
}: WorkbenchSftpFileMonacoEditorProps) {
  const { t } = useTranslation()
  const prefersDark = usePrefersDark()
  const queryClient = useQueryClient()
  const editorSurfaceRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const modelRef = useRef<monaco.editor.ITextModel | null>(null)
  const activeReadStreamIdRef = useRef<string | null>(null)
  const isApplyingRemoteContentRef = useRef(false)
  const loadedChunksRef = useRef<string[]>([])
  const readRequestIdRef = useRef(0)
  const [editorContent, setEditorContent] = useState('')
  const [savedContent, setSavedContent] = useState('')
  const [fileEncoding, setFileEncoding] = useState('utf8')
  const [loadState, setLoadState] = useState<FileLoadState>('idle')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [fontZoomOffset, setFontZoomOffset] = useState(0)
  const settingsQuery = useQuery({
    queryKey: queryKeys.settings,
    queryFn: () => settingsClient.get(),
    initialData: DEFAULT_APP_SETTINGS
  })
  const themesQuery = useQuery({
    queryKey: queryKeys.themes,
    queryFn: () => themesClient.list()
  })
  const saveMutation = useMutation({
    mutationFn: async ({ contents, encoding }: { contents: string; encoding: string }) => {
      const stream = await sftpClient.openFileWriteStream(
        document.sessionId,
        document.remotePath,
        encoding
      )

      try {
        for (let offset = 0; offset < contents.length;) {
          const end = getSftpFileSaveChunkEnd(contents, offset)
          await sftpClient.writeFileChunk(stream.streamId, contents.slice(offset, end))
          offset = end
        }

        await sftpClient.closeFileWriteStream(stream.streamId)
      } catch (error) {
        sftpClient.cancelFileStream(stream.streamId)
        throw error
      }
    }
  })
  const closeDocument = useWorkbenchStore((state) => state.closeDocument)
  const resolvedTheme = resolveThemeDefinition(
    settingsQuery.data.theme,
    themesQuery.data ?? [],
    prefersDark
  )
  const terminalAppearance = resolvedTheme
    ? resolveTerminalAppearance(settingsQuery.data, resolvedTheme)
    : {
        fontId: settingsQuery.data.terminalFontId,
        fontSize: settingsQuery.data.terminalFontSize
      }
  const temporaryFontSize = resolveTemporaryFontSize(terminalAppearance.fontSize, fontZoomOffset)
  const editorFontId = settingsQuery.data.editorFontId ?? terminalAppearance.fontId
  const language = useMemo(() => getRemoteFileLanguage(document.remotePath), [document.remotePath])
  const session = useSessionsStore(
    (state) => state.tabs.find((tab) => tab.sessionId === document.sessionId) ?? null
  )
  const SaveIcon = actionIcons.save
  const RefreshIcon = actionIcons.refresh
  const isDirty = editorContent !== savedContent
  const [downloadProgress, setDownloadProgress] = useState<TransferProgressEvent | null>(null)

  const cancelReadStream = useCallback(() => {
    readRequestIdRef.current += 1
    loadedChunksRef.current = []
    const streamId = activeReadStreamIdRef.current
    if (streamId) {
      sftpClient.cancelFileStream(streamId)
      activeReadStreamIdRef.current = null
    }
  }, [])

  const startReadStream = useCallback(async () => {
    const model = modelRef.current
    if (!model) {
      return
    }

    cancelReadStream()

    const requestId = readRequestIdRef.current + 1
    readRequestIdRef.current = requestId
    activeReadStreamIdRef.current = null
    loadedChunksRef.current = []
    setLoadState('loading')
    setLoadError(null)
    setDownloadProgress(null)
    setEditorContent('')
    setSavedContent('')
    isApplyingRemoteContentRef.current = true
    try {
      model.setValue('')
    } finally {
      isApplyingRemoteContentRef.current = false
    }

    try {
      const stream = await sftpClient.openFileReadStream(document.sessionId, document.remotePath)

      if (readRequestIdRef.current !== requestId) {
        sftpClient.cancelFileStream(stream.streamId)
        return
      }

      activeReadStreamIdRef.current = stream.streamId
      setFileEncoding(stream.encoding)
      sftpClient.startFileReadStream(stream.streamId)
    } catch (error) {
      if (readRequestIdRef.current !== requestId) {
        return
      }

      activeReadStreamIdRef.current = null
      loadedChunksRef.current = []
      setLoadState('error')
      setLoadError(
        error instanceof Error ? error.message : t('workbench.sftpFileEditor.empty.description')
      )
    }
  }, [document.remotePath, document.sessionId, t])

  const isEditorTransfer = useCallback(
    (event: TransferProgressEvent) =>
      event.sessionId === document.sessionId &&
      event.direction === 'download' &&
      event.localPath === '__editor__' &&
      event.remotePath === document.remotePath,
    [document.sessionId, document.remotePath]
  )

  useEffect(() => {
    return sftpClient.onTransferProgress((event) => {
      if (!isEditorTransfer(event)) {
        return
      }

      if (event.status === 'completed') {
        setDownloadProgress(null)
        return
      }

      setDownloadProgress(event)
    })
  }, [isEditorTransfer])

  useEffect(() => {
    const unsubscribeChunk = sftpClient.onFileChunk((event) => {
      if (
        event.streamId !== activeReadStreamIdRef.current ||
        event.sessionId !== document.sessionId ||
        event.remotePath !== document.remotePath
      ) {
        return
      }

      loadedChunksRef.current.push(event.chunk)
      if (modelRef.current) {
        isApplyingRemoteContentRef.current = true
        try {
          appendModelText(modelRef.current, event.chunk)
        } finally {
          isApplyingRemoteContentRef.current = false
        }
      }
    })

    const unsubscribeState = sftpClient.onFileStreamState((event) => {
      if (
        event.streamId !== activeReadStreamIdRef.current ||
        event.sessionId !== document.sessionId ||
        event.remotePath !== document.remotePath ||
        event.direction !== 'download'
      ) {
        return
      }

      if (event.encoding) {
        setFileEncoding(event.encoding)
      }

      if (event.status === 'running') {
        setDownloadProgress({
          fileName: getRemoteFileName(event.remotePath),
          localPath: '__editor__',
          remotePath: event.remotePath,
          sessionId: event.sessionId,
          direction: 'download',
          status: 'running',
          total: event.total,
          transferred: event.transferred,
          correlationId: event.correlationId,
          source: event.source,
          timestamp: event.timestamp
        })
        return
      }

      activeReadStreamIdRef.current = null
      setDownloadProgress(null)

      if (event.status === 'completed') {
        const loadedContent = loadedChunksRef.current.join('')
        loadedChunksRef.current = []
        modelRef.current?.detectIndentation?.(true, 4)
        setEditorContent(loadedContent)
        setSavedContent(loadedContent)
        setLoadState('ready')
        setLoadError(null)
        return
      }

      loadedChunksRef.current = []
      setLoadState('error')
      setLoadError(event.error ?? t('workbench.sftpFileEditor.empty.description'))
    })

    return () => {
      unsubscribeChunk()
      unsubscribeState()
      cancelReadStream()
    }
  }, [cancelReadStream, document.remotePath, document.sessionId, t])

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
      autoIndent: 'advanced',
      automaticLayout: false,
      fontFamily: getTerminalFontStack(editorFontId),
      fontSize: temporaryFontSize,
      language,
      minimap: { enabled: false },
      model,
      scrollBeyondLastLine: false,
      theme: resolvedTheme ? defineMonacoTheme(resolvedTheme) : getFallbackMonacoThemeId(),
      guides: {
        indentation: true,
        bracketPairs: true
      },
      renderLineHighlight: 'all',
      renderWhitespace: 'selection',
      fontLigatures: true,
      scrollbar: {
        vertical: 'auto',
        horizontal: 'auto',
        verticalScrollbarSize: 10,
        horizontalScrollbarSize: 10,
        useShadows: false
      }
    })
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      const form = window.document.getElementById(getSftpFileEditorFormId(document.id))
      if (form instanceof HTMLFormElement) {
        form.requestSubmit()
      }
    })
    const contentDisposable = editor.onDidChangeModelContent(() => {
      if (isApplyingRemoteContentRef.current) {
        return
      }

      setEditorContent(editor.getValue())
    })
    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => editor.layout()) : null

    resizeObserver?.observe(container)
    editorRef.current = editor
    modelRef.current = model
    void loadTerminalFontStack(editorFontId).then(() => {
      if (editorRef.current !== editor) {
        return
      }

      monaco.editor.remeasureFonts?.()
      editor.updateOptions({ fontFamily: getTerminalFontStack(editorFontId) })
      editor.layout()
    })

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
    if (!modelRef.current) {
      return
    }

    void startReadStream()
  }, [document.id, startReadStream])

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
    const editor = editorRef.current
    if (!editor) {
      return
    }

    let cancelled = false
    void loadTerminalFontStack(editorFontId).then(() => {
      if (cancelled || editorRef.current !== editor) {
        return
      }

      monaco.editor.remeasureFonts?.()
      editor.updateOptions({
        fontFamily: getTerminalFontStack(editorFontId),
        fontSize: temporaryFontSize
      })
    })

    return () => {
      cancelled = true
    }
  }, [editorFontId, temporaryFontSize])

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
    if (loadState !== 'ready' || saveMutation.isPending) {
      return
    }

    const nextContent = editorRef.current?.getValue() ?? editorContent

    try {
      await saveMutation.mutateAsync({ contents: nextContent, encoding: fileEncoding })
      setSavedContent(nextContent)
      setEditorContent(nextContent)
      await queryClient.invalidateQueries({ queryKey: ['sftp', document.sessionId] })
      toast.success(t('workbench.sftpFileEditor.toasts.saved'))
    } catch {
      toast.error(t('workbench.sftpFileEditor.toasts.saveFailed'))
    }
  }

  const updateFontZoom = useCallback(
    (action: FontZoomKeyboardAction) => {
      if (action === 'reset') {
        setFontZoomOffset(0)
        editorRef.current?.updateOptions({ fontSize: terminalAppearance.fontSize })
        return
      }

      const delta = action === 'increase' ? 1 : -1

      setFontZoomOffset((currentOffset) => {
        const currentSize = resolveTemporaryFontSize(terminalAppearance.fontSize, currentOffset)
        const nextSize = resolveTemporaryFontSize(currentSize, delta)

        editorRef.current?.updateOptions({ fontSize: nextSize })

        return nextSize - terminalAppearance.fontSize
      })
    },
    [terminalAppearance.fontSize]
  )

  const handleEditorKeyDownCapture = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const fontZoomAction = getKeyboardFontZoomAction(event)

    if (!fontZoomAction) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    updateFontZoom(fontZoomAction)
  }

  const handleEditorWheelZoom = useCallback(
    (event: WheelEvent) => {
      if (!(event.ctrlKey || event.metaKey)) {
        return
      }

      const delta = getWheelFontZoomDelta(event)

      if (delta === 0) {
        return
      }

      event.preventDefault()
      event.stopPropagation()

      updateFontZoom(delta > 0 ? 'increase' : 'decrease')
    },
    [updateFontZoom]
  )

  useEffect(() => {
    const surface = editorSurfaceRef.current
    if (!surface) {
      return
    }

    surface.addEventListener('wheel', handleEditorWheelZoom, { capture: true, passive: false })

    return () => {
      surface.removeEventListener('wheel', handleEditorWheelZoom, { capture: true })
    }
  }, [handleEditorWheelZoom])

  return (
    <form
      id={getSftpFileEditorFormId(document.id)}
      className="flex h-full min-h-0 flex-col bg-[var(--workbench-editor)]"
      onSubmit={(event) => {
        event.preventDefault()
        void handleSave()
      }}
    >
      <div className="flex min-h-[56px] shrink-0 items-center gap-3 border-b border-[var(--workbench-border)] px-3 py-2">
        <div className="grid min-w-[220px] shrink-0 gap-1 rounded-md border border-[var(--workbench-border)] bg-[var(--workbench-input)] px-2.5 py-1.5">
          <div className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="shrink-0">{t('workbench.sessionEditor.serverName')}</span>
            <span className="truncate font-mono">{session?.serverName ?? document.sessionId}</span>
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
          <span className="rounded-sm border border-[var(--workbench-border)] bg-[var(--workbench-input)] px-2 py-1 text-[11px] text-muted-foreground uppercase">
            {fileEncoding}
          </span>
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
            disabled={loadState === 'loading'}
            onClick={() => void startReadStream()}
          >
            <RefreshIcon className="size-4" />
            {t('common.actions.refresh')}
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={!isDirty || loadState !== 'ready' || saveMutation.isPending}
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

      {loadState === 'error' ? (
        <div className="border-b border-[var(--workbench-border)] bg-[var(--workbench-input)] px-4 py-3">
          <div className="text-sm font-medium text-foreground">
            {t('workbench.sftpFileEditor.empty.title')}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {loadError ?? t('workbench.sftpFileEditor.empty.description')}
          </div>
        </div>
      ) : null}

      <div className="min-h-0 flex-1">
        <div
          ref={editorSurfaceRef}
          className="relative h-full overflow-hidden bg-[var(--workbench-editor)]"
          data-sftp-editor-surface
          onKeyDownCapture={handleEditorKeyDownCapture}
          tabIndex={-1}
        >
          {loadState === 'loading' ? (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-[var(--workbench-editor)]">
              {downloadProgress && downloadProgress.total > 0 ? (
                <div className="flex w-full max-w-sm flex-col items-center gap-4 px-4">
                  <Download className="size-8 text-muted-foreground animate-pulse" />
                  <div className="w-full space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="font-medium">{t('workbench.sftpFileEditor.loading')}</span>
                      <span>
                        {formatFileSize(downloadProgress.transferred)} /{' '}
                        {formatFileSize(downloadProgress.total)}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--workbench-border)]">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-200 ease-out"
                        style={{
                          width: `${Math.min(100, (downloadProgress.transferred / downloadProgress.total) * 100)}%`
                        }}
                      />
                    </div>
                    <div className="text-center text-[11px] text-muted-foreground">
                      {Math.round((downloadProgress.transferred / downloadProgress.total) * 100)}%
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <LoaderCircle className="size-6 animate-spin text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    {t('workbench.sftpFileEditor.loading')}
                  </span>
                </div>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  cancelReadStream()
                  closeDocument(document.id)
                }}
              >
                <X className="size-4" />
                {t('common.actions.cancel')}
              </Button>
            </div>
          ) : null}
          <div ref={containerRef} className="h-full w-full" />
        </div>
      </div>
    </form>
  )
}
