import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { AppLayout } from "@/components/layout/app-layout"
import {
  TaskRepository,
  ProjectRepository,
  DailyReportRepository,
  StatusRepository,
  TaskTeamRepository,
  UserRepository,
} from "@/lib/repositories"
import { TaskDetailClient } from "./task-detail-client"

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getSession()
  if (!session) redirect("/login")

  const { id } = await params
  const [task, statuses, allUsers] = await Promise.all([
    TaskRepository.findById(id),
    StatusRepository.findAll(),
    UserRepository.findAll(),
  ])

  if (!task) redirect("/tasks")

  const [project, reports] = await Promise.all([
    ProjectRepository.findById(task.project_id),
    DailyReportRepository.findByTaskId(id),
  ])

  // Get task team members
  const taskTeam = await TaskTeamRepository.findByTaskId(id)
  const teamMembers = taskTeam
    .map((tt) => {
      const user = allUsers.find((u) => u.user_id === tt.user_id)
      return user ? {
        user_id: user.user_id,
        user_name: user.user_name || user.user_email,
        user_email: user.user_email,
        user_occupation: user.user_occupation,
      } : null
    })
    .filter((m): m is NonNullable<typeof m> => m !== null)

  const sortedReports = reports.sort((a, b) =>
    (b.date ?? "").localeCompare(a.date ?? "")
  )

  const userMap = Object.fromEntries(allUsers.map((u) => [u.user_id, u.user_name || u.user_email]))
  const createdByName = userMap[task.created_by ?? ""] ?? task.created_by ?? "—"
  const updatedByName = userMap[task.updated_by ?? ""] ?? task.updated_by ?? "—"

  return (
    <AppLayout userName={session.name} userEmail={session.email}>
      <TaskDetailClient
        task={task}
        project={project}
        reports={sortedReports}
        statuses={statuses}
        createdByName={createdByName}
        updatedByName={updatedByName}
        userMap={userMap}
        teamMembers={teamMembers}
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
