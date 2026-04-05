import { BookOpenText, FolderTree, PanelLeft, Search, TerminalSquare } from 'lucide-react'
import { BrandLogo } from '@/components/brand-logo'
import { useSiteLanguage } from '@/components/site-language'

export function WorkbenchPreview() {
  const { copy } = useSiteLanguage()
  const preview = copy.home.preview
  const railIcons = [PanelLeft, TerminalSquare, FolderTree, BookOpenText]

  return (
    <div className="site-preview-stage overflow-hidden rounded-sm border border-[var(--workbench-border)] bg-[var(--workbench-bg)] shadow-[0_24px_80px_rgba(15,23,42,0.12)]">
      <div className="flex items-center justify-between border-b border-[var(--workbench-border)] bg-[var(--workbench-titlebar)] px-3 py-2">
        <div className="flex items-center gap-2 text-[var(--workbench-logo)]">
          <BrandLogo className="size-5" />
          <span className="text-xs font-semibold text-[var(--foreground)]">WinSSH</span>
        </div>
        <div className="hidden items-center gap-2 md:flex">
          <div className="flex items-center gap-2 rounded-sm border border-[var(--workbench-border)] bg-[var(--workbench-input)] px-2 py-1 text-[11px] text-[var(--workbench-muted)]">
            <Search className="size-3.5" />
            {preview.quickLabels[0]}
          </div>
          <div className="rounded-sm border border-[var(--workbench-border)] bg-[var(--workbench-input)] px-2 py-1 text-[11px] text-[var(--workbench-muted)]">
            {preview.quickLabels[1]}
          </div>
        </div>
      </div>

      <div className="grid min-h-[420px] grid-cols-[48px_minmax(180px,220px)_minmax(0,1fr)]">
        <aside className="hidden border-r border-[var(--workbench-border)] bg-[var(--workbench-activity-bar)] py-3 md:flex md:flex-col md:items-center md:gap-2">
          {railIcons.map((Icon, index) => (
            <div
              key={index}
              className={`relative flex size-9 items-center justify-center rounded-sm ${
                index === 1
                  ? 'bg-[var(--workbench-hover)] text-[var(--foreground)]'
                  : 'text-[var(--workbench-muted)]'
              }`}
            >
              {index === 1 ? (
                <span className="absolute inset-y-1 left-0 w-0.5 rounded-r bg-[var(--workbench-active)]" />
              ) : null}
              <Icon className="size-4" />
            </div>
          ))}
        </aside>

        <aside className="border-r border-[var(--workbench-border)] bg-[var(--workbench-sidebar)]">
          <div className="border-b border-[var(--workbench-border)] px-4 py-3">
            <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--workbench-muted)]">
              {preview.sidebarTitle}
            </div>
          </div>
          <div className="space-y-2 p-3">
            {preview.sidebarItems.map((item, index) => (
              <div
                key={item}
                className={`rounded-sm border px-3 py-2 text-sm ${
                  index === 0
                    ? 'border-[var(--workbench-border)] bg-[var(--workbench-hover)] text-[var(--foreground)]'
                    : 'border-transparent bg-[var(--workbench-editor)] text-[var(--workbench-muted)]'
                }`}
              >
                {item}
              </div>
            ))}
          </div>
        </aside>

        <div className="flex min-w-0 flex-col bg-[var(--workbench-editor)]">
          <div className="border-b border-[var(--workbench-border)] bg-[var(--workbench-tabs)] px-4 py-2 text-xs text-[var(--workbench-muted)]">
            <span className="inline-flex rounded-sm border border-[var(--workbench-border)] bg-[var(--workbench-editor)] px-3 py-1 text-[var(--foreground)]">
              {preview.sessionTitle}
            </span>
          </div>

          <div className="grid flex-1 gap-0 lg:grid-cols-[minmax(0,1fr)_260px]">
            <section className="border-b border-[var(--workbench-border)] px-4 py-4 lg:border-b-0 lg:border-r">
              <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--workbench-muted)]">
                Terminal
              </div>
              <div className="mt-2 text-sm text-[var(--workbench-muted)]">{preview.sessionMeta}</div>
              <div className="mt-4 rounded-sm border border-[var(--workbench-border)] bg-[var(--background)] p-4 font-mono text-[13px] leading-6 text-[var(--foreground)]">
                {preview.terminalLines.map((line) => (
                  <div key={line}>{line}</div>
                ))}
              </div>
            </section>

            <aside className="bg-[var(--workbench-panel)] px-4 py-4">
              <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--workbench-muted)]">
                {preview.panelTitle}
              </div>
              <div className="mt-4 space-y-2">
                {preview.panelItems.map((item) => (
                  <div
                    key={item}
                    className="rounded-sm border border-[var(--workbench-border)] bg-[var(--workbench-editor)] px-3 py-3 text-sm"
                  >
                    {item}
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {preview.quickLabels.slice(2).map((label) => (
                  <span
                    key={label}
                    className="rounded-sm border border-[var(--workbench-border)] bg-[var(--workbench-input)] px-2 py-1 text-xs text-[var(--workbench-muted)]"
                  >
                    {label}
                  </span>
                ))}
              </div>
            </aside>
          </div>

          <div className="flex items-center justify-between bg-[var(--workbench-statusbar)] px-4 py-1.5 text-[11px] text-[var(--workbench-statusbar-foreground)]">
            <span>WinSSH</span>
            <span>{copy.meta.version} {copy.meta.releaseChannel}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
