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

        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="mt-20 w-full max-w-[1600px] px-4 sm:px-6 md:px-12 group cursor-default"
        >
          <div className="relative w-full rounded-[24px] overflow-hidden shadow-[0_0_80px_-20px_rgba(37,99,235,0.2)] p-[3px] transition-all duration-700 ease-out group-hover:-translate-y-6 group-hover:shadow-[0_40px_100px_-20px_rgba(59,130,246,0.4)]">
            {/* Fluid glowing border animation */}
            <div className="absolute top-1/2 left-1/2 w-[150%] h-[300%] -translate-x-1/2 -translate-y-1/2 bg-[conic-gradient(from_0deg_at_50%_50%,transparent_0%,transparent_25%,rgba(96,165,250,0.9)_50%,transparent_50%,transparent_75%,rgba(96,165,250,0.9)_100%)] animate-[spin_4s_linear_infinite] opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />

            {/* Inner Content Block */}
            <div className="relative w-full h-full rounded-[21px] overflow-hidden border border-white/10 group-hover:border-transparent transition-colors duration-500">
              <img
                src={lang === 'zh' ? '/winssh-shell-zh.png' : '/winssh-shell-en.png'}
                alt="WinSSH Main Interface"
                className="w-full h-auto block object-cover"
                style={{ imageRendering: "high-quality" }}
              />
            </div>
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}
