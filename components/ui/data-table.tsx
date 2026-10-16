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

function parseSortValue(val: unknown): number | null {
  if (typeof val === "number") return isNaN(val) ? null : val
  if (typeof val === "string") {
    const trimmed = val.trim()
    const cleaned = trimmed.replace(/^[^\d.-]+/, "").replace(/[^\d.-]+$/, "")
    if (cleaned !== "") {
      const parsed = parseFloat(cleaned)
      if (!isNaN(parsed)) return parsed
    }
  }
  return null
}

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

  // O(N) key extraction + O(N log N) sorting
  const sortedData = useMemo(() => {
    if (!sortConfig.key || sortConfig.direction === null) return data

    const key = sortConfig.key
    const isAsc = sortConfig.direction === "asc"

    const mapped = data.map((item, index) => {
      const raw = item[key]
      const num = parseSortValue(raw)
      return { index, raw, num, item }
    })

    mapped.sort((a, b) => {
      if (a.raw === b.raw) return 0
      if (a.raw == null) return isAsc ? 1 : -1
      if (b.raw == null) return isAsc ? -1 : 1

      // Numeric comparison (handles duration e.g. "16h", "0.4d", "100%")
      if (a.num !== null && b.num !== null) {
        return isAsc ? a.num - b.num : b.num - a.num
      }

      if (typeof a.raw === "string" && typeof b.raw === "string") {
        return isAsc ? a.raw.localeCompare(b.raw) : b.raw.localeCompare(a.raw)
      }

      if (a.raw < b.raw) return isAsc ? -1 : 1
      if (a.raw > b.raw) return isAsc ? 1 : -1

      return 0
    })

    return mapped.map((m) => m.item)
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
