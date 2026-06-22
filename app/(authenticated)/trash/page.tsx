import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { revalidateTag } from "next/cache"
import {
  findAllProjectsIncludingDeleted,
  findAllTasksIncludingDeleted,
  findAllReportsIncludingDeleted,
  getUserMap,
} from "@/lib/repositories"
import { deleteRowDimension } from "@/lib/sheets"
import { TrashClient } from "./trash-client"

export default async function TrashPage() {
  const session = await getSession()
  if (!session) redirect("/login")

  let allProjects
  let allTasks
  let allReports

  const [initProjects, initTasks, initReports, userMap] = await Promise.all([
    findAllProjectsIncludingDeleted(),
    findAllTasksIncludingDeleted(),
    findAllReportsIncludingDeleted(),
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

  const projectsToDelete: number[] = []
  for (let i = 0; i < allProjects.length; i++) {
    const p = allProjects[i]
    if (p.deleted_at) {
      const deletedTime = new Date(p.deleted_at)
      if (deletedTime < thirtyDaysAgo) {
        projectsToDelete.push(i + 2)
      }
    }
  }
  if (projectsToDelete.length > 0) {
    projectsToDelete.sort((a, b) => b - a)
    for (const rowNum of projectsToDelete) {
      await deleteRowDimension("project", rowNum)
    }
    projectsChanged = true
  }

  const tasksToDelete: number[] = []
  for (let i = 0; i < allTasks.length; i++) {
    const t = allTasks[i]
    if (t.deleted_at) {
      const deletedTime = new Date(t.deleted_at)
      if (deletedTime < thirtyDaysAgo) {
        tasksToDelete.push(i + 2)
      }
    }
  }
  if (tasksToDelete.length > 0) {
    tasksToDelete.sort((a, b) => b - a)
    for (const rowNum of tasksToDelete) {
      await deleteRowDimension("task", rowNum)
    }
    tasksChanged = true
  }

  const reportsToDelete: number[] = []
  for (let i = 0; i < allReports.length; i++) {
    const r = allReports[i]
    if (r.deleted_at) {
      const deletedTime = new Date(r.deleted_at)
      if (deletedTime < thirtyDaysAgo) {
        reportsToDelete.push(i + 2)
      }
    }
  }
  if (reportsToDelete.length > 0) {
    reportsToDelete.sort((a, b) => b - a)
    for (const rowNum of reportsToDelete) {
      await deleteRowDimension("report", rowNum)
    }
    reportsChanged = true
  }

  if (projectsChanged || tasksChanged || reportsChanged) {
    if (projectsChanged) revalidateTag("projects", "max")
    if (tasksChanged) revalidateTag("tasks", "max")
    if (reportsChanged) revalidateTag("reports", "max")

    // Re-fetch clean data
    ;[allProjects, allTasks, allReports] = await Promise.all([
      findAllProjectsIncludingDeleted(),
      findAllTasksIncludingDeleted(),
      findAllReportsIncludingDeleted(),
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
