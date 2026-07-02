import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api.js'
import { DEFAULT_APP_SETTINGS } from '@shared/constants'
import type { SftpFileChunkEvent, SftpFileStreamStateEvent } from '@shared/types'
import { createThemeDefinition } from '@shared/themes'
import i18n from '@/i18n'
import { WorkbenchSftpFileMonacoEditor } from '@/components/workbench/workbench-sftp-file-monaco-editor'
import type { SftpFileEditorDocument } from '@/lib/workbench'
import { createWinsshApiMock } from '@test/renderer/helpers/create-winssh-api'
import { useSessionsStore } from '@/store/sessions-store'

let modelValue = ''
let modelContentCallback: (() => void) | null = null

function appendModelValue(edits: { text: string }[]) {
  for (const edit of edits) {
    modelValue += edit.text
  }
}

const monacoModel = {
  applyEdits: vi.fn((edits: { text: string }[]) => {
    appendModelValue(edits)
    modelContentCallback?.()
  }),
  detectIndentation: vi.fn(),
  dispose: vi.fn(),
  getFullModelRange: vi.fn(() => ({ endColumn: modelValue.length + 1, endLineNumber: 1 })),
  getLineCount: vi.fn(() => modelValue.split('\n').length),
  getLineMaxColumn: vi.fn(
    (lineNumber: number) => (modelValue.split('\n')[lineNumber - 1] ?? '').length + 1
  ),
  getValue: vi.fn(() => modelValue),
  pushEditOperations: vi.fn((_selections: unknown, edits: { text: string }[]) => {
    appendModelValue(edits)
    modelContentCallback?.()
    return null
  }),
  setValue: vi.fn((value: string) => {
    modelValue = value
    modelContentCallback?.()
  })
}

const monacoEditor = {
  addCommand: vi.fn(),
  dispose: vi.fn(),
  focus: vi.fn(),
  getValue: vi.fn(() => modelValue),
  layout: vi.fn(),
  onDidChangeModelContent: vi.fn((callback: () => void) => {
    modelContentCallback = callback
    return {
      dispose: vi.fn(() => {
        modelContentCallback = null
      })
    }
  }),
  updateOptions: vi.fn()
}

vi.mock('monaco-editor/esm/vs/basic-languages/bat/bat.contribution.js', () => ({}))
vi.mock('monaco-editor/esm/vs/basic-languages/cpp/cpp.contribution.js', () => ({}))
vi.mock('monaco-editor/esm/vs/basic-languages/csharp/csharp.contribution.js', () => ({}))
vi.mock('monaco-editor/esm/vs/basic-languages/css/css.contribution.js', () => ({}))
vi.mock('monaco-editor/esm/vs/basic-languages/dockerfile/dockerfile.contribution.js', () => ({}))
vi.mock('monaco-editor/esm/vs/basic-languages/go/go.contribution.js', () => ({}))
vi.mock('monaco-editor/esm/vs/basic-languages/html/html.contribution.js', () => ({}))
vi.mock('monaco-editor/esm/vs/basic-languages/ini/ini.contribution.js', () => ({}))
vi.mock('monaco-editor/esm/vs/basic-languages/java/java.contribution.js', () => ({}))
vi.mock('monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution.js', () => ({}))
vi.mock('monaco-editor/esm/vs/basic-languages/less/less.contribution.js', () => ({}))
vi.mock('monaco-editor/esm/vs/basic-languages/lua/lua.contribution.js', () => ({}))
vi.mock('monaco-editor/esm/vs/basic-languages/markdown/markdown.contribution.js', () => ({}))
vi.mock('monaco-editor/esm/vs/basic-languages/php/php.contribution.js', () => ({}))
vi.mock('monaco-editor/esm/vs/basic-languages/powershell/powershell.contribution.js', () => ({}))
vi.mock('monaco-editor/esm/vs/basic-languages/python/python.contribution.js', () => ({}))
vi.mock('monaco-editor/esm/vs/basic-languages/ruby/ruby.contribution.js', () => ({}))
vi.mock('monaco-editor/esm/vs/basic-languages/rust/rust.contribution.js', () => ({}))
vi.mock('monaco-editor/esm/vs/basic-languages/scss/scss.contribution.js', () => ({}))
vi.mock('monaco-editor/esm/vs/basic-languages/shell/shell.contribution.js', () => ({}))
vi.mock('monaco-editor/esm/vs/basic-languages/sql/sql.contribution.js', () => ({}))
vi.mock('monaco-editor/esm/vs/basic-languages/typescript/typescript.contribution.js', () => ({}))
vi.mock('monaco-editor/esm/vs/basic-languages/xml/xml.contribution.js', () => ({}))
vi.mock('monaco-editor/esm/vs/basic-languages/yaml/yaml.contribution.js', () => ({}))
vi.mock('monaco-editor/min/vs/editor/editor.main.css', () => ({}))

