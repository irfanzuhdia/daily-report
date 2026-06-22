"use client"

import Link from "next/link"
import { ArrowLeft, Pencil } from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { DailyReport, Task, Project } from "@/lib/types"
import { formatDate, formatDateTime } from "@/lib/format"
import { FileSection } from "@/components/file-section"

export function ReportDetailClient({
  report,
  task,
  project,
  createdByName,
}: {
  report: DailyReport
  task: Task | null
  project: Project | null
  createdByName: string
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/reports">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold">Report {report.report_id}</h1>
                <Badge variant="outline">{report.progress_percentage ?? 0}%</Badge>
                {report.total_hours && (
                  <Badge variant="secondary">{report.total_hours}h</Badge>
                )}
              </div>
              <p className="text-muted-foreground">{formatDate(report.date)}</p>
            </div>
            <Link href={`/reports/${report.report_id}/edit`}>
              <Button variant="outline" size="sm">
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {task && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">Task</p>
              <Link href={`/tasks/${task.id}`} className="text-sm hover:text-primary">
                {task.task_description}
              </Link>
            </div>
          )}
          {project && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">Project</p>
              <Link href={`/projects/${project.project_id}`} className="text-sm hover:text-primary">
                {project.project_name}
              </Link>
            </div>
          )}
          <div>
            <p className="text-xs font-medium text-muted-foreground">Remarks</p>
            <p className="whitespace-pre-wrap text-sm">
              {report.remarks || "No remarks"}
            </p>
          </div>

          {/* Progress & Hours */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Progress</p>
              <p className="text-sm font-medium">{report.progress_percentage ?? 0}%</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total Hours</p>
              <p className="text-sm font-medium">{report.total_hours || "—"}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Created By</p>
              <p className="text-sm">{createdByName}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Created At</p>
              <p className="text-sm">{formatDateTime(report.created_at)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <FileSection reportId={report.report_id} />
    </div>
  )
}
