"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Save, X, UserPlus } from "lucide-react"
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
import { Badge } from "@/components/ui/badge"
import type { Task, Project, Status } from "@/lib/types"
import { revalidatePathsAndTags } from "@/app/actions"

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
  const [showAddMember, setShowAddMember] = useState(false)

  const availableUsers = allUsers.filter((u) => !teamUserIds.includes(u.user_id))

  const addTeamMember = (userId: string) => {
    if (!teamUserIds.includes(userId)) {
      setTeamUserIds([...teamUserIds, userId])
    }
    setShowAddMember(false)
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
        await fetch(`/api/tasks/${task.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        await revalidatePathsAndTags(
          ['/tasks', `/tasks/${task.id}`, `/projects/${task.project_id}`, '/dashboard'],
          ['tasks', 'task_log', 'projects', 'project_log']
        )
        router.push(`/tasks/${task.id}`)
      } else {
        const res = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        await revalidatePathsAndTags(
          ['/tasks', `/tasks/${data.id}`, `/projects/${projectId}`, '/dashboard'],
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

              {teamUserIds.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {teamUserIds.map((uid) => {
                    const user = allUsers.find((u) => u.user_id === uid)
                    return (
                      <Badge key={uid} variant="secondary" className="gap-1 pl-2 pr-1">
                        <span className="text-xs">{user?.user_name || user?.user_email || uid}</span>
                        <button
                          type="button"
                          onClick={() => removeTeamMember(uid)}
                          className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    )
                  })}
                </div>
              )}

              {showAddMember && availableUsers.length > 0 ? (
                <div className="flex flex-wrap gap-2 p-3 rounded-xl border bg-muted/30">
                  <p className="text-xs text-muted-foreground w-full mb-1">Select a user to add:</p>
                  {availableUsers.map((u) => (
                    <Button
                      key={u.user_id}
                      type="button"
                      variant="outline"
                      size="xs"
                      onClick={() => addTeamMember(u.user_id)}
                    >
                      {u.user_name || u.user_email}
                      {u.user_occupation ? ` (${u.user_occupation})` : ""}
                    </Button>
                  ))}
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => setShowAddMember(false)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddMember(true)}
                  disabled={availableUsers.length === 0}
                >
                  <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                  Add Team Member
                </Button>
              )}
              {availableUsers.length === 0 && teamUserIds.length > 0 && (
                <p className="text-xs text-muted-foreground">All users are already assigned.</p>
              )}
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
