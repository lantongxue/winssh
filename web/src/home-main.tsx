import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HomePage } from '@/components/home-page'
import { SiteLanguageProvider } from '@/components/site-language'
import { initializeSiteTheme } from '@/lib/theme'
import '@/styles.css'

initializeSiteTheme(document.documentElement)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SiteLanguageProvider>
      <HomePage />
    </SiteLanguageProvider>
  </StrictMode>
)
