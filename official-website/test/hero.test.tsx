import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LanguageProvider } from '@/lib/language'
import { HomePage } from '@/pages/home'

function renderInProvider(node: React.ReactNode) {
  return render(<LanguageProvider>{node}</LanguageProvider>)
}

describe('HomePage', () => {
  it('renders the workbench shell and welcome tab', () => {
    renderInProvider(<HomePage />)
    expect(screen.getByRole('navigation')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
  })
})