vi.mock('monaco-editor/esm/vs/editor/editor.api.js', () => ({
  KeyCode: {
    KeyS: 49
  },
  KeyMod: {
    CtrlCmd: 2048
  },
  Uri: {
    from: (value: unknown) => value
  },
  Range: class {
    startLineNumber: number
    startColumn: number
    endLineNumber: number
    endColumn: number

    constructor(
      startLineNumber: number,
      startColumn: number,
      endLineNumber: number,
      endColumn: number
    ) {
      this.startLineNumber = startLineNumber
      this.startColumn = startColumn
      this.endLineNumber = endLineNumber
      this.endColumn = endColumn
    }
  },
  editor: {
    create: vi.fn(() => monacoEditor),
    createModel: vi.fn(() => monacoModel),
    defineTheme: vi.fn(),
    getModel: vi.fn(() => null),
    remeasureFonts: vi.fn(),
    setModelLanguage: vi.fn(),
    setTheme: vi.fn()
  },
  languages: {
    getLanguages: vi.fn(() => [{ id: 'json' }]),
    register: vi.fn(),
    setMonarchTokensProvider: vi.fn()
  }
}))

const sessionSummary = {
  connectedAt: new Date().toISOString(),
  currentPath: '/etc',
  host: '10.0.0.8',
  port: 22,
  serverId: 'server-1',
  serverName: 'prod-box',
  sessionId: 'session-1',
  status: 'ready' as const
}

const sftpDocument: SftpFileEditorDocument = {
  id: 'sftp-file-editor:session-1:%2Fetc%2Fnginx%2Fnginx.conf',
  kind: 'sftp-file-editor',
  remotePath: '/etc/nginx/nginx.conf',
  sessionId: 'session-1'
}

function createDeferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve
  })

  return { promise, resolve }
}

