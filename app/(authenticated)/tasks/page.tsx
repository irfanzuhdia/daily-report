import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import {
  TaskRepository,
  StatusRepository,
  ProjectRepository,
  DailyReportRepository,
  filterTasksByUser,
} from "@/lib/repositories"
import { getViewModeFromCookies } from "@/lib/get-view-mode.server"
import { TasksClient } from "./tasks-client"

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ project_id?: string; status?: string; search?: string }>
}) {
  const session = await getSession()
  if (!session) redirect("/login")

  const viewMode = await getViewModeFromCookies()
  const userId = session.user_id
  const params = await searchParams

  const [allTasks, statuses, allProjects, allReports] = await Promise.all([
    TaskRepository.findAll(),
    StatusRepository.findAll(),
    ProjectRepository.findAll(),
    DailyReportRepository.findAll(),
  ])

  // Filter by user when in "my" view
  let tasks = viewMode === "my"
    ? await filterTasksByUser(allTasks, userId)
    : allTasks

  if (params.project_id) {
    tasks = tasks.filter((t) => t.project_id === params.project_id)
  }
  if (params.status) {
    tasks = tasks.filter((t) => t.task_status === params.status)
  }
  if (params.search) {
    const q = params.search.toLowerCase()
    tasks = tasks.filter((t) =>
      t.task_description?.toLowerCase().includes(q)
    )
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
      projectMap={Object.fromEntries(projectMap)}
      taskHoursMap={taskHoursMap}
      currentProjectId={params.project_id}
      currentStatus={params.status}
      currentSearch={params.search}
      viewMode={viewMode}
    />
  )
}
