import { motion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import { useLanguage } from "../i18n/LanguageContext";

export function Hero() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  });

  const { t, lang } = useLanguage();
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "50%"]);
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  return (
    <section ref={containerRef} className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden pt-20">
      {/* Background Glow & Grid */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none flex items-center justify-center">
        {/* Animated Grid */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ 
            opacity: 1,
            backgroundPosition: ["0px 0px", "40px 40px"]
          }}
          transition={{ 
            opacity: { duration: 2 },
            backgroundPosition: { repeat: Infinity, duration: 4, ease: "linear" }
          }}
          className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff20_1px,transparent_1px),linear-gradient(to_bottom,#ffffff20_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_100%_100%_at_50%_30%,#000_60%,transparent_100%)] z-0"
        />

        {/* Animated Orbs */}
        <motion.div 
          animate={{ 
            x: ['-50%', '-20%', '-70%', '-50%'],
            y: ['-50%', '-70%', '-30%', '-50%'],
            scale: [1, 1.2, 0.9, 1]
          }}
          transition={{ repeat: Infinity, duration: 12, ease: "easeInOut" }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-blue-600/40 rounded-full blur-[100px] mix-blend-screen" 
        />
        <motion.div 
          animate={{ 
            x: ['0%', '40%', '-20%', '0%'],
            y: ['0%', '-40%', '20%', '0%'],
            scale: [1, 1.1, 0.8, 1]
          }}
          transition={{ repeat: Infinity, duration: 15, ease: "easeInOut", delay: 1 }}
          className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-purple-600/30 rounded-full blur-[100px] mix-blend-screen" 
        />
        <motion.div 
          animate={{ 
            x: ['0%', '-40%', '20%', '0%'],
            y: ['0%', '40%', '-20%', '0%'],
            scale: [1, 1.3, 0.9, 1]
          }}
          transition={{ repeat: Infinity, duration: 18, ease: "easeInOut", delay: 2 }}
          className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-cyan-600/20 rounded-full blur-[120px] mix-blend-screen" 
        />
      </div>

      <motion.div 
        style={{ y, opacity }}
        className="relative z-10 w-full pt-12 flex flex-col items-center"
      >
        <div className="max-w-7xl mx-auto px-6 flex flex-col items-center text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/5 backdrop-blur-md mb-8"
          >
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-xs font-medium text-neutral-300 tracking-wide uppercase">{t.hero.tagline}</span>
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="font-display text-5xl md:text-7xl lg:text-8xl font-bold tracking-tighter leading-[1.1] md:leading-[1.1] text-transparent bg-clip-text bg-gradient-to-b from-white to-white/40"
          >
            {t.hero.title[0]} <br/> {t.hero.title[1]}
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
        
        <motion.div
           initial={{ opacity: 0, y: 60 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ duration: 1.2, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
           className="mt-20 w-full max-w-[1600px] px-4 sm:px-6 md:px-12"
        >
          <div className="w-full rounded-t-3xl overflow-hidden border border-white/10 border-b-0 shadow-[0_-20px_80px_-20px_rgba(37,99,235,0.2)] bg-[#050505] backdrop-blur-sm">
            <img 
              src={lang === 'zh' ? '/winssh-shell-zh.png' : '/winssh-shell-en.png'}
              alt="WinSSH Main Interface" 
              className="w-full h-auto block object-cover"
              style={{ imageRendering: "high-quality" }}
            />
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}
