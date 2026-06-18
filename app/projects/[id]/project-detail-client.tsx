"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, Plus, ListTodo, Pencil, FileDown, Users, UserPlus, X } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { Project, Task, Status } from "@/lib/types"
import { formatDate, formatDateTime } from "@/lib/format"

const statusVariant: Record<string, "default" | "success" | "warning" | "destructive" | "secondary"> = {
  NS: "secondary",
  OP: "warning",
  D: "success",
  H: "destructive",
  CC: "destructive",
}

export function ProjectDetailClient({
  project,
  tasks,
  statuses,
  taskReports,
  taskHours,
  projectTotalHours,
  projectProgress,
  autoProjectStatus,
  taskProgress,
  createdByName,
  updatedByName,
  teamMembers: initialTeamMembers,
  allUsers,
}: {
  project: Project
  tasks: Task[]
  statuses: Status[]
  taskReports: Record<string, number>
  taskHours: Record<string, number>
  projectTotalHours: number
  projectProgress: number
  autoProjectStatus: string
  taskProgress: Record<string, number>
  createdByName: string
  updatedByName: string
  teamMembers: { user_id: string; user_name: string; user_email: string; user_occupation: string | null }[]
  allUsers: { user_id: string; user_name: string; user_email: string; user_occupation: string | null }[]
}) {
  const statusName = statuses.find((s) => s.id === autoProjectStatus)?.name ?? autoProjectStatus
  const [teamMembers, setTeamMembers] = useState(initialTeamMembers)
  const [showAddMember, setShowAddMember] = useState(false)
  const [adding, setAdding] = useState(false)

  const availableUsers = allUsers.filter(
    (u) => !teamMembers.some((m) => m.user_id === u.user_id)
  )

  const handleAddMember = async (userId: string) => {
    setAdding(true)
    try {
      const res = await fetch(`/api/projects/${project.project_id}/team`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      })
      if (res.ok) {
        const user = allUsers.find((u) => u.user_id === userId)
        if (user) {
          setTeamMembers([
            ...teamMembers,
            {
              user_id: user.user_id,
              user_name: user.user_name || user.user_email,
              user_email: user.user_email,
              user_occupation: user.user_occupation,
            },
          ])
        }
        setShowAddMember(false)
      }
    } catch (error) {
      console.error("Failed to add team member:", error)
    } finally {
      setAdding(false)
    }
  }

  const handleRemoveMember = async (userId: string) => {
    try {
      const res = await fetch(`/api/projects/${project.project_id}/team`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      })
      if (res.ok) {
        setTeamMembers(teamMembers.filter((m) => m.user_id !== userId))
      }
    } catch (error) {
      console.error("Failed to remove team member:", error)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/projects">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </Link>
      </div>

      {/* Project Information */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <h1 className="text-2xl font-bold">{project.project_name}</h1>
                <Badge variant={statusVariant[autoProjectStatus ?? "NS"] ?? "default"}>
                  {statusName}
                </Badge>
              </div>
              <p className="text-muted-foreground">
                {project.project_description || "No description"}
              </p>
            </div>
            <Link href={`/projects/${project.project_id}/edit`}>
              <Button variant="outline" size="sm">
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Progress</p>
              <p className="text-sm font-medium">{projectProgress}%</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Tasks</p>
              <p className="text-sm">{tasks.length}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total Hours</p>
              <p className="text-sm font-medium">{projectTotalHours}h</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total Reports</p>
              <p className="text-sm">
                {Object.values(taskReports).reduce((a, b) => a + b, 0)}
              </p>
            </div>
          </div>

          <div className="mt-4 border-t pt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Start Date</p>
              <p className="text-sm">{project.project_start_date_plan ? formatDate(project.project_start_date_plan) : "—"}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">End Date</p>
              <p className="text-sm">{project.project_end_date_plan ? formatDate(project.project_end_date_plan) : "—"}</p>
            </div>
          </div>

          <div className="mt-4 border-t pt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Created By</p>
              <p className="text-sm">{createdByName}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Created At</p>
              <p className="text-sm">{formatDateTime(project.created_at)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Updated By</p>
              <p className="text-sm">{updatedByName}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Updated At</p>
              <p className="text-sm">{formatDateTime(project.updated_at)}</p>
            </div>
          </div>

          {project.project_file && (
            <div className="mt-4 border-t pt-4">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Attached File</p>
              <a
                href={project.project_file}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-muted transition-colors"
              >
                <FileDown className="h-4 w-4 text-primary" />
                <span>View / Download File</span>
                <Badge variant="outline" className="ml-1">Drive</Badge>
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Project Team */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Project Team
            <Badge variant="secondary">{teamMembers.length}</Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            {showAddMember ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowAddMember(false)} disabled={adding}>
                <X className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button type="button" variant="outline" size="sm" onClick={() => setShowAddMember(true)} disabled={availableUsers.length === 0}>
                <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                Add
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Add member picker */}
          {showAddMember && availableUsers.length > 0 && (
            <div className="flex flex-wrap gap-2 p-3 rounded-xl border bg-muted/30">
              {adding ? (
                <p className="text-xs text-muted-foreground py-1">Adding...</p>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground w-full mb-1">Select a user to add:</p>
                  {availableUsers.map((u) => (
                    <Button
                      key={u.user_id}
                      type="button"
                      variant="outline"
                      size="xs"
                      onClick={() => handleAddMember(u.user_id)}
                    >
                      {u.user_name || u.user_email}
                      {u.user_occupation ? ` (${u.user_occupation})` : ""}
                    </Button>
                  ))}
                </>
              )}
            </div>
          )}

          {teamMembers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No team members assigned yet.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {teamMembers.map((member) => (
                <div
                  key={member.user_id}
                  className="flex items-center gap-3 rounded-xl border p-3"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary shrink-0">
                    {member.user_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{member.user_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{member.user_email}</p>
                    {member.user_occupation && (
                      <p className="text-xs text-muted-foreground truncate">{member.user_occupation}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveMember(member.user_id)}
                    className="rounded-full p-1 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    title="Remove from team"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tasks */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Tasks</h2>
        <Link href={`/tasks/new?project_id=${project.project_id}`}>
          <Button size="sm">
            <Plus className="mr-2 h-4 w-4" />
            New Task
          </Button>
        </Link>
      </div>

      {tasks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ListTodo className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <p className="text-muted-foreground">No tasks yet</p>
            <Link href={`/tasks/new?project_id=${project.project_id}`} className="mt-4">
              <Button variant="outline" size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Create first task
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <Link key={task.id} href={`/tasks/${task.id}`}>
              <Card className="transition-shadow hover:shadow-md">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {task.task_description}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {taskReports[task.id] ?? 0} reports •{" "}
                      {taskProgress[task.id] ?? 0}% complete
                      {(taskHours[task.id] ?? 0) > 0 && (
                        <> • <span className="font-medium">{taskHours[task.id]}h</span></>
                      )}
                    </p>
                  </div>
                  <Badge
                    variant={statusVariant[task.task_status ?? "NS"] ?? "default"}
                    className="ml-3 shrink-0"
                  >
                    {task.task_status ?? "NS"}
                  </Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
