"use client"

import { useRouter } from "next/navigation"
import { ReactNode, useState } from "react"
import { Sidebar } from "@/components/layout/sidebar"
import { Button } from "@/components/ui/button"
import { Eye, Undo2 } from "lucide-react"
import { PWAInstallBanner } from "@/components/pwa/pwa-install-banner"

export function AppLayout({
  children,
  userName,
  userEmail,
  userOccupation,
  userLevel,
  isImpersonating = false,
  realEmail,
}: {
  children: ReactNode
  userName: string
  userEmail: string
  userOccupation?: string | null
  userLevel: number
  isImpersonating?: boolean
  realEmail?: string
}) {
  const router = useRouter()
  const [stopping, setStopping] = useState(false)

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    router.push("/login")
    router.refresh()
  }

  const handleStopImpersonating = async () => {
    setStopping(true)
    try {
      const res = await fetch("/api/impersonate", { method: "DELETE" })
      if (res.ok) {
        // Redirect back to users page or refresh
        router.push("/users")
        router.refresh()
      }
    } catch (e) {
      console.error("Failed to stop impersonating:", e)
    } finally {
      setStopping(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Skip-to-content link for keyboard accessibility (WCAG 2.4.1) */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-1/2 focus:-translate-x-1/2 focus:z-[60] focus:rounded-xl focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:shadow-lg"
      >
        Skip to content
      </a>
      <Sidebar 
        userName={userName} 
        userEmail={userEmail} 
        userOccupation={userOccupation} 
        userLevel={userLevel} 
        onLogout={handleLogout} 
        isImpersonating={isImpersonating}
        realEmail={realEmail}
      />
      <main id="main-content" className="lg:pl-64">
        <div className="p-4 pt-16 lg:p-8 lg:pt-8 space-y-6">
          <PWAInstallBanner />
          {children}
        </div>
      </main>

      {/* Impersonation Floating Banner */}
      {isImpersonating && (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-2xl border border-amber-500/30 bg-card/90 p-4 shadow-xl backdrop-blur-md animate-in slide-in-from-bottom-5 duration-300">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Eye className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="flex h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                <p className="text-xs font-semibold text-foreground">Impersonating Account</p>
              </div>
              <p className="mt-1 text-xs font-medium text-muted-foreground truncate">
                {userName}
              </p>
              <p className="text-[10px] text-muted-foreground truncate">
                {userEmail} ({userOccupation || "Staff"})
              </p>
              <p className="mt-2 text-[9px] text-amber-600 dark:text-amber-400 font-medium bg-amber-500/5 px-2 py-1 rounded-lg border border-amber-500/10">
                Read-only permissions applied. Write actions are saved under your real identity: {realEmail || "Super User"}.
              </p>
              <Button
                variant="default"
                size="xs"
                onClick={handleStopImpersonating}
                disabled={stopping}
                className="mt-3 w-full bg-amber-600 hover:bg-amber-500 text-white font-medium shadow-sm transition-colors rounded-xl"
              >
                <Undo2 className="mr-1.5 h-3.5 w-3.5" />
                {stopping ? "Returning..." : "Return to Super User"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
