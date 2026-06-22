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
import type { Project, Status } from "@/lib/types"
import { revalidatePathsAndTags } from "@/app/actions"

const statusVariant: Record<string, "default" | "success" | "warning" | "destructive" | "secondary"> = {
  NS: "secondary",
  OP: "warning",
  D: "success",
  H: "destructive",
  CC: "destructive",
}

export function ProjectsClient({
  projects,
  statuses,
  currentStatus,
  currentSearch,
  projectHoursMap,
  projectProgressMap,
  viewMode,
}: {
  projects: Project[]
  statuses: Status[]
  projectHoursMap: Record<string, number>
  projectProgressMap: Record<string, number>
  currentStatus?: string
  currentSearch?: string
  viewMode: "my" | "team"
}) {
  const router = useRouter()
  const [search, setSearch] = useState(currentSearch ?? "")
  const [statusFilter, setStatusFilter] = useState(currentStatus ?? "")
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const handleFilter = () => {
    const params = new URLSearchParams()
    if (search) params.set("search", search)
    if (statusFilter) params.set("status", statusFilter)
    router.push(`/projects${params.toString() ? "?" + params.toString() : ""}`)
  }

  const handleDelete = async () => {
    if (!deleteId) return
    await fetch(`/api/projects/${deleteId}`, { method: "DELETE" })
    await revalidatePathsAndTags(
      ['/projects', '/dashboard'],
      ['projects']
    )
    setDeleteId(null)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {viewMode === "my" ? "My Projects" : "Projects"}
          </h1>
          <p className="text-muted-foreground">
            {viewMode === "my"
              ? "Projects you are assigned to"
              : "Manage all projects and track progress"}
          </p>
        </div>
        <Link href="/projects/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Project
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
                placeholder="Search projects..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                onKeyDown={(e) => e.key === "Enter" && handleFilter()}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="mr-2 h-4 w-4" />
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

      {/* Project List */}
      {projects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FolderIcon className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <p className="text-muted-foreground">
              {viewMode === "my" ? "No projects assigned to you" : "No projects found"}
            </p>
            {viewMode === "team" && (
              <Link href="/projects/new" className="mt-4">
                <Button variant="outline" size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Create your first project
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Card key={project.project_id} className="transition-shadow hover:shadow-md">
              <CardContent className="p-4">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <h3 className="line-clamp-1 text-sm font-semibold">{project.project_name}</h3>
                  <Badge
                    variant={statusVariant[project.project_status ?? "NS"] ?? "default"}
                    className="shrink-0 text-xs"
                  >
                    {project.project_status ?? "NS"}
                  </Badge>
                </div>
                <p className="mb-3 line-clamp-2 text-xs text-muted-foreground">
                  {project.project_description || "No description"}
                </p>
                <div className="mb-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {project.project_start_date_plan && (
                    <span>Start: {project.project_start_date_plan}</span>
                  )}
                  {project.project_end_date_plan && (
                    <span>End: {project.project_end_date_plan}</span>
                  )}
                </div>
                <div className="mb-3 flex flex-wrap gap-1.5 text-xs">
                  {(projectProgressMap[project.project_id] ?? 0) > 0 && (
                    <Badge variant="outline">
                      {projectProgressMap[project.project_id]}% done
                    </Badge>
                  )}
                  {(projectHoursMap[project.project_id] ?? 0) > 0 && (
                    <Badge variant="secondary">
                      {projectHoursMap[project.project_id]}h logged
                    </Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  <Link href={`/projects/${project.project_id}`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full">
                      <Eye className="mr-1 h-3 w-3" />
                      View
                    </Button>
                  </Link>
                  <Link href={`/projects/${project.project_id}/edit`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full">
                      <Pencil className="mr-1 h-3 w-3" />
                      Edit
                    </Button>
                  </Link>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setDeleteId(project.project_id)}
                  >
                    <Trash2 className="h-3 w-3" />
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
            <DialogTitle>Delete Project</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete this project? This action cannot be undone.
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

function FolderIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
    </svg>
  )
}
