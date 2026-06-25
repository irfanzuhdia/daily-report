"use client"

import { useEffect, useState } from "react"
import { useViewDensity } from "@/lib/view-density"
import Link from "next/link"
import { Bell, Check, CheckCheck, Inbox, Loader2, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Notification } from "@/lib/types"

export default function InboxPage() {
  const { density } = useViewDensity()
  const isCompact = density === "compact"
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [markingAll, setMarkingAll] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const LIMIT = 50

  useEffect(() => {
    let active = true
    const fetchNotifications = async () => {
      try {
        const res = await fetch(`/api/notifications?limit=${LIMIT}&offset=0`)
        if (res.ok && active) {
          const data = await res.json()
          const list = data.notifications || []
          setNotifications(list)
          setHasMore(list.length === LIMIT)
        }
      } catch (error) {
        console.error("Failed to fetch notifications:", error)
      } finally {
        if (active) setLoading(false)
      }
    }

    fetchNotifications()
    return () => {
      active = false
    }
  }, [])

  const handleLoadMore = async () => {
    if (loadingMore) return
    setLoadingMore(true)
    try {
      const offset = notifications.length
      const res = await fetch(`/api/notifications?limit=${LIMIT}&offset=${offset}`)
      if (res.ok) {
        const data = await res.json()
        const list = data.notifications || []
        setNotifications((prev) => [...prev, ...list])
        setHasMore(list.length === LIMIT)
      }
    } catch (error) {
      console.error("Failed to load more notifications:", error)
    } finally {
      setLoadingMore(false)
    }
  }

  const markAsRead = async (id: string) => {
    try {
      const res = await fetch("/api/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
        )
        // Refresh sidebar and page layout state
        window.dispatchEvent(new Event("notificationsUpdated"))
      }
    } catch (error) {
      console.error("Failed to mark notification as read:", error)
    }
  }

  const markAllAsRead = async () => {
    if (markingAll) return
    setMarkingAll(true)
    try {
      const res = await fetch("/api/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      })
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
        window.dispatchEvent(new Event("notificationsUpdated"))
      }
    } catch (error) {
      console.error("Failed to mark all as read:", error)
    } finally {
      setMarkingAll(false)
    }
  }

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString)
      return date.toLocaleDateString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        day: "numeric",
        month: "short",
      })
    } catch {
      return isoString
    }
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inbox Notifications</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Stay up to date with updates and comments where you were mentioned.
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={markAllAsRead}
            disabled={markingAll}
          >
            {markingAll ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <CheckCheck className="mr-1.5 h-4 w-4 text-emerald-500" />
            )}
            Mark all as read
          </Button>
        )}
      </div>

      <Card className={isCompact ? "shadow-sm" : ""}>
        <CardHeader className={`flex flex-row items-center gap-2 border-b ${isCompact ? "p-3 pb-2" : "pb-4"}`}>
          <Inbox className="h-4 w-4 text-primary" />
          <CardTitle className={`font-bold ${isCompact ? "text-base" : "text-lg"}`}>
            All Messages {unreadCount > 0 && `(${unreadCount} unread)`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <Bell className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <h3 className="font-semibold text-base">Your inbox is empty</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                When you are mentioned in notes or comments, notifications will appear here.
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 transition-colors hover:bg-muted/30 ${
                    isCompact ? "p-2.5 px-3" : "p-4"
                  } ${
                    !n.is_read ? "bg-primary/[0.03] border-l-2 border-primary" : ""
                  }`}
                >
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-block h-1.5 w-1.5 rounded-full ${
                          !n.is_read ? "bg-primary animate-pulse" : "bg-transparent"
                        }`}
                      />
                      <span className="text-[10px] font-bold text-primary uppercase tracking-wide">
                        {n.type}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {formatTime(n.created_at)}
                      </span>
                    </div>
                    <h4 className={`font-bold text-foreground leading-snug ${isCompact ? "text-xs" : "text-sm"}`}>
                      {n.title}
                    </h4>
                    <p className={`text-muted-foreground leading-relaxed ${isCompact ? "text-[11px] line-clamp-1" : "text-sm line-clamp-2"}`}>
                      {n.content}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                    {!n.is_read && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className={isCompact ? "h-6 w-6" : ""}
                        onClick={() => markAsRead(n.id)}
                        title="Mark as read"
                      >
                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                      </Button>
                    )}
                    <Link href={n.link} onClick={() => !n.is_read && markAsRead(n.id)}>
                      <Button size="sm" className={isCompact ? "h-7 text-[10px] px-2.5 rounded-md" : "h-8 rounded-lg"}>
                        Go to item
                        <ArrowRight className="ml-1 h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
              {hasMore && (
                <div className="flex justify-center p-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="w-full sm:w-auto rounded-xl"
                  >
                    {loadingMore ? (
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin text-muted-foreground" />
                    ) : null}
                    Load older notifications
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
