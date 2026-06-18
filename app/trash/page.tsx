import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { AppLayout } from "@/components/layout/app-layout"
import {
  findAllProjectsIncludingDeleted,
  findAllTasksIncludingDeleted,
  findAllReportsIncludingDeleted,
  getUserMap,
} from "@/lib/repositories"
import { TrashClient } from "./trash-client"

export default async function TrashPage() {
  const session = await getSession()
  if (!session) redirect("/login")

  const [allProjects, allTasks, allReports, userMap] = await Promise.all([
    findAllProjectsIncludingDeleted(),
    findAllTasksIncludingDeleted(),
    findAllReportsIncludingDeleted(),
    getUserMap(),
  ])

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
    <AppLayout userName={session.name} userEmail={session.email}>
      <TrashClient items={items} />
    </AppLayout>
  )
}
