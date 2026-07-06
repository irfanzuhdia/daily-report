"use client"

import { useState, useCallback, useMemo, useId, useEffect, useRef } from "react"
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
import { useViewDensity } from "@/lib/view-density"

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
  created_by_name?: string
}

/* ─────────────────────── Sortable Report Card ─────────────────────── */

function SortableReportCard({
  report,
  onDelete,
  isPinned,
  onTogglePin,
  updatingTaskId,
  currentUserId,
  density,
}: {
  report: EnrichedReport
  onDelete: (id: string) => void
  isPinned: boolean
  onTogglePin: (id: string) => void
  updatingTaskId: string | null
  currentUserId?: string
  density?: "comfortable" | "compact"
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

  const isCompact = density === "compact"

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <Card className={`shadow-sm hover:shadow-md transition-shadow relative overflow-hidden ${isDragging ? "ring-2 ring-primary" : ""}`}>
        {updatingTaskId === report.task_id && (
          <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        )}
        <CardContent className={isCompact ? "p-3 space-y-2" : "p-4 space-y-3"}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                {...listeners}
                className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground shrink-0 touch-none"
                tabIndex={-1}
              >
                <GripVertical className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className="text-[9px] py-0 px-1">
                  {report.progress_percentage ?? 0}%
                </Badge>
                {report.total_hours && (
                  <Badge variant="secondary" className="text-[9px] py-0 px-1">
                    {report.total_hours}h
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
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

          <div className={isCompact ? "space-y-1" : "space-y-1.5"}>
            <h4 className={`font-semibold text-foreground leading-snug whitespace-pre-wrap ${isCompact ? "text-xs" : "text-sm"}`}>
              {report.remarks || "No remarks"}
            </h4>
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <span>{report.date}</span>
              {report.created_by_name && (
                <>
                  <span>·</span>
                  <span>{report.created_by_name}</span>
                </>
              )}
            </div>
            {report.task_description && (
              <p className="text-[10px] text-muted-foreground truncate pt-0.5">
                📁 {report.project_name ?? "Unknown"} → {report.task_description}
              </p>
            )}
          </div>

          <div className={`flex items-center justify-end border-t border-muted/50 ${isCompact ? "pt-1.5" : "pt-2"}`}>
            <div className="flex items-center gap-1">
              <Link href={`/reports/${report.report_id}`}>
                <Button variant="ghost" size="icon-sm" className={isCompact ? "h-6 w-6" : "h-7 w-7"}>
                  <Eye className="h-3 w-3" />
                </Button>
              </Link>
              {(report.user_id === currentUserId || report.created_by === currentUserId) && (
                <>
                  <Link href={`/reports/${report.report_id}/edit`}>
                    <Button variant="ghost" size="icon-sm" className={isCompact ? "h-6 w-6" : "h-7 w-7"}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className={isCompact ? "h-6 w-6" : "h-7 w-7"}
                    onClick={() => onDelete(report.report_id)}
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </>
              )}
            </div>
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
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className="text-[10px] py-0 px-1.5">
              {report.progress_percentage ?? 0}%
            </Badge>
          </div>
        </div>
        <div className="space-y-1.5">
          <h4 className="font-semibold text-sm whitespace-pre-wrap leading-snug">
            {report.remarks || "No remarks"}
          </h4>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span>{report.date}</span>
            {report.created_by_name && (
              <>
                <span className="mx-1">·</span>
                <span>{report.created_by_name}</span>
              </>
            )}
          </div>
          {report.task_description && (
            <p className="text-[10px] text-muted-foreground truncate pt-0.5">
              📁 {report.project_name ?? "Unknown"} → {report.task_description}
            </p>
          )}
        </div>
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
  users = [],
  currentTaskId,
  currentSearch,
  currentCreatedBy,
  viewMode,
  currentUserId,
  currentDept = "",
  currentSite = "",
  currentDiv = "",
  currentTeam = "",
  currentPage = 1,
  totalPages = 1,
}: {
  reports: EnrichedReport[]
  tasks: Task[]
  users?: any[]
  currentTaskId?: string
  currentSearch?: string
  currentCreatedBy?: string
  viewMode: "my" | "team"
  currentUserId?: string
  currentDept?: string
  currentSite?: string
  currentDiv?: string
  currentTeam?: string
  currentPage?: number
  totalPages?: number
}) {
  const { density } = useViewDensity()
  const currentUser = useMemo(() => (users || []).find(u => u.user_id === currentUserId), [users, currentUserId])
  const isSuperUser = currentUser?.user_occupation?.toLowerCase() === 'super user'
  const userLevel = currentUser?.level || 1

  const isDeptDisabled = userLevel < 6
  const isSiteDisabled = userLevel < 5
  const isDivDisabled = userLevel < 3
  const isTeamDisabled = userLevel < 2

  const defaultDept = isDeptDisabled ? (currentUser?.user_departement || "") : ""
  const defaultSite = isSiteDisabled ? (currentUser?.user_site || "") : ""
  const defaultDiv = isDivDisabled ? (currentUser?.user_division || "") : ""
  const defaultTeam = isTeamDisabled ? (currentUser?.user_team || "") : ""

  const router = useRouter()
  const [search, setSearch] = useState(currentSearch ?? "")
  const [taskFilter, setTaskFilter] = useState(currentTaskId ?? "")
  const [createdByFilter, setCreatedByFilter] = useState(currentCreatedBy ?? "")

  const [dept, setDept] = useState(currentDept || defaultDept)
  const [site, setSite] = useState(currentSite || defaultSite)
  const [division, setDivision] = useState(currentDiv || defaultDiv)
  const [team, setTeam] = useState(currentTeam || defaultTeam)

  const [deleteId, setDeleteId] = useState<string | null>(null)
  
  const [layout, setLayout] = useState<"kanban" | "list">("list")
  const [showArchive, setShowArchive] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null)
  const [optimisticTaskStatuses, setOptimisticTaskStatuses] = useState<Record<string, string>>({})
  const [dragOverTaskStatuses, setDragOverTaskStatuses] = useState<Record<string, string>>({})
  const [dragStartColumn, setDragStartColumn] = useState<string | null>(null)

  const [localReports, setLocalReports] = useState(reports)
  const [prevReports, setPrevReports] = useState(reports)
  if (reports !== prevReports) {
    setPrevReports(reports)
    setLocalReports(reports.map(r => {
      const optStatus = optimisticTaskStatuses[r.task_id]
      if (optStatus) {
        return { ...r, task_status: optStatus }
      }
      return r
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

  // Realtime Websocket Supabase
  useEffect(() => {
    const { supabase } = require("@/lib/supabase-client")
    const channel = supabase
      .channel('realtime-reports')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'daily_reports' },
        () => {
          router.refresh()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [router])

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false
      return
    }
    const params = new URLSearchParams()
    if (debouncedSearch) params.set("search", debouncedSearch)
    if (taskFilter) params.set("task_id", taskFilter)
    if (viewMode === "team") {
      if (createdByFilter) params.set("created_by", createdByFilter)
      if (dept) params.set("dept_filter", dept)
      if (site) params.set("site_filter", site)
      if (division) params.set("div_filter", division)
      if (team) params.set("team_filter", team)
    }
    const query = params.toString()
    router.push(`/reports${query ? "?" + query : ""}`)
  }, [debouncedSearch, taskFilter, createdByFilter, viewMode, router, dept, site, division, team])

  const handleDelete = async () => {
    if (!deleteId) return
    const idToDelete = deleteId
    setDeleteId(null)
    setLocalReports(prev => prev.filter(r => r.report_id !== idToDelete))
    
    await fetch(`/api/reports/${idToDelete}`, { method: "DELETE" })
    await revalidatePathsAndTags(
      ['/reports', '/reports/dashboard'],
      ['reports', 'tasks', 'projects']
    )
    router.refresh()
  }

  const handleTaskStatusChange = useCallback(async (taskId: string, newStatus: string) => {
    setUpdatingTaskId(taskId)
    const existingStatus = localReports.find(r => r.task_id === taskId)?.task_status ?? "NS"
    setLocalReports(prev => prev.map(r => r.task_id === taskId ? { ...r, task_status: newStatus } : r))
    setOptimisticTaskStatuses(prev => ({ ...prev, [taskId]: newStatus }))
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_status: newStatus }),
      })
      if (res.ok) {
        await revalidatePathsAndTags(
          ['/reports', '/tasks', '/reports/dashboard'],
          ['reports', 'tasks', 'projects']
        )
        router.refresh()
      } else {
        setLocalReports(prev => prev.map(r => r.task_id === taskId ? { ...r, task_status: existingStatus } : r))
        setOptimisticTaskStatuses(prev => {
          const next = { ...prev }
          delete next[taskId]
          return next
        })
      }
    } catch (error) {
      console.error("Failed to update task status:", error)
      setLocalReports(prev => prev.map(r => r.task_id === taskId ? { ...r, task_status: existingStatus } : r))
      setOptimisticTaskStatuses(prev => {
        const next = { ...prev }
        delete next[taskId]
        return next
      })
    } finally {
      setUpdatingTaskId(null)
    }
  }, [localReports, router])

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

  const activeReports = localReports.filter(r => {
    const status = dragOverTaskStatuses[r.task_id] ?? optimisticTaskStatuses[r.task_id] ?? r.task_status ?? "NS"
    return status !== "CC" && status !== "C"
  })
  const cancelledReports = localReports.filter(r => {
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
    let finalColumn = dragOverTaskStatuses[activeReportObj.task_id] ?? originalColumn

    // Fallback in case dragOverTaskStatuses is missing/stale on fast drag end
    if (finalColumn === originalColumn) {
      const targetCol = columns.find(c => c.id === overId)
      if (targetCol) {
        finalColumn = targetCol.id
      } else {
        const overReport = activeReports.find(r => r.report_id === overId)
        if (overReport) {
          finalColumn = dragOverTaskStatuses[overReport.task_id] ?? optimisticTaskStatuses[overReport.task_id] ?? overReport.task_status ?? "NS"
        }
      }
    }

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

  const uniqueDepts = Array.from(new Set(users.map((u) => u.user_departement).filter(Boolean))) as string[]
  const uniqueSites = Array.from(new Set(users.map((u) => u.user_site).filter(Boolean))) as string[]
  const uniqueDivs = Array.from(new Set(users.map((u) => u.user_division).filter(Boolean))) as string[]
  const uniqueTeams = Array.from(new Set(users.map((u) => u.user_team).filter(Boolean))) as string[]

  // Only show users who have actually created a report
  const reporterIds = new Set(reports.map((r) => r.created_by || r.user_id).filter(Boolean))
  const uniqueReporters = users.filter((u) => reporterIds.has(u.user_id))

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
          <div className="flex rounded-xl border p-1 bg-muted/20 mr-1 sm:mr-2">
            <Button
              type="button"
              variant={layout === "kanban" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 px-2 sm:px-3 rounded-lg text-xs"
              onClick={() => setLayout("kanban")}
            >
              <Kanban className="h-3.5 w-3.5 sm:mr-1.5" />
              <span className="hidden sm:inline">Kanban</span>
            </Button>
            <Button
              type="button"
              variant={layout === "list" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 px-2 sm:px-3 rounded-lg text-xs"
              onClick={() => setLayout("list")}
            >
              <List className="h-3.5 w-3.5 sm:mr-1.5" />
              <span className="hidden sm:inline">List</span>
            </Button>
          </div>

          {/* Complete & Cancel Folder Button */}
          {layout === "kanban" && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 px-2 sm:px-3 text-xs border-dashed"
              onClick={() => setShowArchive(true)}
            >
              <Archive className="h-3.5 w-3.5 text-primary sm:mr-1.5" />
              <span className="hidden sm:inline">Complete &amp; Cancel </span>
              <span>({cancelledReports.length})</span>
            </Button>
          )}

          <Link href="/reports/new">
            <Button size="sm" className="h-8 px-2 sm:px-4 sm:h-9">
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">New Report</span>
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
                placeholder="Search reports..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
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
            {viewMode === "team" && (
              <>
                <Select value={createdByFilter} onValueChange={setCreatedByFilter}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <Filter className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="Created by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All reporters</SelectItem>
                    {uniqueReporters.map((u) => (
                      <SelectItem key={u.user_id} value={u.user_id}>
                        {u.user_name || u.user_email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={dept} onValueChange={setDept} disabled={isDeptDisabled}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <Filter className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="Department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Departments</SelectItem>
                    {uniqueDepts.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={site} onValueChange={setSite} disabled={isSiteDisabled}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <Filter className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="Site" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Sites</SelectItem>
                    {uniqueSites.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={division} onValueChange={setDivision} disabled={isDivDisabled}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <Filter className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="Division" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Divisions</SelectItem>
                    {uniqueDivs.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={team} onValueChange={setTeam} disabled={isTeamDisabled}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <Filter className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="Team" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Teams</SelectItem>
                    {uniqueTeams.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
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
                      currentUserId={currentUserId}
                      density={density}
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
        localReports.length === 0 ? (
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
            {localReports.map((report) => (
              <Card key={report.report_id} className="transition-shadow hover:shadow-md">
                <CardContent className={`flex items-center justify-between gap-3 ${density === "compact" ? "p-2.5" : "p-4"}`}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Badge variant="outline" className="text-[9px] py-0 px-1">
                        {report.progress_percentage ?? 0}%
                      </Badge>
                      {report.total_hours && (
                        <Badge variant="secondary" className="text-[9px] py-0 px-1">
                          {report.total_hours}h
                        </Badge>
                      )}
                      <span className="text-[10px] text-muted-foreground">{report.date}</span>
                      {report.created_by_name && (
                        <span className="text-[10px] text-muted-foreground">· {report.created_by_name}</span>
                      )}
                    </div>
                    <h4 className={`font-semibold text-foreground leading-snug truncate ${density === "compact" ? "text-xs" : "text-sm"}`}>
                      {report.remarks || "No remarks"}
                    </h4>
                    {report.task_description && (
                      <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                        📁 {report.project_name ?? "Unknown"} → {report.task_description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <Link href={`/reports/${report.report_id}`}>
                      <Button variant="ghost" size="icon-sm" className="h-6 w-6">
                        <Eye className="h-3 w-3" />
                      </Button>
                    </Link>
                    {(report.user_id === currentUserId || report.created_by === currentUserId) && (
                      <>
                        <Link href={`/reports/${report.report_id}/edit`}>
                          <Button variant="ghost" size="icon-sm" className="h-6 w-6">
                            <Pencil className="h-3 w-3" />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="h-6 w-6 text-destructive hover:text-destructive"
                          onClick={() => setDeleteId(report.report_id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      )}

      {/* Pagination Controls */}
      {layout !== "kanban" && totalPages > 1 && (
        <div className="flex items-center justify-center py-6 mt-4 gap-2 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const url = new URL(window.location.href)
              url.searchParams.set("page", String(Math.max(1, currentPage - 1)))
              router.push(url.pathname + url.search)
            }}
            disabled={currentPage <= 1}
          >
            Previous
          </Button>
          <div className="text-sm text-muted-foreground px-4">
            Page <span className="font-medium text-foreground">{currentPage}</span> of {totalPages}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const url = new URL(window.location.href)
              url.searchParams.set("page", String(Math.min(totalPages, currentPage + 1)))
              router.push(url.pathname + url.search)
            }}
            disabled={currentPage >= totalPages}
          >
            Next
          </Button>
        </div>
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
                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
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
                        <h4 className="text-sm font-semibold text-foreground line-clamp-2 leading-snug">
                          {report.remarks || "No remarks"}
                        </h4>
                        <div className="flex items-center gap-1.5 mt-1 text-[10px] text-muted-foreground">
                          <span>{report.date}</span>
                          {report.created_by_name && (
                            <>
                              <span>·</span>
                              <span>{report.created_by_name}</span>
                            </>
                          )}
                        </div>
                        {report.task_description && (
                          <p className="text-[10px] text-muted-foreground mt-1 truncate pt-0.5">
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
