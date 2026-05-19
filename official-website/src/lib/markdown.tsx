import type { ReactNode } from 'react'

interface InlineToken {
  type: 'text' | 'link' | 'code'
  value: string
  href?: string
}

function parseInline(line: string): ReactNode[] {
  const tokens: InlineToken[] = []
  let cursor = 0
  const len = line.length

  while (cursor < len) {
    if (line[cursor] === '`') {
      const end = line.indexOf('`', cursor + 1)
      if (end !== -1) {
        tokens.push({ type: 'code', value: line.slice(cursor + 1, end) })
        cursor = end + 1
        continue
      }
    }
    if (line[cursor] === '[') {
      const closeBracket = line.indexOf(']', cursor + 1)
      if (closeBracket !== -1 && line[closeBracket + 1] === '(') {
        const closeParen = line.indexOf(')', closeBracket + 2)
        if (closeParen !== -1) {
          tokens.push({
            type: 'link',
            value: line.slice(cursor + 1, closeBracket),
            href: line.slice(closeBracket + 2, closeParen)
          })
          cursor = closeParen + 1
          continue
        }
      }
    }
    let next = cursor
    while (next < len && line[next] !== '`' && line[next] !== '[') {
      next++
    }
    if (next > cursor) {
      tokens.push({ type: 'text', value: line.slice(cursor, next) })
    }
    cursor = Math.max(next, cursor + 1)
  }

  return tokens.map((t, i) => {
    if (t.type === 'code') return <code key={i}>{t.value}</code>
    if (t.type === 'link') {
      return (
        <a key={i} href={t.href} target="_blank" rel="noopener noreferrer">
          {t.value}
        </a>
      )
    }
    return <span key={i}>{t.value}</span>
  })
}

export function renderMarkdown(markdown: string): ReactNode {
  const lines = markdown.split(/\r?\n/)
  const nodes: ReactNode[] = []
  let listBuffer: string[] = []

  const flushList = () => {
    if (listBuffer.length === 0) return
    nodes.push(
      <ul key={`ul-${nodes.length}`}>
        {listBuffer.map((item, i) => (
          <li key={i}>{parseInline(item)}</li>
        ))}
      </ul>
    )
    listBuffer = []
  }

  for (const raw of lines) {
    const line = raw.trimEnd()
    if (!line) {
      flushList()
      continue
    }
    if (line.startsWith('### ')) {
      flushList()
      nodes.push(<h3 key={`h3-${nodes.length}`}>{parseInline(line.slice(4))}</h3>)
      continue
    }
    if (line.startsWith('## ')) {
      flushList()
      nodes.push(<h2 key={`h2-${nodes.length}`}>{parseInline(line.slice(3))}</h2>)
      continue
    }
    if (line.startsWith('# ')) {
      flushList()
      nodes.push(<h1 key={`h1-${nodes.length}`}>{parseInline(line.slice(2))}</h1>)
      continue
    }
    if (line.startsWith('* ') || line.startsWith('- ')) {
      listBuffer.push(line.slice(2))
      continue
    }
    flushList()
    nodes.push(<p key={`p-${nodes.length}`}>{parseInline(line)}</p>)
  }
  flushList()
  return nodes
}
