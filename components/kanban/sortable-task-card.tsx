"use client"

import React, { memo } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical, Pin, Pencil, Trash2, Loader2 } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Task, Status } from "@/lib/types"

interface SortableTaskCardProps {
  task: Task
  projectMap: Record<string, string | null>
  taskHoursMap: Record<string, number>
  statuses: Status[]
  updatingId: string | null
  onStatusChange: (taskId: string, newStatus: string) => void
  onDelete: (taskId: string) => void
  isPinned: boolean
  onTogglePin: (taskId: string) => void
  isTaskTeamMember: boolean
  density: "comfortable" | "compact"
}

export const SortableTaskCard = memo(function SortableTaskCard({
  task,
  projectMap,
  taskHoursMap,
  statuses,
  updatingId,
  onStatusChange,
  onDelete,
  isPinned,
  onTogglePin,
  isTaskTeamMember,
  density,
}: SortableTaskCardProps) {
  const router = useRouter()
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

  const isCompact = density === "compact"

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <Card 
        onClick={() => router.push(`/tasks/${task.id}`)}
        className={`shadow-sm hover:shadow-md transition-shadow relative overflow-hidden cursor-pointer hover:bg-muted/50 ${isDragging ? "ring-2 ring-primary" : ""}`}
      >
        {updatingId === task.id && (
          <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        )}
        <CardContent className={isCompact ? "p-3 space-y-2" : "p-4 space-y-3"}>
          <div className="flex items-start gap-2">
            {isTaskTeamMember && (
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
              <span className="font-medium text-sm hover:text-primary leading-snug block whitespace-pre-wrap">
                {task.task_description}
              </span>
              <p className="text-[10px] text-muted-foreground truncate">
                📁 {projectMap[task.project_id] ?? task.project_id}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              className={`h-6 w-6 shrink-0 ${isPinned ? "text-primary" : "text-muted-foreground opacity-30 hover:opacity-100"}`}
              onClick={(e) => {
                e.stopPropagation();
                onTogglePin(task.id);
              }}
            >
              <Pin className="h-3.5 w-3.5" style={isPinned ? { fill: "currentColor" } : {}} />
            </Button>
          </div>

          <div className={`flex items-center justify-between text-xs text-muted-foreground pt-1 border-t ${isCompact ? "border-t-muted/30" : ""}`}>
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
              disabled={!isTaskTeamMember}
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
              {isTaskTeamMember && (
                <>
                  <Link href={`/tasks/${task.id}/edit`}>
                    <Button variant="ghost" size="icon-sm" className={isCompact ? "h-6 w-6" : "h-7 w-7"}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className={`text-destructive hover:text-destructive ${isCompact ? "h-6 w-6" : "h-7 w-7"}`}
                    onClick={() => onDelete(task.id)}
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
