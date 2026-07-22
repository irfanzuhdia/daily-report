import * as React from "react"
import { useDroppable } from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { Badge } from "@/components/ui/badge"

interface KanbanColumnProps {
  id: string
  title: string
  items: Array<{ id: string }>
  indicatorColorClass?: string
  children: React.ReactNode
  emptyMessage?: string
}

export function KanbanColumn({
  id,
  title,
  items,
  indicatorColorClass = "bg-slate-400",
  children,
  emptyMessage = "No items",
}: KanbanColumnProps) {
  const itemIds = items.map((item) => item.id)
  const { setNodeRef } = useDroppable({ id })

  return (
    <div
      ref={setNodeRef}
      className="flex flex-col rounded-2xl border bg-muted/30 p-4 min-h-[500px]"
    >
      <div className="flex items-center justify-between mb-4 pb-2 border-b">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${indicatorColorClass}`} />
          <h3 className="font-semibold text-sm text-foreground">{title}</h3>
        </div>
        <Badge variant="secondary">{items.length}</Badge>
      </div>

      <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
        <div
          className="flex-1 space-y-3 overflow-y-auto"
          data-column-id={id}
        >
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 border border-dashed rounded-xl bg-card/50">
              <p className="text-xs text-muted-foreground">{emptyMessage}</p>
            </div>
          ) : (
            children
          )}
        </div>
      </SortableContext>
    </div>
  )
}
