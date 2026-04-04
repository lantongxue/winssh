import { render, screen, waitFor } from '@testing-library/react'
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

    expect(screen.getByRole('heading', { level: 1, name: /ssh workbench with a wink/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /everything important stays inside the session flow/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /beta channels are defined/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /what the first public site should set clearly/i })).toBeInTheDocument()
  })

  it('updates the left rail active state when the home hash changes', async () => {
    render(
      <SiteLanguageProvider initialLocale="en-US">
        <HomePage />
      </SiteLanguageProvider>
    )

    expect(screen.getByLabelText('Overview')).toHaveAttribute('aria-current', 'location')

    window.location.hash = '#features'
    window.dispatchEvent(new HashChangeEvent('hashchange'))

    await waitFor(() => {
      expect(screen.getByLabelText('Features')).toHaveAttribute('aria-current', 'location')
    })

    expect(screen.getByLabelText('Overview')).not.toHaveAttribute('aria-current')
  })
})
