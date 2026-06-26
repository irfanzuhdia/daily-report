"use client"

import { useState } from "react"
import { X, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import type { Task } from "@/lib/types"

interface TaskBrowseModalProps {
  isOpen: boolean
  onClose: () => void
  tasks: Task[]
  onSelect: (taskId: string) => void
  taskHoursMap?: Record<string, number>
}

import { statusVariant, statusLabel } from "@/lib/status-helpers"

export function TaskBrowseModal({
  isOpen,
  onClose,
  tasks,
  onSelect,
  taskHoursMap = {},
}: TaskBrowseModalProps) {
  const [search, setSearch] = useState("")

  if (!isOpen) return null

  const filteredTasks = tasks.filter((t) => {
    const q = search.toLowerCase()
    return (
      t.id.toLowerCase().includes(q) ||
      (t.task_description || "").toLowerCase().includes(q)
    )
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-card text-card-foreground w-full max-w-2xl rounded-2xl border shadow-lg overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
        <div className="flex justify-between items-center px-6 py-4 border-b shrink-0">
          <div>
            <h3 className="font-bold text-lg text-foreground">Select Task</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Search and pick an active task under this project</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            className="h-8 w-8 rounded-lg"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-4 border-b shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search tasks by ID or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-full"
              autoFocus
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {filteredTasks.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              No tasks found matching &quot;{search}&quot;
            </div>
          ) : (
            filteredTasks.map((t) => {
              const hours = taskHoursMap[t.id] ?? 0
              return (
                <div
                  key={t.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border hover:bg-muted/30 transition-all duration-150 gap-4"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-primary font-mono bg-primary/10 px-1.5 py-0.5 rounded">
                        {t.id}
                      </span>
                      <Badge
                        variant={statusVariant[t.task_status || "NS"] || "default"}
                        className="text-[10px] py-0 px-1.5"
                      >
                        {statusLabel[t.task_status || "NS"] || t.task_status}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                        {t.task_latest_percentage ?? 0}% completed
                      </Badge>
                      {hours > 0 && (
                        <Badge variant="secondary" className="text-[10px] py-0 px-1.5">
                          {hours}h logged
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-foreground leading-relaxed line-clamp-3">
                      {t.task_description}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <a
                      href={`/tasks/${t.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center rounded-lg border h-8 px-3 text-xs font-medium hover:bg-muted transition-colors text-muted-foreground"
                    >
                      View Detail ↗
                    </a>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        onSelect(t.id)
                        onClose()
                        setSearch("")
                      }}
                      className="h-8 rounded-lg"
                    >
                      Select
                    </Button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
