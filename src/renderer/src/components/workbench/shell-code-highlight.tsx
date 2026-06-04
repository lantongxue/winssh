import { useState, useEffect } from 'react'
import { Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api.js'
import 'monaco-editor/esm/vs/basic-languages/shell/shell.contribution.js'

interface ShellCodeHighlightProps {
  code: string
}

const isTestEnv = typeof process !== 'undefined' && process.env.NODE_ENV === 'test'

export function ShellCodeHighlight({ code }: ShellCodeHighlightProps) {
  const [copied, setCopied] = useState(false)
  const [colorizedHtml, setColorizedHtml] = useState(() => {
    if (isTestEnv) {
      return `<div>${code}</div>`
    }
    return ''
  })

  useEffect(() => {
    if (isTestEnv) {
      return
    }

    let active = true
    monaco.editor.colorize(code, 'shell', {}).then((html) => {
      if (active) {
        setColorizedHtml(html)
      }
    })
    return () => {
      active = false
    }
  }, [code])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback
    }
  }

  return (
    <div className="relative rounded-md border border-[var(--workbench-border)] bg-[var(--workbench-panel)]/30 overflow-hidden text-left">
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--workbench-border)] bg-[var(--workbench-input)]/50">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Shell Integration Script
        </span>
        <Button
          type="button"
          className="size-6 text-muted-foreground hover:text-foreground"
          variant="ghost"
          size="icon"
          onClick={handleCopy}
        >
          {copied ? <Check className="size-3.5 text-green-500" /> : <Copy className="size-3.5" />}
        </Button>
      </div>
      <div className="p-4 overflow-auto max-h-[300px] bg-[var(--workbench-panel)]/20">
        <div
          className="font-mono text-xs leading-5 select-text text-foreground whitespace-pre [&_div]:whitespace-pre"
          dangerouslySetInnerHTML={{ __html: colorizedHtml }}
        />
      </div>
    </div>
  )
}
