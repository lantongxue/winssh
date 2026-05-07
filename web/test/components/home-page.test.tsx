import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { HomePage } from '@/components/home-page'
import { SiteLanguageProvider } from '@/components/site-language'
import { SITE_THEME_STORAGE_KEY } from '@/lib/theme'

function mockMatchMedia(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      matches,
      media: '(prefers-color-scheme: dark)',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    }))
  })
}

describe('HomePage', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/')
    window.localStorage.clear()
    mockMatchMedia(false)
  })

  it('renders the major homepage sections in English', () => {
    render(
      <SiteLanguageProvider initialLocale="en-US">
        <HomePage />
      </SiteLanguageProvider>
    )

    expect(screen.getByRole('heading', { level: 1, name: /knowing wink/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /serious tooling, less ceremony/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /installer parade comes next/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /plainly and with a wink/i })).toBeInTheDocument()
    expect(screen.getByText(/open and save remote text files/i)).toBeInTheDocument()
    expect(screen.getByText(/WebDAV backup flows/i)).toBeInTheDocument()
    expect(document.title).toBe('WinSSH')
    expect(document.head.querySelector('meta[name="description"]')?.getAttribute('content')).toMatch(
      /WebDAV backup and restore/i
    )
    expect(document.head.querySelector('meta[name="keywords"]')?.getAttribute('content')).toMatch(
      /SSH client/i
    )
  })

  it('updates the left rail active state when the home hash changes', async () => {
    render(
      <SiteLanguageProvider initialLocale="en-US">
        <HomePage />
      </SiteLanguageProvider>
    )

    expect(screen.getByLabelText('Overview')).toHaveAttribute('aria-current', 'location')

    act(() => {
      window.location.hash = '#features'
      window.dispatchEvent(new HashChangeEvent('hashchange'))
    })

    await waitFor(() => {
      expect(screen.getByLabelText('Features')).toHaveAttribute('aria-current', 'location')
    })

    expect(screen.getByLabelText('Overview')).not.toHaveAttribute('aria-current')
  })

  it('follows the system theme by default and supports manual switching', async () => {
    mockMatchMedia(true)

    render(
      <SiteLanguageProvider initialLocale="en-US">
        <HomePage />
      </SiteLanguageProvider>
    )

    expect(document.documentElement.dataset.theme).toBe('winssh.dark-plus')
    expect(document.documentElement.dataset.themeSelection).toBe('system')

    fireEvent.click(screen.getByRole('button', { name: 'Light+' }))

    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe('winssh.light-plus')
    })

    expect(document.documentElement.dataset.themeSelection).toBe('winssh.light-plus')
    expect(window.localStorage.getItem(SITE_THEME_STORAGE_KEY)).toBe('winssh.light-plus')
  })
})
