import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { AppLayout } from "@/components/layout/app-layout"
import { StatusRepository, UserRepository } from "@/lib/repositories"
import { ProjectForm } from "../project-form"

export default async function NewProjectPage() {
  const session = await getSession()
  if (!session) redirect("/login")

  const [statuses, users] = await Promise.all([
    StatusRepository.findAll(),
    UserRepository.findAll(),
  ])

  return (
    <AppLayout userName={session.name} userEmail={session.email}>
      <ProjectForm
        statuses={statuses}
        users={users}
        initialTeamUserIds={[session.user_id]}
      />
    </AppLayout>
  )
}
