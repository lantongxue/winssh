import { motion } from "motion/react";
import { Github, Star } from "lucide-react";
import { useLanguage } from "../i18n/LanguageContext";
import { LanguageToggle } from "./LanguageToggle";
import { useEffect, useState } from "react";

export function Navbar() {
  const { t } = useLanguage();
  const [stars, setStars] = useState<number | null>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    fetch('https://api.github.com/repos/lantongxue/winssh')
      .then(res => res.json())
      .then(data => {
        if (typeof data.stargazers_count === 'number') {
          setStars(data.stargazers_count);
        }
      })
      .catch((e) => console.log('Error fetching stars', e));
  }, []);

  return (
    <motion.nav 
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-4 transition-all duration-500 ${
        scrolled ? "bg-black/40 backdrop-blur-xl border-b border-white/5 py-4" : "bg-transparent py-6 mix-blend-difference"
      }`}
    >
      <div className="flex items-center gap-2">
        <img src="/logo.png" alt="WinSSH Logo" className="w-8 h-8 object-contain" />
        <span className="font-display font-medium text-xl tracking-tight text-white">WinSSH</span>
      </div>
      <div className="hidden md:flex items-center gap-8 text-sm font-medium text-neutral-400">
        <a href="#features" className="hover:text-white transition-colors">{t.nav.features}</a>
        <a href="#sync" className="hover:text-white transition-colors">{t.nav.sync}</a>
        <a href="#download" className="hover:text-white transition-colors">{t.nav.download}</a>
        <a href="#changelog" className="hover:text-white transition-colors">{t.nav.changelog}</a>
      </div>
      <div className="flex items-center gap-4">
        <LanguageToggle />
        <a 
          href="https://github.com/lantongxue/winssh"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2 bg-white text-black font-medium text-sm rounded-full hover:bg-neutral-200 transition-colors"
        >
          <Github className="w-4 h-4" />
          <span className="hidden sm:inline">GitHub</span>
          {stars !== null && (
            <div className="flex items-center gap-1 sm:ml-1 sm:pl-3 sm:border-l border-black/10">
              <Star className="w-3.5 h-3.5" />
              <span>{stars}</span>
            </div>
          )}
        </a>
      </div>
    </motion.nav>
  );
}

