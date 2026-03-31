import { COLOR_PRESETS } from '@shared/constants'

export const colorOptions = [...COLOR_PRESETS]

export const colorStyles: Record<string, { badge: string; dot: string; ring: string }> = {
  slate: {
    badge: 'border-slate-400/25 bg-slate-500/10 text-foreground',
    dot: 'bg-slate-400',
    ring: 'ring-slate-400/25'
  },
  stone: {
    badge: 'border-stone-400/25 bg-stone-500/10 text-foreground',
    dot: 'bg-stone-400',
    ring: 'ring-stone-400/25'
  },
  red: {
    badge: 'border-red-400/25 bg-red-500/10 text-foreground',
    dot: 'bg-red-400',
    ring: 'ring-red-400/25'
  },
  orange: {
    badge: 'border-orange-400/25 bg-orange-500/10 text-foreground',
    dot: 'bg-orange-400',
    ring: 'ring-orange-400/25'
  },
  amber: {
    badge: 'border-amber-400/25 bg-amber-500/10 text-foreground',
    dot: 'bg-amber-400',
    ring: 'ring-amber-400/25'
  },
  yellow: {
    badge: 'border-yellow-400/25 bg-yellow-500/10 text-foreground',
    dot: 'bg-yellow-400',
    ring: 'ring-yellow-400/25'
  },
  lime: {
    badge: 'border-lime-400/25 bg-lime-500/10 text-foreground',
    dot: 'bg-lime-400',
    ring: 'ring-lime-400/25'
  },
  green: {
    badge: 'border-green-400/25 bg-green-500/10 text-foreground',
    dot: 'bg-green-400',
    ring: 'ring-green-400/25'
  },
  emerald: {
    badge: 'border-emerald-400/25 bg-emerald-500/10 text-foreground',
    dot: 'bg-emerald-400',
    ring: 'ring-emerald-400/25'
  },
  teal: {
    badge: 'border-teal-400/25 bg-teal-500/10 text-foreground',
    dot: 'bg-teal-400',
    ring: 'ring-teal-400/25'
  },
  cyan: {
    badge: 'border-cyan-400/25 bg-cyan-500/10 text-foreground',
    dot: 'bg-cyan-400',
    ring: 'ring-cyan-400/25'
  },
  sky: {
    badge: 'border-sky-400/25 bg-sky-500/10 text-foreground',
    dot: 'bg-sky-400',
    ring: 'ring-sky-400/25'
  },
  blue: {
    badge: 'border-blue-400/25 bg-blue-500/10 text-foreground',
    dot: 'bg-blue-400',
    ring: 'ring-blue-400/25'
  },
  indigo: {
    badge: 'border-indigo-400/25 bg-indigo-500/10 text-foreground',
    dot: 'bg-indigo-400',
    ring: 'ring-indigo-400/25'
  },
  violet: {
    badge: 'border-violet-400/25 bg-violet-500/10 text-foreground',
    dot: 'bg-violet-400',
    ring: 'ring-violet-400/25'
  },
  pink: {
    badge: 'border-pink-400/25 bg-pink-500/10 text-foreground',
    dot: 'bg-pink-400',
    ring: 'ring-pink-400/25'
  },
  rose: {
    badge: 'border-rose-400/25 bg-rose-500/10 text-foreground',
    dot: 'bg-rose-400',
    ring: 'ring-rose-400/25'
  }
}

export function getColorStyle(color: string) {
  return colorStyles[color] ?? colorStyles.slate
}
