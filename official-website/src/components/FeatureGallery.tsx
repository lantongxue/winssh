import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'

const features = [
  {
    src: '/assets/features/winssh-home.png',
    title: '主控面板',
    desc: '清晰全局的工作区'
  },
  {
    src: '/assets/features/winssh-new.png',
    title: '会话管理',
    desc: '清晰有序的主机归建'
  },
  {
    src: '/assets/features/winssh-quick-conn.png',
    title: '悬浮快连',
    desc: '零阻力的一键触达'
  },
  {
    src: '/assets/features/winssh-settings-webdav.png',
    title: '安全云同步',
    desc: '配置数据永不丢失'
  },
  {
    src: '/assets/features/winssh-settings-xterm.png',
    title: '硬核终端配置',
    desc: '释放底层表现潜力'
  },
  {
    src: '/assets/features/winssh-command-panel.png',
    title: '快捷命令集',
    desc: '效率优先的操作流'
  },
  {
    src: '/assets/features/winssh-light.png',
    title: '无界流明主题',
    desc: '日渐护眼的干净亮色'
  }
]

export default function FeatureGallery() {
  const [activeIndex, setActiveIndex] = useState(0)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const handleWheel = (e: WheelEvent) => {
      // Only intercept if we are primarily scrolling vertically
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault()
        container.scrollLeft += e.deltaY
      }
    }

    container.addEventListener('wheel', handleWheel, { passive: false })
    return () => container.removeEventListener('wheel', handleWheel)
  }, [])

  return (
    <section className="py-24 bg-white dark:bg-black border-gray-150 dark:border-zinc-900 relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-cyan-500/5 blur-[120px] pointer-events-none -translate-y-1/2 translate-x-1/3" />
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-blue-500/5 blur-[100px] pointer-events-none translate-y-1/3 -translate-x-1/3" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Heading */}
        <div className="text-center mb-16 max-w-2xl mx-auto">
          <motion.h2
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.6 }}
            className="text-3xl md:text-4xl font-black text-gray-900 dark:text-white tracking-tight mb-4"
          >
            打磨到像素级的工作环境
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-gray-500 dark:text-zinc-400 font-medium md:text-lg"
          >
            无论是终端配色，字体渲染，还是功能面板的位置分配，每一个组件都经过反复调优，只为带来如入无我之境的沉浸感。
          </motion.p>
        </div>

        {/* Main Image Display */}
        <div className="relative w-full bg-gray-50 dark:bg-zinc-900/50 border border-gray-200 dark:border-zinc-800 overflow-hidden mb-8 group mx-auto shadow-sm">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeIndex}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="w-full flex justify-center items-center relative"
            >
              <img
                src={features[activeIndex].src}
                alt={features[activeIndex].title}
                referrerPolicy="no-referrer"
                className="w-full h-auto block mix-blend-multiply dark:mix-blend-normal"
              />
              <div className="absolute bottom-6 left-0 right-0 text-center pointer-events-none">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white bg-white/70 dark:bg-black/70 backdrop-blur-md inline-block px-4 py-1 rounded">
                  {features[activeIndex].title}
                </h3>
                <br />
                <p className="text-sm font-medium text-gray-700 dark:text-zinc-300 bg-white/70 dark:bg-black/70 backdrop-blur-md inline-block px-4 py-1 mt-1 rounded">
                  {features[activeIndex].desc}
                </p>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Thumbnail Carousel */}
        <div
          ref={scrollContainerRef}
          className="flex gap-4 overflow-x-auto pb-6 vscode-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0"
        >
          {features.map((feature, idx) => (
            <button
              key={idx}
              onClick={() => setActiveIndex(idx)}
              className={`relative flex-shrink-0 w-48 sm:w-56 mb-2 aspect-[16/10] overflow-hidden group border transition-all duration-300 outline-none
                ${
                  activeIndex === idx
                    ? 'border-cyan-500 ring-1 ring-cyan-500 ring-offset-2 ring-offset-white dark:ring-offset-black opacity-100'
                    : 'border-gray-200 dark:border-zinc-800 opacity-60 hover:opacity-100 hover:border-cyan-500/50'
                }
              `}
            >
              <img
                src={feature.src}
                alt={feature.title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover object-top mix-blend-multiply dark:mix-blend-normal transition-transform duration-500 group-hover:scale-105"
              />
              <div
                className={`absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-black/80 to-transparent text-left transition-opacity duration-300 ${activeIndex === idx ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
              >
                <p className="text-white text-xs font-medium truncate">{feature.title}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
