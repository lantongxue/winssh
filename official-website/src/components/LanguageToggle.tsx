import { useLanguage } from '../i18n/LanguageContext'

export function LanguageToggle() {
  const { lang, setLang } = useLanguage()

  return (
    <button
      onClick={() => setLang(lang === 'en' ? 'zh' : 'en')}
      className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-neutral-400 hover:text-white hover:bg-white/10 transition-colors text-xs font-semibold cursor-pointer"
    >
      <span className={lang === 'en' ? 'text-white' : 'text-neutral-500 transition-colors'}>
        EN
      </span>
      <span className="text-neutral-600 font-normal">/</span>
      <span className={lang === 'zh' ? 'text-white' : 'text-neutral-500 transition-colors'}>
        中
      </span>
    </button>
  )
}
