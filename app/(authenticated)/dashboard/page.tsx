import { redirect } from "next/navigation"
import { toDateStr } from "@/lib/format"
import { getSession } from "@/lib/session"
import {
  ProjectRepository,
  TaskRepository,
  DailyReportRepository,
  StatusRepository,
  getContributionData,
  filterProjectsByUser,
  filterTasksByUser,
  filterReportsByUser,
} from "@/lib/repositories"
import { getViewModeFromCookies } from "@/lib/get-view-mode.server"
import { DashboardClient } from "./dashboard-client"

export default async function DashboardPage() {
  const session = await getSession()
  if (session == null) {
    redirect("/login")
  }

  const viewMode = await getViewModeFromCookies()
  const userId = session.user_id

  const [allProjects, allTasks, allReports, statuses] = await Promise.all([
    ProjectRepository.findAll(),
    TaskRepository.findAll(),
    DailyReportRepository.findAll(),
    StatusRepository.findAll(),
  ])

  // Filter by user when in "my" view
  const [projects, tasks, reports] = await Promise.all([
    viewMode === "my" ? filterProjectsByUser(allProjects, userId) : allProjects,
    viewMode === "my" ? filterTasksByUser(allTasks, userId) : allTasks,
    viewMode === "my" ? filterReportsByUser(allReports, userId) : allReports,
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
      }
    })

  const totalHours = reports.reduce((sum, r) => {
    const h = parseFloat(r.total_hours ?? '0');
    return sum + (isNaN(h) ? 0 : h);
  }, 0);

  // Contribution data for heatmap (last 30 days)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const contributionData = await getContributionData({
    startDate: toDateStr(thirtyDaysAgo),
    ...(viewMode === "my" ? { userId } : {}),
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

  return <DashboardClient stats={stats} viewMode={viewMode} />
}
