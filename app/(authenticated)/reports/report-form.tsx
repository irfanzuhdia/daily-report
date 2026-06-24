"use client"
import { toDateStr } from "@/lib/format"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Save, X, Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { DailyReport, Task, Project } from "@/lib/types"
import { revalidatePathsAndTags } from "@/app/actions"

export function ReportForm({
  report,
  tasks,
  projects = [],
  defaultTaskId,
  defaultPercentage,
  currentUserId,
}: {
  report?: DailyReport
  tasks: Task[]
  projects?: Project[]
  defaultTaskId?: string
  defaultPercentage?: string
  currentUserId: string
}) {
  const router = useRouter()
  const isEdit = !!report

  const [localProjects, setLocalProjects] = useState<Project[]>(projects)
  const [localTasks, setLocalTasks] = useState<Task[]>(tasks)

  const initialTaskId = report?.task_id ?? defaultTaskId ?? ""
  const initialTask = localTasks.find((t) => t.id === initialTaskId)

  const [projectId, setProjectId] = useState(initialTask?.project_id ?? "")
  const [taskId, setTaskId] = useState(initialTaskId)
  const [date, setDate] = useState(
    report?.date ?? toDateStr(new Date())
  )
  const [percentage, setPercentage] = useState(() => {
    if (report?.progress_percentage) return report.progress_percentage
    if (defaultPercentage) return defaultPercentage
    if (defaultTaskId) {
      const task = localTasks.find((t) => t.id === defaultTaskId)
      if (task && task.task_latest_percentage) return task.task_latest_percentage
    }
    return "0"
  })
  const [totalHours, setTotalHours] = useState(
    report?.total_hours ?? ""
  )
  const [remarks, setRemarks] = useState(report?.remarks ?? "")
  const [saving, setSaving] = useState(false)

  const [showProjectModal, setShowProjectModal] = useState(false)
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [projectSearch, setProjectSearch] = useState("")
  const [taskSearch, setTaskSearch] = useState("")

  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false)
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false)
  
  // Project modal inputs
  const [newProjectName, setNewProjectName] = useState("")
  const [newProjectDesc, setNewProjectDesc] = useState("")
  const [newProjectStart, setNewProjectStart] = useState("")
  const [newProjectEnd, setNewProjectEnd] = useState("")
  const [projectCreating, setProjectCreating] = useState(false)
  const [projectCreateError, setProjectCreateError] = useState<string | null>(null)

  // Task modal inputs
  const [newTaskDesc, setNewTaskDesc] = useState("")
  const [taskCreating, setTaskCreating] = useState(false)
  const [taskCreateError, setTaskCreateError] = useState<string | null>(null)

  const projectTasks = localTasks.filter((t) => t.project_id === projectId)

  const filteredProjects = localProjects.filter((p) => {
    const q = projectSearch.toLowerCase()
    return (
      p.project_id.toLowerCase().includes(q) ||
      (p.project_name || "").toLowerCase().includes(q) ||
      (p.project_description || "").toLowerCase().includes(q)
    )
  })

  const filteredTasks = projectTasks.filter((t) => {
    const q = taskSearch.toLowerCase()
    return (
      t.id.toLowerCase().includes(q) ||
      (t.task_description || "").toLowerCase().includes(q)
    )
  })

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "NS":
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-muted text-muted-foreground">Not Started</span>
      case "OP":
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-500/10 text-blue-500">On Progress</span>
      case "D":
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-500">Done</span>
      case "H":
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-500">Hold</span>
      case "CC":
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/10 text-rose-500">Cancel</span>
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-muted text-muted-foreground">{status || "Unknown"}</span>
    }
  }

  const handleProjectIdChange = (newProjId: string) => {
    setProjectId(newProjId)
    // Check if the current taskId is in the new project
    const currentTask = tasks.find((t) => t.id === taskId)
    if (!currentTask || currentTask.project_id !== newProjId) {
      setTaskId("")
    }
  }

  const handleTaskIdChange = (val: string) => {
    setTaskId(val)
    if (!isEdit) {
      const task = tasks.find((t) => t.id === val)
      if (task && task.task_latest_percentage) {
        setPercentage(task.task_latest_percentage)
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      if (isEdit && report) {
        const res = await fetch(`/api/reports/${report.report_id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            task_id: taskId,
            date,
            progress_percentage: percentage,
            total_hours: totalHours || undefined,
            remarks: remarks || undefined,
          }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Unknown error' }))
          throw new Error(err.error || `Update failed (${res.status})`)
        }
        const currentTask = tasks.find((t) => t.id === report.task_id)
        const projectId = currentTask?.project_id
        const paths = ['/reports', `/reports/${report.report_id}`, `/tasks/${report.task_id}`, '/dashboard']
        if (projectId) {
          paths.push(`/projects/${projectId}`, '/projects')
        }
        await revalidatePathsAndTags(
          paths,
          ['reports', 'tasks', 'task_log', 'projects', 'project_log']
        )
        router.push(`/reports/${report.report_id}`)
      } else {
        const res = await fetch("/api/reports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            task_id: taskId,
            date,
            progress_percentage: percentage,
            total_hours: totalHours || undefined,
            remarks: remarks || undefined,
          }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Unknown error' }))
          throw new Error(err.error || `Create failed (${res.status})`)
        }
        const data = await res.json()
        const currentTask = tasks.find((t) => t.id === taskId)
        const projectId = currentTask?.project_id
        const paths = ['/reports', `/reports/${data.report_id}`, `/tasks/${taskId}`, '/dashboard']
        if (projectId) {
          paths.push(`/projects/${projectId}`, '/projects')
        }
        await revalidatePathsAndTags(
          paths,
          ['reports', 'tasks', 'task_log', 'projects', 'project_log']
        )
        router.push(`/reports/${data.report_id}`)
      }
      router.refresh()
    } catch (error) {
      console.error("Failed to save report:", error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href={isEdit ? `/reports/${report.report_id}` : "/reports"}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">
          {isEdit ? "Edit Report" : "New Daily Report"}
        </h1>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Report Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Project Selection */}
            <div className="space-y-2">
              <Label htmlFor="project">Project *</Label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Select value={projectId} onValueChange={handleProjectIdChange} required>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select project" />
                    </SelectTrigger>
                    <SelectContent>
                      {localProjects.map((p) => (
                        <SelectItem key={p.project_id} value={p.project_id}>
                          {p.project_id} - {p.project_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowProjectModal(true)}
                  className="shrink-0 rounded-lg"
                >
                  Browse...
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateProjectModal(true)}
                  className="shrink-0 rounded-lg bg-primary/5 border-primary/20 text-primary hover:bg-primary/10 hover:text-primary"
                >
                  + Project
                </Button>
              </div>
            </div>

            {/* Task Selection */}
            <div className="space-y-2">
              <Label htmlFor="task">Task *</Label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Select 
                    value={taskId} 
                    onValueChange={handleTaskIdChange} 
                    required 
                    disabled={!projectId}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={projectId ? "Select task" : "Select project first"} />
                    </SelectTrigger>
                    <SelectContent>
                      {projectTasks.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.id} - {t.task_description?.slice(0, 50) ?? t.id}
                          {(t.task_description?.length ?? 0) > 50 ? "..." : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowTaskModal(true)}
                  disabled={!projectId}
                  className="shrink-0 rounded-lg"
                >
                  Browse...
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateTaskModal(true)}
                  disabled={!projectId}
                  className="shrink-0 rounded-lg bg-primary/5 border-primary/20 text-primary hover:bg-primary/10 hover:text-primary"
                >
                  + Task
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">Date *</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="percentage">Progress (%) *</Label>
                <Input
                  id="percentage"
                  type="number"
                  min="0"
                  max="100"
                  value={percentage}
                  onChange={(e) => setPercentage(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="totalHours">Total Hours *</Label>
                <Input
                  id="totalHours"
                  type="number"
                  min="0"
                  step="0.5"
                  value={totalHours}
                  onChange={(e) => setTotalHours(e.target.value)}
                  placeholder="e.g. 8"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="remarks">Remarks</Label>
              <Textarea
                id="remarks"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Enter your daily progress notes..."
                rows={5}
              />
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 flex justify-end gap-3">
          <Link href={isEdit ? `/reports/${report.report_id}` : "/reports"}>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
          <Button
            type="submit"
            disabled={saving || !date || !percentage || !totalHours || !taskId}
          >
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Saving..." : isEdit ? "Update" : "Create"}
          </Button>
        </div>
      </form>

      {/* Browse Project Modal */}
      {showProjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-card text-card-foreground w-full max-w-2xl rounded-2xl border shadow-lg overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center px-6 py-4 border-b shrink-0">
              <div>
                <h3 className="font-bold text-lg text-foreground">Browse Projects</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Search and preview projects before selecting</p>
              </div>
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => {
                setShowProjectModal(false)
                setProjectSearch("")
              }} className="h-8 w-8 rounded-lg">
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="p-4 border-b shrink-0">
              <Input
                placeholder="Search projects by ID, name, or description..."
                value={projectSearch}
                onChange={(e) => setProjectSearch(e.target.value)}
                className="w-full"
                autoFocus
              />
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {filteredProjects.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  No projects found matching &quot;{projectSearch}&quot;
                </div>
              ) : (
                filteredProjects.map((p) => (
                  <div key={p.project_id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border hover:bg-muted/30 transition-colors gap-4">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-primary font-mono bg-primary/10 px-1.5 py-0.5 rounded">
                          {p.project_id}
                        </span>
                        <h4 className="text-sm font-bold truncate text-foreground">{p.project_name}</h4>
                        {getStatusBadge(p.project_status)}
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
                          handleProjectIdChange(p.project_id)
                          setShowProjectModal(false)
                          setProjectSearch("")
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
      )}

      {/* Browse Task Modal */}
      {showTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-card text-card-foreground w-full max-w-2xl rounded-2xl border shadow-lg overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center px-6 py-4 border-b shrink-0">
              <div>
                <h3 className="font-bold text-lg text-foreground">Browse Tasks</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Search tasks belonging to the selected project</p>
              </div>
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => {
                setShowTaskModal(false)
                setTaskSearch("")
              }} className="h-8 w-8 rounded-lg">
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="p-4 border-b shrink-0">
              <Input
                placeholder="Search tasks by ID or description..."
                value={taskSearch}
                onChange={(e) => setTaskSearch(e.target.value)}
                className="w-full"
                autoFocus
              />
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {filteredTasks.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  No tasks found matching &quot;{taskSearch}&quot; in this project
                </div>
              ) : (
                filteredTasks.map((t) => (
                  <div key={t.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border hover:bg-muted/30 transition-colors gap-4">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-primary font-mono bg-primary/10 px-1.5 py-0.5 rounded">
                          {t.id}
                        </span>
                        {getStatusBadge(t.task_status)}
                        {t.task_latest_percentage && (
                          <span className="text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
                            {t.task_latest_percentage}%
                          </span>
                        )}
                      </div>
                      {t.task_description && (
                        <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                          {t.task_description}
                        </p>
                      )}
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
                          handleTaskIdChange(t.id)
                          setShowTaskModal(false)
                          setTaskSearch("")
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
      )}

      {/* Create Project Modal */}
      {showCreateProjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-card text-card-foreground w-full max-w-lg rounded-2xl border shadow-lg overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
            <div className="flex justify-between items-center px-6 py-4 border-b shrink-0">
              <div>
                <h3 className="font-bold text-lg text-foreground">Create New Project</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Define project settings inline</p>
              </div>
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => {
                setShowCreateProjectModal(false)
                setProjectCreateError(null)
              }} className="h-8 w-8 rounded-lg">
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <form 
              onSubmit={async (e) => {
                e.preventDefault()
                if (!newProjectName.trim() || projectCreating) return
                setProjectCreating(true)
                setProjectCreateError(null)

                try {
                  const res = await fetch("/api/projects", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      project_name: newProjectName.trim(),
                      project_description: newProjectDesc.trim() || undefined,
                      project_start_date_plan: newProjectStart || undefined,
                      project_end_date_plan: newProjectEnd || undefined,
                      project_status: "NS",
                      team_user_ids: [currentUserId],
                    }),
                  })

                  if (!res.ok) {
                    const err = await res.json().catch(() => ({ error: "Failed to create project" }))
                    throw new Error(err.error || "Failed to create project")
                  }

                  const newProject = await res.json()
                  setLocalProjects((prev) => [...prev, newProject])
                  handleProjectIdChange(newProject.project_id)
                  
                  // Reset form
                  setNewProjectName("")
                  setNewProjectDesc("")
                  setNewProjectStart("")
                  setNewProjectEnd("")
                  setShowCreateProjectModal(false)
                } catch (error: unknown) {
                  const msg = error instanceof Error ? error.message : "Failed to create project"
                  setProjectCreateError(msg)
                } finally {
                  setProjectCreating(false)
                }
              }} 
              className="p-6 space-y-4"
            >
              {projectCreateError && (
                <div className="p-3 text-xs bg-destructive/10 text-destructive rounded-lg font-medium">
                  {projectCreateError}
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="newProjName">Project Name *</Label>
                <Input
                  id="newProjName"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="e.g. Project Apollo"
                  required
                  autoFocus
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="newProjDesc">Description</Label>
                <Textarea
                  id="newProjDesc"
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                  placeholder="Enter project description..."
                  rows={3}
                />
              </div>
              
              <div className="grid gap-4 grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="newProjStart">Start Date</Label>
                  <Input
                    id="newProjStart"
                    type="date"
                    value={newProjectStart}
                    onChange={(e) => setNewProjectStart(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newProjEnd">End Date</Label>
                  <Input
                    id="newProjEnd"
                    type="date"
                    value={newProjectEnd}
                    onChange={(e) => setNewProjectEnd(e.target.value)}
                  />
                </div>
              </div>
              
              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowCreateProjectModal(false)
                    setProjectCreateError(null)
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={projectCreating || !newProjectName.trim()}>
                  {projectCreating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin text-muted-foreground" />
                      Creating...
                    </>
                  ) : (
                    "Create Project"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Task Modal */}
      {showCreateTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-card text-card-foreground w-full max-w-lg rounded-2xl border shadow-lg overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
            <div className="flex justify-between items-center px-6 py-4 border-b shrink-0">
              <div>
                <h3 className="font-bold text-lg text-foreground">Create New Task</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Define task inline for the selected project</p>
              </div>
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => {
                setShowCreateTaskModal(false)
                setTaskCreateError(null)
              }} className="h-8 w-8 rounded-lg">
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <form 
              onSubmit={async (e) => {
                e.preventDefault()
                if (!newTaskDesc.trim() || taskCreating || !projectId) return
                setTaskCreating(true)
                setTaskCreateError(null)

                try {
                  const res = await fetch("/api/tasks", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      project_id: projectId,
                      task_description: newTaskDesc.trim(),
                      task_status: "NS",
                      task_latest_percentage: "0",
                      task_user_ids: [currentUserId],
                    }),
                  })

                  if (!res.ok) {
                    const err = await res.json().catch(() => ({ error: "Failed to create task" }))
                    throw new Error(err.error || "Failed to create task")
                  }

                  const newTask = await res.json()
                  setLocalTasks((prev) => [...prev, newTask])
                  handleTaskIdChange(newTask.id)
                  
                  // Reset form
                  setNewTaskDesc("")
                  setShowCreateTaskModal(false)
                } catch (error: unknown) {
                  const msg = error instanceof Error ? error.message : "Failed to create task"
                  setTaskCreateError(msg)
                } finally {
                  setTaskCreating(false)
                }
              }} 
              className="p-6 space-y-4"
            >
              {taskCreateError && (
                <div className="p-3 text-xs bg-destructive/10 text-destructive rounded-lg font-medium">
                  {taskCreateError}
                </div>
              )}

              <div className="space-y-2">
                <Label>Parent Project</Label>
                <div className="p-2.5 rounded-lg border bg-muted/30 text-sm font-semibold text-muted-foreground">
                  {(() => {
                    const p = localProjects.find((x) => x.project_id === projectId)
                    return p ? `${p.project_id} - ${p.project_name}` : projectId
                  })()}
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="newTaskDesc">Task Description *</Label>
                <Textarea
                  id="newTaskDesc"
                  value={newTaskDesc}
                  onChange={(e) => setNewTaskDesc(e.target.value)}
                  placeholder="Enter task description..."
                  rows={4}
                  required
                  autoFocus
                />
              </div>
              
              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowCreateTaskModal(false)
                    setTaskCreateError(null)
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={taskCreating || !newTaskDesc.trim() || !projectId}>
                  {taskCreating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin text-muted-foreground" />
                      Creating...
                    </>
                  ) : (
                    "Create Task"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
