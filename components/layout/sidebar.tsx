"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  FolderKanban,
  ListTodo,
  FileText,
  LogOut,
  Menu,
  X,
  BarChart3,
  Trash2,
  User,
  Users,
  Inbox,
  Sun,
  Moon,
  Settings,
  LifeBuoy,
  ChevronDown,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useViewMode } from "@/lib/view-mode"
import { useViewDensity } from "@/lib/view-density"
import { useTheme } from "next-themes"
import { MDMLogo } from "@/components/ui/mdm-logo"

export function Sidebar({
  userName,
  userEmail,
  userOccupation,
  userLevel,
  onLogout,
  isImpersonating = false,
  realEmail,
}: {
  userName: string
  userEmail: string
  userOccupation?: string | null
  userLevel: number
  onLogout: () => void
  isImpersonating?: boolean
  realEmail?: string
}) {
  const isRealSuperUser = realEmail === 'gadmin@multidayamitra.co.id' || (!isImpersonating && userEmail === 'gadmin@multidayamitra.co.id');
  const normOcc = userOccupation?.toLowerCase().replace(/\s+/g, "") ?? "";
  const isAdmin = ["superuser", "cosuperuser", "co-superuser"].includes(normOcc) || isRealSuperUser;
  const monitoringItems = [
    { href: "/reports/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/projects", label: "Projects", icon: FolderKanban },
    { href: "/tasks", label: "Tasks", icon: ListTodo },
    { href: "/reports", label: "Daily Reports", icon: FileText },
    { href: "/reports/analytics", label: "Analytics", icon: BarChart3 },
  ]

  const otherItems = [
    { href: "/ticketing", label: "Ticketing", icon: LifeBuoy },
    { href: "/inbox", label: "Inbox", icon: Inbox },
    ...(isAdmin ? [{ href: "/users", label: "Users & Roles", icon: Users }] : []),
    { href: "/trash", label: "Trash", icon: Trash2 },
  ]

  const pathname = usePathname()
  const isProjectMonitoringActive = React.useMemo(() => {
    return pathname.startsWith("/reports") || pathname.startsWith("/projects") || pathname.startsWith("/tasks");
  }, [pathname])

  const [projectMonitoringExpanded, setProjectMonitoringExpanded] = React.useState(isProjectMonitoringActive)

  React.useEffect(() => {
    if (isProjectMonitoringActive) {
      setProjectMonitoringExpanded(true)
    }
  }, [pathname, isProjectMonitoringActive])

  const [mobileOpen, setMobileOpen] = React.useState(false)
  const [logoutConfirm, setLogoutConfirm] = React.useState(false)
  const [settingsOpen, setSettingsOpen] = React.useState(false)
  const { viewMode, setViewMode } = useViewMode()
  const { density, setDensity } = useViewDensity()
  const [mounted, setMounted] = React.useState(false)
  const { resolvedTheme, setTheme } = useTheme()

  React.useEffect(() => {
    setMounted(true)
  }, [])

  React.useEffect(() => {
    if (userLevel === 1 && viewMode !== "my") {
      setViewMode("my")
    }
  }, [userLevel, viewMode, setViewMode])

  const [localUnreadCount, setLocalUnreadCount] = React.useState(0)

  React.useEffect(() => {
    let active = true
    const fetchUnreadCount = async () => {
      try {
        const res = await fetch("/api/notifications?count_only=true")
        if (res.ok && active) {
          const data = await res.json()
          setLocalUnreadCount(data.unreadCount || 0)
        }
      } catch (e) {
        console.error(e)
      }
    }

    fetchUnreadCount()
    
    const handleUpdate = () => {
      fetchUnreadCount()
    }
    
    window.addEventListener("notificationsUpdated", handleUpdate)
    const interval = setInterval(fetchUnreadCount, 10000)
    
    return () => {
      active = false
      window.removeEventListener("notificationsUpdated", handleUpdate)
      clearInterval(interval)
    }
  }, [])

  const handleLogoutClick = () => {
    setLogoutConfirm(true)
  }

  const handleLogoutConfirm = () => {
    setLogoutConfirm(false)
    onLogout()
  }

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed top-4 left-4 z-50 rounded-xl border bg-background p-2 shadow-sm lg:hidden"
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-40 flex h-full w-64 flex-col border-r bg-card transition-transform lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center gap-2.5 border-b px-6">
          <MDMLogo className="h-7 w-7 shrink-0" />
          <div className="flex flex-col">
            <span className="text-sm font-bold tracking-tight text-foreground leading-none">MDM</span>
            <span className="text-xs text-muted-foreground font-medium">Daily Report</span>
          </div>
        </div>

        <nav className="flex-1 space-y-1 p-4 overflow-y-auto">
          {/* Project Monitoring Expandable Group */}
          <div className="space-y-1">
            <Link
              href="/reports/dashboard"
              onClick={() => {
                setProjectMonitoringExpanded(!projectMonitoringExpanded)
                setMobileOpen(false)
              }}
              className={cn(
                "flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
                isProjectMonitoringActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <div className="flex items-center gap-3">
                <FolderKanban className="h-4.5 w-4.5 shrink-0" />
                <span>Project Monitoring</span>
              </div>
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform duration-200",
                  projectMonitoringExpanded ? "transform rotate-0" : "transform -rotate-90"
                )}
              />
            </Link>

            {projectMonitoringExpanded && (
              <div className="ml-3 pl-3 border-l border-muted/50 space-y-1 pt-1 pb-2">
                {/* View Mode Toggle inside Project Monitoring */}
                {userLevel > 1 && (
                  <div className="pb-2">
                    <div className="flex rounded-lg border bg-muted/10 p-0.5 gap-0.5">
                      <button
                        onClick={() => setViewMode("my")}
                        className={cn(
                          "flex flex-1 items-center justify-center gap-1.5 rounded-md py-1 text-[10px] font-semibold transition-colors",
                          viewMode === "my"
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <User className="h-2.5 w-2.5" />
                        My View
                      </button>
                      <button
                        onClick={() => setViewMode("team")}
                        className={cn(
                          "flex flex-1 items-center justify-center gap-1.5 rounded-md py-1 text-[10px] font-semibold transition-colors",
                          viewMode === "team"
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <Users className="h-2.5 w-2.5" />
                        Team
                      </button>
                    </div>
                  </div>
                )}

                {/* Sub-menu Items */}
                {monitoringItems.map((item) => {
                  const active = item.href === "/reports"
                    ? pathname === "/reports" || (pathname.startsWith("/reports/") && !pathname.startsWith("/reports/dashboard") && !pathname.startsWith("/reports/analytics"))
                    : pathname === item.href || pathname.startsWith(item.href + "/")
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors",
                        active
                          ? "bg-primary/5 text-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <item.icon className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="h-px bg-muted/40 my-2" />

          {/* Main level items outside Project Monitoring */}
          {otherItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/")
            const isInbox = item.href === "/inbox"
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <div className="flex items-center gap-3">
                  <item.icon className="h-4 w-4 shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <span className="truncate">{item.label}</span>
                    {item.href === "/users" && isImpersonating && (
                      <span className="text-[9px] text-destructive font-normal leading-none mt-0.5 whitespace-normal">
                        *Not available for this user
                      </span>
                    )}
                  </div>
                </div>
                {isInbox && localUnreadCount > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                    {localUnreadCount}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        <div className="border-t p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary shrink-0">
                {userName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{userName}</p>
                <p className="truncate text-xs text-muted-foreground">{userEmail}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground rounded-lg"
              onClick={() => setSettingsOpen(true)}
              title="Settings"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={handleLogoutClick}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Logout Confirmation Dialog */}
      <Dialog open={logoutConfirm} onOpenChange={setLogoutConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Logout</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to log out? You will need to sign in again to access your account.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setLogoutConfirm(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleLogoutConfirm}>
              Logout
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Settings / Preferences Dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Settings className="h-4 w-4 text-primary" />
              Preferences
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-3">
            {/* Theme setting */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-xs font-medium">Theme Mode</p>
                <p className="text-[10px] text-muted-foreground">Toggle dark or light theme</p>
              </div>
              <div className="flex rounded-xl border p-0.5 bg-muted/20">
                <button
                  type="button"
                  onClick={() => setTheme("light")}
                  className={cn(
                    "rounded-lg p-1.5 text-[10px] font-medium transition-colors flex items-center justify-center h-7 w-9",
                    mounted && resolvedTheme === "light"
                      ? "bg-background text-foreground shadow-sm border"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  title="Light Mode"
                >
                  <Sun className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setTheme("dark")}
                  className={cn(
                    "rounded-lg p-1.5 text-[10px] font-medium transition-colors flex items-center justify-center h-7 w-9",
                    mounted && resolvedTheme === "dark"
                      ? "bg-background text-foreground shadow-sm border"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  title="Dark Mode"
                >
                  <Moon className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Density setting */}
            <div className="flex items-center justify-between border-t pt-3">
              <div className="space-y-0.5">
                <p className="text-xs font-medium">Layout Density</p>
                <p className="text-[10px] text-muted-foreground">Adjust text sizing and spacing density</p>
              </div>
              <div className="flex rounded-xl border p-0.5 bg-muted/20">
                <button
                  type="button"
                  onClick={() => setDensity("comfortable")}
                  className={cn(
                    "rounded-lg px-2.5 py-1 text-[10px] font-medium transition-colors h-7 flex items-center justify-center",
                    density === "comfortable"
                      ? "bg-background text-foreground shadow-sm border"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Comfortable
                </button>
                <button
                  type="button"
                  onClick={() => setDensity("compact")}
                  className={cn(
                    "rounded-lg px-2.5 py-1 text-[10px] font-medium transition-colors h-7 flex items-center justify-center",
                    density === "compact"
                      ? "bg-background text-foreground shadow-sm border"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Compact
                </button>
              </div>
            </div>
          </div>
          <div className="flex justify-end pt-2 border-t">
            <Button variant="secondary" size="xs" onClick={() => setSettingsOpen(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
