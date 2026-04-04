import type { SiteLocale } from '@/lib/language'

export function LanguageToggle({
  currentLocale,
  label,
  onChange
}: {
  currentLocale: SiteLocale
  label: string
  onChange: (locale: SiteLocale) => void
}) {
  const options: Array<{ label: string; value: SiteLocale }> = [
    { label: 'EN', value: 'en-US' },
    { label: '中文', value: 'zh-CN' }
  ]

  return (
    <div className="flex items-center gap-2">
      <span className="hidden text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--workbench-muted)] sm:inline">
        {label}
      </span>
      <div className="flex rounded-sm border border-[var(--workbench-border)] bg-[var(--workbench-input)] p-0.5">
        {options.map((option) => {
          const active = option.value === currentLocale

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
