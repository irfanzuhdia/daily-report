import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import {
  DailyReportRepository,
  TaskRepository,
  ProjectRepository,
  UserRepository,
  filterReportsByUser,
  filterTasksByUser,
  getUserMap,
} from "@/lib/repositories"
import { getViewModeFromCookies } from "@/lib/get-view-mode.server"
import { ReportsClient } from "./reports-client"

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ task_id?: string; search?: string; created_by?: string }>
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

  // Filter by user when in "my" view
  let reports = viewMode === "my"
    ? await filterReportsByUser(allReports, userId)
    : allReports

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

  // Filter tasks for the dropdown
  const filteredTasks = viewMode === "my"
    ? await filterTasksByUser(allTasks, userId)
    : allTasks

  return (
    <ReportsClient
      reports={enriched}
      tasks={filteredTasks}
      users={allUsers}
      currentTaskId={params.task_id}
      currentSearch={params.search}
      currentCreatedBy={params.created_by}
      viewMode={viewMode}
    />
  )
}
