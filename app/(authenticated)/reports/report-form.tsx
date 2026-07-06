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
import { ProjectBrowseModal } from "@/components/project-browse-modal"
import { TaskBrowseModal } from "@/components/task-browse-modal"
import { ProjectCreateModal } from "@/components/project-create-modal"
import { TaskCreateModal } from "@/components/task-create-modal"
import type { DailyReport, Task, Project, Status } from "@/lib/types"
import { type UserSelectItem } from "@/components/ui/searchable-user-select"
import { revalidatePathsAndTags } from "@/app/actions"

export function ReportForm({
  report,
  tasks,
  projects = [],
  defaultTaskId,
  defaultPercentage,
  currentUserId,
  uniqueCategories = [],
  statuses = [],
  allUsers = [],
}: {
  report?: DailyReport
  tasks: Task[]
  projects?: Project[]
  defaultTaskId?: string
  defaultPercentage?: string
  currentUserId: string
  uniqueCategories?: string[]
  statuses?: Status[]
  allUsers?: UserSelectItem[]
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
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false)
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false)

  const projectTasks = localTasks.filter((t) => t.project_id === projectId)

  const handleProjectIdChange = (newProjId: string) => {
    setProjectId(newProjId)
    // Check if the current taskId is in the new project
    const currentTask = localTasks.find((t) => t.id === taskId)
    if (!currentTask || currentTask.project_id !== newProjId) {
      setTaskId("")
    }
  }

  const handleTaskIdChange = (val: string) => {
    setTaskId(val)
    if (!isEdit) {
      const task = localTasks.find((t) => t.id === val)
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
        const paths = ['/reports', `/reports/${report.report_id}`, `/tasks/${report.task_id}`, '/reports/dashboard']
        if (projectId) {
          paths.push(`/projects/${projectId}`, '/projects')
        }
        await revalidatePathsAndTags(
          paths,
          ['reports', 'tasks', 'task_log', 'projects', 'project_log']
        )
        router.push(`/reports`)
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
        const paths = ['/reports', `/reports/${data.report_id}`, `/tasks/${taskId}`, '/reports/dashboard']
        if (projectId) {
          paths.push(`/projects/${projectId}`, '/projects')
        }
        await revalidatePathsAndTags(
          paths,
          ['reports', 'tasks', 'task_log', 'projects', 'project_log']
        )
        router.push(`/reports`)
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
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 justify-between text-left font-normal h-10 bg-background"
                  onClick={() => setShowProjectModal(true)}
                >
                  <span className="truncate">
                    {projectId 
                      ? `${projectId} - ${localProjects.find((p) => p.project_id === projectId)?.project_name || ""}` 
                      : "Select project..."}
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0 opacity-60">▼</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateProjectModal(true)}
                  className="shrink-0 rounded-lg bg-primary/5 border-primary/20 text-primary hover:bg-primary/10 hover:text-primary h-10"
                >
                  + Project
                </Button>
              </div>
            </div>

            {/* Task Selection */}
            <div className="space-y-2">
              <Label htmlFor="task">Task *</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 justify-between text-left font-normal h-10 bg-background"
                  disabled={!projectId}
                  onClick={() => setShowTaskModal(true)}
                >
                  <span className="truncate">
                    {taskId 
                      ? `${taskId} - ${localTasks.find((t) => t.id === taskId)?.task_description || ""}` 
                      : (projectId ? "Select task..." : "Select project first")}
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0 opacity-60">▼</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateTaskModal(true)}
                  disabled={!projectId}
                  className="shrink-0 rounded-lg bg-primary/5 border-primary/20 text-primary hover:bg-primary/10 hover:text-primary h-10"
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

      <ProjectBrowseModal
        isOpen={showProjectModal}
        onClose={() => setShowProjectModal(false)}
        projects={localProjects}
        onSelect={handleProjectIdChange}
      />
      
      <TaskBrowseModal
        isOpen={showTaskModal}
        onClose={() => setShowTaskModal(false)}
        tasks={projectTasks}
        onSelect={handleTaskIdChange}
      />
      
      <ProjectCreateModal
        isOpen={showCreateProjectModal}
        onClose={() => setShowCreateProjectModal(false)}
        onSuccess={(newProject) => {
          setLocalProjects((prev) => [...prev, newProject])
          handleProjectIdChange(newProject.project_id)
        }}
        statuses={statuses}
        users={allUsers}
        currentUserId={currentUserId}
        uniqueCategories={uniqueCategories}
      />
      
      <TaskCreateModal
        isOpen={showCreateTaskModal}
        onClose={() => setShowCreateTaskModal(false)}
        onSuccess={(newTask) => {
          setLocalTasks((prev) => [...prev, newTask])
          handleTaskIdChange(newTask.id)
        }}
        statuses={statuses}
        users={allUsers}
        currentUserId={currentUserId}
        projectId={projectId}
      />
    </div>
  )
}
