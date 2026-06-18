"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, RotateCcw, Trash2, FolderKanban, ListTodo, FileText } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
            {items.length} deleted item{items.length !== 1 ? "s" : ""} — review or restore
          </p>
        </div>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Trash2 className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <p className="text-muted-foreground">Trash is empty</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const Icon = TYPE_ICON[item.type]
            return (
              <Card key={`${item.type}-${item.id}`}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
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
                    disabled={restoring === item.id}
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
      )}
    </div>
  )
}
