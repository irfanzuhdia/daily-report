"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

/* ─────────────────────── Page Header ─────────────────────── */

interface PageHeaderProps {
  title: string
  description?: string
  children?: React.ReactNode // Action buttons slot
  className?: string
}

export function PageHeader({
  title,
  description,
  children,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4",
        className
      )}
    >
      <div className="min-w-0 flex-1">
        <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          {title}
        </h1>
        {description && (
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {children && (
        <div className="flex shrink-0 items-center gap-2">{children}</div>
      )}
    </div>
  )
}

/* ─────────────────────── Page Container ─────────────────────── */

interface PageContainerProps {
  children: React.ReactNode
  className?: string
}

/**
 * Wraps page content with consistent max-width and spacing.
 */
export function PageContainer({ children, className }: PageContainerProps) {
  return (
    <div className={cn("mx-auto w-full max-w-7xl space-y-6", className)}>
      {children}
    </div>
  )
}
