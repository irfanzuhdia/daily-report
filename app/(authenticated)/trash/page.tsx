import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { revalidateTag } from "next/cache"
import {
  findAllProjectsIncludingDeleted,
  findAllTasksIncludingDeleted,
  findAllReportsIncludingDeleted,
  getUserMap,
} from "@/lib/repositories"
import { sql } from "@/lib/db"
import { TrashClient } from "./trash-client"

export default async function TrashPage() {
  const session = await getSession()
  if (!session) redirect("/login")

  let allProjects
  let allTasks
  let allReports

  const [initProjects, initTasks, initReports, userMap] = await Promise.all([
    findAllProjectsIncludingDeleted(session.user_id),
    findAllTasksIncludingDeleted(session.user_id),
    findAllReportsIncludingDeleted(session.user_id),
    getUserMap(),
  ])

  allProjects = initProjects
  allTasks = initTasks
  allReports = initReports

  // Purge items older than 30 days automatically
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  let projectsChanged = false
  let tasksChanged = false
  let reportsChanged = false

  const projectsToDelete = allProjects.filter(
    (p) => p.deleted_at && new Date(p.deleted_at) < thirtyDaysAgo
  )
  if (projectsToDelete.length > 0) {
    const ids = projectsToDelete.map((p) => p.project_id)
    await sql`DELETE FROM projects WHERE project_id = ANY(${ids})`
    projectsChanged = true
  }

  const tasksToDelete = allTasks.filter(
    (t) => t.deleted_at && new Date(t.deleted_at) < thirtyDaysAgo
  )
  if (tasksToDelete.length > 0) {
    const ids = tasksToDelete.map((t) => t.id)
    await sql`DELETE FROM tasks WHERE id = ANY(${ids})`
    tasksChanged = true
  }

  const reportsToDelete = allReports.filter(
    (r) => r.deleted_at && new Date(r.deleted_at) < thirtyDaysAgo
  )
  if (reportsToDelete.length > 0) {
    const ids = reportsToDelete.map((r) => r.report_id)
    await sql`DELETE FROM daily_reports WHERE report_id = ANY(${ids})`
    reportsChanged = true
  }

  if (projectsChanged || tasksChanged || reportsChanged) {
    if (projectsChanged) revalidateTag("projects", "max")
    if (tasksChanged) revalidateTag("tasks", "max")
    if (reportsChanged) revalidateTag("reports", "max")

    // Re-fetch clean data
    ;[allProjects, allTasks, allReports] = await Promise.all([
      findAllProjectsIncludingDeleted(session.user_id),
      findAllTasksIncludingDeleted(session.user_id),
      findAllReportsIncludingDeleted(session.user_id),
    ])
  }

  const items: {
    type: "project" | "task" | "report"
    id: string
    name: string
    deletedBy: string | null
    deletedAt: string | null
  }[] = []

  for (const p of allProjects) {
    if (p.deleted_at) {
      items.push({
        type: "project",
        id: p.project_id,
        name: p.project_name ?? p.project_id,
        deletedBy: userMap[p.deleted_by ?? ""] ?? p.deleted_by ?? null,
        deletedAt: p.deleted_at,
      })
    }
  }

  for (const t of allTasks) {
    if (t.deleted_at) {
      items.push({
        type: "task",
        id: t.id,
        name: t.task_description ?? t.id,
        deletedBy: userMap[t.deleted_by ?? ""] ?? t.deleted_by ?? null,
        deletedAt: t.deleted_at,
      })
    }
  }

  for (const r of allReports) {
    if (r.deleted_at) {
      items.push({
        type: "report",
        id: r.report_id,
        name: `Report ${r.report_id} — ${r.date ?? "No date"}`,
        deletedBy: userMap[r.deleted_by ?? ""] ?? r.deleted_by ?? null,
        deletedAt: r.deleted_at,
      })
    }
  }

  items.sort((a, b) => (b.deletedAt ?? "").localeCompare(a.deletedAt ?? ""))

  return (
    <TrashClient items={items} />
  )
}
