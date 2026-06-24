"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Plus, ListTodo, Pencil, FileDown, Users, X, History, Loader2, ExternalLink } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Project, Task, Status, EnrichedProjectLog } from "@/lib/types"
import { formatDate, formatDateTime } from "@/lib/format"
import { revalidatePathsAndTags } from "@/app/actions"
import { FileSection } from "@/components/file-section"
import { CommentsSection } from "@/components/comments-section"
import { SearchableUserSelect } from "@/components/ui/searchable-user-select"

const statusVariant: Record<string, "default" | "success" | "warning" | "destructive" | "secondary"> = {
  NS: "secondary",
  OP: "warning",
  D: "success",
  C: "success",
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
  projectLogs,
  allUsers,
  currentUserId,
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
  projectLogs: EnrichedProjectLog[]
  allUsers: { user_id: string; user_name: string; user_email: string; user_occupation: string | null }[]
  currentUserId: string
}) {
  const router = useRouter()
  const [teamMembers, setTeamMembers] = useState(initialTeamMembers)
  const [selectedNewUserIds, setSelectedNewUserIds] = useState<string[]>([])
  const [adding, setAdding] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [currentStatus, setCurrentStatus] = useState(autoProjectStatus)

  const isProjectCreator = project.created_by === currentUserId
  const isProjectTeamMember = teamMembers.some((m) => m.user_id === currentUserId)
  const hasEditPermission = isProjectCreator || isProjectTeamMember

  const availableUsers = allUsers.filter(
    (u) => !teamMembers.some((m) => m.user_id === u.user_id)
  )

  const handleSaveNewMembers = async () => {
    if (selectedNewUserIds.length === 0) return
    setAdding(true)
    try {
      const res = await fetch(`/api/projects/${project.project_id}/team`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_ids: selectedNewUserIds }),
      })
      if (res.ok) {
        const newMembers = selectedNewUserIds.map((uid) => {
          const user = allUsers.find((u) => u.user_id === uid)
          return {
            user_id: uid,
            user_name: user?.user_name || user?.user_email || uid,
            user_email: user?.user_email || '',
            user_occupation: user?.user_occupation || null,
          }
        })
        setTeamMembers([...teamMembers, ...newMembers])
        await revalidatePathsAndTags(
          [`/projects/${project.project_id}`],
          ['project_team', 'project_log']
        )
        router.refresh()
        setSelectedNewUserIds([])
      }
    } catch (error) {
      console.error("Failed to add team members:", error)
    } finally {
      setAdding(false)
    }
  }

  const handleRemoveMember = async (userId: string) => {
    setRemovingId(userId)
    try {
      const res = await fetch(`/api/projects/${project.project_id}/team`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      })
      if (res.ok) {
        setTeamMembers(teamMembers.filter((m) => m.user_id !== userId))
        await revalidatePathsAndTags(
          [`/projects/${project.project_id}`],
          ['project_team', 'project_log']
        )
        router.refresh()
      }
    } catch (error) {
      console.error("Failed to remove team member:", error)
    } finally {
      setRemovingId(null)
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    if (newStatus === currentStatus) return
    setUpdatingStatus(true)
    try {
      const res = await fetch(`/api/projects/${project.project_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_status: newStatus }),
      })
      if (res.ok) {
        setCurrentStatus(newStatus)
        await revalidatePathsAndTags(
          [`/projects/${project.project_id}`, '/projects', '/dashboard'],
          ['projects', 'project_log']
        )
        router.refresh()
      }
    } catch (error) {
      console.error("Failed to update project status:", error)
    } finally {
      setUpdatingStatus(false)
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
                <div className="relative">
                  {updatingStatus && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-md z-10">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    </div>
                  )}
                  {!hasEditPermission ? (
                    <Badge variant={statusVariant[currentStatus] || "default"}>
                      {statuses.find((s) => s.id === currentStatus)?.name || currentStatus}
                    </Badge>
                  ) : (
                    <Select value={currentStatus} onValueChange={handleStatusChange}>
                      <SelectTrigger className="h-7 text-xs w-[130px] px-2 py-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {statuses.map((s) => (
                          <SelectItem key={s.id} value={s.id} className="text-xs">
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
              <p className="text-muted-foreground">
                {project.project_description || "No description"}
              </p>
            </div>
            {hasEditPermission && (
              <Link href={`/projects/${project.project_id}/edit`}>
                <Button variant="outline" size="sm">
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </Button>
              </Link>
            )}
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
            <div>
              <p className="text-xs font-medium text-muted-foreground">Category</p>
              {project.category ? (
                <Badge variant="outline" className="mt-1 bg-primary/10 text-primary border-primary/20">
                  {project.category}
                </Badge>
              ) : (
                <p className="text-sm text-muted-foreground">—</p>
              )}
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

          {project.additional_link && (
            <div className="mt-4 border-t pt-4">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Additional Link</p>
              <a
                href={
                  /^https?:\/\//i.test(project.additional_link)
                    ? project.additional_link
                    : `https://${project.additional_link}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-muted transition-colors text-primary font-medium"
              >
                <ExternalLink className="h-4 w-4" />
                <span>{project.additional_link}</span>
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Project Team */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4 border-b">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Project Team
            <Badge variant="secondary">{teamMembers.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          {/* Add member picker */}
          {hasEditPermission && availableUsers.length > 0 && (
            <div className="space-y-3 p-3 rounded-xl border bg-muted/20">
              <SearchableUserSelect
                allUsers={availableUsers}
                selectedUserIds={selectedNewUserIds}
                onAddUser={(uid) => setSelectedNewUserIds([...selectedNewUserIds, uid])}
                onRemoveUser={(uid) => setSelectedNewUserIds(selectedNewUserIds.filter(id => id !== uid))}
                placeholder="Assign project team members..."
              />
              {selectedNewUserIds.length > 0 && (
                <div className="flex justify-end gap-2 pt-2 border-t border-muted animate-in fade-in duration-200">
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => setSelectedNewUserIds([])}
                    disabled={adding}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="xs"
                    onClick={handleSaveNewMembers}
                    disabled={adding}
                  >
                    {adding ? (
                      <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      "Save Team"
                    )}
                  </Button>
                </div>
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
                  {removingId === member.user_id ? (
                     <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
                   ) : (
                     hasEditPermission && (
                       <button
                         type="button"
                         onClick={() => handleRemoveMember(member.user_id)}
                         className="rounded-full p-1 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                         title="Remove from team"
                         disabled={removingId !== null || adding}
                       >
                         <X className="h-3.5 w-3.5" />
                       </button>
                     )
                   )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tasks */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Tasks</h2>
        {hasEditPermission && (
          <Link href={`/tasks/new?project_id=${project.project_id}`}>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              New Task
            </Button>
          </Link>
        )}
      </div>

      {tasks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ListTodo className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <p className="text-muted-foreground">No tasks yet</p>
            {hasEditPermission && (
              <Link href={`/tasks/new?project_id=${project.project_id}`} className="mt-4">
                <Button variant="outline" size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Create first task
                </Button>
              </Link>
            )}
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
                    {statuses.find((s) => s.id === task.task_status)?.name ?? task.task_status ?? "Not Started"}
                  </Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Files Attachments */}
      <FileSection projectId={project.project_id} />

      {/* Comments Section */}
      <CommentsSection projectId={project.project_id} allUsers={allUsers} />

      {/* Project Activity Log */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <History className="h-4 w-4 text-primary" />
            Project Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {projectLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activities logged yet.</p>
          ) : (
            <div className="relative pl-6 border-l border-muted space-y-6">
              {projectLogs
                .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
                .map((log: EnrichedProjectLog, index) => {
                  const actor = log.createdByName || "System"
                  let actionText = ""

                  switch (log.project_status_old) {
                    case "CREATED":
                      actionText = "created the project"
                      break
                    case "UPDATED":
                      actionText = "updated project details"
                      break
                    case "TEAM_ADD":
                      actionText = `added ${log.targetUserName || log.project_status_new || "a user"} to the team`
                      break
                    case "TEAM_REMOVE":
                      actionText = `removed ${log.targetUserName || log.project_status_new || "a user"} from the team`
                      break
                    case "FILE_UPLOAD":
                      actionText = "uploaded file: "
                      break
                    case "RESTORED":
                      actionText = "restored the project from trash"
                      break
                    default: {
                      const oldStatus = statuses.find(s => s.id === log.project_status_old)?.name ?? log.project_status_old ?? "Unknown"
                      const newStatus = statuses.find(s => s.id === log.project_status_new)?.name ?? log.project_status_new ?? "Unknown"
                      actionText = `changed status from "${oldStatus}" to "${newStatus}"`
                    }
                  }

                  return (
                    <div key={`${log.id}-${index}`} className="relative">
                      {/* Timeline dot */}
                      <span className="absolute -left-[31px] top-1.5 flex h-4 w-4 items-center justify-center rounded-full border bg-background">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                      </span>
                      <div className="flex flex-col gap-0.5">
                        <p className="text-sm text-foreground">
                          <span className="font-semibold">{actor}</span>{" "}
                          {log.project_status_old === "FILE_UPLOAD" ? (
                            <>
                              {actionText}
                              <a
                                href={log.project_status_new ?? "#"}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-medium text-primary hover:underline"
                              >
                                {log.project_status_new ? decodeURIComponent(log.project_status_new.split("/").pop()?.split("?")[0] || "file") : "View File"}
                              </a>
                            </>
                          ) : (
                            actionText
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(log.created_at)}
                        </p>
                      </div>
                    </div>
                  )
                })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
