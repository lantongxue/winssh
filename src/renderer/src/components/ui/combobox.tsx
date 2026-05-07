'use client'

import * as React from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

export type ComboboxOption = {
  value: string
  label: string
  keywords?: string[]
  disabled?: boolean
}

type ComboboxProps = {
  value?: string | null
  onValueChange: (value: string) => void
  options: ComboboxOption[]
  placeholder: string
  searchPlaceholder: string
  emptyText: string
  disabled?: boolean
  className?: string
  contentClassName?: string
  'aria-label'?: string
  renderOption?: (option: ComboboxOption, selected: boolean) => React.ReactNode
  renderValue?: (option: ComboboxOption | null) => React.ReactNode
}

const Combobox = React.forwardRef<HTMLButtonElement, ComboboxProps>(
  (
    {
      value = null,
      onValueChange,
      options,
      placeholder,
      searchPlaceholder,
      emptyText,
      disabled = false,
      className,
      contentClassName,
      renderOption,
      renderValue,
      ...buttonProps
    },
    ref
  ) => {
    const [open, setOpen] = React.useState(false)
    const [query, setQuery] = React.useState('')

    const selectedOption = options.find((option) => option.value === value) ?? null

    const handleOpenChange = (nextOpen: boolean) => {
      setOpen(nextOpen)
      if (!nextOpen) {
        setQuery('')
      }
    }

    const handleSelect = (nextValue: string) => {
      onValueChange(nextValue)
      setOpen(false)
      setQuery('')
    }

    return (
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            ref={ref}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              'w-full justify-between bg-transparent px-3 font-normal',
              !selectedOption && 'text-muted-foreground',
              className
            )}
            {...buttonProps}
          >
            <span className="min-w-0 flex-1 truncate text-left">
              {selectedOption
                ? (renderValue?.(selectedOption) ?? selectedOption.label)
                : placeholder}
            </span>
            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className={cn('w-[var(--radix-popover-trigger-width)] p-0', contentClassName)}
        >
          <Command>
            <CommandInput value={query} onValueChange={setQuery} placeholder={searchPlaceholder} />
            <CommandList className="max-h-72">
              <CommandEmpty>{emptyText}</CommandEmpty>
              {options.map((option) => {
                const selected = option.value === value
                const searchValue = [option.label, ...(option.keywords ?? [])].join(' ').trim()

                return (
                  <CommandItem
                    key={option.value}
                    value={searchValue}
                    disabled={option.disabled}
                    onSelect={() => handleSelect(option.value)}
                  >
                    {renderOption ? (
                      renderOption(option, selected)
                    ) : (
                      <>
                        <Check className={cn('size-4', selected ? 'opacity-100' : 'opacity-0')} />
                        <span className="truncate">{option.label}</span>
                      </>
                    )}
                  </CommandItem>
                )
              })}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    )
  }
)

Combobox.displayName = 'Combobox'

export { Combobox }
