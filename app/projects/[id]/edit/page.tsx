import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { AppLayout } from "@/components/layout/app-layout"
import {
  ProjectRepository,
  StatusRepository,
  UserRepository,
  ProjectTeamRepository,
} from "@/lib/repositories"
import { ProjectForm } from "../../project-form"

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getSession()
  if (!session) redirect("/login")

  const { id } = await params
  const [project, statuses, users] = await Promise.all([
    ProjectRepository.findById(id),
    StatusRepository.findAll(),
    UserRepository.findAll(),
  ])

  if (!project) redirect("/projects")

  // Get current team members
  const projectTeam = await ProjectTeamRepository.findByProjectId(id)
  const initialTeamUserIds = projectTeam.map((pt) => pt.user_id)

  return (
    <AppLayout userName={session.name} userEmail={session.email}>
      <ProjectForm
        project={project}
        statuses={statuses}
        users={users}
        initialTeamUserIds={initialTeamUserIds}
      />
    </AppLayout>
  )
}
