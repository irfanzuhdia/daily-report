import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { AppLayout } from "@/components/layout/app-layout"
import { getUserLevel } from "@/lib/repositories"

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

  const userLevel = await getUserLevel(session.user_occupation)

  return (
    <AppLayout 
      userName={session.name} 
      userEmail={session.email} 
      userOccupation={session.user_occupation}
      userLevel={userLevel}
      isImpersonating={!!session.real_user_id}
      realEmail={session.real_email}
    >
      {children}
    </AppLayout>
  )
}
