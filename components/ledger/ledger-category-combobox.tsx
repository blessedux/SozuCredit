"use client"

import { useMemo, useState } from "react"
import { CommandInput as CmdkCommandInput } from "cmdk"
import { Check, ChevronDown, SearchIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

function formatCategoryLabel(category: string) {
  return category.replace(/_/g, " ")
}

type LedgerCategoryComboboxProps = {
  value: string
  onValueChange: (next: string) => void
  categories: string[]
  disabled?: boolean
  /** Merged with internal trigger layout classes */
  triggerClassName?: string
  /** Popover panel (z-index for nested dialogs) */
  contentClassName?: string
  placeholder?: string
  emptyMessage?: string
  searchPlaceholder?: string
}

export function LedgerCategoryCombobox({
  value,
  onValueChange,
  categories,
  disabled,
  triggerClassName,
  contentClassName,
  placeholder = "Elegí categoría…",
  emptyMessage = "Sin coincidencias.",
  searchPlaceholder = "Buscar categoría…",
}: LedgerCategoryComboboxProps) {
  const [open, setOpen] = useState(false)

  const options = useMemo(() => {
    const seen = new Set<string>()
    const out: string[] = []
    for (const c of categories) {
      if (!seen.has(c)) {
        seen.add(c)
        out.push(c)
      }
    }
    if (value && !seen.has(value)) {
      out.push(value)
    }
    return out
  }, [categories, value])

  const label = value ? formatCategoryLabel(value) : placeholder

  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "h-9 w-full justify-between rounded-md border px-3 font-normal shadow-xs",
            "border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white",
            triggerClassName,
          )}
        >
          <span className="truncate text-left">{label}</span>
          <ChevronDown className="ml-2 size-4 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn(
          "z-[200] w-[var(--radix-popover-trigger-width)] max-w-[min(calc(100vw-2rem),22rem)] border-white/15 bg-neutral-950 p-0 text-white shadow-xl",
          contentClassName,
        )}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <Command
          className="bg-neutral-950 text-white [&_[cmdk-group-heading]]:text-white/50 [&_[cmdk-item]]:text-white/90 [&_[cmdk-item][data-selected=true]]:bg-white/10 [&_[cmdk-item][data-selected=true]]:text-white"
          shouldFilter
        >
          <div className="hidden h-9 items-center gap-2 border-b border-white/10 px-3 md:flex">
            <SearchIcon className="size-4 shrink-0 opacity-50" />
            <CmdkCommandInput
              className="flex h-9 w-full min-w-0 rounded-md bg-transparent text-sm text-white outline-none placeholder:text-white/40"
              placeholder={searchPlaceholder}
            />
          </div>
          <CommandList className="max-h-52">
            <CommandEmpty className="text-white/50">{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {options.map((c) => (
                <CommandItem
                  key={c}
                  value={c}
                  keywords={[c, formatCategoryLabel(c)]}
                  onSelect={() => {
                    onValueChange(c)
                    setOpen(false)
                  }}
                  className="cursor-pointer"
                >
                  <Check className={cn("mr-2 size-4 shrink-0", value === c ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{formatCategoryLabel(c)}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
