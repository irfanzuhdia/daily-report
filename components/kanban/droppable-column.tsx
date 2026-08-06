"use client"

import React from "react"
import { useDroppable } from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { Badge } from "@/components/ui/badge"
import type { Task } from "@/lib/types"

interface DroppableColumnProps {
  column: { id: string; title: string }
  tasks: Task[]
  children: React.ReactNode
  /** Real number of tasks in this status, which can exceed what is loaded so far. */
  total?: number
  hasMore?: boolean
  loadingMore?: boolean
  onLoadMore?: () => void
}

export function DroppableColumn({
  column,
  tasks,
  children,
  total,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
}: DroppableColumnProps) {
  const taskIds = tasks.map((t) => t.id)
  const { setNodeRef } = useDroppable({
    id: column.id,
  })
  const sentinelRef = React.useRef<HTMLDivElement>(null)
  const scrollRef = React.useRef<HTMLDivElement>(null)

  // Each column pages on its own scroll, so a short column never hides rows
  // behind a board-wide "next page". The column body is the observer root —
  // with the default viewport root, scrolling a column that sits off-screen
  // would never trigger anything.
  React.useEffect(() => {
    if (!hasMore || !onLoadMore) return
    const el = sentinelRef.current
    const root = scrollRef.current
    if (!el || !root) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onLoadMore()
      },
      { root, rootMargin: "150px" }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMore, onLoadMore, tasks.length])

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
        <Badge variant="secondary">{total ?? tasks.length}</Badge>
      </div>

      <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
        <div ref={scrollRef} className="flex-1 space-y-3.5 sm:space-y-4 overflow-y-auto p-0.5 max-h-[70vh]" data-column-id={column.id}>
          {tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 border border-dashed rounded-xl bg-card/50">
              <p className="text-xs text-muted-foreground">No tasks</p>
            </div>
          ) : (
            <>
              {children}
              {hasMore && (
                <div
                  ref={sentinelRef}
                  className="flex items-center justify-center gap-2 py-3 text-[11px] text-muted-foreground"
                >
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
                  {loadingMore ? "Loading..." : `${(total ?? tasks.length) - tasks.length} more`}
                </div>
              )}
            </>
          )}
        </div>
      </SortableContext>
    </div>
  )
}
