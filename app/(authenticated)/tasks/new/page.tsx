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
  const [projects, statuses, allUsers, uniqueCategories] = await Promise.all([
    ProjectRepository.findAll(session.user_id),
    StatusRepository.findAll(),
    UserRepository.findAll(),
    ProjectRepository.findUniqueCategories(),
  ])

  // If project_id is provided, get the project's team as default
  let defaultTeamUserIds: string[] = [session.user_id]
  if (params.project_id) {
    const projectTeam = await ProjectTeamRepository.findByProjectId(params.project_id)
    const projectTeamUserIds = projectTeam.map((pt) => pt.user_id)
    defaultTeamUserIds = Array.from(new Set([session.user_id, ...projectTeamUserIds]))
  }

  return (
    <TaskForm
      projects={projects}
      statuses={statuses}
      defaultProjectId={params.project_id}
      defaultTeamUserIds={defaultTeamUserIds}
      currentUserId={session.user_id}
      allUsers={allUsers.map((u) => ({
        user_id: u.user_id,
        user_name: u.user_name || u.user_email,
        user_email: u.user_email,
        user_occupation: u.user_occupation,
        user_division: u.user_division,
        user_departement: u.user_departement,
        user_site: u.user_site,
        user_team: u.user_team,
        level: u.level,
      }))}
      uniqueCategories={uniqueCategories}
    />
  )
}
