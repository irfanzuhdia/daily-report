"use client"

import { useSortable, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { useDroppable } from "@dnd-kit/core"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { GripVertical, Pin, LifeBuoy, Loader2, Pencil, Trash2 } from "lucide-react"
import React, { memo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { Project, Status } from "@/lib/types"

export const SortableProjectCard = memo(function SortableProjectCard({
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
  const router = useRouter()
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
      <Card 
        onClick={() => router.push(`/projects/${project.project_id}`)}
        className={`shadow-sm hover:shadow-md transition-shadow relative overflow-hidden cursor-pointer hover:bg-muted/50 ${isDragging ? "ring-2 ring-primary" : ""}`}
      >
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
                onClick={(e) => e.stopPropagation()}
                className="mt-0.5 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground shrink-0 touch-none"
                tabIndex={-1}
              >
                <GripVertical className="h-4 w-4" />
              </button>
            )}
            <div className="space-y-1 min-w-0 flex-1">
              <span className="font-medium text-sm hover:text-primary leading-snug whitespace-pre-wrap">
                {project.project_name}
              </span>
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
              onClick={(e) => {
                e.stopPropagation();
                onTogglePin(project.project_id);
              }}
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
              <div onClick={(e) => e.stopPropagation()}>
                <SelectTrigger className={`text-[10px] px-2 py-0 ${isCompact ? "h-6 w-[95px]" : "h-7 w-[110px]"}`}>
                  <SelectValue />
                </SelectTrigger>
              </div>
              <SelectContent>
                {statuses.map((s) => (
                  <SelectItem key={s.id} value={s.id} className="text-xs">
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
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
})

export function ProjectDragOverlay({
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

export function DroppableColumn({
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
