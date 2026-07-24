"use client"

import { useState, useCallback, useMemo, useId, useEffect, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Plus, Search, Filter, Eye, Pencil, Trash2, Kanban, List, Archive, Loader2, GripVertical, Pin, Download } from "lucide-react"
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
import { FilterContainer, FilterSearch, FilterMultiSelect } from "@/components/ui/filter-bar"
import type { Task, Status, Project, TaskTeam, ProjectTeam } from "@/lib/types"
import { useViewDensity } from "@/lib/view-density"
import dynamic from "next/dynamic"
import { revalidatePathsAndTags } from "@/app/actions"
import { statusVariant, statusLabel } from "@/lib/status-helpers"

const SortableTaskCard = dynamic(() => import("@/components/kanban").then(m => m.SortableTaskCard), {
  loading: () => <div className="h-24 bg-muted/20 animate-pulse rounded-xl" />
})
const TaskDragOverlay = dynamic(() => import("@/components/kanban").then(m => m.TaskDragOverlay))
const DroppableColumn = dynamic(() => import("@/components/kanban").then(m => m.DroppableColumn), {
  loading: () => <div className="flex-1 min-h-[500px] bg-muted/10 animate-pulse rounded-2xl" />
})



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
  taskTeams = [],
  projectTeams = [],
  currentUserId = "",
  currentDept = "",
  currentSite = "",
  currentDiv = "",
  currentTeam = "",
  currentPage = 1,
  totalPages = 1,
}: {
  tasks: Task[]
  statuses: Status[]
  projects: Project[]
  users?: any[]
  projectMap: Record<string, string | null>
  taskHoursMap: Record<string, number>
  currentProjectId?: string
  currentStatus?: string
  currentSearch?: string
  currentCreatedBy?: string
  currentMemberId?: string
  viewMode: "my" | "team"
  taskTeams?: TaskTeam[]
  projectTeams?: ProjectTeam[]
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
  const [statusFilter, setStatusFilter] = useState<string[]>(currentStatus ? currentStatus.split(',') : [])
  const [projectFilter, setProjectFilter] = useState<string[]>(currentProjectId ? currentProjectId.split(',') : [])
  const [createdByFilter, setCreatedByFilter] = useState<string[]>(currentCreatedBy ? currentCreatedBy.split(',') : [])
  const [memberFilter, setMemberFilter] = useState<string[]>(currentMemberId ? currentMemberId.split(',') : [])

  const [dept, setDept] = useState<string[]>(currentDept ? currentDept.split(',') : (defaultDept ? [defaultDept] : []))
  const [site, setSite] = useState<string[]>(currentSite ? currentSite.split(',') : (defaultSite ? [defaultSite] : []))
  const [division, setDivision] = useState<string[]>(currentDiv ? currentDiv.split(',') : (defaultDiv ? [defaultDiv] : []))
  const [team, setTeam] = useState<string[]>(currentTeam ? currentTeam.split(',') : (defaultTeam ? [defaultTeam] : []))

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

  // Realtime Websocket Supabase
  useEffect(() => {
    const { supabase } = require("@/lib/supabase-client")
    const channel = supabase
      .channel('realtime-tasks')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
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
    if (statusFilter.length > 0) params.set("status", statusFilter.join(","))
    if (projectFilter.length > 0) params.set("project_id", projectFilter.join(","))
    if (viewMode === "team") {
      if (createdByFilter.length > 0) params.set("created_by", createdByFilter.join(","))
      if (memberFilter.length > 0) params.set("member_id", memberFilter.join(","))
      if (dept.length > 0) params.set("dept_filter", dept.join(","))
      if (site.length > 0) params.set("site_filter", site.join(","))
      if (division.length > 0) params.set("div_filter", division.join(","))
      if (team.length > 0) params.set("team_filter", team.join(","))
    }
    const query = params.toString()
    router.push(`/tasks${query ? "?" + query : ""}`)
  }, [debouncedSearch, statusFilter, projectFilter, createdByFilter, memberFilter, viewMode, router, dept, site, division, team])

  const handleDelete = async () => {
    if (!deleteId) return
    const idToDelete = deleteId
    setDeleteId(null)
    setLocalTasks(prev => prev.filter(t => t.id !== idToDelete))

    await fetch(`/api/tasks/${idToDelete}`, { method: "DELETE" })
    await revalidatePathsAndTags(
      ['/tasks', '/reports/dashboard'],
      ['tasks', 'projects']
    )
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
          ['/tasks', '/reports/dashboard'],
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

  const { uniqueDepts, uniqueSites, uniqueDivs, uniqueTeams } = useMemo(() => {
    return {
      uniqueDepts: Array.from(new Set(users.map((u) => u.user_departement).filter(Boolean))) as string[],
      uniqueSites: Array.from(new Set(users.map((u) => u.user_site).filter(Boolean))) as string[],
      uniqueDivs: Array.from(new Set(users.map((u) => u.user_division).filter(Boolean))) as string[],
      uniqueTeams: Array.from(new Set(users.map((u) => u.user_team).filter(Boolean))) as string[],
    }
  }, [users])

  // Only show users who have actually created a task
  const uniqueCreators = useMemo(() => {
    const creatorIds = new Set(tasks.map((t) => t.created_by).filter(Boolean))
    return users.filter((u) => creatorIds.has(u.user_id))
  }, [tasks, users])

  // Only show users who are actually a team member on some task
  const uniqueMembers = useMemo(() => {
    const memberIds = new Set(taskTeams.map((tt) => tt.user_id).filter(Boolean))
    return users.filter((u) => memberIds.has(u.user_id))
  }, [taskTeams, users])

  const activeTask = activeId ? activeTasks.find(t => t.id === activeId) : null

  const [exporting, setExporting] = useState(false)

  const handleExportCSV = async () => {
    try {
      setExporting(true)
      const res = await fetch("/api/export/tasks")
      const result = await res.json()
      if (!res.ok || !result.data) throw new Error(result.error || "Export failed")

      const { generateCSV, downloadCSV, formatStatus, formatDate, formatDateTime, todayString } = await import("@/lib/utils/csv-export")

      const headers = [
        "Task ID",
        "Project Name",
        "Task Description",
        "Status",
        "Progress (%)",
        "Hours Logged",
        "Assigned To",
        "Latest Reporter",
        "Latest Report Date",
        "Latest Remarks",
        "Created By",
        "Created At",
      ]

      const rows = result.data.map((t: any) => [
        t.task_id,
        t.project_name || "",
        t.task_description || "",
        formatStatus(t.task_status),
        t.task_latest_percentage || "0",
        t.total_hours || "0",
        t.assigned_to || "",
        t.latest_reporter || "",
        formatDate(t.latest_report_date),
        t.latest_remarks || "",
        t.creator_name || "",
        formatDateTime(t.created_at),
      ])

      const csvString = generateCSV(headers, rows)
      downloadCSV(csvString, `tasks_report_${todayString()}.csv`)
    } catch (e: any) {
      console.error("Export error:", e)
      alert(e.message || "Failed to export tasks CSV")
    } finally {
      setExporting(false)
    }
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
        <div className="flex items-center gap-2">
          {/* Export CSV Button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 px-2 sm:px-3 text-xs gap-1.5"
            onClick={handleExportCSV}
            disabled={exporting}
          >
            {exporting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            )}
            <span className="hidden sm:inline">{exporting ? "Exporting..." : "Export CSV"}</span>
          </Button>

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
              <span>({cancelledTasks.length})</span>
            </Button>
          )}

          <Link href="/tasks/new">
            <Button size="sm" className="h-8 px-2 sm:px-4 sm:h-9">
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">New Task</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <FilterContainer>
        <FilterSearch
          placeholder="Search tasks..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none max-w-full">
            <FilterMultiSelect
              placeholder="All projects"
              icon={<Filter className="h-3.5 w-3.5" />}
              options={projects.map((p) => ({ label: p.project_name || "Unnamed Project", value: p.project_id }))}
              selectedValues={projectFilter}
              onSelectedValuesChange={setProjectFilter}
              className="w-[150px] sm:w-[180px]"
            />
            {layout === "list" && (
              <FilterMultiSelect
                placeholder="All statuses"
                icon={<Filter className="h-3.5 w-3.5" />}
                options={statuses.map((s) => ({ label: s.name, value: s.id }))}
                selectedValues={statusFilter}
                onSelectedValuesChange={setStatusFilter}
                className="w-[140px] sm:w-[160px]"
              />
            )}
            {viewMode === "team" && (
              <>
                <FilterMultiSelect
                  placeholder="Created by"
                  icon={<Filter className="h-3.5 w-3.5" />}
                  options={uniqueCreators.map((u) => ({ label: u.user_name || u.user_email, value: u.user_id }))}
                  selectedValues={createdByFilter}
                  onSelectedValuesChange={setCreatedByFilter}
                  className="w-[150px] sm:w-[180px]"
                />

                <FilterMultiSelect
                  placeholder="Task team"
                  icon={<Filter className="h-3.5 w-3.5" />}
                  options={uniqueMembers.map((u) => ({ label: u.user_name || u.user_email, value: u.user_id }))}
                  selectedValues={memberFilter}
                  onSelectedValuesChange={setMemberFilter}
                  className="w-[150px] sm:w-[180px]"
                />

                {!isDeptDisabled && (
                  <FilterMultiSelect
                    placeholder="Department"
                    icon={<Filter className="h-3.5 w-3.5" />}
                    options={uniqueDepts.map((d) => ({ label: d, value: d }))}
                    selectedValues={dept}
                    onSelectedValuesChange={setDept}
                    className="w-[150px] sm:w-[180px]"
                  />
                )}

                {!isSiteDisabled && (
                  <FilterMultiSelect
                    placeholder="Site"
                    icon={<Filter className="h-3.5 w-3.5" />}
                    options={uniqueSites.map((s) => ({ label: s, value: s }))}
                    selectedValues={site}
                    onSelectedValuesChange={setSite}
                    className="w-[150px] sm:w-[180px]"
                  />
                )}

                {!isDivDisabled && (
                  <FilterMultiSelect
                    placeholder="Division"
                    icon={<Filter className="h-3.5 w-3.5" />}
                    options={uniqueDivs.map((d) => ({ label: d, value: d }))}
                    selectedValues={division}
                    onSelectedValuesChange={setDivision}
                    className="w-[150px] sm:w-[180px]"
                  />
                )}

                {!isTeamDisabled && (
                  <FilterMultiSelect
                    placeholder="Team"
                    icon={<Filter className="h-3.5 w-3.5" />}
                    options={uniqueTeams.map((t) => ({ label: t, value: t }))}
                    selectedValues={team}
                    onSelectedValuesChange={setTeam}
                    className="w-[150px] sm:w-[180px]"
                  />
                )}
              </>
            )}
          </div>
      </FilterContainer>

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
          <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-4 md:grid md:grid-cols-2 lg:grid-cols-4 md:overflow-visible -mx-4 px-4 md:mx-0 md:px-0">
            {columns.map((col) => {
              const colTasks = getSortedColumnTasks(col.id)
              return (
                <div key={col.id} className="w-[85vw] max-w-[340px] shrink-0 snap-center md:w-auto md:max-w-none">
                <DroppableColumn column={col} tasks={colTasks}>
                  {colTasks.map((task) => {
                    const isMember = taskTeams.some(tt => tt.task_id === task.id && tt.user_id === currentUserId) ||
                      projectTeams.some(pt => pt.project_id === task.project_id && pt.user_id === currentUserId) ||
                      task.created_by === currentUserId ||
                      projects.find(p => p.project_id === task.project_id)?.created_by === currentUserId ||
                      isSuperUser
                    return (
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
                        isTaskTeamMember={isMember}
                        density={density}
                      />
                    )
                  })}
                </DroppableColumn>
                </div>
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
          density === "compact" ? (
            <div className="flex flex-col border rounded-xl divide-y divide-border/55 bg-card overflow-hidden">
              {localTasks.map((task) => {
                const isMember = taskTeams.some(tt => tt.task_id === task.id && tt.user_id === currentUserId) ||
                  projectTeams.some(pt => pt.project_id === task.project_id && pt.user_id === currentUserId) ||
                  task.created_by === currentUserId ||
                  projects.find(p => p.project_id === task.project_id)?.created_by === currentUserId ||
                  isSuperUser
                return (
                  <div key={task.id} onClick={() => router.push(`/tasks/${task.id}`)} className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 gap-2.5 hover:bg-muted/30 transition-colors cursor-pointer">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <Badge variant="outline" className="shrink-0 text-[10px] font-mono py-0 px-1 bg-muted">
                        {task.id.substring(0, 6)}
                      </Badge>
                      <div className="min-w-0 flex-1">
                        <span className="font-medium text-xs hover:text-primary leading-none block truncate">
                          {task.task_description}
                        </span>
                        <p className="text-[10px] text-muted-foreground mt-0.5 max-w-xl truncate">
                          📁 {projectMap[task.project_id] ?? task.project_id}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-2 shrink-0 text-xs" onClick={(e) => e.stopPropagation()}>
                      <Badge
                        variant={statusVariant[task.task_status ?? "NS"] ?? "default"}
                        className="text-[9px] py-0 px-1.5 shrink-0"
                      >
                        {statusLabel[task.task_status ?? "NS"] ?? task.task_status ?? "NS"}
                      </Badge>

                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground min-w-[100px] justify-end">
                        <span className="shrink-0">{task.task_latest_percentage ?? 0}% done</span>
                        {(taskHoursMap[task.id] ?? 0) > 0 && (
                          <span className="shrink-0 font-medium text-foreground">{taskHoursMap[task.id]}h</span>
                        )}
                      </div>

                      <div className="flex items-center gap-0.5">
                        {isMember && (
                          <>
                            <Link href={`/tasks/${task.id}/edit`}>
                              <Button variant="ghost" size="icon-sm" className="h-6 w-6">
                                <Pencil className="h-3 w-3" />
                              </Button>
                            </Link>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="text-destructive hover:text-destructive h-6 w-6"
                              onClick={() => setDeleteId(task.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="space-y-3">
              {localTasks.map((task) => {
                const isMember = taskTeams.some(tt => tt.task_id === task.id && tt.user_id === currentUserId) ||
                  projectTeams.some(pt => pt.project_id === task.project_id && pt.user_id === currentUserId) ||
                  task.created_by === currentUserId ||
                  projects.find(p => p.project_id === task.project_id)?.created_by === currentUserId ||
                  isSuperUser
                return (
                  <Card key={task.id} onClick={() => router.push(`/tasks/${task.id}`)} className="transition-shadow hover:shadow-md cursor-pointer hover:bg-muted/50">
                    <CardContent className="flex items-center justify-between p-4">
                      <div className="min-w-0 flex-1">
                        <span className="font-medium hover:text-primary">
                          <p className="truncate">{task.task_description}</p>
                        </span>
                        <p className="text-xs text-muted-foreground">
                          {projectMap[task.project_id] ?? task.project_id} •{" "}
                          {task.task_latest_percentage ?? 0}% complete
                          {(taskHoursMap[task.id] ?? 0) > 0 && (
                            <> • <span className="font-medium">{taskHoursMap[task.id]}h</span></>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <Badge
                          variant={statusVariant[task.task_status ?? "NS"] ?? "default"}
                          className="shrink-0"
                        >
                          {statusLabel[task.task_status ?? "NS"] ?? task.task_status ?? "NS"}
                        </Badge>
                        {isMember && (
                          <>
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
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )
        )
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between py-6 mt-6 border-t px-2">
          <p className="text-sm text-muted-foreground">
            Showing page {currentPage} of {totalPages} ({tasks.length} items)
          </p>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              disabled={currentPage <= 1}
              onClick={() => {
                const params = new URLSearchParams(window.location.search)
                params.set("page", (currentPage - 1).toString())
                router.push(`?${params.toString()}`)
              }}
            >
              Previous
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              disabled={currentPage >= totalPages}
              onClick={() => {
                const params = new URLSearchParams(window.location.search)
                params.set("page", (currentPage + 1).toString())
                router.push(`?${params.toString()}`)
              }}
            >
              Next
            </Button>
          </div>
        </div>
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
                  <Card 
                    key={task.id} 
                    onClick={() => router.push(`/tasks/${task.id}`)}
                    className="group hover:shadow-md transition-shadow relative overflow-hidden cursor-pointer hover:bg-muted/50 border bg-muted/10"
                  >
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
                          disabled={
                            !(taskTeams.some(tt => tt.task_id === task.id && tt.user_id === currentUserId) ||
                              projectTeams.some(pt => pt.project_id === task.project_id && pt.user_id === currentUserId) ||
                              task.created_by === currentUserId ||
                              projects.find(p => p.project_id === task.project_id)?.created_by === currentUserId ||
                              isSuperUser)
                          }
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
