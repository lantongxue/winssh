import { AlertCircle, Bell, Check, GitBranch, Info, Radio, Wifi, X } from 'lucide-react'
import { APP_VERSION, REPOSITORY_URL } from '@/lib/constants'
import { useLanguage } from '@/lib/language'

export function StatusBar() {
  const { language } = useLanguage()

  return (
    <footer className="vsc-statusbar" aria-label="status">
      <a
        href={REPOSITORY_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="vsc-status-item"
        title="Open repository"
      >
        <Radio size={12} strokeWidth={1.75} aria-hidden="true" />
        <GitBranch size={12} strokeWidth={1.75} aria-hidden="true" />
        main*
      </a>
      <span className="vsc-status-item is-static">
        <X size={12} strokeWidth={1.75} aria-hidden="true" />0
        <AlertCircle size={12} strokeWidth={1.75} aria-hidden="true" style={{ marginLeft: 8 }} />0
      </span>
      <span className="vsc-status-item is-static">
        <Check size={12} strokeWidth={1.75} aria-hidden="true" />
        {language === 'zh-CN' ? '准备就绪' : 'Ready'}
      </span>
      <span className="vsc-status-spacer" />
      <span className="vsc-status-item is-static" title="Line / column">
        Ln 1, Col 1
      </span>
      <span className="vsc-status-item is-static" title="Indentation">
        {language === 'zh-CN' ? '空格: 2' : 'Spaces: 2'}
      </span>
      <span className="vsc-status-item is-static">UTF-8</span>
      <span className="vsc-status-item is-static">LF</span>
      <span className="vsc-status-item is-static">{language}</span>
      <span className="vsc-status-item is-static" title="Version">
        WinSSH v{APP_VERSION}
      </span>
      <span className="vsc-status-item is-static" aria-label="Online">
        <Wifi size={12} strokeWidth={1.75} aria-hidden="true" />
      </span>
      <span className="vsc-status-item is-static">
        <Info size={12} strokeWidth={1.75} aria-hidden="true" />
      </span>
      <span className="vsc-status-item is-static" aria-label="Notifications">
        <Bell size={12} strokeWidth={1.75} aria-hidden="true" />
      </span>
    </footer>
  )
}
