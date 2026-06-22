"use client"

import { useState, useCallback, useId, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Plus, Search, Filter, Eye, Pencil, Trash2, Kanban, List, Archive, GripVertical, Pin, Loader2 } from "lucide-react"
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
  task_status?: string
  project_id?: string
  project_name?: string
}

/* ─────────────────────── Sortable Report Card ─────────────────────── */

function SortableReportCard({
  report,
  onDelete,
  isPinned,
  onTogglePin,
  updatingTaskId,
}: {
  report: EnrichedReport
  onDelete: (id: string) => void
  isPinned: boolean
  onTogglePin: (id: string) => void
  updatingTaskId: string | null
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: report.report_id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <Card className={`shadow-sm hover:shadow-md transition-shadow relative overflow-hidden ${isDragging ? "ring-2 ring-primary" : ""}`}>
        {updatingTaskId === report.task_id && (
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
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">{report.date}</span>
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                    {report.progress_percentage ?? 0}%
                  </Badge>
                  {report.total_hours && (
                    <Badge variant="secondary" className="text-[10px] py-0 px-1.5">
                      {report.total_hours}h
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className={`h-6 w-6 shrink-0 ${isPinned ? "text-primary" : "text-muted-foreground opacity-30 hover:opacity-100"}`}
                    onClick={() => onTogglePin(report.report_id)}
                  >
                    <Pin className="h-3.5 w-3.5" style={isPinned ? { fill: "currentColor" } : {}} />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
              {report.remarks || "No remarks"}
            </p>
            {report.task_description && (
              <p className="text-[10px] text-muted-foreground pt-1 border-t truncate">
                📁 {report.project_name ?? "Unknown"} → {report.task_description}
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-1 pt-1">
            <Link href={`/reports/${report.report_id}`}>
              <Button variant="ghost" size="icon-sm" className="h-7 w-7">
                <Eye className="h-3 w-3" />
              </Button>
            </Link>
            <Link href={`/reports/${report.report_id}/edit`}>
              <Button variant="ghost" size="icon-sm" className="h-7 w-7">
                <Pencil className="h-3 w-3" />
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="icon-sm"
              className="h-7 w-7"
              onClick={() => onDelete(report.report_id)}
            >
              <Trash2 className="h-3 w-3 text-destructive" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/* ─────────────────────── Drag Overlay Card ─────────────────────── */

function ReportDragOverlay({ report }: { report: EnrichedReport }) {
  return (
    <Card className="shadow-xl ring-2 ring-primary/50 rotate-2 w-[280px]">
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold">{report.date}</span>
          <Badge variant="outline" className="text-[10px] py-0 px-1.5">
            {report.progress_percentage ?? 0}%
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2">
          {report.remarks || "No remarks"}
        </p>
        {report.task_description && (
          <p className="text-[10px] text-muted-foreground truncate">
            📁 {report.project_name ?? "Unknown"} → {report.task_description}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

/* ─────────────────────── Droppable Column ─────────────────────── */

function DroppableColumn({
  column,
  reports,
  children,
}: {
  column: { id: string; title: string }
  reports: EnrichedReport[]
  children: React.ReactNode
}) {
  const reportIds = reports.map((r) => r.report_id)
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
        <Badge variant="secondary">{reports.length}</Badge>
      </div>

      <SortableContext items={reportIds} strategy={verticalListSortingStrategy}>
        <div className="flex-1 space-y-3 overflow-y-auto" data-column-id={column.id}>
          {reports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 border border-dashed rounded-xl bg-card/50">
              <p className="text-xs text-muted-foreground">No reports</p>
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
  
  const [layout, setLayout] = useState<"kanban" | "list">("kanban")
  const [showArchive, setShowArchive] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null)
  const [optimisticTaskStatuses, setOptimisticTaskStatuses] = useState<Record<string, string>>({})
  const [dragOverTaskStatuses, setDragOverTaskStatuses] = useState<Record<string, string>>({})
  const [dragStartColumn, setDragStartColumn] = useState<string | null>(null)

  const dndId = useId()
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  )

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

  const handleTaskStatusChange = useCallback(async (taskId: string, newStatus: string) => {
    setUpdatingTaskId(taskId)
    setOptimisticTaskStatuses(prev => ({ ...prev, [taskId]: newStatus }))
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_status: newStatus }),
      })
      if (res.ok) {
        await revalidatePathsAndTags(
          ['/reports', '/tasks', '/dashboard'],
          ['reports', 'tasks', 'projects']
        )
        router.refresh()
      } else {
        setOptimisticTaskStatuses(prev => {
          const next = { ...prev }
          delete next[taskId]
          return next
        })
      }
    } catch (error) {
      console.error("Failed to update task status:", error)
      setOptimisticTaskStatuses(prev => {
        const next = { ...prev }
        delete next[taskId]
        return next
      })
    } finally {
      setUpdatingTaskId(null)
    }
  }, [router])

  const [pinnedIds, setPinnedIds] = useState<string[]>([])
  const [columnOrders, setColumnOrders] = useState<Record<string, string[]>>({})

  useEffect(() => {
    const pinned = localStorage.getItem("reports-pinned")
    const order = localStorage.getItem("reports-order")
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

  // Synchronize optimisticTaskStatuses directly during render if the prop has updated
  let hasOptimisticTaskChanges = false
  const updatedOptimisticTaskStatuses = { ...optimisticTaskStatuses }
  for (const [taskId, optStatus] of Object.entries(optimisticTaskStatuses)) {
    const matchingReport = reports.find(r => r.task_id === taskId)
    if (matchingReport && matchingReport.task_status === optStatus) {
      delete updatedOptimisticTaskStatuses[taskId]
      hasOptimisticTaskChanges = true
    }
  }
  if (hasOptimisticTaskChanges) {
    setOptimisticTaskStatuses(updatedOptimisticTaskStatuses)
  }

  const togglePin = useCallback((reportId: string) => {
    setPinnedIds((prev) => {
      const next = prev.includes(reportId)
        ? prev.filter((id) => id !== reportId)
        : [...prev, reportId]
      localStorage.setItem("reports-pinned", JSON.stringify(next))
      return next
    })
  }, [])

  // Kanban columns: NS, OP, H, D (Done)
  const columns = [
    { id: "NS", title: "Not Started Tasks" },
    { id: "OP", title: "On Progress Tasks" },
    { id: "H", title: "On Hold Tasks" },
    { id: "D", title: "Done Tasks" },
  ]

  const activeReports = reports.filter(r => {
    const status = dragOverTaskStatuses[r.task_id] ?? optimisticTaskStatuses[r.task_id] ?? r.task_status ?? "NS"
    return status !== "CC" && status !== "C"
  })
  const cancelledReports = reports.filter(r => {
    const status = dragOverTaskStatuses[r.task_id] ?? optimisticTaskStatuses[r.task_id] ?? r.task_status ?? "NS"
    return status === "CC" || status === "C"
  })

  const getSortedColumnReports = useCallback((colId: string) => {
    const colReports = activeReports.filter((r) => {
      const status = dragOverTaskStatuses[r.task_id] ?? optimisticTaskStatuses[r.task_id] ?? r.task_status ?? "NS"
      return status === colId
    })

    const pinned = colReports.filter((r) => pinnedIds.includes(r.report_id))
    const unpinned = colReports.filter((r) => !pinnedIds.includes(r.report_id))

    const sortOrder = columnOrders[colId] || []
    const sortFn = (a: EnrichedReport, b: EnrichedReport) => {
      const idxA = sortOrder.indexOf(a.report_id)
      const idxB = sortOrder.indexOf(b.report_id)
      if (idxA === -1 && idxB === -1) return 0
      if (idxA === -1) return 1
      if (idxB === -1) return -1
      return idxA - idxB
    }

    pinned.sort(sortFn)
    unpinned.sort(sortFn)

    return [...pinned, ...unpinned]
  }, [activeReports, pinnedIds, columnOrders, optimisticTaskStatuses, dragOverTaskStatuses])

  /* ── Drag handlers ── */

  const handleDragStart = (event: DragStartEvent) => {
    const activeReportId = event.active.id as string
    setActiveId(activeReportId)
    const activeReportObj = activeReports.find(r => r.report_id === activeReportId)
    if (activeReportObj) {
      setDragStartColumn(dragOverTaskStatuses[activeReportObj.task_id] ?? optimisticTaskStatuses[activeReportObj.task_id] ?? activeReportObj.task_status ?? "NS")
    }
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return

    const activeReportId = active.id as string
    const overId = over.id as string

    const activeReportObj = activeReports.find(r => r.report_id === activeReportId)
    if (!activeReportObj) return

    const currentColumn = dragOverTaskStatuses[activeReportObj.task_id] ?? optimisticTaskStatuses[activeReportObj.task_id] ?? activeReportObj.task_status ?? "NS"

    let targetColumn: string | null = null
    let overReportId: string | null = null

    const overReport = activeReports.find(r => r.report_id === overId)
    if (overReport) {
      targetColumn = dragOverTaskStatuses[overReport.task_id] ?? optimisticTaskStatuses[overReport.task_id] ?? overReport.task_status ?? "NS"
      overReportId = overReport.report_id
    } else {
      targetColumn = columns.find(c => c.id === overId)?.id ?? null
    }

    if (!targetColumn || targetColumn === currentColumn) return

    setDragOverTaskStatuses(prev => ({ ...prev, [activeReportObj.task_id]: targetColumn! }))

    // Move in columnOrders
    const sourceOrder = (columnOrders[currentColumn] || getSortedColumnReports(currentColumn).map(r => r.report_id)).filter(id => id !== activeReportId)
    const destOrder = (columnOrders[targetColumn] || getSortedColumnReports(targetColumn).map(r => r.report_id)).filter(id => id !== activeReportId)

    if (overReportId) {
      const idx = destOrder.indexOf(overReportId)
      if (idx !== -1) {
        destOrder.splice(idx, 0, activeReportId)
      } else {
        destOrder.push(activeReportId)
      }
    } else {
      destOrder.push(activeReportId)
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
      setDragOverTaskStatuses({})
      return
    }

    const activeReportId = active.id as string
    const overId = over.id as string

    const activeReportObj = activeReports.find(r => r.report_id === activeReportId)
    if (!activeReportObj) {
      setDragOverTaskStatuses({})
      return
    }

    const originalColumn = dragStartColumn ?? activeReportObj.task_status ?? "NS"
    const finalColumn = dragOverTaskStatuses[activeReportObj.task_id] ?? originalColumn

    // Reset dragOverTaskStatuses
    setDragOverTaskStatuses({})

    if (finalColumn !== originalColumn) {
      handleTaskStatusChange(activeReportObj.task_id, finalColumn)
      localStorage.setItem("reports-order", JSON.stringify(columnOrders))
    } else {
      // Same-column reorder
      const colReports = getSortedColumnReports(finalColumn)
      const colIds = colReports.map(r => r.report_id)

      const overReport = activeReports.find(r => r.report_id === overId)
      const overReportId = overReport ? overReport.report_id : null

      const oldIndex = colIds.indexOf(activeReportId)
      const newIndex = overReportId ? colIds.indexOf(overReportId) : -1

      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        const nextIds = arrayMove(colIds, oldIndex, newIndex)
        const nextOrders = {
          ...columnOrders,
          [finalColumn]: nextIds,
        }
        setColumnOrders(nextOrders)
        localStorage.setItem("reports-order", JSON.stringify(nextOrders))
      }
    }
  }

  const activeReport = activeId ? activeReports.find(r => r.report_id === activeId) : null

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
              Complete &amp; Cancel ({cancelledReports.length})
            </Button>
          )}

          <Link href="/reports/new">
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              New Report
            </Button>
          </Link>
        </div>
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
              const colReports = getSortedColumnReports(col.id)
              return (
                <DroppableColumn key={col.id} column={col} reports={colReports}>
                  {colReports.map((report) => (
                    <SortableReportCard
                      key={report.report_id}
                      report={report}
                      onDelete={setDeleteId}
                      isPinned={pinnedIds.includes(report.report_id)}
                      onTogglePin={togglePin}
                      updatingTaskId={updatingTaskId}
                    />
                  ))}
                </DroppableColumn>
              )
            })}
          </div>

          <DragOverlay>
            {activeReport ? (
              <ReportDragOverlay report={activeReport} />
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        /* Traditional List View */
        reports.length === 0 ? (
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
                        📁 {report.project_name ?? "Unknown"} → {report.task_description}
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
        )
      )}

      {/* Complete & Cancel Reports Folder Dialog */}
      <Dialog open={showArchive} onOpenChange={setShowArchive}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <Archive className="h-5 w-5 text-primary" />
              Complete &amp; Cancel
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {cancelledReports.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">
                No completed or cancelled reports found.
              </p>
            ) : (
              <div className="space-y-3">
                {cancelledReports.map((report) => (
                  <Card key={report.report_id} className="border bg-muted/10">
                    <CardContent className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm">{report.date}</span>
                          <Badge variant="outline" className="text-[10px] py-0">
                            {report.progress_percentage ?? 0}%
                          </Badge>
                          {report.total_hours && (
                            <Badge variant="secondary" className="text-[10px] py-0">
                              {report.total_hours}h
                            </Badge>
                          )}
                          <Badge variant={report.task_status === "C" ? "success" : "destructive"} className="text-[10px] py-0">
                            {report.task_status === "C" ? "Completed Task" : "Cancelled Task"}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">
                          {report.remarks || "No remarks"}
                        </p>
                        {report.task_description && (
                          <p className="text-[10px] text-muted-foreground mt-1 truncate">
                            📁 {report.project_name ?? "Unknown"} → {report.task_description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Link href={`/reports/${report.report_id}`}>
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
