import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { AppLayout } from "@/components/layout/app-layout"
import {
  TaskRepository,
  ProjectRepository,
  StatusRepository,
  UserRepository,
  TaskTeamRepository,
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
  const [task, projects, statuses, allUsers] = await Promise.all([
    TaskRepository.findById(id),
    ProjectRepository.findAll(),
    StatusRepository.findAll(),
    UserRepository.findAll(),
  ])

  if (!task) redirect("/tasks")

  // Get current task team members
  const taskTeam = await TaskTeamRepository.findByTaskId(id)
  const defaultTeamUserIds = taskTeam.map((tt) => tt.user_id)

  return (
    <AppLayout userName={session.name} userEmail={session.email}>
      <TaskForm
        task={task}
        projects={projects}
        statuses={statuses}
        defaultTeamUserIds={defaultTeamUserIds}
        allUsers={allUsers.map((u) => ({
          user_id: u.user_id,
          user_name: u.user_name || u.user_email,
          user_email: u.user_email,
          user_occupation: u.user_occupation,
        }))}
      />
    </AppLayout>
  )
}
