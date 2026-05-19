import { useLanguage, type LanguageCode } from '@/lib/language'
import { SITE_COPY } from '@/content/site'

const LABELS: Record<LanguageCode, string> = {
  'zh-CN': '中文',
  'en-US': 'EN'
}

export function LanguageToggle() {
  const { language, setLanguage, supported } = useLanguage()
  const copy = SITE_COPY[language]

  return (
    <div className="vsc-toggle-group" role="radiogroup" aria-label={copy.titlebar.languageLabel}>
      {supported.map((code) => (
        <button
          key={code}
          type="button"
          role="radio"
          aria-checked={language === code}
          className={language === code ? 'is-active' : ''}
          onClick={() => setLanguage(code)}
        >
          {LABELS[code]}
        </button>
      ))}
    </div>
  )
}
