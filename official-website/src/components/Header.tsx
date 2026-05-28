import { useState } from 'react';
import { Download, Menu, X } from 'lucide-react';
import pkg from '../../package.json';

interface HeaderProps {
  onScrollToSection: (sectionId: string) => void;
}

export default function Header({ onScrollToSection }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [telemetryState] = useState<'healthy' | 'checking'>('healthy');

  const navItems = [
    { label: '核心优势', target: 'features' },
    { label: '产品界面', target: 'showcase' },
    { label: '下载指引', target: 'downloads' },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-gray-100 dark:border-zinc-850/80 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Logo and Brand Title */}
        <div 
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="flex items-center space-x-2.5 cursor-pointer select-none group"
        >
          <img 
            src="/assets/logo.png" 
            alt="WinSSH Logo" 
            className="w-9 h-9 object-contain shadow-md shadow-cyan-500/10 group-hover:scale-105 transition-all"
            referrerPolicy="no-referrer"
          />
          <div>
            <div className="text-md font-bold tracking-tight text-gray-900 dark:text-gray-100 flex items-center">
              <span>WinSSH</span>
              <span className="ml-1 px-1.5 py-0.5 bg-cyan-100 dark:bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 text-[10px] font-bold">Active Client</span>
            </div>
            <p className="text-[10px] text-gray-400 font-mono tracking-wider">MODERN SECURE SHELL</p>
          </div>
        </div>

        {/* Desktop Navigation Links Container */}
        <nav className="hidden md:flex items-center space-x-6">
          {navItems.map((item) => (
            <button
              key={item.target}
              onClick={() => onScrollToSection(item.target)}
              className="text-xs font-semibold text-gray-600 hover:text-cyan-600 dark:text-zinc-350 dark:hover:text-cyan-400 transition cursor-pointer"
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* Action Widgets Group */}
        <div className="hidden md:flex items-center space-x-4">

          <button
            onClick={() => onScrollToSection('downloads')}
            className="flex items-center space-x-1.5 bg-gray-900 hover:bg-gray-800 dark:bg-cyan-600 dark:hover:bg-cyan-500 text-white px-3.5 py-1.5 text-xs font-semibold tracking-wide transition shadow-sm cursor-pointer"
          >
            <Download size={13} />
            <span>免费下载 WinSSH</span>
          </button>
        </div>

        {/* Mobile Hamburger menu */}
        <div className="flex items-center md:hidden space-x-2">
          <button
            onClick={() => onScrollToSection('downloads')}
            className="bg-cyan-600 p-1.5 text-white hover:bg-cyan-500 transition cursor-pointer"
            title="下载"
          >
            <Download size={15} />
          </button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 border border-gray-200 dark:border-zinc-800 text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-900 transition cursor-pointer"
          >
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

      </div>

      {/* Mobile Drawer Slide-open menu bar */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-gray-100 dark:border-zinc-850 px-4 py-4 space-y-3.5 bg-white dark:bg-zinc-950 transition-all select-none">
          <div className="flex flex-col space-y-2">
            {navItems.map((item) => (
              <button
                key={item.target}
                onClick={() => {
                  onScrollToSection(item.target);
                  setMobileMenuOpen(false);
                }}
                className="text-left w-full py-2.5 px-3 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:text-zinc-350 dark:hover:bg-zinc-900 dark:hover:text-white transition cursor-pointer"
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="pt-3 border-t border-gray-100 dark:border-zinc-850 flex flex-col space-y-3">
            <div className="flex items-center justify-between text-xs px-3">
              <span className="text-gray-400">网络连接指纹:</span>
              <span className="font-mono text-[10px] text-emerald-500 font-bold">● V{pkg.version} HEALTHY</span>
            </div>
            <button
              onClick={() => {
                onScrollToSection('downloads');
                setMobileMenuOpen(false);
              }}
              className="flex items-center justify-center space-x-2 bg-gray-900 dark:bg-cyan-600 hover:bg-gray-800 text-white py-2.5 text-xs font-semibold transition shadow-sm cursor-pointer"
            >
              <Download size={14} />
              <span>立即下载客户端</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
