"use client"

import * as React from "react"
import { useViewMode } from "@/lib/view-mode"
import { Users, User } from "lucide-react"
import { cn } from "@/lib/utils"

export function ViewModeToggle({ className }: { className?: string }) {
  const { viewMode, setViewMode } = useViewMode()

  return (
    <div className={cn("inline-flex items-center rounded-full bg-muted/60 p-1 border border-border/80 shrink-0 w-fit", className)}>
      <button
        type="button"
        onClick={() => setViewMode("team")}
        className={cn(
          "flex items-center justify-center gap-1.5 rounded-full px-3.5 py-1 text-[11px] sm:text-xs font-semibold transition-all cursor-pointer select-none whitespace-nowrap",
          viewMode === "team"
            ? "bg-background text-foreground shadow-xs"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Users className="h-3.5 w-3.5 text-primary shrink-0" />
        <span>Team View</span>
      </button>
      <button
        type="button"
        onClick={() => setViewMode("my")}
        className={cn(
          "flex items-center justify-center gap-1.5 rounded-full px-3.5 py-1 text-[11px] sm:text-xs font-semibold transition-all cursor-pointer select-none whitespace-nowrap",
          viewMode === "my"
            ? "bg-background text-foreground shadow-xs"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <User className="h-3.5 w-3.5 text-primary shrink-0" />
        <span>My View</span>
      </button>
    </div>
  )
}
