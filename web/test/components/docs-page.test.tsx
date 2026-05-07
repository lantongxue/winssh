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

    expect(screen.getByRole('heading', { level: 1, name: /先把产品地图摊开/ })).toBeInTheDocument()
    expect(screen.getAllByText('快速开始').length).toBeGreaterThan(0)
    expect(screen.getAllByText('备份').length).toBeGreaterThan(0)
    expect(screen.getAllByText('安全模型').length).toBeGreaterThan(0)
    expect(screen.getByRole('heading', { level: 3, name: /主题开发摘要/ })).toBeInTheDocument()
    expect(screen.getAllByText(/远端文本文件打开保存/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/WebDAV 备份配置/).length).toBeGreaterThan(0)
    expect(screen.getByText(/官网不会在运行时加载任意主题/)).toBeInTheDocument()
    expect(screen.getByText(/非法主题选择会被归一化回 `system`/)).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: '回顶部' }).every((link) => link.getAttribute('href') === '#docs-top')).toBe(true)
    expect(screen.getByText(/npm run web:dev/)).toBeInTheDocument()
    expect(screen.getByText(/Docs 首版先做有用的前门/)).toBeInTheDocument()
    expect(document.title).toBe('WinSSH 文档')
    expect(document.head.querySelector('meta[name="description"]')?.getAttribute('content')).toMatch(
      /WebDAV 备份恢复/
    )
    expect(document.head.querySelector('meta[name="keywords"]')?.getAttribute('content')).toMatch(
      /主题开发/
    )
  })
})
