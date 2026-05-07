'use client'

import * as React from 'react'
import { Check, ChevronDown, LoaderCircle, Plus, X } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

export type ComboboxChipsOption = {
  value: string
  label: string
  keywords?: string[]
  disabled?: boolean
  chipClassName?: string
  chipDotClassName?: string
  deleteLabel?: string
}

type ComboboxChipsProps = {
  value: string[]
  onValueChange: (value: string[]) => void
  options: ComboboxChipsOption[]
  placeholder: string
  searchPlaceholder?: string
  emptyText: string
  disabled?: boolean
  className?: string
  contentClassName?: string
  id?: string
  'aria-describedby'?: string
  'aria-invalid'?: boolean
  'aria-label'?: string
  createOptionLabel?: (query: string) => string
  onCreateOption?: (query: string) => Promise<void> | void
  onDeleteOption?: (option: ComboboxChipsOption) => Promise<void> | void
  deletingOptionValue?: string | null
  creating?: boolean
  onQueryChange?: (query: string) => void
}

const ComboboxChips = React.forwardRef<HTMLDivElement, ComboboxChipsProps>(
  (
    {
      value,
      onValueChange,
      options,
      placeholder,
      searchPlaceholder,
      emptyText,
      disabled = false,
      className,
      contentClassName,
      id,
      'aria-describedby': ariaDescribedBy,
      'aria-invalid': ariaInvalid,
      createOptionLabel,
      onCreateOption,
      onDeleteOption,
      deletingOptionValue = null,
      creating = false,
      onQueryChange,
      'aria-label': ariaLabel
    },
    ref
  ) => {
    const [open, setOpen] = React.useState(false)
    const [query, setQuery] = React.useState('')
    const inputRef = React.useRef<HTMLInputElement | null>(null)

    const selectedOptions = value
      .map((selectedValue) => options.find((option) => option.value === selectedValue) ?? null)
      .filter((option): option is ComboboxChipsOption => option !== null)

    const trimmedQuery = query.trim()
    const normalizedQuery = trimmedQuery.toLowerCase()
    const exactMatch = normalizedQuery
      ? (options.find((option) => option.label.trim().toLowerCase() === normalizedQuery) ?? null)
      : null

    const filteredOptions = normalizedQuery
      ? options.filter((option) =>
          [option.label, ...(option.keywords ?? [])].some((part) =>
            part.toLowerCase().includes(normalizedQuery)
          )
        )
      : options

    const focusInput = () => {
      queueMicrotask(() => inputRef.current?.focus())
    }

    const clearQuery = () => {
      setQuery('')
      onQueryChange?.('')
    }

    const handleOpenChange = (nextOpen: boolean) => {
      setOpen(nextOpen)
      if (!nextOpen) {
        clearQuery()
        return
      }

      focusInput()
    }

    const handleQueryChange = (nextQuery: string) => {
      setQuery(nextQuery)
      onQueryChange?.(nextQuery)
      if (!open) {
        setOpen(true)
      }
    }

    const handleToggleValue = (nextValue: string) => {
      onValueChange(
        value.includes(nextValue)
          ? value.filter((currentValue) => currentValue !== nextValue)
          : [...value, nextValue]
      )
      clearQuery()
      focusInput()
    }

    const handleCreate = (nextQuery: string) => {
      clearQuery()
      void onCreateOption?.(nextQuery)
      focusInput()
    }

    const handleSubmitQuery = () => {
      if (disabled || creating || !trimmedQuery) {
        return
      }

      if (exactMatch) {
        if (!exactMatch.disabled && !value.includes(exactMatch.value)) {
          handleToggleValue(exactMatch.value)
        }
        return
      }

      if (onCreateOption) {
        handleCreate(trimmedQuery)
      }
    }

    return (
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <div
            ref={ref}
            id={id}
            role="combobox"
            aria-label={ariaLabel}
            aria-describedby={ariaDescribedBy}
            aria-expanded={open}
            aria-disabled={disabled}
            aria-invalid={ariaInvalid}
            tabIndex={disabled ? -1 : 0}
            className={cn(
              'flex w-full items-stretch rounded-md border border-input bg-transparent text-sm shadow-xs transition-[color,box-shadow] outline-none',
              'focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50',
              disabled && 'cursor-not-allowed opacity-50',
              className
            )}
            onClick={() => {
              if (disabled) {
                return
              }

              setOpen(true)
              focusInput()
            }}
            onKeyDown={(event) => {
              if (disabled) {
                return
              }

              if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
                event.preventDefault()
                setOpen(true)
                focusInput()
              }
            }}
          >
            <div className="flex min-h-9 min-w-0 flex-1 flex-wrap items-center gap-1.5 px-3 py-1">
              {selectedOptions.map((option) => (
                <Badge
                  key={option.value}
                  variant="secondary"
                  className={cn(
                    'h-6 gap-1.5 rounded-md px-2 font-normal shadow-none',
                    option.chipClassName
                  )}
                >
                  {option.chipDotClassName ? (
                    <span className={cn('size-1.5 rounded-full', option.chipDotClassName)} />
                  ) : null}
                  <span className="max-w-[10rem] truncate">{option.label}</span>
                  <button
                    type="button"
                    className="inline-flex size-4 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:text-foreground"
                    aria-label={`Remove ${option.label}`}
                    onMouseDown={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                    }}
                    onClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      handleToggleValue(option.value)
                    }}
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              ))}
              <input
                ref={inputRef}
                value={query}
                aria-label={ariaLabel}
                disabled={disabled}
                placeholder={selectedOptions.length === 0 ? placeholder : searchPlaceholder}
                className="h-7 min-w-[5rem] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                onFocus={() => {
                  if (!disabled) {
                    setOpen(true)
                  }
                }}
                onChange={(event) => handleQueryChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') {
                    return
                  }

                  event.preventDefault()
                  event.stopPropagation()
                  handleSubmitQuery()
                }}
              />
            </div>
            <div className="flex w-9 shrink-0 items-center justify-center border-l border-input/70 text-muted-foreground">
              <ChevronDown className="size-4" />
            </div>
          </div>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className={cn('w-[var(--radix-popover-trigger-width)] p-1', contentClassName)}
        >
          <Command shouldFilter={false}>
            <CommandList className="max-h-72">
              {trimmedQuery && !exactMatch && onCreateOption ? (
                <CommandItem
                  value={trimmedQuery}
                  disabled={creating}
                  className="rounded-md"
                  onSelect={() => handleCreate(trimmedQuery)}
                >
                  {creating ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : (
                    <Plus className="size-4" />
                  )}
                  <span className="min-w-0 flex-1 truncate">
                    {createOptionLabel ? createOptionLabel(trimmedQuery) : trimmedQuery}
                  </span>
                </CommandItem>
              ) : null}

              {filteredOptions.length === 0 ? <CommandEmpty>{emptyText}</CommandEmpty> : null}

              {filteredOptions.map((option) => {
                const selected = value.includes(option.value)
                const deleting = deletingOptionValue === option.value

                return (
                  <CommandItem
                    key={option.value}
                    value={option.label}
                    disabled={option.disabled || deleting}
                    className="rounded-md"
                    onSelect={() => handleToggleValue(option.value)}
                  >
                    <span className="min-w-0 flex-1 truncate">{option.label}</span>
                    {onDeleteOption ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        disabled={deleting}
                        className="mr-1 shrink-0"
                        aria-label={option.deleteLabel ?? `Delete ${option.label}`}
                        onMouseDown={(event) => {
                          event.preventDefault()
                          event.stopPropagation()
                        }}
                        onClick={(event) => {
                          event.preventDefault()
                          event.stopPropagation()
                          void onDeleteOption(option)
                        }}
                      >
                        {deleting ? (
                          <LoaderCircle className="size-3 animate-spin" />
                        ) : (
                          <X className="size-3" />
                        )}
                      </Button>
                    ) : null}
                    <Check
                      className={cn('size-4 shrink-0', selected ? 'opacity-100' : 'opacity-0')}
                    />
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

ComboboxChips.displayName = 'ComboboxChips'

export { ComboboxChips }
