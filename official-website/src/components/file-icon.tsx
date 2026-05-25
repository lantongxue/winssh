import type { ReactNode } from 'react'

export type FileLanguage = 'markdown' | 'json' | 'typescript' | 'terminal' | 'plain'

interface FileIconProps {
  language: FileLanguage
  size?: number
}

const COLOR_MAP: Record<FileLanguage, string> = {
  markdown: '#519aba',
  json: '#cbcb41',
  typescript: '#519aba',
  terminal: '#4d4d4d',
  plain: '#7a7a7a'
}

const GLYPH_MAP: Record<FileLanguage, ReactNode> = {
  markdown: (
    <>
      <path d="M2 4h12v8H2z" fill="none" />
      <path d="M3 6v4h1V7.5l1 1.5 1-1.5V10h1V6h-1l-1 1.5L4 6H3zM10 6v2H9l1.5 2 1.5-2h-1V6h-1z" />
    </>
  ),
  json: (
    <>
      <path d="M5 4c-1 0-1.5.5-1.5 1.5v2c0 .5-.3 1-1 1h-.5v1h.5c.7 0 1 .5 1 1v2C3.5 12.5 4 13 5 13h1v-1h-.5c-.5 0-.5-.3-.5-.8V9.5c0-.7-.4-1.2-1-1.5.6-.3 1-.8 1-1.5V4.8c0-.5 0-.8.5-.8H6V3H5zM11 4c1 0 1.5.5 1.5 1.5v2c0 .5.3 1 1 1h.5v1h-.5c-.7 0-1 .5-1 1v2c0 1-.5 1.5-1.5 1.5h-1v-1h.5c.5 0 .5-.3.5-.8V9.5c0-.7.4-1.2 1-1.5-.6-.3-1-.8-1-1.5V4.8c0-.5 0-.8-.5-.8H10V3h1z" />
    </>
  ),
  typescript: (
    <>
      <rect x="2" y="2" width="12" height="12" rx="1" />
      <text x="8" y="11" fill="white" fontSize="6" fontWeight="700" textAnchor="middle" fontFamily="monospace">
        TS
      </text>
    </>
  ),
  terminal: (
    <>
      <rect x="2" y="3" width="12" height="10" rx="1" />
      <path d="M4.5 6l2 2-2 2M8 10h3" stroke="white" strokeWidth="1" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  plain: <rect x="3" y="2" width="10" height="12" />
}

export function FileIcon({ language, size = 14 }: FileIconProps) {
  const color = COLOR_MAP[language]
  const glyph = GLYPH_MAP[language]
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill={color}
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      {glyph}
    </svg>
  )
}
