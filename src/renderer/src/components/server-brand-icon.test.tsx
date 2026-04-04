import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ServerBrandIcon } from '@/components/server-brand-icon'

describe('ServerBrandIcon', () => {
  it('falls back to the default linux brand icon when no brand is set', () => {
    const { container } = render(<ServerBrandIcon data-testid="brand-icon" />)

    expect(screen.getByTestId('brand-icon')).toBeInTheDocument()
    expect(container.querySelector('svg[data-icon="linux"]')).toBeInTheDocument()
  })

  it('prefers a custom icon over the built-in brand icon', () => {
    const { container } = render(
      <ServerBrandIcon
        brandId="ubuntu"
        customIconDataUrl="data:image/png;base64,AQID"
        data-testid="brand-icon"
      />
    )

    expect(screen.getByTestId('brand-icon').querySelector('img')).toHaveAttribute(
      'src',
      'data:image/png;base64,AQID'
    )
    expect(container.querySelector('svg[data-icon]')).not.toBeInTheDocument()
  })

  it('renders the arch linux brand icon when the server brand is archlinux', () => {
    const { container } = render(<ServerBrandIcon brandId="archlinux" data-testid="brand-icon" />)

    expect(screen.getByTestId('brand-icon')).toBeInTheDocument()
    expect(container.querySelector('svg[data-icon="arch-linux"]')).toBeInTheDocument()
  })
})
