import { render, screen } from '@testing-library/react'
import { DocsPage } from '@/components/docs-page'
import { SiteLanguageProvider } from '@/components/site-language'

describe('DocsPage', () => {
  it('renders the docs landing sections in Chinese', () => {
    render(
      <SiteLanguageProvider initialLocale="zh-CN">
        <DocsPage />
      </SiteLanguageProvider>
    )

    expect(screen.getByRole('heading', { level: 1, name: /先把产品地图立起来/ })).toBeInTheDocument()
    expect(screen.getAllByText('快速开始').length).toBeGreaterThan(0)
    expect(screen.getAllByText('安全模型').length).toBeGreaterThan(0)
    expect(screen.getByText(/Docs 首版不是空白页/)).toBeInTheDocument()
  })
})
