import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api.js'
import { DEFAULT_APP_SETTINGS } from '@shared/constants'
import { createThemeDefinition } from '@shared/themes'
import i18n from '@/i18n'
import { WorkbenchSftpFileMonacoEditor } from '@/components/workbench/workbench-sftp-file-monaco-editor'
import type { SftpFileEditorDocument } from '@/lib/workbench'
import { createWinsshApiMock } from '@test/renderer/helpers/create-winssh-api'
import { useSessionsStore } from '@/store/sessions-store'

const monacoModel = {
  detectIndentation: vi.fn(),
  dispose: vi.fn(),
  setValue: vi.fn()
}

const monacoEditor = {
  addCommand: vi.fn(),
  dispose: vi.fn(),
  focus: vi.fn(),
  getValue: vi.fn(() => ''),
  layout: vi.fn(),
  onDidChangeModelContent: vi.fn(() => ({ dispose: vi.fn() })),
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
    monacoModel.detectIndentation.mockReset()
    monacoModel.dispose.mockReset()
    monacoModel.setValue.mockReset()
    monacoEditor.addCommand.mockReset()
    monacoEditor.dispose.mockReset()
    monacoEditor.focus.mockReset()
    monacoEditor.getValue.mockReset()
    monacoEditor.getValue.mockReturnValue('')
    monacoEditor.layout.mockReset()
    monacoEditor.onDidChangeModelContent.mockReset()
    monacoEditor.onDidChangeModelContent.mockReturnValue({ dispose: vi.fn() })
    monacoEditor.updateOptions.mockReset()
    vi.mocked(monaco.editor.defineTheme).mockClear()
    vi.mocked(monaco.editor.setTheme).mockClear()
    window.winsshApi = createWinsshApiMock({
      sftp: {
        readFile: vi.fn().mockResolvedValue({ content: 'user nginx;', encoding: 'utf8' })
      }
    })
  })

  it('shows server identity above the remote file path', async () => {
    renderEditor()

    expect(await screen.findByText('prod-box')).toBeInTheDocument()
    expect(screen.getByText('10.0.0.8')).toBeInTheDocument()
    expect(screen.getByText('nginx.conf')).toBeInTheDocument()
    expect(screen.getByText('/etc/nginx/nginx.conf')).toBeInTheDocument()

    await waitFor(() => {
      expect(monacoModel.setValue).toHaveBeenCalledWith('user nginx;')
    })
  })

  it('defines Monaco themes on the native high contrast base', async () => {
    window.winsshApi = createWinsshApiMock({
      settings: {
        get: vi.fn().mockResolvedValue({
          ...DEFAULT_APP_SETTINGS,
          language: 'en-US',
          terminalFontId: 'cascadia-mono',
          theme: 'acme.accessible-dark'
        })
      },
      sftp: {
        readFile: vi.fn().mockResolvedValue({ content: 'user nginx;', encoding: 'utf8' })
      },
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
})
