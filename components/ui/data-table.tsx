"use client"

import React, { useState, useMemo, useRef } from "react"
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { cn } from "@/lib/utils"

export interface ColumnDef<T> {
  header: string | React.ReactNode
  accessorKey?: keyof T
  cell?: (item: T) => React.ReactNode
  sortable?: boolean
  className?: string
}

interface DataTableProps<T> {
  columns: ColumnDef<T>[]
  data: T[]
  className?: string
  rowClassName?: (item: T) => string
  onRowClick?: (item: T) => void
  emptyMessage?: string
}

type SortDirection = "asc" | "desc" | null

export function DataTable<T>({
  columns,
  data,
  className,
  rowClassName,
  onRowClick,
  emptyMessage = "No results found.",
}: DataTableProps<T>) {
  const [sortConfig, setSortConfig] = useState<{
    key: keyof T | null
    direction: SortDirection
  }>({
    key: null,
    direction: null,
  })

  const handleSort = (column: ColumnDef<T>) => {
    if (!column.sortable || !column.accessorKey) return

    setSortConfig((prev) => {
      if (prev.key === column.accessorKey) {
        if (prev.direction === "asc") return { key: column.accessorKey as keyof T, direction: "desc" }
        if (prev.direction === "desc") return { key: null, direction: null }
      }
      return { key: column.accessorKey as keyof T, direction: "asc" }
    })
  }

  const sortedData = useMemo(() => {
    if (!sortConfig.key || sortConfig.direction === null) return data

    return [...data].sort((a, b) => {
      const aVal = a[sortConfig.key!]
      const bVal = b[sortConfig.key!]

      if (aVal === bVal) return 0
      
      const isAsc = sortConfig.direction === "asc"
      
      // Handle nulls/undefined
      if (aVal == null) return isAsc ? 1 : -1
      if (bVal == null) return isAsc ? -1 : 1

      if (typeof aVal === "string" && typeof bVal === "string") {
        return isAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }

      if (aVal < bVal) return isAsc ? -1 : 1
      if (aVal > bVal) return isAsc ? 1 : -1

      return 0
    })
  }, [data, sortConfig])

  const parentRef = useRef<HTMLDivElement>(null)

  const rowVirtualizer = useVirtualizer({
    count: sortedData.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 52, // Approximate height of a row
    overscan: 5,
  })

  const virtualItems = rowVirtualizer.getVirtualItems()
  const paddingTop = virtualItems.length > 0 ? virtualItems[0]?.start || 0 : 0
  const paddingBottom = virtualItems.length > 0
    ? rowVirtualizer.getTotalSize() - (virtualItems[virtualItems.length - 1]?.end || 0)
    : 0

  return (
    <div 
      ref={parentRef}
      className={cn("w-full overflow-auto rounded-md border max-h-[600px]", className)}
    >
      <table className="w-full text-sm text-left relative">
        <thead className="bg-muted/50 border-b sticky top-0 z-10 backdrop-blur-sm">
          <tr>
            {columns.map((col, idx) => {
              const isSorted = sortConfig.key === col.accessorKey
              return (
                <th
                  key={idx}
                  onClick={() => handleSort(col)}
                  className={cn(
                    "h-10 px-4 align-middle font-medium text-muted-foreground",
                    col.sortable && "cursor-pointer select-none hover:text-foreground",
                    col.className
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    {col.header}
                    {col.sortable && (
                      <span className="w-4 h-4 inline-flex items-center justify-center">
                        {isSorted ? (
                          sortConfig.direction === "asc" ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" />
                          )
                        ) : (
                          <ChevronsUpDown className="h-3 w-3 opacity-30 group-hover:opacity-100" />
                        )}
                      </span>
                    )}
                  </div>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody className="divide-y">
          {sortedData.length > 0 ? (
            <>
              {paddingTop > 0 && (
                <tr><td style={{ height: `${paddingTop}px` }} colSpan={columns.length} /></tr>
              )}
              {virtualItems.map((virtualRow) => {
                const row = sortedData[virtualRow.index]
                return (
                  <tr
                    key={virtualRow.index}
                    onClick={() => onRowClick?.(row)}
                    className={cn(
                      "hover:bg-muted/30 transition-colors",
                      onRowClick && "cursor-pointer",
                      rowClassName?.(row)
                    )}
                    data-index={virtualRow.index}
                    ref={rowVirtualizer.measureElement}
                  >
                    {columns.map((col, colIdx) => (
                      <td key={colIdx} className={cn("p-4 align-middle", col.className)}>
                        {col.cell
                          ? col.cell(row)
                          : col.accessorKey
                          ? (row[col.accessorKey] as React.ReactNode)
                          : null}
                      </td>
                    ))}
                  </tr>
                )
              })}
              {paddingBottom > 0 && (
                <tr><td style={{ height: `${paddingBottom}px` }} colSpan={columns.length} /></tr>
              )}
            </>
          ) : (
            <tr>
              <td
                colSpan={columns.length}
                className="h-24 text-center text-muted-foreground"
              >
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
