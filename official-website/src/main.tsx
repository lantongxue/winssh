import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { LanguageProvider } from '@/lib/language'
import { initializeTheme } from '@/lib/theme'
import { detectRoute } from '@/lib/routes'
import { HomePage } from '@/pages/home'
import { DocsPage } from '@/pages/docs'
import { ChangelogPage } from '@/pages/changelog'
import { DownloadPage } from '@/pages/download'
import '@/styles/global.css'

initializeTheme(document.documentElement)

const route = detectRoute()

const PAGE_BY_ROUTE = {
  home: HomePage,
  docs: DocsPage,
  changelog: ChangelogPage,
  download: DownloadPage
} as const

const Page = PAGE_BY_ROUTE[route]

const container = document.getElementById('root')
if (!container) {
  throw new Error('Root container #root not found')
}

createRoot(container).render(
  <StrictMode>
    <LanguageProvider>
      <Page />
    </LanguageProvider>
  </StrictMode>
)
