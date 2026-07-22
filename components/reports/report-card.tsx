"use client"

import { useSortable, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import React, { memo } from "react"
import { CSS } from "@dnd-kit/utilities"
import { useDroppable } from "@dnd-kit/core"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { GripVertical, Pin, Pencil, Trash2, Loader2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

export interface EnrichedReport {
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

export const SortableReportCard = memo(function SortableReportCard({
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
  
  const router = useRouter()

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  const isCompact = density === "compact"

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <Card 
        onClick={() => router.push(`/reports/${report.report_id}`)}
        className={`shadow-sm hover:shadow-md transition-shadow relative overflow-hidden cursor-pointer hover:bg-muted/50 ${isDragging ? "ring-2 ring-primary" : ""}`}
      >
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
                onClick={(e) => e.stopPropagation()}
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
                onClick={(e) => {
                  e.stopPropagation();
                  onTogglePin(report.report_id);
                }}
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
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
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
})

export function ReportDragOverlay({ report }: { report: EnrichedReport }) {
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

export function DroppableColumn({
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
