import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import {
  ProjectRepository,
  StatusRepository,
  UserRepository,
  ProjectTeamRepository,
} from "@/lib/repositories"
import { TaskForm } from "../task-form"

export default async function NewTaskPage({
  searchParams,
}: {
  searchParams: Promise<{ project_id?: string }>
}) {
  const session = await getSession()
  if (!session) redirect("/login")

  const params = await searchParams
  const [projects, statuses, allUsers] = await Promise.all([
    ProjectRepository.findAll(),
    StatusRepository.findAll(),
    UserRepository.findAll(),
  ])

  // If project_id is provided, get the project's team as default
  let defaultTeamUserIds: string[] = []
  if (params.project_id) {
    const projectTeam = await ProjectTeamRepository.findByProjectId(params.project_id)
    defaultTeamUserIds = projectTeam.map((pt) => pt.user_id)
  }

  return (
    <TaskForm
      projects={projects}
      statuses={statuses}
      defaultProjectId={params.project_id}
      defaultTeamUserIds={defaultTeamUserIds}
      allUsers={allUsers.map((u) => ({
        user_id: u.user_id,
        user_name: u.user_name || u.user_email,
        user_email: u.user_email,
        user_occupation: u.user_occupation,
      }))}
    />
  )
}
