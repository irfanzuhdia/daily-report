import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import {
  DailyReportRepository,
  TaskRepository,
  ProjectRepository,
  getUserMap,
} from "@/lib/repositories"
import { ReportDetailClient } from "./report-detail-client"

export default async function ReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getSession()
  if (!session) redirect("/login")

  const { id } = await params
  const [report, userMap] = await Promise.all([
    DailyReportRepository.findById(id),
    getUserMap(),
  ])
  if (!report) redirect("/reports")

  const task = await TaskRepository.findById(report.task_id)
  const project = task ? await ProjectRepository.findById(task.project_id) : null

  const createdByName = userMap[report.created_by ?? ""] ?? report.created_by ?? "—"

  return (
    <ReportDetailClient
      report={report}
      task={task}
      project={project}
      createdByName={createdByName}
    />
  )
}
