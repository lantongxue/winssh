/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Navbar } from './components/Navbar'
import { Hero } from './components/Hero'
import { Features } from './components/Features'
import { CrossPlatform } from './components/CrossPlatform'
import { Download } from './components/Download'
import { Changelog } from './components/Changelog'
import { Footer } from './components/Footer'
import { ScrollToTop } from './components/ScrollToTop'
import { LanguageProvider } from './i18n/LanguageContext'

export default function App() {
  return (
    <LanguageProvider>
      <div className="min-h-screen bg-[#030303] text-white selection:bg-white/20 selection:text-white font-sans">
        <Navbar />
        <main>
          <Hero />
          <Features />
          <CrossPlatform />
          <Download />
          <Changelog />
        </main>
        <Footer />
        <ScrollToTop />
      </div>
    </LanguageProvider>
  )
}
