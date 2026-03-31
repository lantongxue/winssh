import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MonitorCog, MoonStar, SunMedium } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'

const themeOptions = [
  { value: 'system', label: '跟随系统', icon: MonitorCog },
  { value: 'light', label: '浅色', icon: SunMedium },
  { value: 'dark', label: '深色', icon: MoonStar }
] as const

export function ThemeToggle() {
  const queryClient = useQueryClient()
  const settingsQuery = useQuery({
    queryKey: ['settings'],
    queryFn: () => window.winsshApi.settings.get()
  })

  const updateSettings = useMutation({
    mutationFn: (theme: 'system' | 'light' | 'dark') => window.winsshApi.settings.update({ theme }),
    onSuccess: (settings) => {
      queryClient.setQueryData(['settings'], settings)
    }
  })

  const activeTheme = settingsQuery.data?.theme ?? 'system'
  const activeOption =
    themeOptions.find((option) => option.value === activeTheme) ?? themeOptions[0]
  const ActiveIcon = activeOption.icon

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-2 rounded-md px-2.5">
          <ActiveIcon className="size-4" />
          <span className="hidden sm:inline">{activeOption.label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {themeOptions.map((option) => {
          const Icon = option.icon
          return (
            <DropdownMenuItem
              key={option.value}
              onClick={() => updateSettings.mutate(option.value)}
              className="gap-2"
            >
              <Icon className="size-4" />
              {option.label}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
