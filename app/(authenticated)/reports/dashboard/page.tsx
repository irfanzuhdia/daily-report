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
  const isDeptDisabled = userLevel < 6
  const isSiteDisabled = userLevel < 5
  const isDivDisabled = userLevel < 3
  const isTeamDisabled = userLevel < 2

  // Dept Filter
  const targetDept = isDeptDisabled ? (currentUser?.user_departement || "") : (params.dept_filter !== undefined ? params.dept_filter : (currentUser?.user_departement || ""))
  if (targetDept && targetDept !== "all") {
    projects = projects.filter((p) => (userById.get(p.created_by || "")?.user_departement || "") === targetDept)
    tasks = tasks.filter((t) => (userById.get(t.created_by || "")?.user_departement || "") === targetDept)
    reports = reports.filter((r) => (userById.get(r.user_id || "")?.user_departement || "") === targetDept)
  }

  // Site Filter
  const targetSite = isSiteDisabled ? (currentUser?.user_site || "") : (params.site_filter !== undefined ? params.site_filter : (currentUser?.user_site || ""))
  if (targetSite && targetSite !== "all") {
    projects = projects.filter((p) => (userById.get(p.created_by || "")?.user_site || "") === targetSite)
    tasks = tasks.filter((t) => (userById.get(t.created_by || "")?.user_site || "") === targetSite)
    reports = reports.filter((r) => (userById.get(r.user_id || "")?.user_site || "") === targetSite)
  }

  // Div Filter
  const targetDiv = isDivDisabled ? (currentUser?.user_division || "") : (params.div_filter !== undefined ? params.div_filter : (currentUser?.user_division || ""))
  if (targetDiv && targetDiv !== "all") {
    projects = projects.filter((p) => (userById.get(p.created_by || "")?.user_division || "") === targetDiv)
    tasks = tasks.filter((t) => (userById.get(t.created_by || "")?.user_division || "") === targetDiv)
    reports = reports.filter((r) => (userById.get(r.user_id || "")?.user_division || "") === targetDiv)
  }

  // Team Filter
  const targetTeam = isTeamDisabled ? (currentUser?.user_team || "") : (params.team_filter !== undefined ? params.team_filter : (currentUser?.user_team || ""))
  if (targetTeam && targetTeam !== "all") {
    projects = projects.filter((p) => (userById.get(p.created_by || "")?.user_team || "") === targetTeam)
    tasks = tasks.filter((t) => (userById.get(t.created_by || "")?.user_team || "") === targetTeam)
    reports = reports.filter((r) => (userById.get(r.user_id || "")?.user_team || "") === targetTeam)
  }

  const userMap = new Map(allUsers.map((u) => [u.user_id, u.user_name || u.user_email || u.user_id]))

  // Apply team view filters
  if (effectiveViewMode === "team" && params.created_by) {
    projects = projects.filter((p) => p.created_by === params.created_by)
    tasks = tasks.filter((t) => t.created_by === params.created_by)
    reports = reports.filter((r) => r.user_id === params.created_by || r.created_by === params.created_by)
  }

  // Apply date range filters
  const now = new Date()
  const defaultEndDate = now.toLocaleDateString('en-CA') // YYYY-MM-DD
  
  const thirtyDaysAgo = new Date(now)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29)
  const defaultStartDate = thirtyDaysAgo.toLocaleDateString('en-CA')

  const targetStartDate = params.start_date || defaultStartDate
  const targetEndDate = params.end_date || defaultEndDate

  if (targetStartDate) {
    projects = projects.filter((p) => p.created_at && p.created_at.split('T')[0] >= targetStartDate)
    tasks = tasks.filter((t) => t.created_at && t.created_at.split('T')[0] >= targetStartDate)
    reports = reports.filter((r) => r.date && r.date >= targetStartDate)
  }
  if (targetEndDate) {
    projects = projects.filter((p) => p.created_at && p.created_at.split('T')[0] <= targetEndDate)
    tasks = tasks.filter((t) => t.created_at && t.created_at.split('T')[0] <= targetEndDate)
    reports = reports.filter((r) => r.date && r.date <= targetEndDate)
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

  // Contribution data for heatmap
  const contributionData: Record<string, number> = {}
  for (const r of reports) {
    const h = parseFloat(r.total_hours ?? '0')
    if (isNaN(h) || h <= 0) continue
    if (r.date) {
      contributionData[r.date] = (contributionData[r.date] || 0) + h
    }
  }

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

  let visibleUsers = allUsers;
  if (userLevel < 6 && currentUser) {
    const viewerOcc = (currentUser.user_occupation || "").toLowerCase().trim();
    visibleUsers = allUsers.filter(u => {
      if (viewerOcc === 'kepala departement' || viewerOcc === 'kepala department') {
        return u.user_departement === currentUser.user_departement;
      } else if (viewerOcc === 'site manager' || viewerOcc === 'site admin' || userLevel === 5) {
        return u.user_site === currentUser.user_site;
      } else if (
        viewerOcc === 'divisi manager' || 
        viewerOcc === 'divisi admin' || 
        viewerOcc === 'div manager' || 
        viewerOcc === 'div admin' || 
        userLevel === 4 || 
        userLevel === 3
      ) {
        return u.user_division === currentUser.user_division;
      } else if (viewerOcc === 'team leader' || userLevel === 2) {
        return u.user_team === currentUser.user_team;
      }
      return u.user_id === currentUser.user_id;
    });
  }

  return (
    <DashboardClient
      stats={stats}
      viewMode={effectiveViewMode}
      users={visibleUsers.map((u) => ({
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
