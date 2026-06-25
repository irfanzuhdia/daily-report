import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import {
  ProjectRepository,
  StatusRepository,
  UserRepository,
  ProjectTeamRepository,
  hasProjectWritePermission,
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
  const [project, statuses, users, uniqueCategories] = await Promise.all([
    ProjectRepository.findById(id),
    StatusRepository.findAll(),
    UserRepository.findAll(),
    ProjectRepository.findUniqueCategories(),
  ])

  if (!project) redirect("/projects")

  // Get current team members
  const projectTeam = await ProjectTeamRepository.findByProjectId(id)
  const initialTeamUserIds = projectTeam.map((pt) => pt.user_id)

  const hasWrite = await hasProjectWritePermission(id, session.user_id)
  if (!hasWrite) {
    redirect(`/projects/${id}`)
  }

  return (
    <ProjectForm
      project={project}
      statuses={statuses}
      users={users}
      initialTeamUserIds={initialTeamUserIds}
      uniqueCategories={uniqueCategories}
    />
  )
}