function createSftpStreamMock(options: { failClose?: boolean } = {}) {
  const chunkCallbacks = new Set<(event: SftpFileChunkEvent) => void>()
  const stateCallbacks = new Set<(event: SftpFileStreamStateEvent) => void>()
  let readStreamIndex = 0
  let writeStreamIndex = 0

  const api = {
    openFileReadStream: vi.fn(async (sessionId: string, remotePath: string) => {
      readStreamIndex += 1
      return {
        encoding: 'utf8',
        fileName: remotePath.split('/').at(-1) ?? remotePath,
        remotePath,
        sessionId,
        streamId: `read-${readStreamIndex}`,
        total: 24
      }
    }),
    startFileReadStream: vi.fn(),
    openFileWriteStream: vi.fn(async (sessionId: string, remotePath: string, encoding: string) => {
      writeStreamIndex += 1
      return {
        encoding,
        remotePath,
        sessionId,
        streamId: `write-${writeStreamIndex}`
      }
    }),
    writeFileChunk: vi.fn(async () => undefined),
    closeFileWriteStream: vi.fn(async () => {
      if (options.failClose) {
        throw new Error('write failed')
      }
    }),
    cancelFileStream: vi.fn(),
    onFileChunk: vi.fn((callback: (event: SftpFileChunkEvent) => void) => {
      chunkCallbacks.add(callback)
      return () => {
        chunkCallbacks.delete(callback)
      }
    }),
    onFileStreamState: vi.fn((callback: (event: SftpFileStreamStateEvent) => void) => {
      stateCallbacks.add(callback)
      return () => {
        stateCallbacks.delete(callback)
      }
    })
  }

  return {
    api,
    emitChunk(event: Partial<SftpFileChunkEvent> & Pick<SftpFileChunkEvent, 'streamId' | 'chunk'>) {
      const resolvedEvent: SftpFileChunkEvent = {
        remotePath: sftpDocument.remotePath,
        sessionId: sftpDocument.sessionId,
        total: 24,
        transferred: event.chunk.length,
        ...event
      }

      for (const callback of chunkCallbacks) {
        callback(resolvedEvent)
      }
    },
    emitState(
      event: Partial<SftpFileStreamStateEvent & { encoding?: string }> &
        Pick<SftpFileStreamStateEvent, 'streamId' | 'status'>
    ) {
      const resolvedEvent: SftpFileStreamStateEvent & { encoding?: string } = {
        direction: 'download',
        remotePath: sftpDocument.remotePath,
        sessionId: sftpDocument.sessionId,
        total: 24,
        transferred: 24,
        ...event
      }

      for (const callback of stateCallbacks) {
        callback(resolvedEvent)
      }
    }
  }
}

function renderEditor() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <WorkbenchSftpFileMonacoEditor document={sftpDocument} />
    </QueryClientProvider>
  )
}

function renderEditorWithDocument(document: SftpFileEditorDocument) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  })

  const view = render(
    <QueryClientProvider client={queryClient}>
      <WorkbenchSftpFileMonacoEditor document={document} />
    </QueryClientProvider>
  )

  return {
    ...view,
    rerenderDocument(nextDocument: SftpFileEditorDocument) {
      view.rerender(
        <QueryClientProvider client={queryClient}>
          <WorkbenchSftpFileMonacoEditor document={nextDocument} />
        </QueryClientProvider>
      )
    }
  }
}

const highContrastDarkTheme = createThemeDefinition({
  appearance: 'dark',
  id: 'acme.accessible-dark',
  label: 'High Contrast Dark',
  pluginDisplayName: 'WinSSH High Contrast Themes',
  pluginId: 'winssh.high-contrast-themes',
  source: 'builtin',
  terminal: {
    background: '#000000',
    foreground: '#ffffff',
    cursor: '#ffff00',
    selectionBackground: '#ffff00'
  },
  uiTheme: 'hc-black',
  version: '1.0.0'
})

