import { motion, useScroll, useTransform } from 'motion/react'
import { useRef } from 'react'
import { Cloud, HardDrive, Laptop } from 'lucide-react'
import { useLanguage } from '../i18n/LanguageContext'

export function CrossPlatform() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start']
  })

  const { t } = useLanguage()
  const scale = useTransform(scrollYProgress, [0, 0.5], [0.8, 1])
  const opacity = useTransform(scrollYProgress, [0, 0.3], [0, 1])

  return (
    <section id="sync" ref={containerRef} className="py-32 px-6 relative overflow-hidden">
      {/* Background glow for this section */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div className="w-[1000px] h-[400px] bg-cyan-600/10 blur-[150px] rounded-full mix-blend-screen" />
      </div>

      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-16 relative z-10">
        <div className="flex-1 space-y-8">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 flex items-center justify-center mb-6 text-cyan-400 border border-cyan-500/20">
              <Cloud className="w-6 h-6" />
            </div>
            <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tight mb-6">
              {t.sync.titleLevel1} <br />
              <span className="text-neutral-500">{t.sync.titleLevel2}</span>
            </h2>
            <p className="text-neutral-400 text-lg font-light leading-relaxed mb-8">
              {t.sync.desc}
            </p>

            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-4 text-neutral-300">
                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                  <Laptop className="w-4 h-4" />
                </div>
                <span>{t.sync.desktop}</span>
              </div>
              <div className="flex items-center gap-4 text-neutral-300">
                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                  <HardDrive className="w-4 h-4" />
                </div>
                <span>{t.sync.webdav}</span>
              </div>
            </div>
          </motion.div>
        </div>

        <motion.div
          style={{ scale, opacity }}
          className="flex-1 relative w-full max-w-[500px] md:max-w-auto"
        >
          <div className="aspect-square md:aspect-[4/3] rounded-3xl bg-gradient-to-br from-white/10 to-transparent border border-white/10 p-1 flex items-center justify-center backdrop-blur-sm relative overflow-hidden">
            {/* Abstract Representation of Sync */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />

            <div className="relative z-10 flex gap-4 items-center scale-75 md:scale-100">
              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
                className="w-24 h-32 bg-white/10 rounded-xl border border-white/20 backdrop-blur-md flex items-center justify-center p-4"
              >
                <div className="w-full h-full flex flex-col gap-2 opacity-80">
                  <div className="flex-1 border border-white/20 rounded-md bg-white/5 flex items-center px-2">
                    <div className="w-2 h-2 rounded-full bg-cyan-400" />
                  </div>
                  <div className="flex-1 border border-white/20 rounded-md bg-white/5 flex items-center px-2">
                    <div className="w-2 h-2 rounded-full bg-green-400" />
                  </div>
                  <div className="flex-1 border border-white/20 rounded-md bg-white/5 flex items-center px-2">
                    <div className="w-2 h-2 rounded-full bg-neutral-400" />
                  </div>
                </div>
              </motion.div>

              <div className="w-16 md:w-32 h-[1px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent relative">
                <motion.div
                  animate={{ x: [0, 64], opacity: [0, 1, 0] }}
                  transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
                  className="absolute top-1/2 -translate-y-1/2 left-0 w-2 h-2 bg-cyan-400 rounded-full shadow-[0_0_10px_rgba(34,211,238,0.8)] md:hidden"
                />
                <motion.div
                  animate={{ x: [0, 128], opacity: [0, 1, 0] }}
                  transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
                  className="absolute top-1/2 -translate-y-1/2 left-0 w-2 h-2 bg-cyan-400 rounded-full shadow-[0_0_10px_rgba(34,211,238,0.8)] hidden md:block"
                />
              </div>

              <motion.div
                animate={{ y: [0, 10, 0] }}
                transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut', delay: 1 }}
                className="w-48 h-32 bg-white/10 rounded-xl border border-white/20 backdrop-blur-md flex flex-col items-center justify-center shadow-2xl"
              >
                <Laptop className="w-10 h-10 text-neutral-300 mb-2" />
                <div className="w-2/3 h-2 bg-white/20 rounded-full" />
              </motion.div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
