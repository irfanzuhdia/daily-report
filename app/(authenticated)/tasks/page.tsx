import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import {
  TaskRepository,
  StatusRepository,
  ProjectRepository,
  DailyReportRepository,
  UserRepository,
  TaskTeamRepository,
  ProjectTeamRepository,
  filterTasksByUser,
} from "@/lib/repositories"
import { getViewModeFromCookies } from "@/lib/get-view-mode.server"
import { TasksClient } from "./tasks-client"

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{
    project_id?: string
    status?: string
    search?: string
    created_by?: string
    member_id?: string
    dept_filter?: string
    site_filter?: string
    div_filter?: string
    team_filter?: string
  }>
}) {
  const session = await getSession()
  if (!session) redirect("/login")

  const viewMode = await getViewModeFromCookies()
  const userId = session.user_id
  const params = await searchParams

  const [allTasks, statuses, allProjects, allReports, allUsers, allTaskTeams, allProjectTeams] = await Promise.all([
    TaskRepository.findAll(),
    StatusRepository.findAll(),
    ProjectRepository.findAll(),
    DailyReportRepository.findAll(),
    UserRepository.findAll(),
    TaskTeamRepository.findAll(),
    ProjectTeamRepository.findAll(),
  ])

  const currentUser = allUsers.find((u) => u.user_id === userId)
  const userLevel = currentUser?.level || 1
  const effectiveViewMode = userLevel === 1 ? "my" : viewMode

  // Filter by user based on visibility levels
  let tasks = await filterTasksByUser(allTasks, userId)

  if (effectiveViewMode === "my") {
    const myTaskIds = new Set(
      allTaskTeams.filter((tt) => tt.user_id === userId).map((tt) => tt.task_id)
    )
    tasks = tasks.filter((t) => t.created_by === userId || myTaskIds.has(t.id))
  }

  const userMap = new Map(allUsers.map((u) => [u.user_id, (u.user_name || u.user_email || "").toLowerCase()]))

  // Apply enterprise filters
  if (params.dept_filter) {
    tasks = tasks.filter((t) => t.created_by && allUsers.find(u => u.user_id === t.created_by)?.user_departement === params.dept_filter)
  }
  if (params.site_filter) {
    tasks = tasks.filter((t) => t.created_by && allUsers.find(u => u.user_id === t.created_by)?.user_site === params.site_filter)
  }
  if (params.div_filter) {
    tasks = tasks.filter((t) => t.created_by && allUsers.find(u => u.user_id === t.created_by)?.user_division === params.div_filter)
  }
  if (params.team_filter) {
    tasks = tasks.filter((t) => t.created_by && allUsers.find(u => u.user_id === t.created_by)?.user_team === params.team_filter)
  }

  if (params.project_id) {
    tasks = tasks.filter((t) => t.project_id === params.project_id)
  }
  if (params.status) {
    tasks = tasks.filter((t) => t.task_status === params.status)
  }
  if (params.created_by) {
    tasks = tasks.filter((t) => t.created_by === params.created_by)
  }
  if (params.member_id) {
    const memberTaskIds = new Set(
      allTaskTeams.filter((tt) => tt.user_id === params.member_id).map((tt) => tt.task_id)
    )
    tasks = tasks.filter((t) => memberTaskIds.has(t.id) || t.created_by === params.member_id)
  }
  if (params.search) {
    const q = params.search.toLowerCase()
    tasks = tasks.filter((t) => {
      if (t.task_description?.toLowerCase().includes(q)) {
        return true
      }
      const creatorName = t.created_by ? userMap.get(t.created_by) : ""
      if (creatorName?.includes(q)) {
        return true
      }
      const taskTeamUsers = allTaskTeams.filter((tt) => tt.task_id === t.id)
      for (const tt of taskTeamUsers) {
        const memberName = userMap.get(tt.user_id)
        if (memberName?.includes(q)) {
          return true
        }
      }
      return false
    })
  }

  // Enrich with project names and total hours
  const projectMap = new Map(allProjects.map((p) => [p.project_id, p.project_name]))

  const taskHoursMap: Record<string, number> = {}
  for (const task of tasks) {
    const reports = allReports.filter((r) => r.task_id === task.id)
    taskHoursMap[task.id] = reports.reduce((sum, r) => {
      const h = parseFloat(r.total_hours ?? '0')
      return sum + (isNaN(h) ? 0 : h)
    }, 0)
  }

  return (
    <TasksClient
      tasks={tasks}
      statuses={statuses}
      projects={allProjects}
      users={allUsers}
      projectMap={Object.fromEntries(projectMap)}
      taskHoursMap={taskHoursMap}
      currentProjectId={params.project_id}
      currentStatus={params.status}
      currentSearch={params.search}
      currentCreatedBy={params.created_by}
      currentMemberId={params.member_id}
      viewMode={effectiveViewMode}
      taskTeams={allTaskTeams}
      projectTeams={allProjectTeams}
      currentUserId={userId}
      currentDept={params.dept_filter}
      currentSite={params.site_filter}
      currentDiv={params.div_filter}
      currentTeam={params.team_filter}
    />
  )
}
