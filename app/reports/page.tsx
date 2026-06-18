import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { cookies } from "next/headers"
import { AppLayout } from "@/components/layout/app-layout"
import {
  DailyReportRepository,
  TaskRepository,
  ProjectRepository,
  filterReportsByUser,
  filterTasksByUser,
} from "@/lib/repositories"
import { getViewModeFromCookies } from "@/lib/get-view-mode.server"
import { ReportsClient } from "./reports-client"

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ task_id?: string; search?: string }>
}) {
  const session = await getSession()
  if (!session) redirect("/login")

  const viewMode = await getViewModeFromCookies()
  const userId = session.user_id
  const params = await searchParams

  const [allReports, allTasks, allProjects] = await Promise.all([
    DailyReportRepository.findAll(),
    TaskRepository.findAll(),
    ProjectRepository.findAll(),
  ])

  // Filter by user when in "my" view
  let reports = viewMode === "my"
    ? await filterReportsByUser(allReports, userId)
    : allReports

  if (params.task_id) {
    reports = reports.filter((r) => r.task_id === params.task_id)
  }
  if (params.search) {
    const q = params.search.toLowerCase()
    reports = reports.filter(
      (r) =>
        r.remarks?.toLowerCase().includes(q) ||
        r.report_id.toLowerCase().includes(q)
    )
  }

  // Enrich data
  const taskMap = new Map(allTasks.map((t) => [t.id, t]))
  const projectMap = new Map(allProjects.map((p) => [p.project_id, p.project_name]))

  const enriched = reports
    .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
    .map((r) => ({
      ...r,
      task_description: taskMap.get(r.task_id)?.task_description ?? undefined,
      project_id: taskMap.get(r.task_id)?.project_id ?? undefined,
      project_name: taskMap.get(r.task_id)
        ? projectMap.get(taskMap.get(r.task_id)!.project_id) ?? undefined
        : undefined,
    }))

  // Filter tasks for the dropdown
  const filteredTasks = viewMode === "my"
    ? await filterTasksByUser(allTasks, userId)
    : allTasks

  return (
    <AppLayout userName={session.name} userEmail={session.email}>
      <ReportsClient
        reports={enriched}
        tasks={filteredTasks}
        currentTaskId={params.task_id}
        currentSearch={params.search}
        viewMode={viewMode}
      />
    </AppLayout>
  )
}
