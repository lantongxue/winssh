import {
  SITE_DARK_THEME_ID,
  SITE_LIGHT_THEME_ID,
  SITE_THEME_SYSTEM,
  type SiteThemeSelection
} from '@/lib/theme'

export function ThemeToggle({
  currentSelection,
  label,
  onChange,
  darkLabel,
  lightLabel,
  systemLabel
}: {
  currentSelection: SiteThemeSelection
  label: string
  onChange: (selection: SiteThemeSelection) => void
  darkLabel: string
  lightLabel: string
  systemLabel: string
}) {
  const options: Array<{ label: string; value: SiteThemeSelection }> = [
    { label: systemLabel, value: SITE_THEME_SYSTEM },
    { label: lightLabel, value: SITE_LIGHT_THEME_ID },
    { label: darkLabel, value: SITE_DARK_THEME_ID }
  ]

  return (
    <div className="flex items-center gap-2">
      <span className="hidden text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--workbench-muted)] xl:inline">
        {label}
      </span>
      <div className="flex rounded-sm border border-[var(--workbench-border)] bg-[var(--workbench-input)] p-0.5">
        {options.map((option) => {
          const active = option.value === currentSelection

          return (
            <button
              key={option.value}
              type="button"
              className={`rounded-[2px] px-2.5 py-1 text-xs transition-colors ${
                active
                  ? 'bg-[var(--workbench-active)] text-[var(--primary-foreground)]'
                  : 'text-[var(--workbench-muted)] hover:bg-[var(--workbench-hover)] hover:text-[var(--foreground)]'
              }`}
              onClick={() => onChange(option.value)}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
