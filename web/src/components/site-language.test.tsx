import { fireEvent, render, screen } from '@testing-library/react'
import { SiteLanguageProvider, useSiteLanguage } from '@/components/site-language'
import { SITE_LOCALE_STORAGE_KEY } from '@/lib/language'

function LanguageProbe() {
  const { copy, locale, setLocale } = useSiteLanguage()

  return (
    <div>
      <div>{locale}</div>
      <div>{copy.shell.languageLabel}</div>
      <button type="button" onClick={() => setLocale('zh-CN')}>
        switch
      </button>
    </div>
  )
}

describe('SiteLanguageProvider', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('falls back to the browser language when there is no persisted locale', () => {
    Object.defineProperty(window.navigator, 'language', {
      configurable: true,
      value: 'zh-CN'
    })

    render(
      <SiteLanguageProvider>
        <LanguageProbe />
      </SiteLanguageProvider>
    )

    expect(screen.getByText('zh-CN')).toBeInTheDocument()
    expect(screen.getByText('语言')).toBeInTheDocument()
    expect(window.localStorage.getItem(SITE_LOCALE_STORAGE_KEY)).toBe('zh-CN')
    expect(document.documentElement.lang).toBe('zh-CN')
  })

  it('persists updates when the locale changes', () => {
    render(
      <SiteLanguageProvider initialLocale="en-US">
        <LanguageProbe />
      </SiteLanguageProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: 'switch' }))

    expect(screen.getByText('zh-CN')).toBeInTheDocument()
    expect(window.localStorage.getItem(SITE_LOCALE_STORAGE_KEY)).toBe('zh-CN')
    expect(document.documentElement.lang).toBe('zh-CN')
  })
})
