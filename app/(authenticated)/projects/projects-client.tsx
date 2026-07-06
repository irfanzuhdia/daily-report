"use client"

import { useState, useCallback, useMemo, useId, useEffect, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Plus, Search, Filter, Eye, Pencil, Trash2, Kanban, List, Archive, Loader2, GripVertical, Pin, LifeBuoy } from "lucide-react"
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
import type { Project, Status, ProjectTeam } from "@/lib/types"
import { useViewDensity } from "@/lib/view-density"
import { revalidatePathsAndTags } from "@/app/actions"

import { statusVariant, statusLabel } from "@/lib/status-helpers"

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
  isProjectTeamMember,
  density,
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
  isProjectTeamMember: boolean
  density: "comfortable" | "compact"
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

  const isCompact = density === "compact"

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <Card className={`shadow-sm hover:shadow-md transition-shadow relative overflow-hidden ${isDragging ? "ring-2 ring-primary" : ""}`}>
        {updatingId === project.project_id && (
          <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        )}
        <CardContent className={isCompact ? "p-3 space-y-2" : "p-4 space-y-3"}>
          <div className="flex items-start gap-2">
            {isProjectTeamMember && (
              <button
                {...listeners}
                className="mt-0.5 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground shrink-0 touch-none"
                tabIndex={-1}
              >
                <GripVertical className="h-4 w-4" />
              </button>
            )}
            <div className="space-y-1 min-w-0 flex-1">
              <Link href={`/projects/${project.project_id}`} className="font-medium text-sm hover:text-primary leading-snug whitespace-pre-wrap">
                {project.project_name}
              </Link>
              {!isCompact && project.project_description && (
                <p className="text-[11px] text-muted-foreground whitespace-pre-wrap">
                  {project.project_description}
                </p>
              )}
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
          {!isCompact && (project.project_start_date_plan || project.project_end_date_plan) && (
            <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
              {project.project_start_date_plan && <span>📅 Start: {project.project_start_date_plan}</span>}
              {project.project_end_date_plan && <span>🏁 End: {project.project_end_date_plan}</span>}
            </div>
          )}

          {/* Metrics */}
          <div className={`flex items-center justify-between text-xs text-muted-foreground pt-1 border-t ${isCompact ? "border-t-muted/30" : ""}`}>
            <div className="flex flex-wrap gap-1">
              {project.category && (
                <Badge variant="outline" className="text-[9px] py-0 px-1.5 bg-primary/5 text-primary border-primary/10">
                  {project.category}
                </Badge>
              )}
              {project.ticket_reference && (
                <Link href={`/ticketing?ticketId=${project.ticket_reference}`} onClick={(e) => e.stopPropagation()}>
                  <Badge variant="outline" className="text-[9px] py-0 px-1.5 border-primary/20 bg-primary/5 hover:bg-primary/10 text-primary cursor-pointer transition-all gap-0.5 inline-flex items-center font-medium">
                    <LifeBuoy className="h-2.5 w-2.5 shrink-0" />
                    <span>Ref: {project.ticket_reference}</span>
                  </Badge>
                </Link>
              )}
            </div>
            <div className="flex gap-1">
              {(projectProgressMap[project.project_id] ?? 0) > 0 && (
                <Badge variant="outline" className="text-[9px] py-0">
                  {projectProgressMap[project.project_id]}% done
                </Badge>
              )}
              {(projectHoursMap[project.project_id] ?? 0) > 0 && (
                <Badge variant="secondary" className="text-[9px] py-0">
                  {projectHoursMap[project.project_id]}h logged
                </Badge>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between gap-1 pt-1">
            {/* Fast status switcher */}
            <Select
              value={project.project_status || "NS"}
              onValueChange={(val) => onStatusChange(project.project_id, val)}
              disabled={!isProjectTeamMember}
            >
              <SelectTrigger className={`text-[10px] px-2 py-0 ${isCompact ? "h-6 w-[95px]" : "h-7 w-[110px]"}`}>
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
                <Button variant="ghost" size="icon-sm" className={isCompact ? "h-6 w-6" : "h-7 w-7"}>
                  <Eye className="h-3 w-3" />
                </Button>
              </Link>
              {isProjectTeamMember && (
                <>
                  <Link href={`/projects/${project.project_id}/edit`}>
                    <Button variant="ghost" size="icon-sm" className={isCompact ? "h-6 w-6" : "h-7 w-7"}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className={`text-destructive hover:text-destructive ${isCompact ? "h-6 w-6" : "h-7 w-7"}`}
                    onClick={() => onDelete(project.project_id)}
                  >
                    <Trash2 className="h-3 w-3" />
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
        <p className="font-medium text-sm whitespace-pre-wrap">{project.project_name}</p>
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

/* ─────────────────────── Folder Icon (Fallback) ─────────────────────── */
function FolderIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      {...props}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-19.5 0A2.25 2.25 0 004.5 15h15a2.25 2.25 0 002.25-2.25m-19.5 0v.25A2.25 2.25 0 004.5 15.25h15a2.25 2.25 0 002.25-2.25v-.25"
      />
    </svg>
  )
}

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
  projectTeams = [],
  currentUserId = "",
  currentDept = "",
  currentSite = "",
  currentDiv = "",
  currentTeam = "",
  currentPage = 1,
  totalPages = 1,
}: {
  projects: Project[]
  statuses: Status[]
  users?: any[]
  projectHoursMap: Record<string, number>
  projectProgressMap: Record<string, number>
  currentStatus?: string
  currentSearch?: string
  currentCreatedBy?: string
  currentMemberId?: string
  viewMode: "my" | "team"
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
  const currentUser = useMemo(() => users.find(u => u.user_id === currentUserId), [users, currentUserId])
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
  const [statusFilter, setStatusFilter] = useState(currentStatus ?? "")
  const [createdByFilter, setCreatedByFilter] = useState(currentCreatedBy ?? "")
  const [memberFilter, setMemberFilter] = useState(currentMemberId ?? "")

  const [dept, setDept] = useState(currentDept || defaultDept)
  const [site, setSite] = useState(currentSite || defaultSite)
  const [division, setDivision] = useState(currentDiv || defaultDiv)
  const [team, setTeam] = useState(currentTeam || defaultTeam)

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

  // Realtime Websocket Supabase
  useEffect(() => {
    const { supabase } = require("@/lib/supabase-client")
    const channel = supabase
      .channel('realtime-projects')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'projects' },
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
    if (statusFilter) params.set("status", statusFilter)
    if (viewMode === "team") {
      if (createdByFilter) params.set("created_by", createdByFilter)
      if (memberFilter) params.set("member_id", memberFilter)
      if (dept) params.set("dept_filter", dept)
      if (site) params.set("site_filter", site)
      if (division) params.set("div_filter", division)
      if (team) params.set("team_filter", team)
    }
    const query = params.toString()
    router.push(`/projects${query ? "?" + query : ""}`)
  }, [debouncedSearch, statusFilter, createdByFilter, memberFilter, viewMode, router, dept, site, division, team])

  const handleDelete = async () => {
    if (!deleteId) return
    const idToDelete = deleteId
    setDeleteId(null)
    setLocalProjects(prev => prev.filter(p => p.project_id !== idToDelete))
    
    await fetch(`/api/projects/${idToDelete}`, { method: "DELETE" })
    await revalidatePathsAndTags(
      ['/projects', '/reports/dashboard'],
      ['projects']
    )
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
          ['/projects', '/reports/dashboard'],
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

  const uniqueDepts = Array.from(new Set(users.map((u) => u.user_departement).filter(Boolean))) as string[]
  const uniqueSites = Array.from(new Set(users.map((u) => u.user_site).filter(Boolean))) as string[]
  const uniqueDivs = Array.from(new Set(users.map((u) => u.user_division).filter(Boolean))) as string[]
  const uniqueTeams = Array.from(new Set(users.map((u) => u.user_team).filter(Boolean))) as string[]

  // Only show users who have actually created a project
  const creatorIds = new Set(projects.map((p) => p.created_by).filter(Boolean))
  const uniqueCreators = users.filter((u) => creatorIds.has(u.user_id))

  // Only show users who are actually a team member on some project
  const memberIds = new Set(projectTeams.map((pt) => pt.user_id).filter(Boolean))
  const uniqueMembers = users.filter((u) => memberIds.has(u.user_id))

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
              <span>({cancelledProjects.length})</span>
            </Button>
          )}

          <Link href="/projects/new">
            <Button size="sm" className="h-8 px-2 sm:px-4 sm:h-9">
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">New Project</span>
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
                    {uniqueCreators.map((u) => (
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
                    {uniqueMembers.map((u) => (
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
              const colProjects = getSortedColumnProjects(col.id)
              return (
                <DroppableColumn key={col.id} column={col} projects={colProjects}>
                  {colProjects.map((project) => {
                    const isMember = projectTeams.some(pt => pt.project_id === project.project_id && pt.user_id === currentUserId) || project.created_by === currentUserId || isSuperUser
                    return (
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
                        isProjectTeamMember={isMember}
                        density={density}
                      />
                    )
                  })}
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
          density === "compact" ? (
            <div className="flex flex-col border rounded-xl divide-y divide-border/55 bg-card overflow-hidden">
              {localProjects.map((project) => {
                const isMember = projectTeams.some(pt => pt.project_id === project.project_id && pt.user_id === currentUserId) || project.created_by === currentUserId || isSuperUser
                return (
                  <div key={project.project_id} className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 gap-2.5 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <Badge variant="outline" className="shrink-0 text-[10px] font-mono py-0 px-1 bg-muted">
                        {project.project_id.substring(0, 6)}
                      </Badge>
                      <div className="min-w-0 flex-1">
                        <Link href={`/projects/${project.project_id}`} className="font-medium text-xs hover:text-primary leading-none block truncate">
                          {project.project_name}
                        </Link>
                        {project.project_description && (
                          <p className="text-[10px] text-muted-foreground truncate mt-0.5 max-w-xl">
                            {project.project_description}
                          </p>
                        )}
                        {project.ticket_reference && (
                          <div className="mt-1 flex items-center gap-1">
                            <Link href={`/ticketing?ticketId=${project.ticket_reference}`} onClick={(e) => e.stopPropagation()}>
                              <Badge variant="outline" className="h-4 gap-0.5 text-[8px] py-0 px-1 border-primary/20 bg-primary/5 hover:bg-primary/10 text-primary cursor-pointer transition-all inline-flex items-center font-medium">
                                <LifeBuoy className="h-2.5 w-2.5 shrink-0" />
                                <span>Ref: {project.ticket_reference}</span>
                              </Badge>
                            </Link>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-2 shrink-0 text-xs">
                      <Badge
                        variant={statusVariant[project.project_status ?? "NS"] ?? "default"}
                        className="text-[9px] py-0 px-1.5 shrink-0"
                      >
                        {statusLabel[project.project_status ?? "NS"] ?? project.project_status ?? "NS"}
                      </Badge>

                      {project.category && (
                        <Badge variant="outline" className="text-[9px] py-0 px-1 bg-primary/5 text-primary border-primary/10 shrink-0">
                          {project.category}
                        </Badge>
                      )}

                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground min-w-[100px] justify-end">
                        {(projectProgressMap[project.project_id] ?? 0) > 0 && (
                          <span className="shrink-0">{projectProgressMap[project.project_id]}% done</span>
                        )}
                        {(projectHoursMap[project.project_id] ?? 0) > 0 && (
                          <span className="shrink-0 font-medium text-foreground">{projectHoursMap[project.project_id]}h</span>
                        )}
                      </div>

                      <div className="flex items-center gap-0.5">
                        <Link href={`/projects/${project.project_id}`}>
                          <Button variant="ghost" size="icon-sm" className="h-6 w-6">
                            <Eye className="h-3 w-3" />
                          </Button>
                        </Link>
                        {isMember && (
                          <>
                            <Link href={`/projects/${project.project_id}/edit`}>
                              <Button variant="ghost" size="icon-sm" className="h-6 w-6">
                                <Pencil className="h-3 w-3" />
                              </Button>
                            </Link>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="text-destructive hover:text-destructive h-6 w-6"
                              onClick={() => setDeleteId(project.project_id)}
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
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {localProjects.map((project) => {
                const isMember = projectTeams.some(pt => pt.project_id === project.project_id && pt.user_id === currentUserId) || project.created_by === currentUserId || isSuperUser
                return (
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
                        {project.category && (
                          <Badge variant="outline" className="bg-primary/5 text-primary border-primary/10">
                            {project.category}
                          </Badge>
                        )}
                        {project.ticket_reference && (
                          <Link href={`/ticketing?ticketId=${project.ticket_reference}`} onClick={(e) => e.stopPropagation()}>
                            <Badge variant="outline" className="gap-1 border-primary/20 bg-primary/5 hover:bg-primary/10 text-primary cursor-pointer transition-all flex items-center font-medium">
                              <LifeBuoy className="h-3 w-3 shrink-0" />
                              <span>Ref: {project.ticket_reference}</span>
                            </Badge>
                          </Link>
                        )}
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
                        {isMember && (
                          <>
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
            Showing page {currentPage} of {totalPages} ({projects.length} items)
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
                          disabled={!projectTeams.some(pt => pt.project_id === project.project_id && pt.user_id === currentUserId)}
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

