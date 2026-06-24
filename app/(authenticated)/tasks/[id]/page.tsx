import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import {
  TaskRepository,
  ProjectRepository,
  DailyReportRepository,
  StatusRepository,
  TaskTeamRepository,
  ProjectTeamRepository,
  UserRepository,
  TaskLogRepository,
} from "@/lib/repositories"
import type { DailyReport, ProjectTeam } from "@/lib/types"
import { TaskDetailClient } from "./task-detail-client"

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getSession()
  if (!session) redirect("/login")

  const { id } = await params
  const [task, statuses, allUsers, taskLogs] = await Promise.all([
    TaskRepository.findById(id),
    StatusRepository.findAll(),
    UserRepository.findAll(),
    TaskLogRepository.findByTaskId(id),
  ])

  if (!task) redirect("/tasks")

  const [project, reports, projectTeam] = await Promise.all([
    ProjectRepository.findById(task.project_id),
    DailyReportRepository.findByTaskId(id),
    ProjectTeamRepository.findByProjectId(task.project_id),
  ])

  // Get task team members
  const taskTeam = await TaskTeamRepository.findByTaskId(id)
  const teamMembers = Array.from(
    new Map(
      taskTeam
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
        .map((m) => [m.user_id, m])
    ).values()
  )

  const sortedReports = reports.sort((a: DailyReport, b: DailyReport) =>
    (b.date ?? "").localeCompare(a.date ?? "")
  )

  const userMapLower = Object.fromEntries(allUsers.map((u) => [u.user_id.toLowerCase(), u.user_name || u.user_email]))
  const resolveUser = (userId: string | null | undefined) => {
    if (!userId) return "System"
    return userMapLower[userId.toLowerCase()] ?? userId
  }

  const createdByName = resolveUser(task.created_by)
  const updatedByName = resolveUser(task.updated_by)

  const userMap = Object.fromEntries(allUsers.map((u) => [u.user_id, u.user_name || u.user_email]))

  // Enrich task logs with resolved user display names
  const enrichedTaskLogs = taskLogs.map((log) => {
    let targetUser = undefined
    if (log.task_status_old === "TEAM_ADD" || log.task_status_old === "TEAM_REMOVE") {
      targetUser = resolveUser(log.task_status_new)
    }
    return {
      ...log,
      createdByName: resolveUser(log.created_by),
      targetUserName: targetUser,
    }
  })

  return (
    <TaskDetailClient
      task={task}
      project={project}
      reports={sortedReports}
      statuses={statuses}
      createdByName={createdByName}
      updatedByName={updatedByName}
      userMap={userMap}
      teamMembers={teamMembers}
      taskLogs={enrichedTaskLogs}
      currentUserId={session.user_id}
      projectTeamUserIds={projectTeam.map((pt: ProjectTeam) => pt.user_id)}
      allUsers={allUsers.map((u) => ({
        user_id: u.user_id,
        user_name: u.user_name || u.user_email,
        user_email: u.user_email,
        user_occupation: u.user_occupation,
      }))}
    />
  )
}
