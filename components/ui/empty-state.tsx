"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { FileText, FolderOpen, Inbox, Search, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

/* ─────────────────────── Empty State ─────────────────────── */

type EmptyStateVariant = "default" | "search" | "error" | "inbox"

const VARIANT_CONFIG: Record<
  EmptyStateVariant,
  { icon: React.ElementType; defaultTitle: string; defaultDescription: string }
> = {
  default: {
    icon: FolderOpen,
    defaultTitle: "Nothing here yet",
    defaultDescription: "Get started by creating your first item.",
  },
  search: {
    icon: Search,
    defaultTitle: "No results found",
    defaultDescription: "Try adjusting your search or filters.",
  },
  error: {
    icon: AlertCircle,
    defaultTitle: "Something went wrong",
    defaultDescription: "An error occurred while loading data.",
  },
  inbox: {
    icon: Inbox,
    defaultTitle: "All caught up",
    defaultDescription: "No new notifications to show.",
  },
}

interface EmptyStateProps {
  variant?: EmptyStateVariant
  icon?: React.ElementType
  title?: string
  description?: string
  action?: {
    label: string
    onClick?: () => void
    href?: string
  }
  className?: string
}

export function EmptyState({
  variant = "default",
  icon: IconOverride,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  const config = VARIANT_CONFIG[variant]
  const Icon = IconOverride ?? config.icon

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed bg-muted/20 px-6 py-12 text-center",
        className
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/50 text-muted-foreground">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="mt-4 text-sm font-semibold text-foreground">
        {title ?? config.defaultTitle}
      </h3>
      <p className="mt-1 max-w-xs text-xs text-muted-foreground">
        {description ?? config.defaultDescription}
      </p>
      {action && (
        <div className="mt-4">
          {action.href ? (
            <a href={action.href}>
              <Button size="sm">{action.label}</Button>
            </a>
          ) : (
            <Button size="sm" onClick={action.onClick}>
              {action.label}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
