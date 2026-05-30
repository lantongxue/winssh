import { useState, useEffect } from 'react'
import { Download, Laptop } from 'lucide-react'
import { DOWNLOADS } from '../data'
import { DownloadPlatform } from '../types'

export default function DownloadGuide() {
  const [activeOS, setActiveOS] = useState<'mac' | 'windows' | 'linux'>('mac')
  const [detectedOS, setDetectedOS] = useState<'mac' | 'windows' | 'linux' | null>(null)

  // Simple auto OS detection on mount
  useEffect(() => {
    const userAgent = window.navigator.userAgent.toLowerCase()
    if (userAgent.includes('mac')) {
      setDetectedOS('mac')
      setActiveOS('mac')
    } else if (userAgent.includes('win')) {
      setDetectedOS('windows')
      setActiveOS('windows')
    } else if (userAgent.includes('linux')) {
      setDetectedOS('linux')
      setActiveOS('linux')
    }
  }, [])

  const filteredPlatforms = DOWNLOADS.filter((p) => p.os === activeOS)

  return (
    <section
      id="downloads"
      className="py-16 md:py-24 bg-gray-50 dark:bg-zinc-900 transition-colors duration-200 selection:bg-cyan-500/20"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Title */}
        <div className="max-w-3xl mx-auto text-center mb-12">
          <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-widest bg-cyan-100/60 dark:bg-cyan-500/10 px-3 py-1">
            多端一致，快捷分发
          </span>
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100 mt-3">
            极速获取 WinSSH 桌面客户端
          </h2>
          <p className="text-sm text-gray-500 dark:text-zinc-400 mt-4 leading-relaxed">
            支持原生跨平台运作速度，提供极简的 GUI 双击安装包以及符合 DevOps
            习惯的命令行包管理器服务。
          </p>

          {detectedOS && (
            <div className="mt-5.5 inline-flex items-center space-x-2 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 px-4 py-1.5 text-xs text-cyan-700 dark:text-cyan-400 font-medium">
              <Laptop size={13.5} />
              <span>
                系统识别：智能为您推荐{' '}
                <strong>
                  {detectedOS === 'mac' ? 'macOS' : detectedOS === 'windows' ? 'Windows' : 'Linux'}
                </strong>{' '}
                安装包
              </span>
            </div>
          )}
        </div>

        {/* Tab switcher navigation */}
        <div className="flex justify-center mb-10 select-none">
          <div className="p-1 bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 flex space-x-1">
            <button
              onClick={() => setActiveOS('mac')}
              className={`px-6 py-2 text-xs font-bold transition cursor-pointer ${
                activeOS === 'mac'
                  ? 'bg-gray-900 dark:bg-cyan-600 text-white shadow'
                  : 'text-gray-500 dark:text-zinc-400 hover:text-gray-950'
              }`}
            >
              macOS
            </button>
            <button
              onClick={() => setActiveOS('windows')}
              className={`px-6 py-2 text-xs font-bold transition cursor-pointer ${
                activeOS === 'windows'
                  ? 'bg-gray-900 dark:bg-cyan-600 text-white shadow'
                  : 'text-gray-500 dark:text-zinc-400 hover:text-gray-950'
              }`}
            >
              Windows
            </button>
            <button
              onClick={() => setActiveOS('linux')}
              className={`px-6 py-2 text-xs font-bold transition cursor-pointer ${
                activeOS === 'linux'
                  ? 'bg-gray-900 dark:bg-cyan-600 text-white shadow'
                  : 'text-gray-500 dark:text-zinc-400 hover:text-gray-950'
              }`}
            >
              Linux (deb/AppImage)
            </button>
          </div>
        </div>

        {/* Download Grid Panel Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6.5 max-w-4xl mx-auto">
          {filteredPlatforms.map((pt) => {
            const isRecommended = detectedOS === pt.os
            return (
              <div
                key={pt.id}
                className={`bg-white dark:bg-zinc-950 border p-6.5 hover:shadow-lg transition duration-300 flex flex-col justify-between relative ${
                  isRecommended
                    ? 'border-cyan-500/40 dark:border-cyan-500/30'
                    : 'border-gray-200 dark:border-zinc-800/80'
                }`}
              >
                {isRecommended && (
                  <span className="absolute -top-3 left-6 px-3.5 py-1 bg-cyan-600 text-white text-[10px] font-bold uppercase tracking-wider shadow">
                    此系统推荐
                  </span>
                )}

                <div>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-md font-bold text-gray-900 dark:text-gray-100 flex items-center space-x-1">
                        <span>{pt.name}</span>
                      </h3>
                      <p className="text-[10.5px] text-gray-400 mt-1 font-mono">
                        {pt.architecture}
                      </p>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 bg-gray-100 dark:bg-zinc-850 hover:bg-gray-200 text-gray-500 dark:text-zinc-400 font-mono">
                      {pt.version}
                    </span>
                  </div>

                  {/* Size and specs fields */}
                  <div className="grid grid-cols-2 gap-4 py-3 pb-4 border-y border-gray-100 dark:border-zinc-850 text-xs mb-5">
                    <div>
                      <span className="text-gray-400 block text-[10px] uppercase font-bold tracking-wide">
                        存储积体
                      </span>
                      <span className="font-semibold text-gray-700 dark:text-zinc-300 font-mono">
                        {pt.fileSize}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[10px] uppercase font-bold tracking-wide">
                        包形式
                      </span>
                      <span className="font-semibold text-gray-700 dark:text-zinc-300 font-mono">
                        {pt.fileFormat}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3.5">
                  {/* High converter download button */}
                  <button
                    onClick={() =>
                      alert(
                        `您正在模拟下载【${pt.name}】安装包...\n这会激活标准二进制包分发流程，包含 SHA256 加密验证。`
                      )
                    }
                    className="w-full flex items-center justify-center space-x-2 bg-gray-900 hover:bg-gray-800 dark:bg-cyan-600 dark:hover:bg-cyan-500 text-white font-bold py-2 px-4 text-xs tracking-wider shadow transition"
                  >
                    <Download size={13} />
                    <span>立即免费下载 dmg/exe 安装包</span>
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Safety instruction note */}
        <div className="max-w-xl mx-auto mt-12 text-center text-[11px] text-gray-400 bg-white dark:bg-zinc-950 border border-gray-150 dark:border-zinc-850 px-4 py-3">
          💡 <strong>安全性声明：</strong> WinSSH
          官方承诺所有架构的分发文件均在本地沙箱进行安全验证，没有任何外部服务器上传行迹，您可以安全放心地连接生产数据库和跳板堡垒节点。
        </div>
      </div>
    </section>
  )
}
