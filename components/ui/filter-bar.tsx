import * as React from "react"
import { createPortal } from "react-dom"
import { Search, ChevronDown, Check } from "lucide-react"
import { Input } from "@/components/ui/input"
import { SelectTrigger } from "@/components/ui/select"
import { cn } from "@/lib/utils"

export function FilterContainer({ children, className }: { children: React.ReactNode, className?: string }) {
  return (
    <div className={cn("bg-card border border-border rounded-[1.25rem] p-3 sm:p-3.5 shadow-sm mb-6 flex flex-col gap-3", className)}>
      {children}
    </div>
  )
}

export interface FilterSearchProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export function FilterSearch({ className, ...props }: FilterSearchProps) {
  return (
    <div className="relative w-full">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        {...props}
        className={cn(
          "pl-9 h-10 sm:h-9 rounded-full bg-muted/50 border-border hover:border-border/80 text-sm transition-colors text-foreground placeholder:text-muted-foreground w-full",
          className
        )}
      />
    </div>
  )
}

export const FilterSelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectTrigger>,
  React.ComponentPropsWithoutRef<typeof SelectTrigger>
>(({ className, children, ...props }, ref) => (
  <SelectTrigger
    ref={ref}
    className={cn(
      "h-10 sm:h-9 rounded-full bg-muted/50 border-border hover:border-border/80 text-sm transition-colors text-foreground shrink-0",
      className
    )}
    {...props}
  >
    {children}
  </SelectTrigger>
))
FilterSelectTrigger.displayName = "FilterSelectTrigger"

export interface FilterMultiSelectProps {
  placeholder: string;
  icon?: React.ReactNode;
  options: { label: string; value: string }[];
  selectedValues: string[];
  onSelectedValuesChange: (values: string[]) => void;
  className?: string;
  /** Show a search box inside the dropdown. Defaults to on once the list is long enough to scroll. */
  searchable?: boolean;
  searchPlaceholder?: string;
  disabled?: boolean;
}

/** Below this many options the list fits on screen, so a search box is just noise. */
const SEARCH_THRESHOLD = 8;

export function FilterMultiSelect({
  placeholder,
  icon,
  options,
  selectedValues,
  onSelectedValuesChange,
  className,
  searchable,
  searchPlaceholder = "Search...",
  disabled = false,
}: FilterMultiSelectProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [dropdownPosition, setDropdownPosition] = React.useState<{ top: number; left: number; width: number } | null>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const searchRef = React.useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = React.useState(false);

  const showSearch = searchable ?? options.length > SEARCH_THRESHOLD;

  const visibleOptions = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = React.useCallback(() => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const minW = Math.max(rect.width, 200);
      let left = rect.left;
      if (left + minW > viewportWidth - 16) {
        left = Math.max(16, viewportWidth - minW - 16);
      }
      setDropdownPosition({
        top: rect.bottom + 6,
        left,
        width: minW,
      });
    }
  }, []);

  // Always close through this so the query never survives into the next open.
  const close = React.useCallback(() => {
    setIsOpen(false);
    setQuery("");
  }, []);

  const toggleOpen = () => {
    if (disabled) return;
    if (isOpen) {
      close();
      return;
    }
    updatePosition();
    setIsOpen(true);
  };

  React.useEffect(() => {
    if (!isOpen || !showSearch) return;
    const id = requestAnimationFrame(() => searchRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [isOpen, showSearch]);

  React.useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        buttonRef.current && !buttonRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        close();
      }
    };

    const handleScrollOrResize = () => {
      updatePosition();
    };

    document.addEventListener("mousedown", handleOutsideClick);
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [isOpen, updatePosition, close]);

  const toggleOption = (value: string) => {
    if (selectedValues.includes(value)) {
      onSelectedValuesChange(selectedValues.filter(v => v !== value));
    } else {
      onSelectedValuesChange([...selectedValues, value]);
    }
  };

  // Acts on what is currently visible, so "Select All" while searching adds just the matches.
  const handleSelectAll = () => {
    onSelectedValuesChange(
      Array.from(new Set([...selectedValues, ...visibleOptions.map(opt => opt.value)]))
    );
  };

  const handleClear = () => {
    onSelectedValuesChange([]);
  };

  const hasSelections = selectedValues.length > 0;

  // One pick reads better as the value itself; more than one needs the count.
  const triggerLabel =
    selectedValues.length === 1
      ? options.find((o) => o.value === selectedValues[0])?.label ?? `${placeholder} (1)`
      : `${placeholder} (${selectedValues.length})`;

  return (
    <div className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleOpen}
        disabled={disabled}
        aria-expanded={isOpen}
        className={cn(
          "flex h-10 sm:h-9 w-full min-w-[140px] sm:min-w-[160px] items-center justify-between rounded-full bg-muted/50 border border-border px-3 py-2 text-xs sm:text-sm shadow-sm transition-colors hover:border-border/80 focus:outline-none focus:ring-2 focus:ring-ring/30",
          hasSelections ? "border-primary/50 bg-primary/10 text-primary font-medium" : "",
          disabled ? "cursor-not-allowed opacity-50 hover:border-border" : "",
          className
        )}
      >
        <span className="flex items-center gap-2 truncate text-muted-foreground">
          {icon}
          {hasSelections ? (
            <span className="truncate text-foreground font-medium">{triggerLabel}</span>
          ) : (
            <span className="truncate">{placeholder}</span>
          )}
        </span>
        <ChevronDown className="h-4 w-4 opacity-50 ml-1 shrink-0" />
      </button>

      {isOpen && mounted && dropdownPosition && createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: "fixed",
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
            minWidth: `${dropdownPosition.width}px`,
            zIndex: 9999,
          }}
          className="flex max-h-72 flex-col rounded-xl border border-border bg-popover text-popover-foreground shadow-xl animate-in fade-in-0 zoom-in-95 p-1"
        >
          {options.length === 0 ? (
            <div className="py-2 px-2 text-sm text-muted-foreground text-center">No options found.</div>
          ) : (
            <>
              {showSearch && (
                <div className="relative px-1 pt-1 pb-1.5">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    ref={searchRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        e.stopPropagation();
                        if (query) setQuery("");
                        else close();
                      }
                    }}
                    placeholder={searchPlaceholder}
                    className="h-8 w-full rounded-lg border border-border bg-muted/50 pl-8 pr-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
                  />
                </div>
              )}
              <div className="flex items-center justify-between px-2 py-1.5 border-b border-border/50 mb-1">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-xs font-medium text-primary hover:underline focus:outline-none disabled:opacity-40 disabled:no-underline"
                  disabled={visibleOptions.length === 0}
                >
                  {query.trim() ? `Select ${visibleOptions.length} shown` : "Select All"}
                </button>
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-xs font-medium text-muted-foreground hover:text-foreground hover:underline focus:outline-none"
                >
                  Clear
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {visibleOptions.length === 0 ? (
                  <div className="py-3 px-2 text-sm text-muted-foreground text-center">No matches.</div>
                ) : (
                  visibleOptions.map((option) => {
                    const isSelected = selectedValues.includes(option.value);
                    return (
                      <label
                        key={option.value}
                        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm cursor-pointer hover:bg-accent transition-colors"
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={isSelected}
                          onChange={() => toggleOption(option.value)}
                        />
                        <div className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border",
                          isSelected ? "bg-primary border-primary text-primary-foreground" : "border-primary opacity-50"
                        )}>
                          {isSelected && <Check className="h-3 w-3" />}
                        </div>
                        <span className="truncate">{option.label}</span>
                      </label>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>,
        document.body
      )}
    </div>
  )
}
