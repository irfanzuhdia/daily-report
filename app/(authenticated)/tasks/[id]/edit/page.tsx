import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import {
  TaskRepository,
  ProjectRepository,
  StatusRepository,
  UserRepository,
  TaskTeamRepository,
  hasTaskWritePermission,
} from "@/lib/repositories"
import { TaskForm } from "../../task-form"

export default async function EditTaskPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getSession()
  if (!session) redirect("/login")

  const { id } = await params
  const [task, projects, statuses, allUsers, uniqueCategories] = await Promise.all([
    TaskRepository.findById(id),
    ProjectRepository.findAll(),
    StatusRepository.findAll(),
    UserRepository.findAll(),
    ProjectRepository.findUniqueCategories(),
  ])

  if (!task) redirect("/tasks")

  // Get current task team members
  const taskTeam = await TaskTeamRepository.findByTaskId(id)
  const defaultTeamUserIds = taskTeam.map((tt) => tt.user_id)

  const hasWrite = await hasTaskWritePermission(id, session.user_id)
  if (!hasWrite) {
    redirect(`/tasks/${id}`)
  }

  return (
    <TaskForm
      task={task}
      projects={projects}
      statuses={statuses}
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
