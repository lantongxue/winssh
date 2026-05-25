import { APP_VERSION } from '@/lib/constants'
import { useLanguage } from '@/lib/language'
import { SITE_COPY } from '@/content/site'
import { withBasePath } from '@/lib/paths'
import { CommandPalette } from './command-palette'
import { ThemeToggle } from './theme-toggle'
import { LanguageToggle } from './language-toggle'

export function Titlebar() {
  const { language } = useLanguage()
  const copy = SITE_COPY[language]

  return (
    <header className="vsc-titlebar">
      <div className="vsc-titlebar-left">
        <span className="vsc-brand">
          <img
            src={withBasePath('icon.png')}
            alt=""
            className="vsc-brand-logo"
            width={20}
            height={20}
            decoding="async"
          />
          <span className="vsc-brand-name">{copy.brand}</span>
          <span className="vsc-brand-version">v{APP_VERSION}</span>
        </span>
      </div>
      <div className="vsc-titlebar-center">
        <CommandPalette />
      </div>
      <div className="vsc-titlebar-right">
        <ThemeToggle />
        <LanguageToggle />
      </div>
    </header>
  )
}
