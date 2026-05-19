import { Search } from 'lucide-react'
import { useLanguage } from '@/lib/language'

const PLACEHOLDER: Record<'zh-CN' | 'en-US', string> = {
  'zh-CN': 'WinSSH · 官方网站',
  'en-US': 'WinSSH · Official Site'
}

export function CommandPalette() {
  const { language } = useLanguage()
  return (
    <div className="vsc-cmd-pill" role="search" aria-label="Command palette">
      <Search size={12} strokeWidth={1.5} aria-hidden="true" />
      <span>{PLACEHOLDER[language]}</span>
      <kbd>⌘P</kbd>
    </div>
  )
}
