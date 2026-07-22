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

  const [statuses, allUsers] = await Promise.all([
    StatusRepository.findAll(),
    UserRepository.findAll(),
  ])

  const currentUser = allUsers.find((u) => u.user_id === userId)
  const userLevel = currentUser?.level || 1
  const effectiveViewMode = userLevel === 1 ? "my" : viewMode

  const now = new Date()
  const defaultEndDate = now.toLocaleDateString('en-CA') // YYYY-MM-DD
  
  const thirtyDaysAgo = new Date(now)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29)
  const defaultStartDate = thirtyDaysAgo.toLocaleDateString('en-CA')

  const targetStartDate = params.start_date || defaultStartDate
  const targetEndDate = params.end_date || defaultEndDate

  const isDeptDisabled = userLevel < 6
  const isSiteDisabled = userLevel < 5
  const isDivDisabled = userLevel < 3
  const isTeamDisabled = userLevel < 2

  const currentUserData = allUsers.find((u) => u.user_id === userId)
  const targetDept = isDeptDisabled ? (currentUserData?.user_departement || "") : (params.dept_filter !== undefined ? params.dept_filter : (currentUserData?.user_departement || ""))
  const targetSite = isSiteDisabled ? (currentUserData?.user_site || "") : (params.site_filter !== undefined ? params.site_filter : (currentUserData?.user_site || ""))
  const targetDiv = isDivDisabled ? (currentUserData?.user_division || "") : (params.div_filter !== undefined ? params.div_filter : (currentUserData?.user_division || ""))
  const targetTeam = isTeamDisabled ? (currentUserData?.user_team || "") : (params.team_filter !== undefined ? params.team_filter : (currentUserData?.user_team || ""))

  const filters = {
    dept_filter: targetDept && targetDept !== "all" ? targetDept : undefined,
    site_filter: targetSite && targetSite !== "all" ? targetSite : undefined,
    div_filter: targetDiv && targetDiv !== "all" ? targetDiv : undefined,
    team_filter: targetTeam && targetTeam !== "all" ? targetTeam : undefined,
    start_date: targetStartDate,
    end_date: targetEndDate,
    viewMode: effectiveViewMode,
    created_by: effectiveViewMode === "team" ? params.created_by : undefined,
  }

  const limit = 100000;

  let [
    { data: projects },
    { data: tasks },
    { reports },
  ] = await Promise.all([
    ProjectRepository.findPaginated(userId, filters, limit, 0),
    TaskRepository.findPaginated(userId, filters, limit, 0),
    DailyReportRepository.findPaginatedEnriched(userId, limit, 0, {
      dept: filters.dept_filter,
      site: filters.site_filter,
      div: filters.div_filter,
      team: filters.team_filter,
      startDate: targetStartDate,
      endDate: targetEndDate,
      viewMode: effectiveViewMode,
      createdBy: filters.created_by
    }),
  ])

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

  const userMap = new Map(allUsers.map((u) => [u.user_id, u.user_name || u.user_email || u.user_id]))

  // Recent reports with enriched data
  const recentReports = reports
    .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
    .slice(0, 5)
    .map((r) => {
      // For Dashboard stats, we already have enriched project_name and task_description
      return {
        ...r,
        task_description: r.task_description ?? undefined,
        project_name: r.project_name ?? undefined,
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
