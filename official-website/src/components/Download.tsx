import { motion, AnimatePresence } from "motion/react";
import { Download as DownloadIcon, Command, Monitor, Terminal, Loader2, X, Apple, Cpu, Package } from "lucide-react";
import { useLanguage } from "../i18n/LanguageContext";
import { useState, useEffect } from "react";

interface Asset {
  name: string;
  browser_download_url: string;
}

export function Download() {
  const { t } = useLanguage();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [activeModal, setActiveModal] = useState<'macos' | 'linux' | null>(null);

  useEffect(() => {
    fetch('https://api.github.com/repos/lantongxue/winssh/releases/latest')
      .then(res => res.json())
      .then(data => {
        if (data && Array.isArray(data.assets)) {
          setAssets(data.assets);
        }
      })
      .catch(e => console.error("Error fetching release assets for download", e))
      .finally(() => setLoading(false));
  }, []);

  const getDownloadUrl = (type: 'win' | 'mac-arm' | 'mac-x64' | 'linux-deb' | 'linux-appimage') => {
    let match = "";
    if (type === 'win') match = "-x64-Setup.exe";
    if (type === 'mac-arm') match = "-arm64.dmg";
    if (type === 'mac-x64') match = "-x64.dmg";
    if (type === 'linux-deb') match = "-amd64.deb";
    if (type === 'linux-appimage') match = "-x86_64.AppImage";

    const asset = assets.find(a => a.name.toLowerCase().includes(match.toLowerCase()));
    return asset ? asset.browser_download_url : "#";
  };

  const executeDownload = (url: string, id: string) => {
    if (url && url !== "#") {
      setDownloadingId(id);
      setTimeout(() => {
        window.location.href = url;
        setTimeout(() => {
          setDownloadingId(null);
          setActiveModal(null);
        }, 500);
      }, 1000);
    }
  };

  const platforms = [
    {
      id: 'macos',
      name: "macOS",
      icon: <Command className="w-8 h-8" />,
      desc: t.download.platforms.macos.desc,
      arch: t.download.platforms.macos.arch,
      btnText: t.download.platforms.macos.btn,
      onClick: () => setActiveModal('macos')
    },
    {
      id: 'windows',
      name: "Windows",
      icon: <Monitor className="w-8 h-8" />,
      desc: t.download.platforms.windows.desc,
      arch: t.download.platforms.windows.arch,
      btnText: t.download.platforms.windows.btn,
      onClick: () => executeDownload(getDownloadUrl('win'), 'win')
    },
    {
      id: 'linux',
      name: "Linux",
      icon: <Terminal className="w-8 h-8" />,
      desc: t.download.platforms.linux.desc,
      arch: t.download.platforms.linux.arch,
      btnText: t.download.platforms.linux.btn,
      onClick: () => setActiveModal('linux')
    },
  ];

  return (
    <section id="download" className={`py-32 px-6 relative ${activeModal ? 'z-50' : 'z-10'}`}>
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
         <div className="w-[800px] h-[300px] bg-blue-600/10 blur-[150px] rounded-full mix-blend-screen" />
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="text-center mb-20">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
            className="font-display text-4xl md:text-6xl font-bold tracking-tight mb-6"
          >
            {t.download.titleLevel1} <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">{t.download.titleLevel2}</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="text-neutral-400 text-lg font-light max-w-2xl mx-auto"
          >
            {t.download.desc}
          </motion.p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {platforms.map((platform, i) => (
            <motion.div
              key={platform.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.8, delay: i * 0.15 }}
              className="group flex flex-col p-8 rounded-3xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all hover:-translate-y-1 relative overflow-hidden"
            >
              <div className="text-neutral-300 mb-6 group-hover:text-white transition-colors">
                {platform.icon}
              </div>
              <h3 className="text-2xl font-display font-semibold text-white mb-2">{platform.name}</h3>
              <p className="text-neutral-400 text-sm font-light mb-1">{platform.desc}</p>
              <p className="text-neutral-500 text-xs font-mono mb-8">{platform.arch}</p>
              
              <div className="mt-auto pt-6 border-t border-white/10">
                <button 
                  onClick={platform.onClick}
                  disabled={loading || downloadingId !== null}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-white text-black font-medium hover:bg-neutral-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading || (downloadingId === 'win' && platform.id === 'windows') ? <Loader2 className="w-4 h-4 animate-spin" /> : <DownloadIcon className="w-4 h-4" />}
                  {platform.btnText}
                </button>
              </div>
            </motion.div>
          ))}
        </div>

      </div>

      <AnimatePresence>
        {activeModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveModal(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-neutral-900 border border-white/10 rounded-3xl p-6 shadow-2xl overflow-hidden"
            >
              <button 
                onClick={() => setActiveModal(null)}
                className="absolute top-4 right-4 p-2 text-neutral-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              
              <h3 className="text-2xl font-semibold text-white mb-6">
                {activeModal === 'macos' ? t.download.modalMacTitle : t.download.modalLinuxTitle}
              </h3>
              
              <div className="flex flex-col gap-3">
                {activeModal === 'macos' ? (
                  <>
                    <button 
                      onClick={() => executeDownload(getDownloadUrl('mac-arm'), 'mac-arm')}
                      disabled={downloadingId !== null}
                      className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all text-left group disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="w-12 h-12 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                        {downloadingId === 'mac-arm' ? <Loader2 className="w-6 h-6 animate-spin" /> : <Cpu className="w-6 h-6" />}
                      </div>
                      <div className="flex-1">
                        <div className="text-white font-medium mb-1">{t.download.modalMacAppleSilicon}</div>
                        <div className="text-neutral-500 text-sm">{t.download.modalMacAppleSiliconDesc}</div>
                      </div>
                    </button>
                    <button 
                      onClick={() => executeDownload(getDownloadUrl('mac-x64'), 'mac-x64')}
                      disabled={downloadingId !== null}
                      className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all text-left group disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="w-12 h-12 rounded-full bg-cyan-500/10 text-cyan-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                        {downloadingId === 'mac-x64' ? <Loader2 className="w-6 h-6 animate-spin" /> : <Command className="w-6 h-6" />}
                      </div>
                      <div className="flex-1">
                        <div className="text-white font-medium mb-1">{t.download.modalMacIntel}</div>
                        <div className="text-neutral-500 text-sm">{t.download.modalMacIntelDesc}</div>
                      </div>
                    </button>
                  </>
                ) : (
                  <>
                    <button 
                      onClick={() => executeDownload(getDownloadUrl('linux-deb'), 'linux-deb')}
                      disabled={downloadingId !== null}
                      className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all text-left group disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="w-12 h-12 rounded-full bg-orange-500/10 text-orange-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                        {downloadingId === 'linux-deb' ? <Loader2 className="w-6 h-6 animate-spin" /> : <Package className="w-6 h-6" />}
                      </div>
                      <div className="flex-1">
                        <div className="text-white font-medium mb-1">{t.download.modalLinuxDeb}</div>
                        <div className="text-neutral-500 text-sm">{t.download.modalLinuxDebDesc}</div>
                      </div>
                    </button>
                    <button 
                      onClick={() => executeDownload(getDownloadUrl('linux-appimage'), 'linux-appimage')}
                      disabled={downloadingId !== null}
                      className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all text-left group disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="w-12 h-12 rounded-full bg-purple-500/10 text-purple-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                        {downloadingId === 'linux-appimage' ? <Loader2 className="w-6 h-6 animate-spin" /> : <Terminal className="w-6 h-6" />}
                      </div>
                      <div className="flex-1">
                        <div className="text-white font-medium mb-1">{t.download.modalLinuxAppImage}</div>
                        <div className="text-neutral-500 text-sm">{t.download.modalLinuxAppImageDesc}</div>
                      </div>
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </section>
  );
}
