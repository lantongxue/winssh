import { motion } from 'motion/react'
import { useLanguage } from '../i18n/LanguageContext'

export function Hero() {
  const { t, lang } = useLanguage()

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden pt-20">
      {/* Background Glow & Grid */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none flex items-center justify-center">
        {/* Grid Background */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 2 }}
          className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff20_1px,transparent_1px),linear-gradient(to_bottom,#ffffff20_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_100%_100%_at_50%_30%,#000_60%,transparent_100%)] z-0"
        />

        {/* Static Orbs — radial-gradient instead of filter:blur for GPU performance */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full mix-blend-screen"
          style={{
            background:
              'radial-gradient(circle, transparent 30%, rgba(37,99,235,0.4) 70%, transparent 100%)'
          }}
        />
        <div
          className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full mix-blend-screen"
          style={{
            background:
              'radial-gradient(circle, transparent 30%, rgba(147,51,234,0.3) 70%, transparent 100%)'
          }}
        />
        <div
          className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] rounded-full mix-blend-screen"
          style={{
            background:
              'radial-gradient(circle, transparent 25%, rgba(8,145,178,0.2) 70%, transparent 100%)'
          }}
        />
      </div>

      <div className="relative z-10 w-full pt-12 flex flex-col items-center">
        <div className="max-w-7xl mx-auto px-6 flex flex-col items-center text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/5 backdrop-blur-md mb-8"
          >
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-xs font-medium text-neutral-300 tracking-wide uppercase">
              {t.hero.tagline}
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="font-display text-5xl md:text-7xl lg:text-8xl font-bold tracking-tighter leading-[1.1] md:leading-[1.1]"
          >
            <span className="text-transparent bg-clip-text bg-gradient-to-br from-white via-blue-100 to-white/30 animate-[gradient_8s_ease_infinite] bg-[length:200%_200%]">
              {t.hero.title[0]} <br /> {t.hero.title[1]}
            </span>
            <span className="inline-block ml-[8px] md:ml-[12px] w-[14px] md:w-[20px] lg:w-[24px] h-[0.8em] bg-blue-400 shadow-[0_0_20px_rgba(96,165,250,0.8)] animate-[pulse_1s_cubic-bezier(0.4,0,0.6,1)_infinite] rounded-[1px]" />
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="mt-8 text-neutral-400 text-lg md:text-xl max-w-2xl font-light leading-relaxed"
          >
            {t.hero.desc}
          </motion.p>
        </div>

        <div className="mt-20 w-full max-w-[1600px] px-4 sm:px-6 md:px-12">
          <div className="relative w-full rounded-[24px] overflow-hidden shadow-[0_0_80px_-20px_rgba(37,99,235,0.2)] p-[3px]">
            {/* Inner Content Block */}
            <div className="relative w-full h-full rounded-[21px] overflow-hidden border border-white/10">
              <img
                src={lang === 'zh' ? '/winssh-shell-zh.png' : '/winssh-shell-en.png'}
                alt="WinSSH Main Interface"
                className="w-full h-auto block object-cover"
                style={{ imageRendering: 'high-quality' }}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
