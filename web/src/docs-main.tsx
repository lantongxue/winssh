import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { DocsPage } from '@/components/docs-page'
import { SiteLanguageProvider } from '@/components/site-language'
import { applyLightPlusTheme } from '@/lib/theme'
import '@/styles.css'

applyLightPlusTheme(document.documentElement)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SiteLanguageProvider>
      <DocsPage />
    </SiteLanguageProvider>
  </StrictMode>
)
