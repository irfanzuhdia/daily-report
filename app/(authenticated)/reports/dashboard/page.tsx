import { redirect } from "next/navigation"
import { toDateStr } from "@/lib/format"
import { getSession } from "@/lib/session"
import {
  ProjectRepository,
  TaskRepository,
  DailyReportRepository,
  StatusRepository,
  UserRepository,
  ProjectTeamRepository,
  TaskTeamRepository,
  getContributionData,
  filterProjectsByUser,
  filterTasksByUser,
  filterReportsByUser,
} from "@/lib/repositories"
import { getViewModeFromCookies } from "@/lib/get-view-mode.server"
import { DashboardClient } from "./dashboard-client"

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    created_by?: string
    start_date?: string
    end_date?: string
    dept_filter?: string
    site_filter?: string
    div_filter?: string
    team_filter?: string
  }>
}) {
  const session = await getSession()
  if (session == null) {
    redirect("/login")
  }

  const viewMode = await getViewModeFromCookies()
  const userId = session.user_id
  const params = await searchParams

  const [allProjects, allTasks, allReports, statuses, allUsers] = await Promise.all([
    ProjectRepository.findAll(),
    TaskRepository.findAll(),
    DailyReportRepository.findAll(),
    StatusRepository.findAll(),
    UserRepository.findAll(),
  ])

  const currentUser = allUsers.find((u) => u.user_id === userId)
  const userLevel = currentUser?.level || 1
  const effectiveViewMode = userLevel === 1 ? "my" : viewMode

  // Filter by user based on visibility levels
  let [projects, tasks, reports] = await Promise.all([
    filterProjectsByUser(allProjects, userId),
    filterTasksByUser(allTasks, userId),
    filterReportsByUser(allReports, userId),
  ])

  if (effectiveViewMode === "my") {
    const [projectTeam, taskTeam] = await Promise.all([
      ProjectTeamRepository.findByUserId(userId),
      TaskTeamRepository.findByUserId(userId),
    ])
    const myProjectIds = new Set(projectTeam.map((pt) => pt.project_id))
    projects = projects.filter((p) => p.created_by === userId || myProjectIds.has(p.project_id))

    const myTaskIds = new Set(taskTeam.map((tt) => tt.task_id))
    tasks = tasks.filter((t) => t.created_by === userId || myTaskIds.has(t.id))

    reports = reports.filter((r) => r.user_id === userId || r.created_by === userId)
  }

  // Pre-build user lookup map — O(n) once, then O(1) per lookup
  const userById = new Map(allUsers.map(u => [u.user_id, u]))

  // Apply enterprise filters on dashboard
  if (params.dept_filter) {
    projects = projects.filter((p) => p.created_by && userById.get(p.created_by)?.user_departement === params.dept_filter)
    tasks = tasks.filter((t) => t.created_by && userById.get(t.created_by)?.user_departement === params.dept_filter)
    reports = reports.filter((r) => r.user_id && userById.get(r.user_id)?.user_departement === params.dept_filter)
  }
  if (params.site_filter) {
    projects = projects.filter((p) => p.created_by && userById.get(p.created_by)?.user_site === params.site_filter)
    tasks = tasks.filter((t) => t.created_by && userById.get(t.created_by)?.user_site === params.site_filter)
    reports = reports.filter((r) => r.user_id && userById.get(r.user_id)?.user_site === params.site_filter)
  }
  if (params.div_filter) {
    projects = projects.filter((p) => p.created_by && userById.get(p.created_by)?.user_division === params.div_filter)
    tasks = tasks.filter((t) => t.created_by && userById.get(t.created_by)?.user_division === params.div_filter)
    reports = reports.filter((r) => r.user_id && userById.get(r.user_id)?.user_division === params.div_filter)
  }
  if (params.team_filter) {
    projects = projects.filter((p) => p.created_by && userById.get(p.created_by)?.user_team === params.team_filter)
    tasks = tasks.filter((t) => t.created_by && userById.get(t.created_by)?.user_team === params.team_filter)
    reports = reports.filter((r) => r.user_id && userById.get(r.user_id)?.user_team === params.team_filter)
  }

  const userMap = new Map(allUsers.map((u) => [u.user_id, u.user_name || u.user_email || u.user_id]))

  // Apply team view filters
  if (effectiveViewMode === "team" && params.created_by) {
    projects = projects.filter((p) => p.created_by === params.created_by)
    tasks = tasks.filter((t) => t.created_by === params.created_by)
    reports = reports.filter((r) => r.user_id === params.created_by || r.created_by === params.created_by)
  }

  // Apply date range filters
  if (params.start_date) {
    projects = projects.filter((p) => p.created_at && p.created_at.split('T')[0] >= params.start_date!)
    tasks = tasks.filter((t) => t.created_at && t.created_at.split('T')[0] >= params.start_date!)
    reports = reports.filter((r) => r.date && r.date >= params.start_date!)
  }
  if (params.end_date) {
    projects = projects.filter((p) => p.created_at && p.created_at.split('T')[0] <= params.end_date!)
    tasks = tasks.filter((t) => t.created_at && t.created_at.split('T')[0] <= params.end_date!)
    reports = reports.filter((r) => r.date && r.date <= params.end_date!)
  }

  // Build status lookup
  const statusMap = new Map(statuses.map((s) => [s.id, s.name]))

  // Stats
  const activeProjects = projects.filter((p) => p.project_status === "OP").length
  const completedTasks = tasks.filter((t) => t.task_status === "D" || t.task_status === "C").length

  // Projects by status
  const statusCounts = new Map<string, number>()
  for (const p of projects) {
    const s = p.project_status ?? "NS"
    statusCounts.set(s, (statusCounts.get(s) ?? 0) + 1)
  }
  const projectsByStatus = Array.from(statusCounts.entries()).map(
    ([status, count]) => ({
      status: statusMap.get(status) ?? status,
      count,
    })
  )

  // Recent reports with enriched data
  const recentReports = reports
    .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
    .slice(0, 5)
    .map((r) => {
      const task = allTasks.find((t) => t.id === r.task_id)
      const project = task
        ? allProjects.find((p) => p.project_id === task.project_id)
        : null
      return {
        ...r,
        task_description: task?.task_description ?? undefined,
        project_name: project?.project_name ?? undefined,
        user_name: userMap.get(r.user_id ?? "") ?? undefined,
      }
    })

  const totalHours = reports.reduce((sum, r) => {
    const h = parseFloat(r.total_hours ?? '0');
    return sum + (isNaN(h) ? 0 : h);
  }, 0);

  // Contribution data for heatmap (selected range or default 30 days)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const contributionData = await getContributionData({
    startDate: params.start_date ?? toDateStr(thirtyDaysAgo),
    endDate: params.end_date,
    userId: viewMode === "my" ? userId : params.created_by,
  })

  const stats = {
    totalProjects: projects.length,
    activeProjects,
    totalTasks: tasks.length,
    completedTasks,
    totalReports: reports.length,
    totalHours,
    recentReports,
    projectsByStatus,
    contributionData,
  }

  return (
    <DashboardClient
      stats={stats}
      viewMode={effectiveViewMode}
      users={allUsers.map((u) => ({
        user_id: u.user_id,
        user_email: u.user_email,
        user_name: u.user_name,
        user_occupation: u.user_occupation,
        user_departement: u.user_departement,
        user_division: u.user_division,
        user_site: u.user_site,
        user_team: u.user_team,
        level: u.level,
      }))}
      currentCreatedBy={params.created_by}
      currentStartDate={params.start_date}
      currentEndDate={params.end_date}
      currentDept={params.dept_filter}
      currentSite={params.site_filter}
      currentDiv={params.div_filter}
      currentTeam={params.team_filter}
      currentUserId={userId}
    />
  )
}
