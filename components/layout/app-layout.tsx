"use client"

import { useRouter } from "next/navigation"
import { ReactNode } from "react"
import { Sidebar } from "@/components/layout/sidebar"

export function AppLayout({
  children,
  userName,
  userEmail,
}: {
  children: ReactNode
  userName: string
  userEmail: string
}) {
  const router = useRouter()

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    router.push("/login")
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar userName={userName} userEmail={userEmail} onLogout={handleLogout} />
      <main className="lg:pl-64">
        <div className="p-4 pt-16 lg:p-8 lg:pt-8">{children}</div>
      </main>
    </div>
  )
}
