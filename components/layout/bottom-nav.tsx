"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  FolderKanban,
  ListTodo,
  FileText,
  Inbox,
  Menu,
} from "lucide-react"
import { cn } from "@/lib/utils"

export function BottomNav({
  onOpenMobileMenu,
}: {
  onOpenMobileMenu: () => void
}) {
  const pathname = usePathname()
  const [unreadCount, setUnreadCount] = React.useState(0)

  React.useEffect(() => {
    let active = true
    const fetchUnread = async () => {
      try {
        const res = await fetch("/api/notifications?count_only=true")
        if (res.ok && active) {
          const data = await res.json()
          setUnreadCount(data.unreadCount || 0)
        }
      } catch (e) {
        console.error(e)
      }
    }

    fetchUnread()
    const handleUpdate = () => fetchUnread()
    window.addEventListener("notificationsUpdated", handleUpdate)
    const interval = setInterval(fetchUnread, 5000)

    return () => {
      active = false
      window.removeEventListener("notificationsUpdated", handleUpdate)
      clearInterval(interval)
    }
  }, [])

  const navItems = [
    { href: "/reports/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/projects", label: "Projects", icon: FolderKanban },
    { href: "/tasks", label: "Tasks", icon: ListTodo },
    { href: "/reports", label: "Reports", icon: FileText },
    { href: "/inbox", label: "Inbox", icon: Inbox, badge: unreadCount },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-16 items-center justify-around border-t border-border/80 bg-background/95 px-1 backdrop-blur-lg sm:hidden shadow-lg supports-[backdrop-filter]:bg-background/80 safe-area-pb">
      {navItems.map((item) => {
        const Icon = item.icon
        const isActive =
          item.href === "/reports/dashboard"
            ? pathname === "/reports/dashboard"
            : pathname === item.href || pathname.startsWith(item.href + "/")

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "relative flex flex-col items-center justify-center flex-1 h-full py-1 text-[10px] font-medium transition-colors hover:text-primary",
              isActive ? "text-primary font-semibold" : "text-muted-foreground"
            )}
          >
            <div className="relative">
              <Icon className={cn("h-5 w-5 transition-transform", isActive && "scale-110")} />
              {!!item.badge && item.badge > 0 && (
                <span className="absolute -top-1 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white shadow-sm">
                  {item.badge > 99 ? "99+" : item.badge}
                </span>
              )}
            </div>
            <span className="mt-1 leading-none">{item.label}</span>
            {isActive && (
              <span className="absolute bottom-1.5 h-1 w-1 rounded-full bg-primary" />
            )}
          </Link>
        )
      })}

      <button
        type="button"
        onClick={onOpenMobileMenu}
        className="flex flex-col items-center justify-center flex-1 h-full py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <Menu className="h-5 w-5" />
        <span className="mt-1 leading-none">Menu</span>
      </button>
    </nav>
  )
}
