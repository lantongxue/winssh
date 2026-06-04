import { COLOR_PRESETS } from '@shared/constants'

export const colorOptions = [...COLOR_PRESETS]

export const colorStyles: Record<
  string,
  { badge: string; dot: string; ring: string; text: string }
> = {
  slate: {
    badge: 'border-slate-400/25 bg-slate-500/10 text-foreground',
    dot: 'bg-slate-400',
    ring: 'ring-slate-400/25',
    text: 'text-slate-400'
  },
  stone: {
    badge: 'border-stone-400/25 bg-stone-500/10 text-foreground',
    dot: 'bg-stone-400',
    ring: 'ring-stone-400/25',
    text: 'text-stone-400'
  },
  red: {
    badge: 'border-red-400/25 bg-red-500/10 text-foreground',
    dot: 'bg-red-400',
    ring: 'ring-red-400/25',
    text: 'text-red-400'
  },
  orange: {
    badge: 'border-orange-400/25 bg-orange-500/10 text-foreground',
    dot: 'bg-orange-400',
    ring: 'ring-orange-400/25',
    text: 'text-orange-400'
  },
  amber: {
    badge: 'border-amber-400/25 bg-amber-500/10 text-foreground',
    dot: 'bg-amber-400',
    ring: 'ring-amber-400/25',
    text: 'text-amber-400'
  },
  yellow: {
    badge: 'border-yellow-400/25 bg-yellow-500/10 text-foreground',
    dot: 'bg-yellow-400',
    ring: 'ring-yellow-400/25',
    text: 'text-yellow-400'
  },
  lime: {
    badge: 'border-lime-400/25 bg-lime-500/10 text-foreground',
    dot: 'bg-lime-400',
    ring: 'ring-lime-400/25',
    text: 'text-lime-400'
  },
  green: {
    badge: 'border-green-400/25 bg-green-500/10 text-foreground',
    dot: 'bg-green-400',
    ring: 'ring-green-400/25',
    text: 'text-green-400'
  },
  emerald: {
    badge: 'border-emerald-400/25 bg-emerald-500/10 text-foreground',
    dot: 'bg-emerald-400',
    ring: 'ring-emerald-400/25',
    text: 'text-emerald-400'
  },
  teal: {
    badge: 'border-teal-400/25 bg-teal-500/10 text-foreground',
    dot: 'bg-teal-400',
    ring: 'ring-teal-400/25',
    text: 'text-teal-400'
  },
  cyan: {
    badge: 'border-cyan-400/25 bg-cyan-500/10 text-foreground',
    dot: 'bg-cyan-400',
    ring: 'ring-cyan-400/25',
    text: 'text-cyan-400'
  },
  sky: {
    badge: 'border-sky-400/25 bg-sky-500/10 text-foreground',
    dot: 'bg-sky-400',
    ring: 'ring-sky-400/25',
    text: 'text-sky-400'
  },
  blue: {
    badge: 'border-blue-400/25 bg-blue-500/10 text-foreground',
    dot: 'bg-blue-400',
    ring: 'ring-blue-400/25',
    text: 'text-blue-400'
  },
  indigo: {
    badge: 'border-indigo-400/25 bg-indigo-500/10 text-foreground',
    dot: 'bg-indigo-400',
    ring: 'ring-indigo-400/25',
    text: 'text-indigo-400'
  },
  violet: {
    badge: 'border-violet-400/25 bg-violet-500/10 text-foreground',
    dot: 'bg-violet-400',
    ring: 'ring-violet-400/25',
    text: 'text-violet-400'
  },
  pink: {
    badge: 'border-pink-400/25 bg-pink-500/10 text-foreground',
    dot: 'bg-pink-400',
    ring: 'ring-pink-400/25',
    text: 'text-pink-400'
  },
  rose: {
    badge: 'border-rose-400/25 bg-rose-500/10 text-foreground',
    dot: 'bg-rose-400',
    ring: 'ring-rose-400/25',
    text: 'text-rose-400'
  }
}

export function getColorStyle(color: string) {
  return colorStyles[color] ?? colorStyles.slate
}
