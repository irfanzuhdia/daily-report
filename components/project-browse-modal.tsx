"use client"

import { useState } from "react"
import { X, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import type { Project } from "@/lib/types"

interface ProjectBrowseModalProps {
  isOpen: boolean
  onClose: () => void
  projects: Project[]
  onSelect: (projectId: string) => void
}

const statusVariant: Record<string, "default" | "success" | "warning" | "destructive" | "secondary"> = {
  NS: "secondary",
  OP: "warning",
  D: "success",
  C: "success",
  H: "destructive",
  CC: "destructive",
}

const statusLabel: Record<string, string> = {
  NS: "Not Started",
  OP: "On Progress",
  D: "Completed",
  C: "Completed",
  H: "On Hold",
  CC: "Cancelled",
}

export function ProjectBrowseModal({
  isOpen,
  onClose,
  projects,
  onSelect,
}: ProjectBrowseModalProps) {
  const [search, setSearch] = useState("")

  if (!isOpen) return null

  const filteredProjects = projects.filter((p) => {
    const q = search.toLowerCase()
    return (
      p.project_id.toLowerCase().includes(q) ||
      (p.project_name || "").toLowerCase().includes(q) ||
      (p.project_description || "").toLowerCase().includes(q) ||
      (p.category || "").toLowerCase().includes(q)
    )
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-card text-card-foreground w-full max-w-2xl rounded-2xl border shadow-lg overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
        <div className="flex justify-between items-center px-6 py-4 border-b shrink-0">
          <div>
            <h3 className="font-bold text-lg text-foreground">Select Project</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Search and pick a project from the workspace</p>
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
              placeholder="Search projects by ID, name, description, or category..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-full"
              autoFocus
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {filteredProjects.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              No projects found matching &quot;{search}&quot;
            </div>
          ) : (
            filteredProjects.map((p) => (
              <div
                key={p.project_id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border hover:bg-muted/30 transition-all duration-150 gap-4"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-primary font-mono bg-primary/10 px-1.5 py-0.5 rounded">
                      {p.project_id}
                    </span>
                    <h4 className="text-sm font-bold truncate text-foreground">
                      {p.project_name}
                    </h4>
                    <Badge
                      variant={statusVariant[p.project_status || "NS"] || "default"}
                      className="text-[10px] py-0 px-1.5"
                    >
                      {statusLabel[p.project_status || "NS"] || p.project_status}
                    </Badge>
                    {p.category && (
                      <Badge variant="outline" className="text-[10px] py-0 px-1.5 bg-primary/5 text-primary border-primary/15">
                        {p.category}
                      </Badge>
                    )}
                  </div>
                  {p.project_description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {p.project_description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground pt-1">
                    <span>Start: {p.project_start_date_plan || "-"}</span>
                    <span>•</span>
                    <span>End: {p.project_end_date_plan || "-"}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <a
                    href={`/projects/${p.project_id}`}
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
                      onSelect(p.project_id)
                      onClose()
                      setSearch("")
                    }}
                    className="h-8 rounded-lg"
                  >
                    Select
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
