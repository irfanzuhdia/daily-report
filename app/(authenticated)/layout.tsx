import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { AppLayout } from "@/components/layout/app-layout"

interface AuthenticatedLayoutProps {
  children: React.ReactNode
}

export default async function AuthenticatedLayout({
  children,
}: AuthenticatedLayoutProps) {
  const session = await getSession()
  if (!session) {
    redirect("/login")
  }

  return (
    <AppLayout userName={session.name} userEmail={session.email}>
      {children}
    </AppLayout>
  )
}
