"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Save } from "lucide-react"
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
import type { Task, Project, Status } from "@/lib/types"
import { revalidatePathsAndTags } from "@/app/actions"
import { SearchableUserSelect } from "@/components/ui/searchable-user-select"

export function TaskForm({
  task,
  projects,
  statuses,
  defaultProjectId,
  defaultTeamUserIds,
  allUsers,
}: {
  task?: Task
  projects: Project[]
  statuses: Status[]
  defaultProjectId?: string
  defaultTeamUserIds?: string[]
  allUsers: { user_id: string; user_name: string; user_email: string; user_occupation: string | null }[]
}) {
  const router = useRouter()
  const isEdit = !!task

  const [projectId, setProjectId] = useState(
    task?.project_id ?? defaultProjectId ?? ""
  )
  const [description, setDescription] = useState(task?.task_description ?? "")
  const [status, setStatus] = useState(task?.task_status ?? "NS")
  const [percentage, setPercentage] = useState(
    task?.task_latest_percentage ?? "0"
  )
  const [saving, setSaving] = useState(false)
  const [teamUserIds, setTeamUserIds] = useState<string[]>(defaultTeamUserIds ?? [])

  const addTeamMember = (userId: string) => {
    if (!teamUserIds.includes(userId)) {
      setTeamUserIds([...teamUserIds, userId])
    }
  }

  const removeTeamMember = (userId: string) => {
    setTeamUserIds(teamUserIds.filter((id) => id !== userId))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      const payload = {
        project_id: projectId,
        task_description: description,
        task_status: status,
        task_latest_percentage: percentage,
        task_user_ids: teamUserIds,
      }

      if (isEdit && task) {
        const res = await fetch(`/api/tasks/${task.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Unknown error' }))
          throw new Error(err.error || `Update failed (${res.status})`)
        }
        await revalidatePathsAndTags(
          ['/tasks', `/tasks/${task.id}`, `/projects/${task.project_id}`, '/projects', '/dashboard'],
          ['tasks', 'task_log', 'projects', 'project_log']
        )
        router.push(`/tasks/${task.id}`)
      } else {
        const res = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Unknown error' }))
          throw new Error(err.error || `Create failed (${res.status})`)
        }
        const data = await res.json()
        await revalidatePathsAndTags(
          ['/tasks', `/tasks/${data.id}`, `/projects/${projectId}`, '/projects', '/dashboard'],
          ['tasks', 'task_log', 'projects', 'project_log']
        )
        router.push(`/tasks/${data.id}`)
      }
      router.refresh()
    } catch (error) {
      console.error("Failed to save task:", error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href={isEdit ? `/tasks/${task.id}` : "/tasks"}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">
          {isEdit ? "Edit Task" : "New Task"}
        </h1>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Task Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isEdit && (
              <div className="space-y-2">
                <Label htmlFor="project">Project *</Label>
                <Select value={projectId} onValueChange={setProjectId} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.project_id} value={p.project_id}>
                        {p.project_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter task description"
                rows={4}
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {statuses.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="percentage">Progress (%)</Label>
                <Input
                  id="percentage"
                  type="number"
                  min="0"
                  max="100"
                  value={percentage}
                  onChange={(e) => setPercentage(e.target.value)}
                />
              </div>
            </div>

            {/* Task Team Assignment */}
            <div className="space-y-2">
              <Label>Task Team</Label>
              <p className="text-xs text-muted-foreground">
                Assign people to this task. They will see it in their &quot;My View&quot;.
                {isEdit && " Inherited from the project team."}
              </p>

              <SearchableUserSelect
                allUsers={allUsers}
                selectedUserIds={teamUserIds}
                onAddUser={addTeamMember}
                onRemoveUser={removeTeamMember}
                placeholder="Add Team Member"
              />
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 flex justify-end gap-3">
          <Link href={isEdit ? `/tasks/${task.id}` : "/tasks"}>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
          <Button
            type="submit"
            disabled={saving || !description.trim() || (!isEdit && !projectId)}
          >
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Saving..." : isEdit ? "Update" : "Create"}
          </Button>
        </div>
      </form>
    </div>
  )
}
