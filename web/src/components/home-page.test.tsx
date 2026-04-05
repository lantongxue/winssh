import { act, render, screen, waitFor } from '@testing-library/react'
import { HomePage } from '@/components/home-page'
import { SiteLanguageProvider } from '@/components/site-language'

describe('HomePage', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/')
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
    expect(document.title).toBe('WinSSH')
    expect(document.head.querySelector('meta[name="description"]')?.getAttribute('content')).toMatch(
      /cross-platform desktop SSH client/i
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
})
