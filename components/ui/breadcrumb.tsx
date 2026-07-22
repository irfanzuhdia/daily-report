"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRight, Home } from "lucide-react"
import { cn } from "@/lib/utils"

/* ─────────────────────── Route label overrides ─────────────────────── */

const LABEL_MAP: Record<string, string> = {
  reports: "Daily Reports",
  projects: "Projects",
  tasks: "Tasks",
  users: "Users & Roles",
  ticketing: "Ticketing",
  inbox: "Inbox",
  trash: "Trash",
  dashboard: "Dashboard",
  analytics: "Analytics",
  new: "New",
  edit: "Edit",
}

function humanize(segment: string): string {
  if (LABEL_MAP[segment]) return LABEL_MAP[segment]
  // Check for UUID-like dynamic segments — show as "Detail"
  if (/^[0-9a-f-]{20,}$/i.test(segment)) return "Detail"
  // Convert kebab-case to title case
  return segment
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/* ─────────────────────── Breadcrumb ─────────────────────── */

interface BreadcrumbProps {
  /** Override auto-generated labels: { "/reports": "My Reports" } */
  overrides?: Record<string, string>
  className?: string
}

export function Breadcrumb({ overrides, className }: BreadcrumbProps) {
  const pathname = usePathname()

  const crumbs = React.useMemo(() => {
    const segments = pathname
      .split("/")
      .filter(Boolean)

    const items: { label: string; href: string }[] = []

    let accumulated = ""
    for (const seg of segments) {
      accumulated += `/${seg}`
      const label = overrides?.[accumulated] ?? humanize(seg)
      items.push({ label, href: accumulated })
    }

    return items
  }, [pathname, overrides])

  if (crumbs.length <= 1) return null

  return (
    <nav aria-label="Breadcrumb" className={cn("mb-4", className)}>
      <ol className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <li>
          <Link
            href="/reports/dashboard"
            className="flex items-center gap-1 rounded-md px-1.5 py-0.5 transition-colors hover:text-foreground"
          >
            <Home className="h-3.5 w-3.5" />
          </Link>
        </li>
        {crumbs.map((crumb, i) => {
          const isLast = i === crumbs.length - 1
          return (
            <React.Fragment key={crumb.href}>
              <li aria-hidden="true">
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
              </li>
              <li>
                {isLast ? (
                  <span className="rounded-md px-1.5 py-0.5 font-medium text-foreground">
                    {crumb.label}
                  </span>
                ) : (
                  <Link
                    href={crumb.href}
                    className="rounded-md px-1.5 py-0.5 transition-colors hover:text-foreground"
                  >
                    {crumb.label}
                  </Link>
                )}
              </li>
            </React.Fragment>
          )
        })}
      </ol>
    </nav>
  )
}
