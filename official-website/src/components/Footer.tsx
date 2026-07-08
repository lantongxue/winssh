import { useLanguage } from '../i18n/LanguageContext'

export function Footer() {
  const { t } = useLanguage()
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-white/10 bg-black/50 backdrop-blur-lg pt-20 pb-10 px-6 mt-20 relative z-10">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start gap-12">
        <div>
          <div className="flex items-center gap-2 mb-6">
            <img src="/logo.png" alt="WinSSH Logo" className="w-6 h-6 object-contain" />
            <span className="font-display font-medium text-lg tracking-tight text-white">
              WinSSH
            </span>
          </div>
          <p className="text-neutral-500 max-w-sm text-sm font-light leading-relaxed">
            {t.footer.desc}
          </p>
        </div>

        <div className="flex gap-16">
          <div className="flex flex-col gap-4">
            <h4 className="text-white font-medium mb-2">{t.footer.product}</h4>
            <a
              href="#download"
              className="text-neutral-500 text-sm hover:text-white transition-colors"
            >
              {t.footer.dl}
            </a>
            <a
              href="#changelog"
              className="text-neutral-500 text-sm hover:text-white transition-colors"
            >
              {t.footer.changelog}
            </a>
          </div>
          <div className="flex flex-col gap-4">
            <h4 className="text-white font-medium mb-2">{t.footer.resources}</h4>
            <a
              href="https://github.com/lantongxue/winssh"
              target="_blank"
              rel="noopener noreferrer"
              className="text-neutral-500 text-sm hover:text-white transition-colors"
            >
              {t.footer.community}
            </a>
            <a
              href="https://github.com/lantongxue/winssh"
              target="_blank"
              rel="noopener noreferrer"
              className="text-neutral-500 text-sm hover:text-white transition-colors"
            >
              {t.footer.github}
            </a>
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto mt-20 pt-8 border-t border-white/10 text-center md:text-left flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-neutral-600">
        <p>{t.footer.copyright.replace('{year}', year.toString())}</p>
        <div className="flex gap-4">
          <span>{t.footer.slogan}</span>
        </div>
      </div>
    </footer>
  )
}
