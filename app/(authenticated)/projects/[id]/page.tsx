import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import {
  ProjectRepository,
  TaskRepository,
  DailyReportRepository,
  StatusRepository,
  ProjectTeamRepository,
  UserRepository,
  ProjectLogRepository,
  calcProjectStatus,
} from "@/lib/repositories"
import { ProjectDetailClient } from "./project-detail-client"


export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getSession()
  if (!session) redirect("/login")

  const { id } = await params
  const [project, tasks, statuses, allReports, allUsers, projectLogs] = await Promise.all([
    ProjectRepository.findById(id),
    TaskRepository.findByProjectId(id),
    StatusRepository.findAll(),
    DailyReportRepository.findAll(),
    UserRepository.findAll(),
    ProjectLogRepository.findByProjectId(id),
  ])

  if (!project) redirect("/projects")

  // Get project team members
  const projectTeam = await ProjectTeamRepository.findByProjectId(id)
  const teamMembers = Array.from(
    new Map(
      projectTeam
        .map((pt) => {
          const user = allUsers.find((u) => u.user_id === pt.user_id)
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

  const taskReports: Record<string, number> = {}
  const taskHours: Record<string, number> = {}
  const taskProgress: Record<string, number> = {}
  let projectTotalHours = 0

  for (const task of tasks) {
    const reports = allReports.filter((r) => r.task_id === task.id)
    taskReports[task.id] = reports.length
    const hours = reports.reduce((sum, r) => {
      const h = parseFloat(r.total_hours ?? '0')
      return sum + (isNaN(h) ? 0 : h)
    }, 0)
    taskHours[task.id] = hours
    projectTotalHours += hours

    if (reports.length > 0) {
      const latest = reports.reduce((max, r) => {
        if (!r.date) return max
        if (!max.date) return r
        return r.date > max.date ? r : max
      }, reports[0])
      taskProgress[task.id] = parseFloat(latest.progress_percentage ?? '0') || 0
    } else {
      taskProgress[task.id] = 0
    }
  }

  const projectProgress = tasks.length > 0
    ? Math.round(Object.values(taskProgress).reduce((a, b) => a + b, 0) / tasks.length)
    : 0

  const autoProjectStatus = calcProjectStatus(id, tasks)

  const userMapLower = Object.fromEntries(allUsers.map((u) => [u.user_id.toLowerCase(), u.user_name || u.user_email]))
  const resolveUser = (userId: string | null | undefined) => {
    if (!userId) return "System"
    return userMapLower[userId.toLowerCase()] ?? userId
  }

  const createdByName = resolveUser(project.created_by)
  const updatedByName = resolveUser(project.updated_by)

  // Enrich project logs with resolved user names
  const enrichedProjectLogs = projectLogs.map((log) => {
    let targetUser = undefined
    if (log.project_status_old === "TEAM_ADD" || log.project_status_old === "TEAM_REMOVE") {
      targetUser = resolveUser(log.project_status_new)
    }
    return {
      ...log,
      createdByName: resolveUser(log.created_by),
      targetUserName: targetUser,
    }
  })

  return (
    <ProjectDetailClient
      project={project}
      tasks={tasks}
      statuses={statuses}
      taskReports={taskReports}
      taskHours={taskHours}
      projectTotalHours={projectTotalHours}
      projectProgress={projectProgress}
      autoProjectStatus={autoProjectStatus}
      taskProgress={taskProgress}
      createdByName={createdByName}
      updatedByName={updatedByName}
      teamMembers={teamMembers}
      projectLogs={enrichedProjectLogs}
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
    />
  )
}
