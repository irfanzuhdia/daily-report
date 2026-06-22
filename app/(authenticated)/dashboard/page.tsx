import { redirect } from "next/navigation"
import { toDateStr } from "@/lib/format"
import { getSession } from "@/lib/session"
import {
  ProjectRepository,
  TaskRepository,
  DailyReportRepository,
  StatusRepository,
  UserRepository,
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

  // Filter by user when in "my" view
  let [projects, tasks, reports] = await Promise.all([
    viewMode === "my" ? filterProjectsByUser(allProjects, userId) : allProjects,
    viewMode === "my" ? filterTasksByUser(allTasks, userId) : allTasks,
    viewMode === "my" ? filterReportsByUser(allReports, userId) : allReports,
  ])

  const userMap = new Map(allUsers.map((u) => [u.user_id, u.user_name || u.user_email || u.user_id]))

  // Apply team view filters
  if (viewMode === "team" && params.created_by) {
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
    .slice(0, 10)
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
      viewMode={viewMode}
      users={allUsers.map((u) => ({
        user_id: u.user_id,
        user_email: u.user_email,
        user_name: u.user_name,
      }))}
      currentCreatedBy={params.created_by}
      currentStartDate={params.start_date}
      currentEndDate={params.end_date}
    />
  )
}
