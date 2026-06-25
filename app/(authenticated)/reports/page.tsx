import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import {
  DailyReportRepository,
  TaskRepository,
  ProjectRepository,
  UserRepository,
  TaskTeamRepository,
  filterReportsByUser,
  filterTasksByUser,
  getUserMap,
} from "@/lib/repositories"
import { getViewModeFromCookies } from "@/lib/get-view-mode.server"
import { ReportsClient } from "./reports-client"

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{
    task_id?: string
    search?: string
    created_by?: string
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

  const [allReports, allTasks, allProjects, userMap, allUsers] = await Promise.all([
    DailyReportRepository.findAll(),
    TaskRepository.findAll(),
    ProjectRepository.findAll(),
    getUserMap(),
    UserRepository.findAll(),
  ])

  const currentUser = allUsers.find((u) => u.user_id === userId)
  const userLevel = currentUser?.level || 1
  const effectiveViewMode = userLevel === 1 ? "my" : viewMode

  // Filter by user based on visibility levels
  let reports = await filterReportsByUser(allReports, userId)

  if (effectiveViewMode === "my") {
    reports = reports.filter((r) => r.user_id === userId || r.created_by === userId)
  }

  // Apply enterprise filters
  if (params.dept_filter) {
    reports = reports.filter((r) => r.user_id && allUsers.find(u => u.user_id === r.user_id)?.user_departement === params.dept_filter)
  }
  if (params.site_filter) {
    reports = reports.filter((r) => r.user_id && allUsers.find(u => u.user_id === r.user_id)?.user_site === params.site_filter)
  }
  if (params.div_filter) {
    reports = reports.filter((r) => r.user_id && allUsers.find(u => u.user_id === r.user_id)?.user_division === params.div_filter)
  }
  if (params.team_filter) {
    reports = reports.filter((r) => r.user_id && allUsers.find(u => u.user_id === r.user_id)?.user_team === params.team_filter)
  }

  if (params.task_id) {
    reports = reports.filter((r) => r.task_id === params.task_id)
  }
  if (params.created_by) {
    reports = reports.filter((r) => r.user_id === params.created_by)
  }
  const taskMap = new Map(allTasks.map((t) => [t.id, t]))
  const projectMap = new Map(allProjects.map((p) => [p.project_id, p.project_name]))

  if (params.search) {
    const q = params.search.toLowerCase()
    reports = reports.filter((r) => {
      if (r.remarks?.toLowerCase().includes(q) || r.report_id.toLowerCase().includes(q)) {
        return true
      }
      const reporterName = (r.user_id && userMap[r.user_id]) ?? r.user_id
      if (reporterName?.toLowerCase().includes(q)) {
        return true
      }
      const taskDesc = taskMap.get(r.task_id)?.task_description
      if (taskDesc?.toLowerCase().includes(q)) {
        return true
      }
      const projId = taskMap.get(r.task_id)?.project_id
      const projName = projId ? projectMap.get(projId) : null
      if (projName?.toLowerCase().includes(q)) {
        return true
      }
      return false
    })
  }

  const enriched = reports
    .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
    .map((r) => ({
      ...r,
      task_description: taskMap.get(r.task_id)?.task_description ?? undefined,
      task_status: taskMap.get(r.task_id)?.task_status ?? undefined,
      project_id: taskMap.get(r.task_id)?.project_id ?? undefined,
      project_name: taskMap.get(r.task_id)
        ? projectMap.get(taskMap.get(r.task_id)!.project_id) ?? undefined
        : undefined,
      created_by_name: (r.user_id && userMap[r.user_id]) ?? r.user_id ?? "Unknown",
    }))

  let filteredTasks = await filterTasksByUser(allTasks, userId)
  if (effectiveViewMode === "my") {
    const taskTeams = await TaskTeamRepository.findByUserId(userId)
    const myTaskIds = new Set(taskTeams.map((tt) => tt.task_id))
    filteredTasks = filteredTasks.filter((t) => t.created_by === userId || myTaskIds.has(t.id))
  }

  return (
    <ReportsClient
      reports={enriched}
      tasks={filteredTasks}
      users={allUsers}
      currentTaskId={params.task_id}
      currentSearch={params.search}
      currentCreatedBy={params.created_by}
      viewMode={effectiveViewMode}
      currentUserId={userId}
      currentDept={params.dept_filter}
      currentSite={params.site_filter}
      currentDiv={params.div_filter}
      currentTeam={params.team_filter}
    />
  )
}
