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
import type { Task, Status, Project } from "@/lib/types"
import { revalidatePathsAndTags } from "@/app/actions"

const statusVariant: Record<string, "default" | "success" | "warning" | "destructive" | "secondary"> = {
  NS: "secondary",
  OP: "warning",
  D: "success",
  H: "destructive",
  CC: "destructive",
}

export function TasksClient({
  tasks,
  statuses,
  projects,
  projectMap,
  taskHoursMap,
  currentProjectId,
  currentStatus,
  currentSearch,
  viewMode,
}: {
  tasks: Task[]
  statuses: Status[]
  projects: Project[]
  projectMap: Record<string, string | null>
  taskHoursMap: Record<string, number>
  currentProjectId?: string
  currentStatus?: string
  currentSearch?: string
  viewMode: "my" | "team"
}) {
  const router = useRouter()
  const [search, setSearch] = useState(currentSearch ?? "")
  const [statusFilter, setStatusFilter] = useState(currentStatus ?? "")
  const [projectFilter, setProjectFilter] = useState(currentProjectId ?? "")
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const handleFilter = () => {
    const params = new URLSearchParams()
    if (search) params.set("search", search)
    if (statusFilter) params.set("status", statusFilter)
    if (projectFilter) params.set("project_id", projectFilter)
    router.push(`/tasks${params.toString() ? "?" + params.toString() : ""}`)
  }

  const handleDelete = async () => {
    if (!deleteId) return
    await fetch(`/api/tasks/${deleteId}`, { method: "DELETE" })
    await revalidatePathsAndTags(
      ['/tasks', '/dashboard'],
      ['tasks', 'projects']
    )
    setDeleteId(null)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {viewMode === "my" ? "My Tasks" : "Tasks"}
          </h1>
          <p className="text-muted-foreground">
            {viewMode === "my"
              ? "Tasks assigned to you"
              : "Manage tasks across all projects"}
          </p>
        </div>
        <Link href="/tasks/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Task
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
                placeholder="Search tasks..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                onKeyDown={(e) => e.key === "Enter" && handleFilter()}
              />
            </div>
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="All projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All projects</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.project_id} value={p.project_id}>
                    {p.project_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All statuses</SelectItem>
                {statuses.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
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

      {/* Task List */}
      {tasks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ListTodoIcon className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <p className="text-muted-foreground">
              {viewMode === "my" ? "No tasks assigned to you" : "No tasks found"}
            </p>
            <Link href="/tasks/new" className="mt-4">
              <Button variant="outline" size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Create your first task
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <Card key={task.id} className="transition-shadow hover:shadow-md">
              <CardContent className="flex items-center justify-between p-4">
                <div className="min-w-0 flex-1">
                  <Link href={`/tasks/${task.id}`} className="font-medium hover:text-primary">
                    <p className="truncate">{task.task_description}</p>
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {projectMap[task.project_id] ?? task.project_id} •{" "}
                    {task.task_latest_percentage ?? 0}% complete
                    {(taskHoursMap[task.id] ?? 0) > 0 && (
                      <> • <span className="font-medium">{taskHoursMap[task.id]}h</span></>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={statusVariant[task.task_status ?? "NS"] ?? "default"}
                    className="shrink-0"
                  >
                    {task.task_status ?? "NS"}
                  </Badge>
                  <Link href={`/tasks/${task.id}`}>
                    <Button variant="ghost" size="icon-sm">
                      <Eye className="h-3 w-3" />
                    </Button>
                  </Link>
                  <Link href={`/tasks/${task.id}/edit`}>
                    <Button variant="ghost" size="icon-sm">
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setDeleteId(task.id)}
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
            <DialogTitle>Delete Task</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete this task? This action cannot be undone.
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

function ListTodoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}
