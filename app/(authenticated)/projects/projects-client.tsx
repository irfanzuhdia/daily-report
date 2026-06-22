"use client"

import { useState, useCallback, useId, useEffect, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Plus, Search, Filter, Eye, Pencil, Trash2, Kanban, List, Archive, Loader2, GripVertical, Pin } from "lucide-react"
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
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
  C: "success",
  H: "destructive",
  CC: "destructive",
}

const statusLabel: Record<string, string> = {
  NS: "Not Started",
  OP: "On Progress",
  D: "Completed",
  C: "Completed",
  H: "On Hold",
  CC: "Cancelled",
}

/* ─────────────────────── Sortable Project Card ─────────────────────── */

function SortableProjectCard({
  project,
  projectHoursMap,
  projectProgressMap,
  statuses,
  updatingId,
  onStatusChange,
  onDelete,
  isPinned,
  onTogglePin,
}: {
  project: Project
  projectHoursMap: Record<string, number>
  projectProgressMap: Record<string, number>
  statuses: Status[]
  updatingId: string | null
  onStatusChange: (projectId: string, newStatus: string) => void
  onDelete: (projectId: string) => void
  isPinned: boolean
  onTogglePin: (projectId: string) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: project.project_id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <Card className={`shadow-sm hover:shadow-md transition-shadow relative overflow-hidden ${isDragging ? "ring-2 ring-primary" : ""}`}>
        {updatingId === project.project_id && (
          <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        )}
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start gap-2">
            <button
              {...listeners}
              className="mt-0.5 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground shrink-0 touch-none"
              tabIndex={-1}
            >
              <GripVertical className="h-4 w-4" />
            </button>
            <div className="space-y-1 min-w-0 flex-1">
              <Link href={`/projects/${project.project_id}`} className="font-medium text-sm hover:text-primary leading-snug line-clamp-2">
                {project.project_name}
              </Link>
              <p className="text-[11px] text-muted-foreground line-clamp-2">
                {project.project_description || "No description"}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              className={`h-6 w-6 shrink-0 ${isPinned ? "text-primary" : "text-muted-foreground opacity-30 hover:opacity-100"}`}
              onClick={() => onTogglePin(project.project_id)}
            >
              <Pin className="h-3.5 w-3.5" style={isPinned ? { fill: "currentColor" } : {}} />
            </Button>
          </div>

          {/* Dates */}
          {(project.project_start_date_plan || project.project_end_date_plan) && (
            <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
              {project.project_start_date_plan && <span>📅 Start: {project.project_start_date_plan}</span>}
              {project.project_end_date_plan && <span>🏁 End: {project.project_end_date_plan}</span>}
            </div>
          )}

          {/* Metrics */}
          <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t">
            {(projectProgressMap[project.project_id] ?? 0) > 0 && (
              <Badge variant="outline" className="text-[10px] py-0">
                {projectProgressMap[project.project_id]}% done
              </Badge>
            )}
            {(projectHoursMap[project.project_id] ?? 0) > 0 && (
              <Badge variant="secondary" className="text-[10px] py-0">
                {projectHoursMap[project.project_id]}h logged
              </Badge>
            )}
          </div>

          <div className="flex items-center justify-between gap-1 pt-1">
            {/* Fast status switcher */}
            <Select
              value={project.project_status || "NS"}
              onValueChange={(val) => onStatusChange(project.project_id, val)}
            >
              <SelectTrigger className="h-7 text-[10px] w-[110px] px-2 py-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statuses.map((s) => (
                  <SelectItem key={s.id} value={s.id} className="text-xs">
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-0.5">
              <Link href={`/projects/${project.project_id}`}>
                <Button variant="ghost" size="icon-sm" className="h-7 w-7">
                  <Eye className="h-3 w-3" />
                </Button>
              </Link>
              <Link href={`/projects/${project.project_id}/edit`}>
                <Button variant="ghost" size="icon-sm" className="h-7 w-7">
                  <Pencil className="h-3 w-3" />
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="icon-sm"
                className="h-7 w-7"
                onClick={() => onDelete(project.project_id)}
              >
                <Trash2 className="h-3 w-3 text-destructive" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/* ─────────────────────── Drag Overlay Card ─────────────────────── */

function ProjectDragOverlay({
  project,
  projectHoursMap,
  projectProgressMap,
}: {
  project: Project
  projectHoursMap: Record<string, number>
  projectProgressMap: Record<string, number>
}) {
  return (
    <Card className="shadow-xl ring-2 ring-primary/50 rotate-2 w-[280px]">
      <CardContent className="p-4 space-y-2">
        <p className="font-medium text-sm line-clamp-2">{project.project_name}</p>
        <p className="text-[11px] text-muted-foreground line-clamp-1">
          {project.project_description || "No description"}
        </p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1 border-t">
          {(projectProgressMap[project.project_id] ?? 0) > 0 && (
            <span>{projectProgressMap[project.project_id]}% done</span>
          )}
          {(projectHoursMap[project.project_id] ?? 0) > 0 && (
            <span>{projectHoursMap[project.project_id]}h</span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

/* ─────────────────────── Droppable Column ─────────────────────── */

function DroppableColumn({
  column,
  projects,
  children,
}: {
  column: { id: string; title: string }
  projects: Project[]
  children: React.ReactNode
}) {
  const projectIds = projects.map((p) => p.project_id)
  const { setNodeRef } = useDroppable({
    id: column.id,
  })

  return (
    <div ref={setNodeRef} className="flex flex-col rounded-2xl border bg-muted/30 p-4 min-h-[500px]">
      <div className="flex items-center justify-between mb-4 pb-2 border-b">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${
            column.id === "NS" ? "bg-slate-400" :
            column.id === "OP" ? "bg-amber-500" :
            column.id === "D" ? "bg-emerald-500" :
            "bg-rose-500"
          }`} />
          <h3 className="font-semibold text-sm text-foreground">{column.title}</h3>
        </div>
        <Badge variant="secondary">{projects.length}</Badge>
      </div>

      <SortableContext items={projectIds} strategy={verticalListSortingStrategy}>
        <div className="flex-1 space-y-3 overflow-y-auto" data-column-id={column.id}>
          {projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 border border-dashed rounded-xl bg-card/50">
              <p className="text-xs text-muted-foreground">No projects</p>
            </div>
          ) : (
            children
          )}
        </div>
      </SortableContext>
    </div>
  )
}

/* ─────────────────────── Main Component ─────────────────────── */

export function ProjectsClient({
  projects,
  statuses,
  users = [],
  currentStatus,
  currentSearch,
  currentCreatedBy,
  currentMemberId,
  projectHoursMap,
  projectProgressMap,
  viewMode,
}: {
  projects: Project[]
  statuses: Status[]
  users?: { user_id: string; user_name: string | null; user_email: string }[]
  projectHoursMap: Record<string, number>
  projectProgressMap: Record<string, number>
  currentStatus?: string
  currentSearch?: string
  currentCreatedBy?: string
  currentMemberId?: string
  viewMode: "my" | "team"
}) {
  const router = useRouter()
  const [search, setSearch] = useState(currentSearch ?? "")
  const [statusFilter, setStatusFilter] = useState(currentStatus ?? "")
  const [createdByFilter, setCreatedByFilter] = useState(currentCreatedBy ?? "")
  const [memberFilter, setMemberFilter] = useState(currentMemberId ?? "")
  const [deleteId, setDeleteId] = useState<string | null>(null)
  
  const [layout, setLayout] = useState<"kanban" | "list">("kanban")
  const [showArchive, setShowArchive] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [optimisticStatuses, setOptimisticStatuses] = useState<Record<string, string>>({})
  const [dragOverStatuses, setDragOverStatuses] = useState<Record<string, string>>({})
  const [dragStartColumn, setDragStartColumn] = useState<string | null>(null)

  const [localProjects, setLocalProjects] = useState(projects)
  const [prevProjects, setPrevProjects] = useState(projects)
  if (projects !== prevProjects) {
    setPrevProjects(projects)
    setLocalProjects(projects.map(p => {
      const optStatus = optimisticStatuses[p.project_id]
      if (optStatus) {
        return { ...p, project_status: optStatus }
      }
      return p
    }))
  }

  const dndId = useId()
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  )

  const isFirstMount = useRef(true)
  const [debouncedSearch, setDebouncedSearch] = useState(search)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
    }, 500)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false
      return
    }
    const params = new URLSearchParams()
    if (debouncedSearch) params.set("search", debouncedSearch)
    if (statusFilter) params.set("status", statusFilter)
    if (viewMode === "team") {
      if (createdByFilter) params.set("created_by", createdByFilter)
      if (memberFilter) params.set("member_id", memberFilter)
    }
    const query = params.toString()
    router.push(`/projects${query ? "?" + query : ""}`)
  }, [debouncedSearch, statusFilter, createdByFilter, memberFilter, viewMode, router])

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

  const handleStatusChange = useCallback(async (projectId: string, newStatus: string) => {
    setUpdatingId(projectId)
    const existingStatus = localProjects.find(p => p.project_id === projectId)?.project_status ?? "NS"
    setLocalProjects(prev => prev.map(p => p.project_id === projectId ? { ...p, project_status: newStatus } : p))
    setOptimisticStatuses(prev => ({ ...prev, [projectId]: newStatus }))
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_status: newStatus }),
      })
      if (res.ok) {
        await revalidatePathsAndTags(
          ['/projects', '/dashboard'],
          ['projects']
        )
        router.refresh()
      } else {
        setLocalProjects(prev => prev.map(p => p.project_id === projectId ? { ...p, project_status: existingStatus } : p))
        setOptimisticStatuses(prev => {
          const next = { ...prev }
          delete next[projectId]
          return next
        })
      }
    } catch (error) {
      console.error("Failed to update project status:", error)
      setLocalProjects(prev => prev.map(p => p.project_id === projectId ? { ...p, project_status: existingStatus } : p))
      setOptimisticStatuses(prev => {
        const next = { ...prev }
        delete next[projectId]
        return next
      })
    } finally {
      setUpdatingId(null)
    }
  }, [localProjects, router])

  const [pinnedIds, setPinnedIds] = useState<string[]>([])
  const [columnOrders, setColumnOrders] = useState<Record<string, string[]>>({})

  useEffect(() => {
    const pinned = localStorage.getItem("projects-pinned")
    const order = localStorage.getItem("projects-order")
    setTimeout(() => {
      if (pinned) {
        try {
          setPinnedIds(JSON.parse(pinned))
        } catch (e) {
          console.error(e)
        }
      }
      if (order) {
        try {
          setColumnOrders(JSON.parse(order))
        } catch (e) {
          console.error(e)
        }
      }
    }, 0)
  }, [])

  // Synchronize optimisticStatuses directly during render if the prop has updated
  let hasOptimisticChanges = false
  const updatedOptimisticStatuses = { ...optimisticStatuses }
  for (const [id, optStatus] of Object.entries(optimisticStatuses)) {
    const p = projects.find(proj => proj.project_id === id)
    if (p && p.project_status === optStatus) {
      delete updatedOptimisticStatuses[id]
      hasOptimisticChanges = true
    }
  }
  if (hasOptimisticChanges) {
    setOptimisticStatuses(updatedOptimisticStatuses)
  }

  const togglePin = useCallback((projectId: string) => {
    setPinnedIds((prev) => {
      const next = prev.includes(projectId)
        ? prev.filter((id) => id !== projectId)
        : [...prev, projectId]
      localStorage.setItem("projects-pinned", JSON.stringify(next))
      return next
    })
  }, [])

  // Kanban columns: NS, OP, H, D (Done)
  const columns = [
    { id: "NS", title: "Not Started" },
    { id: "OP", title: "On Progress" },
    { id: "H", title: "On Hold" },
    { id: "D", title: "Done" },
  ]

  const activeProjects = localProjects.filter(p => {
    const status = dragOverStatuses[p.project_id] ?? optimisticStatuses[p.project_id] ?? p.project_status ?? "NS"
    return status !== "CC" && status !== "C"
  })
  const cancelledProjects = localProjects.filter(p => {
    const status = dragOverStatuses[p.project_id] ?? optimisticStatuses[p.project_id] ?? p.project_status ?? "NS"
    return status === "CC" || status === "C"
  })

  const getSortedColumnProjects = useCallback((colId: string) => {
    const colProjects = activeProjects.filter((p) => {
      const status = dragOverStatuses[p.project_id] ?? optimisticStatuses[p.project_id] ?? p.project_status ?? "NS"
      return status === colId
    })

    const pinned = colProjects.filter((p) => pinnedIds.includes(p.project_id))
    const unpinned = colProjects.filter((p) => !pinnedIds.includes(p.project_id))

    const sortOrder = columnOrders[colId] || []
    const sortFn = (a: Project, b: Project) => {
      const idxA = sortOrder.indexOf(a.project_id)
      const idxB = sortOrder.indexOf(b.project_id)
      if (idxA === -1 && idxB === -1) return 0
      if (idxA === -1) return 1
      if (idxB === -1) return -1
      return idxA - idxB
    }

    pinned.sort(sortFn)
    unpinned.sort(sortFn)

    return [...pinned, ...unpinned]
  }, [activeProjects, pinnedIds, columnOrders, optimisticStatuses, dragOverStatuses])

  /* ── Drag handlers ── */

  const handleDragStart = (event: DragStartEvent) => {
    const activeProjectId = event.active.id as string
    setActiveId(activeProjectId)
    const activeProjectObj = activeProjects.find(p => p.project_id === activeProjectId)
    if (activeProjectObj) {
      setDragStartColumn(dragOverStatuses[activeProjectId] ?? optimisticStatuses[activeProjectId] ?? activeProjectObj.project_status ?? "NS")
    }
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return

    const activeProjectId = active.id as string
    const overId = over.id as string

    const activeProjectObj = activeProjects.find(p => p.project_id === activeProjectId)
    if (!activeProjectObj) return

    const currentColumn = dragOverStatuses[activeProjectId] ?? optimisticStatuses[activeProjectId] ?? activeProjectObj.project_status ?? "NS"

    let targetColumn: string | null = null
    let overProjectId: string | null = null

    const overProject = activeProjects.find(p => p.project_id === overId)
    if (overProject) {
      targetColumn = dragOverStatuses[overProject.project_id] ?? optimisticStatuses[overProject.project_id] ?? overProject.project_status ?? "NS"
      overProjectId = overProject.project_id
    } else {
      targetColumn = columns.find(c => c.id === overId)?.id ?? null
    }

    if (!targetColumn || targetColumn === currentColumn) return

    setDragOverStatuses(prev => ({ ...prev, [activeProjectId]: targetColumn }))

    // Move in columnOrders
    const sourceOrder = (columnOrders[currentColumn] || getSortedColumnProjects(currentColumn).map(p => p.project_id)).filter(id => id !== activeProjectId)
    const destOrder = (columnOrders[targetColumn] || getSortedColumnProjects(targetColumn).map(p => p.project_id)).filter(id => id !== activeProjectId)

    if (overProjectId) {
      const idx = destOrder.indexOf(overProjectId)
      if (idx !== -1) {
        destOrder.splice(idx, 0, activeProjectId)
      } else {
        destOrder.push(activeProjectId)
      }
    } else {
      destOrder.push(activeProjectId)
    }

    const nextOrders = {
      ...columnOrders,
      [currentColumn]: sourceOrder,
      [targetColumn]: destOrder,
    }
    setColumnOrders(nextOrders)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)
    setDragStartColumn(null)

    if (!over) {
      setDragOverStatuses({})
      return
    }

    const activeProjectId = active.id as string
    const overId = over.id as string

    const activeProjectObj = activeProjects.find(p => p.project_id === activeProjectId)
    if (!activeProjectObj) {
      setDragOverStatuses({})
      return
    }

    const originalColumn = dragStartColumn ?? activeProjectObj.project_status ?? "NS"
    let finalColumn = dragOverStatuses[activeProjectId] ?? originalColumn

    // Fallback in case dragOverStatuses is missing/stale on fast drag end
    if (finalColumn === originalColumn) {
      const targetCol = columns.find(c => c.id === overId)
      if (targetCol) {
        finalColumn = targetCol.id
      } else {
        const overProject = activeProjects.find(p => p.project_id === overId)
        if (overProject) {
          finalColumn = dragOverStatuses[overProject.project_id] ?? optimisticStatuses[overProject.project_id] ?? overProject.project_status ?? "NS"
        }
      }
    }

    // Reset dragOverStatuses
    setDragOverStatuses({})

    if (finalColumn !== originalColumn) {
      handleStatusChange(activeProjectId, finalColumn)
      localStorage.setItem("projects-order", JSON.stringify(columnOrders))
    } else {
      // Same-column reorder
      const colProjects = getSortedColumnProjects(finalColumn)
      const colIds = colProjects.map(p => p.project_id)

      const overProject = activeProjects.find(p => p.project_id === overId)
      const overProjectId = overProject ? overProject.project_id : null

      const oldIndex = colIds.indexOf(activeProjectId)
      const newIndex = overProjectId ? colIds.indexOf(overProjectId) : -1

      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        const nextIds = arrayMove(colIds, oldIndex, newIndex)
        const nextOrders = {
          ...columnOrders,
          [finalColumn]: nextIds,
        }
        setColumnOrders(nextOrders)
        localStorage.setItem("projects-order", JSON.stringify(nextOrders))
      }
    }
  }

  const activeProject = activeId ? activeProjects.find(p => p.project_id === activeId) : null

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
        <div className="flex items-center gap-2">
          {/* Layout Toggle */}
          <div className="flex rounded-xl border p-1 bg-muted/20 mr-2">
            <Button
              type="button"
              variant={layout === "kanban" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 px-3 rounded-lg text-xs"
              onClick={() => setLayout("kanban")}
            >
              <Kanban className="mr-1.5 h-3.5 w-3.5" />
              Kanban
            </Button>
            <Button
              type="button"
              variant={layout === "list" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 px-3 rounded-lg text-xs"
              onClick={() => setLayout("list")}
            >
              <List className="mr-1.5 h-3.5 w-3.5" />
              List
            </Button>
          </div>

          {/* Complete & Cancel Folder Button */}
          {layout === "kanban" && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs border-dashed"
              onClick={() => setShowArchive(true)}
            >
              <Archive className="mr-1.5 h-3.5 w-3.5 text-primary" />
              Complete &amp; Cancel ({cancelledProjects.length})
            </Button>
          )}

          <Link href="/projects/new">
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              New Project
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search projects..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            {layout === "list" && (
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
            )}
            {viewMode === "team" && (
              <>
                <Select value={createdByFilter} onValueChange={setCreatedByFilter}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <Filter className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="Created by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All creators</SelectItem>
                    {users.map((u) => (
                      <SelectItem key={u.user_id} value={u.user_id}>
                        {u.user_name || u.user_email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={memberFilter} onValueChange={setMemberFilter}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <Filter className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="Project team" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All members</SelectItem>
                    {users.map((u) => (
                      <SelectItem key={u.user_id} value={u.user_id}>
                        {u.user_name || u.user_email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Main Content Area */}
      {layout === "kanban" ? (
        /* Kanban Board View with Drag & Drop */
        <DndContext
          id={dndId}
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {columns.map((col) => {
              const colProjects = getSortedColumnProjects(col.id)
              return (
                <DroppableColumn key={col.id} column={col} projects={colProjects}>
                  {colProjects.map((project) => (
                    <SortableProjectCard
                      key={project.project_id}
                      project={project}
                      projectHoursMap={projectHoursMap}
                      projectProgressMap={projectProgressMap}
                      statuses={statuses}
                      updatingId={updatingId}
                      onStatusChange={handleStatusChange}
                      onDelete={setDeleteId}
                      isPinned={pinnedIds.includes(project.project_id)}
                      onTogglePin={togglePin}
                    />
                  ))}
                </DroppableColumn>
              )
            })}
          </div>

          <DragOverlay>
            {activeProject ? (
              <ProjectDragOverlay
                project={activeProject}
                projectHoursMap={projectHoursMap}
                projectProgressMap={projectProgressMap}
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        /* Traditional List (Card Grid) View */
        localProjects.length === 0 ? (
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
            {localProjects.map((project) => (
              <Card key={project.project_id} className="transition-shadow hover:shadow-md">
                <CardContent className="p-4">
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <h3 className="line-clamp-1 text-sm font-semibold">{project.project_name}</h3>
                    <Badge
                      variant={statusVariant[project.project_status ?? "NS"] ?? "default"}
                      className="shrink-0 text-xs"
                    >
                      {statusLabel[project.project_status ?? "NS"] ?? project.project_status ?? "NS"}
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
        )
      )}

      {/* Complete & Cancel Folder Dialog */}
      <Dialog open={showArchive} onOpenChange={setShowArchive}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <Archive className="h-5 w-5 text-primary" />
              Complete &amp; Cancel
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {cancelledProjects.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">
                No completed or cancelled projects found.
              </p>
            ) : (
              <div className="space-y-3">
                {cancelledProjects.map((project) => (
                  <Card key={project.project_id} className="border bg-muted/10 relative overflow-hidden">
                    {updatingId === project.project_id && (
                      <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      </div>
                    )}
                    <CardContent className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 gap-3">
                      <div className="min-w-0 flex-1">
                        <Link href={`/projects/${project.project_id}`} className="font-semibold text-sm hover:text-primary leading-snug">
                          {project.project_name}
                        </Link>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                          {project.project_description || "No description"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant={project.project_status === "C" ? "success" : "destructive"}>
                          {project.project_status === "C" ? "Completed" : "Cancelled"}
                        </Badge>
                        <Select
                          value={project.project_status || "NS"}
                          onValueChange={(val) => handleStatusChange(project.project_id, val)}
                        >
                          <SelectTrigger className="h-8 text-[11px] w-[120px] px-2 py-0">
                            <SelectValue placeholder="Restore status" />
                          </SelectTrigger>
                          <SelectContent>
                            {statuses.map((s) => (
                              <SelectItem key={s.id} value={s.id} className="text-xs">
                                {s.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Link href={`/projects/${project.project_id}`}>
                          <Button variant="ghost" size="icon-sm" className="h-8 w-8">
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

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
