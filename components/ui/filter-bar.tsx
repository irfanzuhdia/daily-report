import * as React from "react"
import { createPortal } from "react-dom"
import { Search, ChevronDown, Check, Calendar, X, Star } from "lucide-react"
import { Input } from "@/components/ui/input"
import { SelectTrigger } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import {
  AppPageName,
  DateRangePreset,
  DATE_RANGE_PRESET_LABELS,
  getDateRangeFromPreset,
  detectPresetFromRange,
  getEffectivePreference,
  setStoredDateRangePreference,
} from "@/lib/date-range-preference"
import { useToast } from "@/components/ui/toast"

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

export interface FilterDateRangeProps {
  startDate: string;
  endDate: string;
  onDateChange: (start: string, end: string) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  pageName?: AppPageName;
}

export function FilterDateRange({
  startDate,
  endDate,
  onDateChange,
  className,
  placeholder = "Date range",
  disabled = false,
  pageName,
}: FilterDateRangeProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = React.useState(false);
  const [draftStart, setDraftStart] = React.useState(startDate);
  const [draftEnd, setDraftEnd] = React.useState(endDate);
  const [dateError, setDateError] = React.useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = React.useState<{ top: number; left: number; width: number } | null>(null);
  const [effectiveDefault, setEffectiveDefault] = React.useState<DateRangePreset>("all");
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const mounted = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  React.useEffect(() => {
    setEffectiveDefault(getEffectivePreference(pageName));
    const handlePrefChange = () => {
      setEffectiveDefault(getEffectivePreference(pageName));
    };
    window.addEventListener("dr_date_range_preference_changed", handlePrefChange);
    return () => window.removeEventListener("dr_date_range_preference_changed", handlePrefChange);
  }, [pageName]);

  const updatePosition = React.useCallback(() => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const minW = Math.max(rect.width, 290);
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

  const close = React.useCallback(() => {
    setIsOpen(false);
    setDateError(null);
  }, []);

  const toggleOpen = () => {
    if (disabled) return;
    if (isOpen) {
      close();
      return;
    }
    setDraftStart(startDate);
    setDraftEnd(endDate);
    setDateError(null);
    updatePosition();
    setIsOpen(true);
  };

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

  const handleApply = () => {
    if (draftStart && draftEnd && draftStart > draftEnd) {
      setDateError("End date cannot be earlier than start date.");
      return;
    }
    setDateError(null);
    onDateChange(draftStart, draftEnd);
    close();
  };

  const handleClear = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setDraftStart("");
    setDraftEnd("");
    setDateError(null);
    onDateChange("", "");
    close();
  };

  const handlePreset = (type: "today" | "thisWeek" | "thisMonth" | "last30Days") => {
    const range = getDateRangeFromPreset(type);
    setDraftStart(range.startDate);
    setDraftEnd(range.endDate);
    setDateError(null);
  };

  const currentDetected = detectPresetFromRange(draftStart, draftEnd) || (draftStart || draftEnd ? null : "all");
  const isCurrentlyDefault = currentDetected !== null && currentDetected === effectiveDefault;

  const handleSetCurrentAsDefault = (e: React.MouseEvent) => {
    e.stopPropagation();
    const targetPreset: DateRangePreset = currentDetected || (draftStart || draftEnd ? "today" : "all");
    setStoredDateRangePreference(targetPreset, pageName);
    setEffectiveDefault(targetPreset);
    toast({
      variant: "success",
      title: "Default Date Range Saved",
      description: `Default for ${pageName ? pageName.charAt(0).toUpperCase() + pageName.slice(1) : "this page"} is now ${DATE_RANGE_PRESET_LABELS[targetPreset]}.`,
    });
  };

  const hasSelections = Boolean(startDate || endDate);

  const triggerLabel = React.useMemo(() => {
    if (startDate && endDate) {
      return startDate === endDate ? startDate : `${startDate} → ${endDate}`;
    }
    if (startDate) return `From ${startDate}`;
    if (endDate) return `Until ${endDate}`;
    return placeholder;
  }, [startDate, endDate, placeholder]);

  const activePreset = detectPresetFromRange(draftStart, draftEnd);

  return (
    <div className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleOpen}
        disabled={disabled}
        aria-expanded={isOpen}
        className={cn(
          "flex h-10 sm:h-9 w-full min-w-[140px] sm:min-w-[160px] items-center justify-between rounded-full bg-muted/50 border border-border px-3 py-2 text-xs sm:text-sm shadow-sm transition-colors hover:border-border/80 focus:outline-none focus:ring-2 focus:ring-ring/30 gap-1.5",
          hasSelections ? "border-primary/50 bg-primary/10 text-primary font-medium" : "",
          disabled ? "cursor-not-allowed opacity-50 hover:border-border" : "",
          className
        )}
      >
        <span className="flex items-center gap-2 truncate text-muted-foreground">
          <Calendar className="h-3.5 w-3.5 shrink-0 text-foreground/70" />
          {hasSelections ? (
            <span className="truncate text-foreground font-medium flex items-center gap-1">
              {triggerLabel}
              {detectPresetFromRange(startDate, endDate) === effectiveDefault && effectiveDefault !== "all" && (
                <span title="Matching your default filter" className="text-amber-500 font-bold leading-none">•</span>
              )}
            </span>
          ) : (
            <span className="truncate">{placeholder}</span>
          )}
        </span>
        <div className="flex items-center gap-1 shrink-0 ml-1">
          {hasSelections && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation();
                  handleClear();
                }
              }}
              title="Clear date filter"
              className="p-0.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
            >
              <X className="h-3 w-3" />
            </span>
          )}
          <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
        </div>
      </button>

      {isOpen && mounted && dropdownPosition && createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: "fixed",
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
            width: `${dropdownPosition.width}px`,
            zIndex: 9999,
          }}
          className="flex flex-col rounded-xl border border-border bg-popover text-popover-foreground shadow-xl animate-in fade-in-0 zoom-in-95 p-3 gap-3"
        >
          <div className="flex items-center justify-between border-b border-border/50 pb-2">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-primary" />
              Filter Date Range
            </span>
            {(draftStart || draftEnd) && (
              <button
                type="button"
                onClick={() => {
                  setDraftStart("");
                  setDraftEnd("");
                  setDateError(null);
                }}
                className="text-[11px] font-medium text-muted-foreground hover:text-foreground hover:underline focus:outline-none"
              >
                Reset
              </button>
            )}
          </div>

          <div className="space-y-2">
            <div>
              <label className="text-[11px] font-medium text-muted-foreground mb-1 block">
                Start Date
              </label>
              <input
                type="date"
                value={draftStart}
                onChange={(e) => {
                  setDraftStart(e.target.value);
                  setDateError(null);
                }}
                className="h-8 w-full rounded-lg border border-border bg-muted/40 px-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground mb-1 block">
                End Date
              </label>
              <input
                type="date"
                value={draftEnd}
                onChange={(e) => {
                  setDraftEnd(e.target.value);
                  setDateError(null);
                }}
                className="h-8 w-full rounded-lg border border-border bg-muted/40 px-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          {dateError && (
            <p className="text-[11px] text-destructive font-medium leading-tight">{dateError}</p>
          )}

          <div className="flex flex-wrap gap-1 pt-1 border-t border-border/40">
            <button
              type="button"
              onClick={() => handlePreset("today")}
              className={cn(
                "text-[10px] px-2 py-0.5 rounded-md transition-colors cursor-pointer",
                activePreset === "today"
                  ? "bg-primary text-primary-foreground font-medium"
                  : "bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => handlePreset("thisWeek")}
              className={cn(
                "text-[10px] px-2 py-0.5 rounded-md transition-colors cursor-pointer",
                activePreset === "thisWeek"
                  ? "bg-primary text-primary-foreground font-medium"
                  : "bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              This Week
            </button>
            <button
              type="button"
              onClick={() => handlePreset("thisMonth")}
              className={cn(
                "text-[10px] px-2 py-0.5 rounded-md transition-colors cursor-pointer",
                activePreset === "thisMonth"
                  ? "bg-primary text-primary-foreground font-medium"
                  : "bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              This Month
            </button>
            <button
              type="button"
              onClick={() => handlePreset("last30Days")}
              className={cn(
                "text-[10px] px-2 py-0.5 rounded-md transition-colors cursor-pointer",
                activePreset === "last30Days"
                  ? "bg-primary text-primary-foreground font-medium"
                  : "bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              Last 30 Days
            </button>
          </div>

          {/* Quick Default Action */}
          <div className="flex items-center justify-between pt-2 border-t border-border/40 text-[11px]">
            <div className="flex items-center gap-1.5 text-muted-foreground min-w-0 pr-1">
              <Star
                className={cn(
                  "h-3.5 w-3.5 shrink-0 transition-colors",
                  isCurrentlyDefault ? "text-amber-500 fill-amber-500" : "text-muted-foreground/60"
                )}
              />
              <span className="truncate">
                Default: <span className="font-semibold text-foreground">{DATE_RANGE_PRESET_LABELS[effectiveDefault]}</span>
              </span>
            </div>
            <button
              type="button"
              onClick={handleSetCurrentAsDefault}
              title="Save current date filter as your default"
              className={cn(
                "shrink-0 text-[10px] font-medium px-2 py-0.5 rounded transition-colors cursor-pointer",
                isCurrentlyDefault
                  ? "bg-muted text-muted-foreground cursor-default"
                  : "bg-primary/10 text-primary hover:bg-primary/20"
              )}
            >
              {isCurrentlyDefault ? "Saved as Default" : "Set as Default"}
            </button>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
            <button
              type="button"
              onClick={close}
              className="h-7 px-3 text-xs font-medium rounded-lg text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="h-7 px-3 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs cursor-pointer"
            >
              Apply
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

