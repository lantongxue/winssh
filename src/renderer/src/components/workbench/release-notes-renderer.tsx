import { cn } from '@/lib/utils'

interface ReleaseNotesRendererProps {
  content: string
  className?: string
}

function isHtml(text: string): boolean {
  return /<[a-z][\s\S]*>/i.test(text)
}

export function ReleaseNotesRenderer({ content, className }: ReleaseNotesRendererProps) {
  if (isHtml(content)) {
    return (
      <div
        className={cn('changelog-html', className)}
        dangerouslySetInnerHTML={{ __html: content }}
      />
    )
  }

  return <div className={cn('whitespace-pre-wrap', className)}>{content}</div>
}
