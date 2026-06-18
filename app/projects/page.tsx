import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { cookies } from "next/headers"
import { AppLayout } from "@/components/layout/app-layout"
import {
  ProjectRepository,
  StatusRepository,
  TaskRepository,
  DailyReportRepository,
  filterProjectsByUser,
} from "@/lib/repositories"
import { getViewModeFromCookies } from "@/lib/get-view-mode.server"
import { ProjectsClient } from "./projects-client"

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; search?: string }>
}) {
  const session = await getSession()
  if (!session) redirect("/login")

  const viewMode = await getViewModeFromCookies()
  const userId = session.user_id
  const params = await searchParams

  const [allProjects, statuses, allTasks, allReports] = await Promise.all([
    ProjectRepository.findAll(),
    StatusRepository.findAll(),
    TaskRepository.findAll(),
    DailyReportRepository.findAll(),
  ])

  // Filter by user when in "my" view
  let projects = viewMode === "my"
    ? await filterProjectsByUser(allProjects, userId)
    : allProjects

  // Apply search/status filters
  if (params.status) {
    projects = projects.filter((p) => p.project_status === params.status)
  }
  if (params.search) {
    const q = params.search.toLowerCase()
    projects = projects.filter(
      (p) =>
        p.project_name?.toLowerCase().includes(q) ||
        p.project_description?.toLowerCase().includes(q)
    )
  }

  // Calculate total hours and progress per project
  const projectHoursMap: Record<string, number> = {}
  const projectProgressMap: Record<string, number> = {}
  for (const project of projects) {
    const projectTasks = allTasks.filter((t) => t.project_id === project.project_id)
    let totalHours = 0
    let totalProgress = 0
    for (const task of projectTasks) {
      const taskReports = allReports.filter((r) => r.task_id === task.id)
      totalHours += taskReports.reduce((sum, r) => {
        const h = parseFloat(r.total_hours ?? '0')
        return sum + (isNaN(h) ? 0 : h)
      }, 0)
      if (taskReports.length > 0) {
        const latest = taskReports.reduce((max, r) => {
          if (!r.date) return max
          if (!max.date) return r
          return r.date > max.date ? r : max
        }, taskReports[0])
        totalProgress += parseFloat(latest.progress_percentage ?? '0') || 0
      }
    }
    projectHoursMap[project.project_id] = totalHours
    projectProgressMap[project.project_id] = projectTasks.length > 0
      ? Math.round(totalProgress / projectTasks.length)
      : 0
  }

  return (
    <AppLayout userName={session.name} userEmail={session.email}>
      <ProjectsClient
        projects={projects}
        statuses={statuses}
        projectHoursMap={projectHoursMap}
        projectProgressMap={projectProgressMap}
        currentStatus={params.status}
        currentSearch={params.search}
        viewMode={viewMode}
      />
    </AppLayout>
  )
}
