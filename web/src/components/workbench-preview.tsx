import { BookOpenText, FolderTree, PanelLeft, Search, TerminalSquare } from 'lucide-react'
import { BrandLogo } from '@/components/brand-logo'
import { useSiteLanguage } from '@/components/site-language'
import { useSiteTheme } from '@/components/site-theme'
import { SITE_DARK_THEME_ID } from '@/lib/theme'

export function WorkbenchPreview() {
  const { copy } = useSiteLanguage()
  const { resolvedThemeId } = useSiteTheme()
  const preview = copy.home.preview
  const railIcons = [PanelLeft, TerminalSquare, FolderTree, BookOpenText]
  const resolvedThemeLabel =
    resolvedThemeId === SITE_DARK_THEME_ID ? copy.shell.themeDarkLabel : copy.shell.themeLightLabel

  return (
    <div className="site-preview-stage overflow-hidden border border-[var(--workbench-border)] bg-[var(--workbench-bg)] shadow-[0_24px_80px_rgba(15,23,42,0.10)]">
      {/* ── Titlebar ── */}
      <div className="flex items-center justify-between border-b border-[var(--workbench-border)] bg-[var(--workbench-titlebar)] px-3 py-2">
        <div className="flex items-center gap-2 text-[var(--workbench-logo)]">
          <BrandLogo className="size-5" />
          <span className="text-xs font-semibold text-[var(--foreground)]">WinSSH</span>
        </div>
        <div className="hidden items-center gap-2 md:flex">
          <div className="flex items-center gap-2 border border-[var(--workbench-border)] bg-[var(--workbench-input)] px-2 py-1 text-[11px] text-[var(--workbench-muted)]">
            <Search className="size-3.5" />
            {preview.quickLabels[0]}
          </div>
          <div className="border border-[var(--workbench-border)] bg-[var(--workbench-input)] px-2 py-1 text-[11px] text-[var(--workbench-muted)]">
            {preview.quickLabels[1]}
          </div>
        </div>
      </div>

      {/* ── Main layout ── */}
      <div className="grid min-h-[440px] grid-cols-[48px_minmax(180px,220px)_minmax(0,1fr)]">
        {/* ── Activity bar ── */}
        <aside className="hidden border-r border-[var(--workbench-border)] bg-[var(--workbench-activity-bar)] py-3 md:flex md:flex-col md:items-center md:gap-2">
          {railIcons.map((Icon, index) => (
            <div
              key={index}
              className={`relative flex size-9 items-center justify-center ${
                index === 1
                  ? 'bg-[var(--workbench-hover)] text-[var(--foreground)]'
                  : 'text-[var(--workbench-muted)]'
              }`}
            >
              {index === 1 ? (
                <span className="absolute inset-y-1 left-0 w-0.5 bg-[var(--workbench-active)]" />
              ) : null}
              <Icon className="size-4" />
            </div>
          ))}
        </aside>

        {/* ── Sidebar ── */}
        <aside className="border-r border-[var(--workbench-border)] bg-[var(--workbench-sidebar)]">
          <div className="flex items-center justify-between border-b border-[var(--workbench-border)] px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--workbench-muted)]">
              {preview.sidebarTitle}
            </div>
          </div>
          <div className="space-y-1 p-3">
            {preview.sidebarItems.map((item, index) => (
              <div
                key={item}
                className={`flex items-center gap-2 border px-3 py-2 text-sm ${
                  index === 0
                    ? 'border-[var(--workbench-border)] bg-[var(--workbench-hover)] text-[var(--foreground)]'
                    : 'border-transparent text-[var(--workbench-muted)]'
                }`}
              >
                {index === 0 ? (
                  <span className="size-1.5 shrink-0 bg-[var(--workbench-active)]" />
                ) : (
                  <span className="size-1.5 shrink-0 bg-[var(--workbench-muted)] opacity-40" />
                )}
                {item}
              </div>
            ))}
          </div>
        </aside>

        {/* ── Editor area ── */}
        <div className="flex min-w-0 flex-col bg-[var(--workbench-editor)]">
          {/* ── Tabs ── */}
          <div className="flex items-center gap-1 border-b border-[var(--workbench-border)] bg-[var(--workbench-tabs)] px-3 py-1.5">
            <span className="inline-flex items-center gap-1.5 border border-[var(--workbench-border)] bg-[var(--workbench-editor)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)]">
              <TerminalSquare className="size-3.5 text-[var(--workbench-active)]" />
              {preview.sessionTitle}
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-[var(--workbench-muted)]">
              <FolderTree className="size-3.5" />
              sftp: /srv/releases
            </span>
          </div>

          {/* ── Content ── */}
          <div className="grid flex-1 gap-0 lg:grid-cols-[minmax(0,1fr)_260px]">
            {/* ── Terminal ── */}
            <section className="flex flex-col border-b border-[var(--workbench-border)] lg:border-b-0 lg:border-r">
              <div className="flex items-center justify-between border-b border-[var(--workbench-border)] bg-[var(--workbench-panel)] px-4 py-2">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--workbench-muted)]">
                  Terminal
                </div>
                <div className="flex items-center gap-2 text-[11px] text-[var(--workbench-muted)]">
                  <span className="site-status-dot" />
                  <span>connected</span>
                </div>
              </div>
              <div className="px-4 py-3">
                <div className="text-[11px] text-[var(--workbench-muted)]">{preview.sessionMeta}</div>
              </div>
              <div className="flex-1 border border-[var(--workbench-border)] bg-[var(--background)] mx-4 mb-4 p-4 font-mono text-[13px] leading-[1.65] text-[var(--foreground)]">
                {preview.terminalLines.map((line, index) => (
                  <div key={line} className="flex">
                    <span className="mr-3 select-none text-[var(--workbench-muted)] opacity-40 text-[11px] leading-[1.65] w-4 text-right shrink-0">
                      {index + 1}
                    </span>
                    <span className={index === 0 ? 'text-[var(--workbench-active)]' : ''}>
                      {line}
                    </span>
                  </div>
                ))}
                <div className="flex mt-1">
                  <span className="mr-3 select-none text-[var(--workbench-muted)] opacity-40 text-[11px] leading-[1.65] w-4 text-right shrink-0">
                    {preview.terminalLines.length + 1}
                  </span>
                  <span className="site-terminal-cursor" />
                </div>
              </div>
            </section>

            {/* ── Side panel ── */}
            <aside className="flex flex-col bg-[var(--workbench-panel)]">
              <div className="border-b border-[var(--workbench-border)] px-4 py-2">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--workbench-muted)]">
                  {preview.panelTitle}
                </div>
              </div>
              <div className="flex-1 px-4 py-3 space-y-2">
                {preview.panelItems.map((item, index) => (
                  <div
                    key={item}
                    className="flex items-start gap-2.5 border border-[var(--workbench-border)] bg-[var(--workbench-editor)] px-3 py-2.5 text-sm"
                  >
                    <span
                      className={`mt-1 size-1.5 shrink-0 ${
                        index === 0
                          ? 'bg-[var(--workbench-active)]'
                          : index === 1
                            ? 'bg-[#0f8f52]'
                            : 'bg-[#b7791f]'
                      }`}
                    />
                    {item}
                  </div>
                ))}
              </div>
              <div className="border-t border-[var(--workbench-border)] px-4 py-3 flex flex-wrap gap-2">
                {[resolvedThemeLabel, preview.quickLabels[3]].map((label) => (
                  <span
                    key={label}
                    className="border border-[var(--workbench-border)] bg-[var(--workbench-input)] px-2 py-1 text-[11px] font-medium text-[var(--workbench-muted)]"
                  >
                    {label}
                  </span>
                ))}
              </div>
            </aside>
          </div>

          {/* ── Status bar ── */}
          <div className="flex items-center justify-between bg-[var(--workbench-statusbar)] px-4 py-1.5 text-[11px] font-medium text-[var(--workbench-statusbar-foreground)]">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5">
                <span className="site-status-dot" style={{ background: '#ffffff' }} />
                WinSSH
              </span>
              <span>{copy.meta.version} {copy.meta.releaseChannel}</span>
            </div>
            <div className="flex items-center gap-3">
              <span>{preview.quickLabels[2]}</span>
              <span>UTF-8</span>
              <span>LF</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
