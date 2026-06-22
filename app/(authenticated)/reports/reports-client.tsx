"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Plus, Search, Filter, Eye, Pencil, Trash2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { Task } from "@/lib/types"
import { revalidatePathsAndTags } from "@/app/actions"

interface EnrichedReport {
  report_id: string
  task_id: string
  date: string | null
  progress_percentage: string | null
  total_hours: string | null
  remarks: string | null
  user_id: string | null
  created_by: string | null
  created_at: string | null
  deleted_by: string | null
  deleted_at: string | null
  task_description?: string
  project_id?: string
  project_name?: string
}

export function ReportsClient({
  reports,
  tasks,
  currentTaskId,
  currentSearch,
  viewMode,
}: {
  reports: EnrichedReport[]
  tasks: Task[]
  currentTaskId?: string
  currentSearch?: string
  viewMode: "my" | "team"
}) {
  const router = useRouter()
  const [search, setSearch] = useState(currentSearch ?? "")
  const [taskFilter, setTaskFilter] = useState(currentTaskId ?? "")
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const handleFilter = () => {
    const params = new URLSearchParams()
    if (search) params.set("search", search)
    if (taskFilter) params.set("task_id", taskFilter)
    router.push(`/reports${params.toString() ? "?" + params.toString() : ""}`)
  }

  const handleDelete = async () => {
    if (!deleteId) return
    await fetch(`/api/reports/${deleteId}`, { method: "DELETE" })
    await revalidatePathsAndTags(
      ['/reports', '/dashboard'],
      ['reports', 'tasks', 'projects']
    )
    setDeleteId(null)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {viewMode === "my" ? "My Reports" : "Daily Reports"}
          </h1>
          <p className="text-muted-foreground">
            {viewMode === "my"
              ? "Your daily progress reports"
              : "Track daily progress on tasks"}
          </p>
        </div>
        <Link href="/reports/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Report
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search reports..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                onKeyDown={(e) => e.key === "Enter" && handleFilter()}
              />
            </div>
            <Select value={taskFilter} onValueChange={setTaskFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="All tasks" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All tasks</SelectItem>
                {tasks.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.task_description?.slice(0, 30) ?? t.id}
                    {(t.task_description?.length ?? 0) > 30 ? "..." : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleFilter} variant="secondary">
              Filter
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Report List */}
      {reports.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileTextIcon className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <p className="text-muted-foreground">
              {viewMode === "my" ? "No reports from you yet" : "No reports found"}
            </p>
            <Link href="/reports/new" className="mt-4">
              <Button variant="outline" size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Create your first report
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => (
            <Card key={report.report_id} className="transition-shadow hover:shadow-md">
              <CardContent className="flex items-center justify-between p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{report.date}</p>
                    <Badge variant="outline">
                      {report.progress_percentage ?? 0}%
                    </Badge>
                    {report.total_hours && (
                      <Badge variant="secondary" className="text-xs">
                        {report.total_hours}h
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {report.remarks || "No remarks"}
                  </p>
                  {report.task_description && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      📁 {report.project_name ?? "Unknown"} →{" "}
                      {report.task_description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Link href={`/reports/${report.report_id}`}>
                    <Button variant="ghost" size="icon-sm">
                      <Eye className="h-3 w-3" />
                    </Button>
                  </Link>
                  <Link href={`/reports/${report.report_id}/edit`}>
                    <Button variant="ghost" size="icon-sm">
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setDeleteId(report.report_id)}
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Report</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete this report? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function FileTextIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  )
}
