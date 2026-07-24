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
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchUnread()
      }
    }

    window.addEventListener("notificationsUpdated", handleUpdate)
    document.addEventListener("visibilitychange", handleVisibilityChange)

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchUnread()
      }
    }, 15000)

    return () => {
      active = false
      window.removeEventListener("notificationsUpdated", handleUpdate)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      clearInterval(interval)
    }
  }, [])

  const navItems = [
    { href: "/reports/dashboard", label: "Home", icon: LayoutDashboard },
    { href: "/projects", label: "Projects", icon: FolderKanban },
    { href: "/tasks", label: "Tasks", icon: ListTodo },
    { href: "/reports", label: "Reports", icon: FileText },
    { href: "/inbox", label: "Inbox", icon: Inbox, badge: unreadCount },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-14 items-center justify-around border-t border-border/60 bg-background/90 px-2 backdrop-blur-xl sm:hidden shadow-2xl safe-area-pb pb-[env(safe-area-inset-bottom,4px)]">
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
              "relative flex flex-col items-center justify-center flex-1 h-full py-1 text-[10px] font-medium transition-all duration-200",
              isActive ? "text-primary font-semibold" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <div
              className={cn(
                "relative flex items-center justify-center px-3 py-1 rounded-full transition-all duration-200",
                isActive ? "bg-primary/10 text-primary scale-105" : ""
              )}
            >
              <Icon className="h-5 w-5" />
              {!!item.badge && item.badge > 0 && (
                <span className="absolute -top-0.5 -right-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-red-500 px-1 text-[8px] font-bold text-white shadow-sm animate-in zoom-in-50">
                  {item.badge > 99 ? "99+" : item.badge}
                </span>
              )}
            </div>
            <span className="mt-0.5 leading-none text-[9px]">{item.label}</span>
          </Link>
        )
      })}

      <button
        type="button"
        onClick={onOpenMobileMenu}
        className="flex flex-col items-center justify-center flex-1 h-full py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-all duration-200"
      >
        <div className="flex items-center justify-center px-3 py-1 rounded-full">
          <Menu className="h-5 w-5" />
        </div>
        <span className="mt-0.5 leading-none text-[9px]">Menu</span>
      </button>
    </nav>
  )
}
