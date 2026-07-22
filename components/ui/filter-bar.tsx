import * as React from "react"
import { Search, ChevronDown, Check } from "lucide-react"
import { Input } from "@/components/ui/input"
import { SelectTrigger } from "@/components/ui/select"
import { cn } from "@/lib/utils"

export function FilterContainer({ children, className }: { children: React.ReactNode, className?: string }) {
  return (
    <div className={cn("bg-card border border-border rounded-[1.25rem] p-2 shadow-sm mb-6 flex flex-col gap-2", className)}>
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
          "pl-9 h-9 rounded-full bg-muted/50 border-border hover:border-border/80 text-sm transition-colors text-foreground placeholder:text-muted-foreground w-full",
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
      "h-9 rounded-full bg-muted/50 border-border hover:border-border/80 text-sm transition-colors text-foreground",
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
}

export function FilterMultiSelect({
  placeholder,
  icon,
  options,
  selectedValues,
  onSelectedValuesChange,
  className,
}: FilterMultiSelectProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const toggleOption = (value: string) => {
    if (selectedValues.includes(value)) {
      onSelectedValuesChange(selectedValues.filter(v => v !== value));
    } else {
      onSelectedValuesChange([...selectedValues, value]);
    }
  };

  const handleSelectAll = () => {
    onSelectedValuesChange(options.map(opt => opt.value));
  };

  const handleClear = () => {
    onSelectedValuesChange([]);
  };

  const hasSelections = selectedValues.length > 0;
  
  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex h-9 w-full min-w-[180px] items-center justify-between rounded-full bg-muted/50 border border-border px-3 py-2 text-sm shadow-sm transition-colors hover:border-border/80 focus:outline-none focus:ring-2 focus:ring-ring/30",
          className
        )}
      >
        <span className="flex items-center gap-2 truncate text-muted-foreground">
          {icon}
          {hasSelections ? (
            <span className="text-foreground font-medium">
              {placeholder} ({selectedValues.length})
            </span>
          ) : (
            <span>{placeholder}</span>
          )}
        </span>
        <ChevronDown className="h-4 w-4 opacity-50" />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 z-50 w-full min-w-[200px] max-h-72 overflow-y-auto rounded-xl border border-border bg-popover text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 p-1">
          {options.length === 0 ? (
            <div className="py-2 px-2 text-sm text-muted-foreground text-center">No options found.</div>
          ) : (
            <>
              <div className="flex items-center justify-between px-2 py-1.5 border-b border-border/50 mb-1 sticky top-0 bg-popover z-10 backdrop-blur-sm bg-opacity-90">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-xs font-medium text-primary hover:underline focus:outline-none"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-xs font-medium text-muted-foreground hover:text-foreground hover:underline focus:outline-none"
                >
                  Clear
                </button>
              </div>
              {options.map((option) => {
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
              })}
            </>
          )}
        </div>
      )}
    </div>
  )
}
