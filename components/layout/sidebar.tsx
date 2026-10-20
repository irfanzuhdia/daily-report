"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
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
  Bell,
  BellOff,
  Send,
  Check,
  Download,
  Smartphone,
  Calendar,
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
import { usePushNotifications } from "@/components/pwa/pwa-install-banner"
import {
  DateRangePreset,
  DATE_RANGE_PRESET_LABELS,
  getStoredGlobalPreference,
  getStoredPagePreference,
  setStoredDateRangePreference,
  AppPageName,
} from "@/lib/date-range-preference"
import { revalidatePathsAndTags } from "@/app/actions"

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
  const pushNotif = usePushNotifications()
  const { viewMode, setViewMode } = useViewMode()
  const { density, setDensity } = useViewDensity()
  const [mounted, setMounted] = React.useState(false)
  const { resolvedTheme, setTheme } = useTheme()
  const router = useRouter()

  const [globalDateRange, setGlobalDateRange] = React.useState<DateRangePreset>("all")
  const [projectsDateRange, setProjectsDateRange] = React.useState<DateRangePreset | "use_global">("use_global")
  const [tasksDateRange, setTasksDateRange] = React.useState<DateRangePreset | "use_global">("use_global")
  const [reportsDateRange, setReportsDateRange] = React.useState<DateRangePreset | "use_global">("use_global")
  const [showPerPageSettings, setShowPerPageSettings] = React.useState(false)

  React.useEffect(() => {
    const loadDatePrefs = () => {
      setGlobalDateRange(getStoredGlobalPreference())
      setProjectsDateRange(getStoredPagePreference("projects"))
      setTasksDateRange(getStoredPagePreference("tasks"))
      setReportsDateRange(getStoredPagePreference("reports"))
    }
    loadDatePrefs()
    window.addEventListener("dr_date_range_preference_changed", loadDatePrefs)
    return () => window.removeEventListener("dr_date_range_preference_changed", loadDatePrefs)
  }, [])

  const handleGlobalDateRangeChange = async (preset: DateRangePreset) => {
    setGlobalDateRange(preset)
    setStoredDateRangePreference(preset)
    try {
      await revalidatePathsAndTags(['/projects', '/tasks', '/reports'])
    } catch {}
    router.refresh()
  }

  const handlePageDateRangeChange = async (page: AppPageName, preset: DateRangePreset | "use_global") => {
    if (page === "projects") setProjectsDateRange(preset)
    if (page === "tasks") setTasksDateRange(preset)
    if (page === "reports") setReportsDateRange(preset)

    setStoredDateRangePreference(preset, page)
    try {
      await revalidatePathsAndTags([`/${page}`])
    } catch {}
    router.refresh()
  }

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
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchUnreadCount()
      }
    }

    window.addEventListener("notificationsUpdated", handleUpdate)
    document.addEventListener("visibilitychange", handleVisibilityChange)

    // Poll every 15s only when tab is active/visible
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchUnreadCount()
      }
    }, 15000)

    // Supabase Realtime WebSocket for notification counter
    const { supabase } = require("@/lib/supabase-client")
    const channel = supabase
      .channel('sidebar-notifications')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications' },
        () => {
          fetchUnreadCount()
        }
      )
      .subscribe()
    
    const handleOpenMobile = () => {
      setMobileOpen(true)
      window.dispatchEvent(new Event("mobileSidebarOpened"))
    }
    window.addEventListener("openMobileSidebar", handleOpenMobile)

    return () => {
      active = false
      window.removeEventListener("notificationsUpdated", handleUpdate)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("openMobileSidebar", handleOpenMobile)
      clearInterval(interval)
      if (supabase && channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [])

  const handleLogoutClick = () => {
    setLogoutConfirm(true)
  }

  const handleLogoutConfirm = () => {
    setLogoutConfirm(false)
    onLogout()
  }

  const handleCloseMobile = () => {
    setMobileOpen(false)
    window.dispatchEvent(new Event("mobileSidebarClosed"))
  }

  return (
    <>
      {/* Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={handleCloseMobile}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-50 flex h-full w-64 flex-col border-r bg-card transition-transform duration-300 lg:translate-x-0 shadow-2xl",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center justify-between border-b px-6">
          <div className="flex items-center gap-2.5">
            <MDMLogo className="h-7 w-7 shrink-0" />
            <div className="flex flex-col">
              <span className="text-sm font-bold tracking-tight text-foreground leading-none">MDM</span>
              <span className="text-xs text-muted-foreground font-medium">Daily Report</span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCloseMobile}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
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
        <DialogContent className="sm:max-w-[420px]">
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

            {/* Default Date Range Setting */}
            <div className="space-y-2.5 border-t pt-3">
              <div className="space-y-0.5">
                <p className="text-xs font-medium flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-primary" />
                  Default Date Range
                </p>
                <p className="text-[10px] text-muted-foreground">
                  Default filter applied when opening Project, Task, and Daily Report
                </p>
              </div>

              {/* Global Preset Selector */}
              <div className="space-y-1">
                <div className="grid grid-cols-3 gap-1">
                  {(["all", "today", "thisWeek", "thisMonth", "last30Days"] as DateRangePreset[]).map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handleGlobalDateRangeChange(preset)}
                      className={cn(
                        "rounded-lg px-2 py-1 text-[10px] font-medium transition-colors border text-center truncate",
                        globalDateRange === preset
                          ? "bg-primary text-primary-foreground border-primary shadow-xs font-semibold"
                          : "bg-muted/30 border-border text-muted-foreground hover:text-foreground hover:bg-muted/60"
                      )}
                    >
                      {DATE_RANGE_PRESET_LABELS[preset]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Toggle Page-specific overrides */}
              <div className="pt-0.5">
                <button
                  type="button"
                  onClick={() => setShowPerPageSettings(!showPerPageSettings)}
                  className="text-[11px] font-medium text-primary hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <ChevronDown className={cn("h-3 w-3 transition-transform", showPerPageSettings ? "rotate-180" : "")} />
                  {showPerPageSettings ? "Hide page-specific settings" : "Customize per page (optional)"}
                </button>

                {showPerPageSettings && (
                  <div className="mt-2 space-y-2 rounded-lg bg-muted/20 border border-border/50 p-2.5">
                    {/* Projects */}
                    <div className="flex items-center justify-between text-[11px] gap-2">
                      <span className="font-medium text-foreground truncate">Projects</span>
                      <select
                        value={projectsDateRange}
                        onChange={(e) => handlePageDateRangeChange("projects", e.target.value as any)}
                        className="h-7 text-[10px] rounded-md border border-border bg-background px-1.5 py-0.5 text-foreground focus:outline-none"
                      >
                        <option value="use_global">Global ({DATE_RANGE_PRESET_LABELS[globalDateRange]})</option>
                        <option value="all">All Time</option>
                        <option value="today">Today</option>
                        <option value="thisWeek">This Week</option>
                        <option value="thisMonth">This Month</option>
                        <option value="last30Days">Last 30 Days</option>
                      </select>
                    </div>

                    {/* Tasks */}
                    <div className="flex items-center justify-between text-[11px] gap-2">
                      <span className="font-medium text-foreground truncate">Tasks</span>
                      <select
                        value={tasksDateRange}
                        onChange={(e) => handlePageDateRangeChange("tasks", e.target.value as any)}
                        className="h-7 text-[10px] rounded-md border border-border bg-background px-1.5 py-0.5 text-foreground focus:outline-none"
                      >
                        <option value="use_global">Global ({DATE_RANGE_PRESET_LABELS[globalDateRange]})</option>
                        <option value="all">All Time</option>
                        <option value="today">Today</option>
                        <option value="thisWeek">This Week</option>
                        <option value="thisMonth">This Month</option>
                        <option value="last30Days">Last 30 Days</option>
                      </select>
                    </div>

                    {/* Daily Reports */}
                    <div className="flex items-center justify-between text-[11px] gap-2">
                      <span className="font-medium text-foreground truncate">Daily Reports</span>
                      <select
                        value={reportsDateRange}
                        onChange={(e) => handlePageDateRangeChange("reports", e.target.value as any)}
                        className="h-7 text-[10px] rounded-md border border-border bg-background px-1.5 py-0.5 text-foreground focus:outline-none"
                      >
                        <option value="use_global">Global ({DATE_RANGE_PRESET_LABELS[globalDateRange]})</option>
                        <option value="all">All Time</option>
                        <option value="today">Today</option>
                        <option value="thisWeek">This Week</option>
                        <option value="thisMonth">This Month</option>
                        <option value="last30Days">Last 30 Days</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* App & Notifications */}
            <div className="space-y-3 border-t pt-3">
              <div className="space-y-0.5">
                <p className="text-xs font-medium flex items-center gap-1.5">
                  <Smartphone className="h-3.5 w-3.5 text-indigo-500" />
                  App & Notifications
                </p>
                <p className="text-[10px] text-muted-foreground">Install app & manage push notifications</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={pushNotif.togglePushNotifications}
                  disabled={pushNotif.loading}
                  size="sm"
                  variant={pushNotif.isSubscribed ? "outline" : "default"}
                  className={
                    pushNotif.isSubscribed
                      ? "border-border hover:bg-accent text-foreground gap-1.5 text-xs h-8"
                      : "bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5 text-xs h-8"
                  }
                >
                  {pushNotif.isSubscribed ? <BellOff className="w-3.5 h-3.5 text-emerald-500" /> : <Bell className="w-3.5 h-3.5" />}
                  {pushNotif.isSubscribed ? "Notifications On" : "Enable Notifications"}
                </Button>

                {pushNotif.isSubscribed && (
                  <Button
                    onClick={pushNotif.sendTestNotification}
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground hover:text-foreground gap-1.5 text-xs h-8"
                  >
                    {pushNotif.testSent ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Send className="w-3.5 h-3.5 text-blue-500" />}
                    {pushNotif.testSent ? "Sent!" : "Test Alert"}
                  </Button>
                )}
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
