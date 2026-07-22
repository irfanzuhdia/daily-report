import * as React from "react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

interface SortableItemProps {
  id: string
  children: (props: {
    dragHandleProps: Record<string, any>
    isDragging: boolean
  }) => React.ReactNode
  className?: string
}

export function SortableItem({ id, children, className }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    // Add z-index when dragging so it stays above other elements
    ...(isDragging ? { zIndex: 50, position: "relative" as const } : {}),
  }

  // Render a placeholder if actively dragging this item (the overlay handles the actual visual)
  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="opacity-30 pointer-events-none"
      >
        {children({ dragHandleProps: { ...listeners, ...attributes }, isDragging })}
      </div>
    )
  }

  return (
    <div ref={setNodeRef} style={style} className={className}>
      {children({ dragHandleProps: { ...listeners, ...attributes }, isDragging })}
    </div>
  )
}