describe('WorkbenchSftpFileMonacoEditor', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en-US')
    document.documentElement.dataset.themeAppearance = 'dark'
    useSessionsStore.getState().clear()
    useSessionsStore.getState().addSession(sessionSummary)
    modelValue = ''
    modelContentCallback = null
    monacoModel.applyEdits.mockClear()
    monacoModel.detectIndentation.mockClear()
    monacoModel.dispose.mockClear()
    monacoModel.getFullModelRange.mockClear()
    monacoModel.getLineCount.mockClear()
    monacoModel.getLineMaxColumn.mockClear()
    monacoModel.getValue.mockClear()
    monacoModel.pushEditOperations.mockClear()
    monacoModel.setValue.mockClear()
    monacoEditor.addCommand.mockClear()
    monacoEditor.dispose.mockClear()
    monacoEditor.focus.mockClear()
    monacoEditor.getValue.mockClear()
    monacoEditor.layout.mockClear()
    monacoEditor.onDidChangeModelContent.mockClear()
    monacoEditor.updateOptions.mockClear()
    vi.mocked(monaco.editor.defineTheme).mockClear()
    vi.mocked(monaco.editor.setTheme).mockClear()
    const sftpStream = createSftpStreamMock()
    window.winsshApi = createWinsshApiMock({ sftp: sftpStream.api })
  })

  it('shows server identity above the remote file path', async () => {
    const sftpStream = createSftpStreamMock()
    window.winsshApi = createWinsshApiMock({ sftp: sftpStream.api })

    renderEditor()

    expect(await screen.findByText('prod-box')).toBeInTheDocument()
    expect(screen.getByText('10.0.0.8')).toBeInTheDocument()
    expect(screen.getByText('nginx.conf')).toBeInTheDocument()
    expect(screen.getByText('/etc/nginx/nginx.conf')).toBeInTheDocument()

    await waitFor(() => {
      expect(sftpStream.api.openFileReadStream).toHaveBeenCalledWith(
        'session-1',
        '/etc/nginx/nginx.conf'
      )
    })

    act(() => {
      sftpStream.emitChunk({ chunk: 'user nginx;', streamId: 'read-1' })
      sftpStream.emitState({ status: 'completed', streamId: 'read-1' })
    })

    await waitFor(() => {
      expect(monacoModel.getValue()).toBe('user nginx;')
    })
  })

  it('starts read streams only after the active stream id is set', async () => {
    const sftpStream = createSftpStreamMock()
    window.winsshApi = createWinsshApiMock({ sftp: sftpStream.api })

    renderEditor()

    await waitFor(() => {
      expect(sftpStream.api.openFileReadStream).toHaveBeenCalledWith(
        'session-1',
        '/etc/nginx/nginx.conf'
      )
    })

    await waitFor(() => {
      expect(sftpStream.api.startFileReadStream).toHaveBeenCalledWith('read-1')
    })

    act(() => {
      sftpStream.emitState({
        status: 'completed',
        streamId: 'read-1',
        transferred: 0,
        total: 0
      })
    })

    await waitFor(() => {
      expect(screen.queryByText('Loading remote file...')).not.toBeInTheDocument()
      expect(screen.getByText('Saved')).toBeInTheDocument()
    })

    expect(monacoModel.getValue()).toBe('')
  })

  it('defines Monaco themes on the native high contrast base', async () => {
    const sftpStream = createSftpStreamMock()
    window.winsshApi = createWinsshApiMock({
      settings: {
        get: vi.fn().mockResolvedValue({
          ...DEFAULT_APP_SETTINGS,
          language: 'en-US',
          terminalFontId: 'cascadia-mono',
          theme: 'acme.accessible-dark'
        })
      },
      sftp: sftpStream.api,
      themes: {
        list: vi.fn().mockResolvedValue([highContrastDarkTheme])
      }
    })

    renderEditor()

    await waitFor(() => {
      expect(monaco.editor.defineTheme).toHaveBeenCalledWith(
        'winssh-acme-accessible-dark',
        expect.objectContaining({
          base: 'hc-black'
        })
      )
    })
  })

  it('temporarily zooms only the current Monaco editor with ctrl wheel', async () => {
    const updateSettings = vi.fn()
    const sftpStream = createSftpStreamMock()
    window.winsshApi = createWinsshApiMock({
      settings: {
        update: updateSettings
      },
      sftp: sftpStream.api
    })

    const { container } = renderEditor()

    await waitFor(() => {
      expect(monaco.editor.create).toHaveBeenCalled()
    })

    fireEvent.wheel(container.querySelector('[data-sftp-editor-surface]') as HTMLElement, {
      ctrlKey: true,
      deltaY: -120
    })

    expect(monacoEditor.updateOptions).toHaveBeenLastCalledWith(
      expect.objectContaining({ fontSize: 15 })
    )
    expect(updateSettings).not.toHaveBeenCalled()
  })

  it('temporarily zooms the Monaco editor when the editor surface handles wheel propagation', async () => {
    const updateSettings = vi.fn()
    const sftpStream = createSftpStreamMock()
    window.winsshApi = createWinsshApiMock({
      settings: {
        update: updateSettings
      },
      sftp: sftpStream.api
    })

    const { container } = renderEditor()

    await waitFor(() => {
      expect(monaco.editor.create).toHaveBeenCalled()
    })

    const surface = container.querySelector('[data-sftp-editor-surface]') as HTMLElement
    const monacoMount = surface.lastElementChild as HTMLElement
    monacoMount.addEventListener('wheel', (event) => event.stopPropagation())

    const event = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
      deltaY: -120
    })

    act(() => {
      monacoMount.dispatchEvent(event)
    })

    expect(monacoEditor.updateOptions).toHaveBeenLastCalledWith(
      expect.objectContaining({ fontSize: 15 })
    )
    expect(updateSettings).not.toHaveBeenCalled()
  })

  it('temporarily zooms and resets the current Monaco editor with keyboard shortcuts', async () => {
    const updateSettings = vi.fn()
    const sftpStream = createSftpStreamMock()
    window.winsshApi = createWinsshApiMock({
      settings: {
        update: updateSettings
      },
      sftp: sftpStream.api
    })

    const { container } = renderEditor()

    await waitFor(() => {
      expect(monaco.editor.create).toHaveBeenCalled()
    })

    const surface = container.querySelector('[data-sftp-editor-surface]') as HTMLElement

    fireEvent.keyDown(surface, { ctrlKey: true, key: '+' })
    expect(monacoEditor.updateOptions).toHaveBeenLastCalledWith({ fontSize: 15 })

    fireEvent.keyDown(surface, { ctrlKey: true, key: '-' })
    expect(monacoEditor.updateOptions).toHaveBeenLastCalledWith({ fontSize: 14 })

    fireEvent.keyDown(surface, { ctrlKey: true, key: '+' })
    fireEvent.keyDown(surface, { ctrlKey: true, key: '0' })
    expect(monacoEditor.updateOptions).toHaveBeenLastCalledWith({ fontSize: 14 })
    expect(updateSettings).not.toHaveBeenCalled()
  })

  it('appends streamed chunks and marks the editor clean after completion', async () => {
    const sftpStream = createSftpStreamMock()
    window.winsshApi = createWinsshApiMock({ sftp: sftpStream.api })

    renderEditor()

    await waitFor(() => {
      expect(sftpStream.api.openFileReadStream).toHaveBeenCalledWith(
        'session-1',
        '/etc/nginx/nginx.conf'
      )
    })

    act(() => {
      sftpStream.emitChunk({ chunk: 'user ', streamId: 'read-1', transferred: 5 })
      sftpStream.emitChunk({ chunk: 'nginx;', streamId: 'read-1', transferred: 11 })
      sftpStream.emitState({ status: 'completed', streamId: 'read-1' })
    })

    expect(monacoModel.getValue()).toBe('user nginx;')
    expect(screen.getByText('Saved')).toBeInTheDocument()
  })

  it('does not read the full editor value for every streamed load chunk', async () => {
    const sftpStream = createSftpStreamMock()
    window.winsshApi = createWinsshApiMock({ sftp: sftpStream.api })

    renderEditor()

    await waitFor(() => {
      expect(sftpStream.api.openFileReadStream).toHaveBeenCalled()
    })
    monacoEditor.getValue.mockClear()

    act(() => {
      sftpStream.emitChunk({ chunk: 'alpha', streamId: 'read-1', transferred: 5 })
      sftpStream.emitChunk({ chunk: '\nbeta', streamId: 'read-1', transferred: 10 })
      sftpStream.emitChunk({ chunk: '\ngamma', streamId: 'read-1', transferred: 16 })
    })

    expect(monacoEditor.getValue).not.toHaveBeenCalled()

    act(() => {
      sftpStream.emitState({ status: 'completed', streamId: 'read-1', transferred: 16, total: 16 })
    })

    await waitFor(() => {
      expect(screen.getByText('Saved')).toBeInTheDocument()
    })
    expect(monacoEditor.getValue).not.toHaveBeenCalled()

    act(() => {
      monacoModel.setValue('alpha\nbeta\ngamma\nuser edit')
    })

    await waitFor(() => {
      expect(screen.getByText('Unsaved')).toBeInTheDocument()
    })
    expect(monacoEditor.getValue).toHaveBeenCalledTimes(1)
  })

  it('joins streamed chunks once when completing a multi-chunk load', async () => {
    const sftpStream = createSftpStreamMock()
    window.winsshApi = createWinsshApiMock({ sftp: sftpStream.api })

    renderEditor()

    await waitFor(() => {
      expect(sftpStream.api.openFileReadStream).toHaveBeenCalled()
    })
    const joinSpy = vi.spyOn(Array.prototype, 'join')
    const loadedChunkJoinCount = () =>
      joinSpy.mock.contexts.filter(
        (context): context is string[] =>
          Array.isArray(context) &&
          context.length === 3 &&
          context[0] === 'alpha' &&
          context[1] === '\nbeta' &&
          context[2] === '\ngamma'
      ).length

    try {
      act(() => {
        sftpStream.emitChunk({ chunk: 'alpha', streamId: 'read-1', transferred: 5 })
        sftpStream.emitChunk({ chunk: '\nbeta', streamId: 'read-1', transferred: 10 })
        sftpStream.emitChunk({ chunk: '\ngamma', streamId: 'read-1', transferred: 16 })
      })

      expect(loadedChunkJoinCount()).toBe(0)

      act(() => {
        sftpStream.emitState({
          status: 'completed',
          streamId: 'read-1',
          transferred: 16,
          total: 16
        })
      })

      expect(loadedChunkJoinCount()).toBe(1)
      expect(monacoModel.getValue()).toBe('alpha\nbeta\ngamma')

      act(() => {
        monacoModel.setValue('alpha\nbeta\ngamma')
      })

      expect(screen.getByText('Saved')).toBeInTheDocument()
    } finally {
      joinSpy.mockRestore()
    }
  })

  it('ignores chunks from stale read streams', async () => {
    const sftpStream = createSftpStreamMock()
    window.winsshApi = createWinsshApiMock({ sftp: sftpStream.api })
    const nextDocument: SftpFileEditorDocument = {
      ...sftpDocument,
      id: 'sftp-file-editor:session-1:%2Fetc%2Fnginx%2Fsites-enabled%2Fdefault',
      remotePath: '/etc/nginx/sites-enabled/default'
    }

    const view = renderEditorWithDocument(sftpDocument)

    await waitFor(() => {
      expect(sftpStream.api.openFileReadStream).toHaveBeenCalledTimes(1)
    })

    view.rerenderDocument(nextDocument)

    await waitFor(() => {
      expect(sftpStream.api.openFileReadStream).toHaveBeenCalledTimes(2)
    })

    act(() => {
      sftpStream.emitChunk({
        chunk: 'stale',
        remotePath: sftpDocument.remotePath,
        streamId: 'read-1'
      })
      sftpStream.emitChunk({
        chunk: 'fresh',
        remotePath: nextDocument.remotePath,
        streamId: 'read-2'
      })
      sftpStream.emitState({
        remotePath: nextDocument.remotePath,
        status: 'completed',
        streamId: 'read-2'
      })
    })

    expect(monacoModel.getValue()).toBe('fresh')
  })

  it('drops failed streamed chunks before a reload completes', async () => {
    const sftpStream = createSftpStreamMock()
    window.winsshApi = createWinsshApiMock({ sftp: sftpStream.api })

    renderEditor()

    await waitFor(() => {
      expect(sftpStream.api.openFileReadStream).toHaveBeenCalledTimes(1)
    })

    act(() => {
      sftpStream.emitChunk({ chunk: 'stale partial', streamId: 'read-1' })
      sftpStream.emitState({
        error: 'download failed',
        status: 'error',
        streamId: 'read-1'
      })
    })

    await waitFor(() => {
      expect(screen.getByText('download failed')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /refresh/i }))

    await waitFor(() => {
      expect(sftpStream.api.openFileReadStream).toHaveBeenCalledTimes(2)
    })

    act(() => {
      sftpStream.emitChunk({ chunk: 'fresh content', streamId: 'read-2' })
      sftpStream.emitState({ status: 'completed', streamId: 'read-2' })
    })

    expect(monacoModel.getValue()).toBe('fresh content')
  })

  it('cancels a read stream that opens after the editor unmounts', async () => {
    const sftpStream = createSftpStreamMock()
    const readStream =
      createDeferred<Awaited<ReturnType<typeof sftpStream.api.openFileReadStream>>>()
    sftpStream.api.openFileReadStream.mockReturnValueOnce(readStream.promise)
    window.winsshApi = createWinsshApiMock({ sftp: sftpStream.api })

    const view = renderEditor()

    await waitFor(() => {
      expect(sftpStream.api.openFileReadStream).toHaveBeenCalled()
    })

    view.unmount()

    await act(async () => {
      readStream.resolve({
        encoding: 'utf8',
        fileName: 'nginx.conf',
        remotePath: sftpDocument.remotePath,
        sessionId: sftpDocument.sessionId,
        streamId: 'read-1',
        total: 24
      })
      await readStream.promise
    })

    expect(sftpStream.api.cancelFileStream).toHaveBeenCalledWith('read-1')
  })

  it('shows progress from streamed read state events', async () => {
    const sftpStream = createSftpStreamMock()
    window.winsshApi = createWinsshApiMock({ sftp: sftpStream.api })

    renderEditor()

    await waitFor(() => {
      expect(sftpStream.api.openFileReadStream).toHaveBeenCalled()
    })

    act(() => {
      sftpStream.emitState({
        status: 'running',
        streamId: 'read-1',
        transferred: 5,
        total: 10
      })
    })

    expect(screen.getByText('5 B / 10 B')).toBeInTheDocument()
    expect(screen.getByText('50%')).toBeInTheDocument()

    act(() => {
      sftpStream.emitChunk({ chunk: 'done', streamId: 'read-1' })
      sftpStream.emitState({ status: 'completed', streamId: 'read-1', transferred: 10, total: 10 })
    })

    await waitFor(() => {
      expect(screen.queryByText('5 B / 10 B')).not.toBeInTheDocument()
      expect(screen.getByText('Saved')).toBeInTheDocument()
    })
  })

  it('saves editor content in bounded chunks and marks clean after close succeeds', async () => {
    const sftpStream = createSftpStreamMock()
    window.winsshApi = createWinsshApiMock({ sftp: sftpStream.api })

    renderEditor()

    await waitFor(() => {
      expect(sftpStream.api.openFileReadStream).toHaveBeenCalled()
    })

    act(() => {
      sftpStream.emitChunk({ chunk: 'saved-content', streamId: 'read-1' })
      sftpStream.emitState({ status: 'completed', streamId: 'read-1' })
    })

    await waitFor(() => {
      expect(screen.getByText('Saved')).toBeInTheDocument()
    })

    const nextContent = `${'a'.repeat(64 * 1024)}tail`
    act(() => {
      monacoModel.setValue(nextContent)
    })

    await waitFor(() => {
      expect(screen.getByText('Unsaved')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => {
      expect(sftpStream.api.closeFileWriteStream).toHaveBeenCalledWith('write-1')
    })

    expect(sftpStream.api.openFileWriteStream).toHaveBeenCalledWith(
      'session-1',
      '/etc/nginx/nginx.conf',
      'utf8'
    )
    expect(sftpStream.api.writeFileChunk).toHaveBeenNthCalledWith(
      1,
      'write-1',
      'a'.repeat(64 * 1024)
    )
    expect(sftpStream.api.writeFileChunk).toHaveBeenNthCalledWith(2, 'write-1', 'tail')
    expect(screen.getByText('Saved')).toBeInTheDocument()
  })

  it('uses the final streamed encoding when saving after load', async () => {
    const sftpStream = createSftpStreamMock()
    window.winsshApi = createWinsshApiMock({ sftp: sftpStream.api })

    renderEditor()

    await waitFor(() => {
      expect(sftpStream.api.openFileReadStream).toHaveBeenCalled()
    })

    act(() => {
      sftpStream.emitChunk({ chunk: '配置', streamId: 'read-1' })
      sftpStream.emitState({
        encoding: 'gbk',
        status: 'running',
        streamId: 'read-1',
        transferred: 4,
        total: 4
      })
      sftpStream.emitState({
        encoding: 'gbk',
        status: 'completed',
        streamId: 'read-1',
        transferred: 4,
        total: 4
      })
    })

    await waitFor(() => {
      expect(screen.getByText('Saved')).toBeInTheDocument()
    })

    act(() => {
      monacoModel.setValue('配置更新')
    })

    await waitFor(() => {
      expect(screen.getByText('Unsaved')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => {
      expect(sftpStream.api.openFileWriteStream).toHaveBeenCalledWith(
        'session-1',
        '/etc/nginx/nginx.conf',
        'gbk'
      )
    })
  })

  it('does not split an emoji surrogate pair at the save chunk boundary', async () => {
    const sftpStream = createSftpStreamMock()
    window.winsshApi = createWinsshApiMock({ sftp: sftpStream.api })

    renderEditor()

    await waitFor(() => {
      expect(sftpStream.api.openFileReadStream).toHaveBeenCalled()
    })

    act(() => {
      sftpStream.emitChunk({ chunk: 'saved-content', streamId: 'read-1' })
      sftpStream.emitState({ status: 'completed', streamId: 'read-1' })
    })

    await waitFor(() => {
      expect(screen.getByText('Saved')).toBeInTheDocument()
    })

    const prefix = 'a'.repeat(64 * 1024 - 1)
    const nextContent = `${prefix}😀tail`
    act(() => {
      monacoModel.setValue(nextContent)
    })

    await waitFor(() => {
      expect(screen.getByText('Unsaved')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => {
      expect(sftpStream.api.closeFileWriteStream).toHaveBeenCalledWith('write-1')
    })

    expect(sftpStream.api.writeFileChunk).toHaveBeenNthCalledWith(1, 'write-1', prefix)
    expect(sftpStream.api.writeFileChunk).toHaveBeenNthCalledWith(2, 'write-1', '😀tail')
  })

  it('does not save partial content after a streamed load fails', async () => {
    const sftpStream = createSftpStreamMock()
    window.winsshApi = createWinsshApiMock({ sftp: sftpStream.api })

    const { container } = renderEditor()

    await waitFor(() => {
      expect(sftpStream.api.openFileReadStream).toHaveBeenCalled()
    })

    act(() => {
      sftpStream.emitChunk({ chunk: 'partial config', streamId: 'read-1' })
      sftpStream.emitState({
        error: 'download failed',
        status: 'error',
        streamId: 'read-1',
        transferred: 14,
        total: 40
      })
    })

    await waitFor(() => {
      expect(screen.getByText('download failed')).toBeInTheDocument()
    })

    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled()

    fireEvent.submit(container.querySelector('form') as HTMLFormElement)

    expect(sftpStream.api.openFileWriteStream).not.toHaveBeenCalled()
  })

  it('keeps the editor dirty when streamed save fails', async () => {
    const sftpStream = createSftpStreamMock({ failClose: true })
    window.winsshApi = createWinsshApiMock({ sftp: sftpStream.api })

    renderEditor()

    await waitFor(() => {
      expect(sftpStream.api.openFileReadStream).toHaveBeenCalled()
    })

    act(() => {
      sftpStream.emitChunk({ chunk: 'before', streamId: 'read-1' })
      sftpStream.emitState({ status: 'completed', streamId: 'read-1' })
    })

    await waitFor(() => {
      expect(screen.getByText('Saved')).toBeInTheDocument()
    })

    act(() => {
      monacoModel.setValue('after')
    })

    await waitFor(() => {
      expect(screen.getByText('Unsaved')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => {
      expect(sftpStream.api.cancelFileStream).toHaveBeenCalledWith('write-1')
    })

    expect(screen.getByText('Unsaved')).toBeInTheDocument()
  })
})
