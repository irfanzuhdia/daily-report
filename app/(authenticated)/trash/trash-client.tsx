"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, RotateCcw, Trash2, FolderKanban, ListTodo, FileText, Loader2, Search, Filter } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatDateTime } from "@/lib/format"

interface TrashItem {
  type: "project" | "task" | "report"
  id: string
  name: string
  deletedBy: string | null
  deletedAt: string | null
}

const TYPE_ICON = {
  project: FolderKanban,
  task: ListTodo,
  report: FileText,
}

const TYPE_LABEL = {
  project: "Project",
  task: "Task",
  report: "Report",
}

const TYPE_VARIANT = {
  project: "secondary" as const,
  task: "warning" as const,
  report: "default" as const,
}

export function TrashClient({ items }: { items: TrashItem[] }) {
  const [restoring, setRestoring] = useState<string | null>(null)
  const [selectedItems, setSelectedItems] = useState<Record<string, TrashItem>>({})
  const [batchRestoring, setBatchRestoring] = useState(false)

  // Filter state
  const [searchQuery, setSearchQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState<"all" | "project" | "task" | "report">("all")
  const [deletedByFilter, setDeletedByFilter] = useState("all")

  // Derive unique deletedBy values from the actual data
  const uniqueDeletedBy = Array.from(
    new Set(items.map((i) => i.deletedBy).filter(Boolean))
  ) as string[]

  // Apply filters
  const filteredItems = items.filter((item) => {
    if (typeFilter !== "all" && item.type !== typeFilter) return false
    if (deletedByFilter !== "all" && item.deletedBy !== deletedByFilter) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      if (
        !item.name.toLowerCase().includes(q) &&
        !item.id.toLowerCase().includes(q) &&
        !(item.deletedBy || "").toLowerCase().includes(q)
      ) {
        return false
      }
    }
    return true
  })

  const handleRestore = async (item: TrashItem) => {
    setRestoring(item.id)
    try {
      await fetch(`/api/trash/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: item.type, id: item.id }),
      })
      window.location.reload()
    } catch (error) {
      console.error("Restore failed:", error)
    } finally {
      setRestoring(null)
    }
  }

  const handleBatchRestore = async () => {
    const list = Object.values(selectedItems)
    if (list.length === 0) return
    setBatchRestoring(true)
    try {
      await fetch(`/api/trash/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: list.map(item => ({ type: item.type, id: item.id }))
        }),
      })
      window.location.reload()
    } catch (error) {
      console.error("Batch restore failed:", error)
    } finally {
      setBatchRestoring(false)
    }
  }

  const toggleSelect = (item: TrashItem) => {
    const key = `${item.type}-${item.id}`
    setSelectedItems(prev => {
      const next = { ...prev }
      if (next[key]) {
        delete next[key]
      } else {
        next[key] = item
      }
      return next
    })
  }

  const isAllSelected = filteredItems.length > 0 && Object.keys(selectedItems).length === filteredItems.length

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedItems({})
    } else {
      const next: Record<string, TrashItem> = {}
      for (const item of filteredItems) {
        const key = `${item.type}-${item.id}`
        next[key] = item
      }
      setSelectedItems(next)
    }
  }

  const selectedCount = Object.keys(selectedItems).length

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Trash</h1>
          <p className="text-muted-foreground">
            {filteredItems.length} of {items.length} deleted item{items.length !== 1 ? "s" : ""} — review or restore
          </p>
        </div>
      </div>

      {/* Auto-delete Info Alert Banner */}
      <Card className="bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400">
        <CardContent className="p-4 flex items-start gap-3">
          <Trash2 className="h-5 w-5 shrink-0 mt-0.5 text-amber-500" />
          <div className="space-y-1">
            <p className="text-sm font-semibold">Automatic Cleanup Notice</p>
            <p className="text-xs leading-relaxed opacity-90">
              Deleted items are kept in the trash for <strong>30 days</strong>. After 30 days, they are automatically and permanently deleted from the database.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, ID, or deleted by..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-9"
          />
        </div>
        <div className="flex gap-2">
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
            <SelectTrigger className="h-9 w-[140px]">
              <Filter className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="project">Projects</SelectItem>
              <SelectItem value="task">Tasks</SelectItem>
              <SelectItem value="report">Reports</SelectItem>
            </SelectContent>
          </Select>
          {uniqueDeletedBy.length > 1 && (
            <Select value={deletedByFilter} onValueChange={setDeletedByFilter}>
              <SelectTrigger className="h-9 w-[160px]">
                <SelectValue placeholder="Deleted by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                {uniqueDeletedBy.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {filteredItems.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Trash2 className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <p className="text-muted-foreground">
              {items.length === 0 ? "Trash is empty" : "No items match your filters"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Action Bar for Batch Selection */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-muted/30 border rounded-xl">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isAllSelected}
                onChange={toggleSelectAll}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer accent-primary"
                id="select-all-checkbox"
              />
              <label htmlFor="select-all-checkbox" className="text-sm font-medium cursor-pointer select-none">
                {isAllSelected ? "Deselect All" : "Select All"}
              </label>
              {selectedCount > 0 && (
                <span className="text-xs text-muted-foreground ml-2">
                  ({selectedCount} selected)
                </span>
              )}
            </div>
            {selectedCount > 0 && (
              <Button
                variant="default"
                size="sm"
                onClick={handleBatchRestore}
                disabled={batchRestoring}
              >
                {batchRestoring ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <RotateCcw className="mr-1.5 h-4 w-4" />
                )}
                Restore Selected ({selectedCount})
              </Button>
            )}
          </div>

          <div className="space-y-3">
            {filteredItems.map((item) => {
              const Icon = TYPE_ICON[item.type]
              const key = `${item.type}-${item.id}`
              const isSelected = !!selectedItems[key]
              return (
                <Card key={key} className={`transition-all ${isSelected ? "border-primary/50 bg-primary/5" : ""}`}>
                  <CardContent className="flex items-center justify-between p-4 gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(item)}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer accent-primary shrink-0"
                      />
                      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={TYPE_VARIANT[item.type]} className="text-xs">
                            {TYPE_LABEL[item.type]}
                          </Badge>
                          <p className="text-sm font-medium truncate">{item.name}</p>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span>Deleted: {formatDateTime(item.deletedAt)}</span>
                          {item.deletedBy && <span>By: {item.deletedBy}</span>}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRestore(item)}
                      disabled={restoring === item.id || batchRestoring}
                      className="shrink-0 ml-3"
                    >
                      <RotateCcw className="mr-1.5 h-3 w-3" />
                      Restore
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
