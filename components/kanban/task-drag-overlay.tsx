"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Folder } from "lucide-react"
import type { Task } from "@/lib/types"

interface TaskDragOverlayProps {
  task: Task
  projectMap: Record<string, string | null>
  taskHoursMap: Record<string, number>
}

export function TaskDragOverlay({
  task,
  projectMap,
  taskHoursMap,
}: TaskDragOverlayProps) {
  return (
    <Card className="shadow-xl ring-2 ring-primary/50 rotate-2 w-[280px]">
      <CardContent className="p-4 space-y-2">
        <p className="font-medium text-sm whitespace-pre-wrap">{task.task_description}</p>
        <p className="text-[11px] text-muted-foreground truncate inline-flex items-center gap-1">
          <Folder className="h-3 w-3 shrink-0" />
          <span className="truncate">{projectMap[task.project_id] ?? task.project_id}</span>
        </p>
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t">
          <span>{task.task_latest_percentage ?? 0}%</span>
          {taskHoursMap[task.id] > 0 && <span>{taskHoursMap[task.id]}h</span>}
        </div>
      </CardContent>
    </Card>
  )
}
