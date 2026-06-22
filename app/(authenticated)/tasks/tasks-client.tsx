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
import type { Task, Status, Project } from "@/lib/types"
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

/* ─────────────────────── Sortable Task Card ─────────────────────── */

function SortableTaskCard({
  task,
  projectMap,
  taskHoursMap,
  statuses,
  updatingId,
  onStatusChange,
  onDelete,
  isPinned,
  onTogglePin,
}: {
  task: Task
  projectMap: Record<string, string | null>
  taskHoursMap: Record<string, number>
  statuses: Status[]
  updatingId: string | null
  onStatusChange: (taskId: string, newStatus: string) => void
  onDelete: (taskId: string) => void
  isPinned: boolean
  onTogglePin: (taskId: string) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <Card className={`shadow-sm hover:shadow-md transition-shadow relative overflow-hidden ${isDragging ? "ring-2 ring-primary" : ""}`}>
        {updatingId === task.id && (
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
              <Link href={`/tasks/${task.id}`} className="font-medium text-sm hover:text-primary leading-snug line-clamp-2">
                {task.task_description}
              </Link>
              <p className="text-[11px] text-muted-foreground truncate">
                📁 {projectMap[task.project_id] ?? task.project_id}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              className={`h-6 w-6 shrink-0 ${isPinned ? "text-primary" : "text-muted-foreground opacity-30 hover:opacity-100"}`}
              onClick={() => onTogglePin(task.id)}
            >
              <Pin className="h-3.5 w-3.5" style={isPinned ? { fill: "currentColor" } : {}} />
            </Button>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t">
            <span>Progress: <span className="font-medium text-foreground">{task.task_latest_percentage ?? 0}%</span></span>
            {taskHoursMap[task.id] > 0 && (
              <span>Hours: <span className="font-medium text-foreground">{taskHoursMap[task.id]}h</span></span>
            )}
          </div>

          <div className="flex items-center justify-between gap-1 pt-1">
            {/* Fast status switcher */}
            <Select
              value={task.task_status || "NS"}
              onValueChange={(val) => onStatusChange(task.id, val)}
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
              <Link href={`/tasks/${task.id}`}>
                <Button variant="ghost" size="icon-sm" className="h-7 w-7">
                  <Eye className="h-3 w-3" />
                </Button>
              </Link>
              <Link href={`/tasks/${task.id}/edit`}>
                <Button variant="ghost" size="icon-sm" className="h-7 w-7">
                  <Pencil className="h-3 w-3" />
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="icon-sm"
                className="h-7 w-7"
                onClick={() => onDelete(task.id)}
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

function TaskDragOverlay({
  task,
  projectMap,
  taskHoursMap,
}: {
  task: Task
  projectMap: Record<string, string | null>
  taskHoursMap: Record<string, number>
}) {
  return (
    <Card className="shadow-xl ring-2 ring-primary/50 rotate-2 w-[280px]">
      <CardContent className="p-4 space-y-2">
        <p className="font-medium text-sm line-clamp-2">{task.task_description}</p>
        <p className="text-[11px] text-muted-foreground truncate">
          📁 {projectMap[task.project_id] ?? task.project_id}
        </p>
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t">
          <span>{task.task_latest_percentage ?? 0}%</span>
          {taskHoursMap[task.id] > 0 && <span>{taskHoursMap[task.id]}h</span>}
        </div>
      </CardContent>
    </Card>
  )
}

/* ─────────────────────── Droppable Column ─────────────────────── */

function DroppableColumn({
  column,
  tasks,
  children,
}: {
  column: { id: string; title: string }
  tasks: Task[]
  children: React.ReactNode
}) {
  const taskIds = tasks.map((t) => t.id)
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
        <Badge variant="secondary">{tasks.length}</Badge>
      </div>

      <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
        <div className="flex-1 space-y-3 overflow-y-auto" data-column-id={column.id}>
          {tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 border border-dashed rounded-xl bg-card/50">
              <p className="text-xs text-muted-foreground">No tasks</p>
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

export function TasksClient({
  tasks,
  statuses,
  projects,
  users = [],
  projectMap,
  taskHoursMap,
  currentProjectId,
  currentStatus,
  currentSearch,
  currentCreatedBy,
  currentMemberId,
  viewMode,
}: {
  tasks: Task[]
  statuses: Status[]
  projects: Project[]
  users?: { user_id: string; user_name: string | null; user_email: string }[]
  projectMap: Record<string, string | null>
  taskHoursMap: Record<string, number>
  currentProjectId?: string
  currentStatus?: string
  currentSearch?: string
  currentCreatedBy?: string
  currentMemberId?: string
  viewMode: "my" | "team"
}) {
  const router = useRouter()
  const [search, setSearch] = useState(currentSearch ?? "")
  const [statusFilter, setStatusFilter] = useState(currentStatus ?? "")
  const [projectFilter, setProjectFilter] = useState(currentProjectId ?? "")
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

  const [localTasks, setLocalTasks] = useState(tasks)
  const [prevTasks, setPrevTasks] = useState(tasks)
  if (tasks !== prevTasks) {
    setPrevTasks(tasks)
    setLocalTasks(tasks.map(t => {
      const optStatus = optimisticStatuses[t.id]
      if (optStatus) {
        return { ...t, task_status: optStatus }
      }
      return t
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
    if (projectFilter) params.set("project_id", projectFilter)
    if (viewMode === "team") {
      if (createdByFilter) params.set("created_by", createdByFilter)
      if (memberFilter) params.set("member_id", memberFilter)
    }
    const query = params.toString()
    router.push(`/tasks${query ? "?" + query : ""}`)
  }, [debouncedSearch, statusFilter, projectFilter, createdByFilter, memberFilter, viewMode, router])

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

  const handleStatusChange = useCallback(async (taskId: string, newStatus: string) => {
    setUpdatingId(taskId)
    const existingStatus = localTasks.find(t => t.id === taskId)?.task_status ?? "NS"
    setLocalTasks(prev => prev.map(t => t.id === taskId ? { ...t, task_status: newStatus } : t))
    setOptimisticStatuses(prev => ({ ...prev, [taskId]: newStatus }))
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_status: newStatus }),
      })
      if (res.ok) {
        await revalidatePathsAndTags(
          ['/tasks', '/dashboard'],
          ['tasks', 'projects']
        )
        router.refresh()
      } else {
        setLocalTasks(prev => prev.map(t => t.id === taskId ? { ...t, task_status: existingStatus } : t))
        setOptimisticStatuses(prev => {
          const next = { ...prev }
          delete next[taskId]
          return next
        })
      }
    } catch (error) {
      console.error("Failed to update task status:", error)
      setLocalTasks(prev => prev.map(t => t.id === taskId ? { ...t, task_status: existingStatus } : t))
      setOptimisticStatuses(prev => {
        const next = { ...prev }
        delete next[taskId]
        return next
      })
    } finally {
      setUpdatingId(null)
    }
  }, [localTasks, router])

  const [pinnedIds, setPinnedIds] = useState<string[]>([])
  const [columnOrders, setColumnOrders] = useState<Record<string, string[]>>({})

  useEffect(() => {
    const pinned = localStorage.getItem("tasks-pinned")
    const order = localStorage.getItem("tasks-order")
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
    const t = tasks.find(task => task.id === id)
    if (t && t.task_status === optStatus) {
      delete updatedOptimisticStatuses[id]
      hasOptimisticChanges = true
    }
  }
  if (hasOptimisticChanges) {
    setOptimisticStatuses(updatedOptimisticStatuses)
  }

  const togglePin = useCallback((taskId: string) => {
    setPinnedIds((prev) => {
      const next = prev.includes(taskId)
        ? prev.filter((id) => id !== taskId)
        : [...prev, taskId]
      localStorage.setItem("tasks-pinned", JSON.stringify(next))
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

  const activeTasks = localTasks.filter(t => {
    const status = dragOverStatuses[t.id] ?? optimisticStatuses[t.id] ?? t.task_status ?? "NS"
    return status !== "CC" && status !== "C"
  })
  const cancelledTasks = localTasks.filter(t => {
    const status = dragOverStatuses[t.id] ?? optimisticStatuses[t.id] ?? t.task_status ?? "NS"
    return status === "CC" || status === "C"
  })

  const getSortedColumnTasks = useCallback((colId: string) => {
    const colTasks = activeTasks.filter((t) => {
      const status = dragOverStatuses[t.id] ?? optimisticStatuses[t.id] ?? t.task_status ?? "NS"
      return status === colId
    })

    const pinned = colTasks.filter((t) => pinnedIds.includes(t.id))
    const unpinned = colTasks.filter((t) => !pinnedIds.includes(t.id))

    const sortOrder = columnOrders[colId] || []
    const sortFn = (a: Task, b: Task) => {
      const idxA = sortOrder.indexOf(a.id)
      const idxB = sortOrder.indexOf(b.id)
      if (idxA === -1 && idxB === -1) return 0
      if (idxA === -1) return 1
      if (idxB === -1) return -1
      return idxA - idxB
    }

    pinned.sort(sortFn)
    unpinned.sort(sortFn)

    return [...pinned, ...unpinned]
  }, [activeTasks, pinnedIds, columnOrders, optimisticStatuses, dragOverStatuses])

  /* ── Drag handlers ── */

  const handleDragStart = (event: DragStartEvent) => {
    const activeTaskId = event.active.id as string
    setActiveId(activeTaskId)
    const activeTaskObj = activeTasks.find(t => t.id === activeTaskId)
    if (activeTaskObj) {
      setDragStartColumn(dragOverStatuses[activeTaskId] ?? optimisticStatuses[activeTaskId] ?? activeTaskObj.task_status ?? "NS")
    }
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return

    const activeTaskId = active.id as string
    const overId = over.id as string

    const activeTaskObj = activeTasks.find(t => t.id === activeTaskId)
    if (!activeTaskObj) return

    const currentColumn = dragOverStatuses[activeTaskId] ?? optimisticStatuses[activeTaskId] ?? activeTaskObj.task_status ?? "NS"

    let targetColumn: string | null = null
    let overTaskId: string | null = null

    const overTask = activeTasks.find(t => t.id === overId)
    if (overTask) {
      targetColumn = dragOverStatuses[overTask.id] ?? optimisticStatuses[overTask.id] ?? overTask.task_status ?? "NS"
      overTaskId = overTask.id
    } else {
      targetColumn = columns.find(c => c.id === overId)?.id ?? null
    }

    if (!targetColumn || targetColumn === currentColumn) return

    setDragOverStatuses(prev => ({ ...prev, [activeTaskId]: targetColumn }))

    // Move in columnOrders
    const sourceOrder = (columnOrders[currentColumn] || getSortedColumnTasks(currentColumn).map(t => t.id)).filter(id => id !== activeTaskId)
    const destOrder = (columnOrders[targetColumn] || getSortedColumnTasks(targetColumn).map(t => t.id)).filter(id => id !== activeTaskId)

    if (overTaskId) {
      const idx = destOrder.indexOf(overTaskId)
      if (idx !== -1) {
        destOrder.splice(idx, 0, activeTaskId)
      } else {
        destOrder.push(activeTaskId)
      }
    } else {
      destOrder.push(activeTaskId)
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

    const activeTaskId = active.id as string
    const overId = over.id as string

    const activeTaskObj = activeTasks.find(t => t.id === activeTaskId)
    if (!activeTaskObj) {
      setDragOverStatuses({})
      return
    }

    const originalColumn = dragStartColumn ?? activeTaskObj.task_status ?? "NS"
    let finalColumn = dragOverStatuses[activeTaskId] ?? originalColumn

    // Fallback in case dragOverStatuses is missing/stale on fast drag end
    if (finalColumn === originalColumn) {
      const targetCol = columns.find(c => c.id === overId)
      if (targetCol) {
        finalColumn = targetCol.id
      } else {
        const overTask = activeTasks.find(t => t.id === overId)
        if (overTask) {
          finalColumn = dragOverStatuses[overTask.id] ?? optimisticStatuses[overTask.id] ?? overTask.task_status ?? "NS"
        }
      }
    }

    // Reset dragOverStatuses
    setDragOverStatuses({})

    if (finalColumn !== originalColumn) {
      handleStatusChange(activeTaskId, finalColumn)
      localStorage.setItem("tasks-order", JSON.stringify(columnOrders))
    } else {
      // Same-column reorder
      const colTasks = getSortedColumnTasks(finalColumn)
      const colIds = colTasks.map(t => t.id)

      const overTask = activeTasks.find(t => t.id === overId)
      const overTaskId = overTask ? overTask.id : null

      const oldIndex = colIds.indexOf(activeTaskId)
      const newIndex = overTaskId ? colIds.indexOf(overTaskId) : -1

      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        const nextIds = arrayMove(colIds, oldIndex, newIndex)
        const nextOrders = {
          ...columnOrders,
          [finalColumn]: nextIds,
        }
        setColumnOrders(nextOrders)
        localStorage.setItem("tasks-order", JSON.stringify(nextOrders))
      }
    }
  }

  const activeTask = activeId ? activeTasks.find(t => t.id === activeId) : null

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
              Complete &amp; Cancel ({cancelledTasks.length})
            </Button>
          )}

          <Link href="/tasks/new">
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              New Task
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
                placeholder="Search tasks..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
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
            {layout === "list" && (
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
                    <SelectValue placeholder="Task team" />
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
              const colTasks = getSortedColumnTasks(col.id)
              return (
                <DroppableColumn key={col.id} column={col} tasks={colTasks}>
                  {colTasks.map((task) => (
                    <SortableTaskCard
                      key={task.id}
                      task={task}
                      projectMap={projectMap}
                      taskHoursMap={taskHoursMap}
                      statuses={statuses}
                      updatingId={updatingId}
                      onStatusChange={handleStatusChange}
                      onDelete={setDeleteId}
                      isPinned={pinnedIds.includes(task.id)}
                      onTogglePin={togglePin}
                    />
                  ))}
                </DroppableColumn>
              )
            })}
          </div>

          <DragOverlay>
            {activeTask ? (
              <TaskDragOverlay
                task={activeTask}
                projectMap={projectMap}
                taskHoursMap={taskHoursMap}
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        /* Traditional List View */
        localTasks.length === 0 ? (
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
            {localTasks.map((task) => (
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
                      {statusLabel[task.task_status ?? "NS"] ?? task.task_status ?? "NS"}
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
            {cancelledTasks.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">
                No completed or cancelled tasks found.
              </p>
            ) : (
              <div className="space-y-3">
                {cancelledTasks.map((task) => (
                  <Card key={task.id} className="border bg-muted/10 relative overflow-hidden">
                    {updatingId === task.id && (
                      <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      </div>
                    )}
                    <CardContent className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 gap-3">
                      <div className="min-w-0 flex-1">
                        <Link href={`/tasks/${task.id}`} className="font-semibold text-sm hover:text-primary leading-snug">
                          {task.task_description}
                        </Link>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          📁 {projectMap[task.project_id] ?? task.project_id} • {task.task_latest_percentage ?? 0}% complete
                          {taskHoursMap[task.id] > 0 && ` • ${taskHoursMap[task.id]}h`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant={task.task_status === "C" ? "success" : "destructive"}>
                          {task.task_status === "C" ? "Completed" : "Cancelled"}
                        </Badge>
                        <Select
                          value={task.task_status || "NS"}
                          onValueChange={(val) => handleStatusChange(task.id, val)}
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
                        <Link href={`/tasks/${task.id}`}>
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
