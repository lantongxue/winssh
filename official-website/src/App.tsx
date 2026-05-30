import React from 'react'
import { Download, Sparkles } from 'lucide-react'
import { motion } from 'motion/react'
import pkg from '../package.json'

// Subcomponents import
import Header from './components/Header'
import ProductShowcase from './components/ProductShowcase'
import FeatureGallery from './components/FeatureGallery'
import DownloadGuide from './components/DownloadGuide'
import ScrollToTop from './components/ScrollToTop'

export default function App() {
  // Smooth scroll handler helper
  const handleScrollToSection = (id: string) => {
    const el = document.getElementById(id)
    if (el) {
      const headerOffset = 80 // height of navbar
      const elementPosition = el.getBoundingClientRect().top
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      })
    }
  }

  return (
    <div className="min-h-screen bg-[#fafafc] dark:bg-zinc-950 text-gray-800 dark:text-zinc-200 transition-colors duration-200 font-sans selection:bg-cyan-500/20 antialiased overflow-x-hidden">
      {/* 1. Transparent Navbar Header */}
      <Header onScrollToSection={handleScrollToSection} />

      {/* 2. Brand Hero Segment Banner */}
      <main className="relative pt-10 pb-16 md:pt-16 md:pb-24 overflow-hidden border-b border-gray-100 dark:border-zinc-900">
        {/* Abstract glowing backdrop circles */}
        <div className="absolute top-[-20%] left-[-10%] w-[50%] aspect-square bg-cyan-400/10 dark:bg-cyan-500/5 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[55%] aspect-square bg-blue-500/10 dark:bg-blue-600/5 blur-[140px] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center max-w-4xl mx-auto mb-14">
            {/* Super premium top launcher badge */}
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="inline-flex items-center space-x-1.5 bg-cyan-100/60 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border border-cyan-250/20 px-3.5 py-1 text-xs font-bold leading-none select-none mb-6 shrink-0"
            >
              <Sparkles size={11.5} className="animate-spin" />
              <span>全新客户端 v{pkg.version} 全端稳定版正式发布</span>
            </motion.div>

            {/* Main title typography */}
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight text-gray-900 dark:text-white leading-[1.1]"
            >
              <span className="bg-gradient-to-r from-gray-950 to-gray-700 dark:from-white dark:to-zinc-350 bg-clip-text text-transparent">
                终端，本该如此
              </span>
              <br />
              <span className="bg-gradient-to-r from-cyan-600 via-cyan-500 to-blue-500 bg-clip-text text-transparent">
                极简、优雅与高能
              </span>
            </motion.h1>

            {/* Explanatory description lines */}
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="mt-6 text-sm sm:text-base md:text-lg text-gray-500 dark:text-zinc-400 leading-relaxed max-w-2xl mx-auto font-medium"
            >
              WinSSH 专为追求工作流美感的设计型运维与开发极客打造。移植现代 IDE
              体验，完美调度多路会话，让每一次登录都畅行无阻。
            </motion.p>

            {/* CTA anchor buttons */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="mt-8 flex flex-wrap justify-center gap-3.5 select-none"
            >
              <button
                onClick={() => handleScrollToSection('downloads')}
                className="flex items-center space-x-2 bg-gray-900 hover:bg-gray-800 dark:bg-cyan-600 dark:hover:bg-cyan-500 text-white px-5 py-3 text-xs md:text-sm font-bold shadow-md shadow-gray-900/10 transition cursor-pointer"
              >
                <Download size={15} />
                <span>立即免费下载客户端</span>
              </button>
            </motion.div>

            {/* Bold energetic performance showcase declaration banner */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="mt-14 max-w-4xl mx-auto px-4 select-none"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-left">
                {/* Block 1: First "高效" */}
                <div className="relative overflow-hidden bg-white/70 dark:bg-zinc-900/40 backdrop-blur-md border border-gray-150/60 dark:border-zinc-800/50 p-6 transition duration-300 hover:border-cyan-500/30">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-cyan-500/5 to-transparent pointer-events-none" />
                  <span className="text-[10px] font-mono tracking-widest text-cyan-600 dark:text-cyan-400 block mb-1">
                    STAGE 01 . STARTUP
                  </span>
                  <p className="text-xl font-black text-gray-900 dark:text-white tracking-tight leading-none">
                    高效！
                  </p>
                  <p className="text-[11px] text-gray-400 dark:text-zinc-400 mt-2.5 leading-relaxed font-medium">
                    颜值就是第一生产力！
                  </p>
                </div>

                {/* Block 2: Second "高效" */}
                <div className="relative overflow-hidden bg-white/70 dark:bg-zinc-900/40 backdrop-blur-md border border-gray-150/60 dark:border-zinc-800/50 p-6 transition duration-300 hover:border-cyan-500/30">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-cyan-500/5 to-transparent pointer-events-none" />
                  <span className="text-[10px] font-mono tracking-widest text-cyan-600 dark:text-cyan-400 block mb-1">
                    STAGE 02 . TERMINAL
                  </span>
                  <p className="text-xl font-black text-gray-900 dark:text-white tracking-tight leading-none">
                    高效！
                  </p>
                  <p className="text-[11px] text-gray-400 dark:text-zinc-400 mt-2.5 leading-relaxed font-medium">
                    GPU硬抗渲染，60帧丝滑字符屏刷，百万行日志流式加载毫无卡阻。
                  </p>
                </div>

                {/* Block 3: The ultimate statement "还是他妈的高效" */}
                <div className="relative overflow-hidden md:col-span-1 bg-gradient-to-br from-gray-900 to-slate-950 dark:from-zinc-900 dark:to-black p-6 transition duration-300 shadow-lg shadow-cyan-500/5 border border-gray-800 dark:border-zinc-800">
                  <div className="absolute -top-6 -right-6 w-20 h-20 bg-cyan-500/10 blur-xl" />
                  <span className="text-[10px] font-mono tracking-widest text-cyan-400 block mb-1">
                    STAGE 03 . ESSENCE
                  </span>
                  <p className="text-xl font-black text-white tracking-tight leading-none flex items-center gap-1.5">
                    还是他妈的高效
                    <span className="inline-block w-1.5 h-1.5 bg-cyan-400 animate-pulse" />
                  </p>
                  <p className="text-[11px] text-zinc-400 mt-2.5 leading-relaxed font-medium">
                    没有虚荣的功能，只有极致打磨的连接体验，这就是我们唯一的追求。
                  </p>
                </div>
              </div>
            </motion.div>
          </div>

          {/* 3. PRODUCT SHOWCASE SCREEN PORTAL CARD */}
          <div id="showcase" className="max-w-7xl mx-auto pt-4 relative">
            {/* Embedded interactive screenshot dual switcher showcase */}
            <ProductShowcase />
          </div>
        </div>
      </main>

      {/* 4. Core Features Showcase Bento Grid */}
      <FeatureGallery />

      {/* 6. Multi-Platform Download Guides with Auto OS support */}
      <DownloadGuide />

      {/* 9. Polished brand footer */}
      <footer className="bg-gray-50 dark:bg-zinc-950 py-10 border-t border-gray-150 dark:border-zinc-900 select-none text-xs text-gray-400 selection:bg-cyan-500/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-6">
          <div className="flex items-center space-x-2.5">
            <img
              src="/assets/logo.png"
              alt="WinSSH Logo"
              className="w-8 h-8 object-contain shadow-sm"
              referrerPolicy="no-referrer"
            />
            <div>
              <div className="font-bold text-gray-700 dark:text-zinc-350">WinSSH Inc.</div>
              <p className="text-[10px] opacity-75">卓越现代的 SSH 客户端工作流设计所</p>
            </div>
          </div>

          <p className="text-[10px] font-mono opacity-80 mt-1 sm:mt-0 text-center sm:text-right">
            © 2026 WinSSH. All rights reserved. Designed For SSH Security.
          </p>
        </div>
      </footer>

      {/* 10. Scroll To Top Floating Button */}
      <ScrollToTop />
    </div>
  )
}
