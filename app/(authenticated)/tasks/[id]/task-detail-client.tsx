"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Plus, Pencil, FileText, Users, X, History, Loader2, FileDown, ExternalLink } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { Task, Project, DailyReport, Status, EnrichedTaskLog } from "@/lib/types"
import { formatDate, formatDateTime } from "@/lib/format"
import { revalidatePathsAndTags } from "@/app/actions"
import { FileSection } from "@/components/file-section"
import { CommentsSection } from "@/components/comments-section"
import { SearchableUserSelect, getSelectableUsers, type UserSelectItem } from "@/components/ui/searchable-user-select"
import { statusVariant } from "@/lib/status-helpers"

export function TaskDetailClient({
  task,
  project,
  reports,
  statuses,
  createdByName,
  updatedByName,
  userMap,
  teamMembers: initialTeamMembers,
  taskLogs,
  allUsers,
  currentUserId,
  projectTeamUserIds,
}: {
  task: Task
  project: Project | null
  reports: DailyReport[]
  statuses: Status[]
  createdByName: string
  updatedByName: string
  userMap: Record<string, string>
  teamMembers: { user_id: string; user_name: string; user_email: string; user_occupation: string | null }[]
  taskLogs: EnrichedTaskLog[]
  allUsers: UserSelectItem[]
  currentUserId: string
  projectTeamUserIds: string[]
}) {
  const router = useRouter()
  const statusName = statuses.find((s) => s.id === task.task_status)?.name ?? task.task_status
  const [teamMembers, setTeamMembers] = useState(initialTeamMembers)
  const [selectedNewUserIds, setSelectedNewUserIds] = useState<string[]>([])
  const [adding, setAdding] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)

  const currentUser = useMemo(() => allUsers.find((u) => u.user_id === currentUserId), [allUsers, currentUserId])
  const normOcc = currentUser?.user_occupation?.toLowerCase().replace(/\s+/g, "") ?? ""
  const isSUOrCOSU = ["superuser", "cosuperuser", "co-superuser"].includes(normOcc)
  const isHRIS = currentUser?.user_division?.toLowerCase().trim() === "hris"

  const isTaskCreator = task.created_by === currentUserId
  const isProjectCreator = project?.created_by === currentUserId
  const isTaskTeamMember = useMemo(() => teamMembers.some((m) => m.user_id === currentUserId), [teamMembers, currentUserId])
  const isProjectTeamMember = useMemo(() => projectTeamUserIds.includes(currentUserId), [projectTeamUserIds, currentUserId])
  const hasEditPermission = isTaskTeamMember || isProjectTeamMember || isTaskCreator || isProjectCreator || isSUOrCOSU || isHRIS

  const availableUsers = useMemo(() => {
    const teamSet = new Set(teamMembers.map((m) => m.user_id))
    return allUsers.filter((u) => !teamSet.has(u.user_id))
  }, [allUsers, teamMembers])

  const handleSaveNewMembers = async () => {
    if (selectedNewUserIds.length === 0) return
    setAdding(true)
    try {
      const res = await fetch(`/api/tasks/${task.id}/team`, {
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
          [`/tasks/${task.id}`],
          ['task_team', 'task_log']
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
      const res = await fetch(`/api/tasks/${task.id}/team`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      })
      if (res.ok) {
        setTeamMembers(teamMembers.filter((m) => m.user_id !== userId))
        await revalidatePathsAndTags(
          [`/tasks/${task.id}`],
          ['task_team', 'task_log']
        )
        router.refresh()
      }
    } catch (error) {
      console.error("Failed to remove team member:", error)
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/tasks">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </Link>
      </div>

      {/* Task Information */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <h1 className="text-2xl font-bold">{task.task_description}</h1>
                <Badge variant={statusVariant[task.task_status ?? "NS"] ?? "default"}>
                  {statusName}
                </Badge>
              </div>
              {project && (
                <Link
                  href={`/projects/${project.project_id}`}
                  className="text-sm text-muted-foreground hover:text-primary"
                >
                  📁 {project.project_name}
                </Link>
              )}
            </div>
            {hasEditPermission && (
              <Link href={`/tasks/${task.id}/edit`}>
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
              <p className="text-sm font-medium">{task.task_latest_percentage ?? 0}%</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Reports</p>
              <p className="text-sm font-medium">{reports.length}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total Hours</p>
              <p className="text-sm font-medium">
                {reports.reduce((sum, r) => sum + (parseFloat(r.total_hours ?? '0') || 0), 0)}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Status</p>
              <p className="text-sm font-medium">{statusName}</p>
            </div>
          </div>

          <div className="mt-4 border-t pt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Created By</p>
              <p className="text-sm">{createdByName}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Created At</p>
              <p className="text-sm">{formatDateTime(task.created_at)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Updated By</p>
              <p className="text-sm">{updatedByName}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Updated At</p>
              <p className="text-sm font-medium">{formatDateTime(task.updated_at)}</p>
            </div>
          </div>

          {task.task_file && (
            <div className="mt-4 border-t pt-4">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Attached File</p>
              <a
                href={task.task_file}
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

          {task.additional_link && (
            <div className="mt-4 border-t pt-4">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Additional Link</p>
              <a
                href={
                  /^https?:\/\//i.test(task.additional_link)
                    ? task.additional_link
                    : `https://${task.additional_link}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-muted transition-colors text-primary font-medium"
              >
                <ExternalLink className="h-4 w-4" />
                <span>{task.additional_link}</span>
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Task Team */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4 border-b">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Task Team
            <Badge variant="secondary">{teamMembers.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          {/* Add member picker */}
          {hasEditPermission && availableUsers.length > 0 && (
            <div className="space-y-3 p-3 rounded-xl border bg-muted/20">
              <SearchableUserSelect
                allUsers={getSelectableUsers(currentUserId, availableUsers)}
                selectedUserIds={selectedNewUserIds}
                onAddUser={(uid) => setSelectedNewUserIds([...selectedNewUserIds, uid])}
                onRemoveUser={(uid) => setSelectedNewUserIds(selectedNewUserIds.filter(id => id !== uid))}
                placeholder="Assign task team person..."
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
            <p className="text-sm text-muted-foreground">No team person assigned yet.</p>
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

      {/* Reports */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Daily Reports</h2>
        {hasEditPermission && (
          <Link href={`/reports/new?task_id=${task.id}`}>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              New Report
            </Button>
          </Link>
        )}
      </div>

      {reports.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <p className="text-muted-foreground">No reports yet</p>
            {hasEditPermission && (
              <Link href={`/reports/new?task_id=${task.id}`} className="mt-4">
                <Button variant="outline" size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Create first report
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => (
            <Link key={report.report_id} href={`/reports/${report.report_id}`}>
              <Card className="transition-shadow hover:shadow-md">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h4 className="text-sm font-semibold text-foreground leading-snug">
                        {report.remarks || "No remarks"}
                      </h4>
                      {report.total_hours && (
                        <Badge variant="secondary" className="text-[10px] py-0 px-1.5">
                          {report.total_hours}h
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                        {report.progress_percentage ?? 0}%
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <span>{formatDate(report.date)}</span>
                      {report.user_id && (
                        <>
                          <span>·</span>
                          <span>{userMap[report.user_id] ?? report.user_id}</span>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Files Attachments */}
      <FileSection taskId={task.id} />

      <CommentsSection 
        taskId={task.id} 
        allUsers={allUsers.map((u) => ({
          user_id: u.user_id,
          user_name: u.user_name || "No Name",
          user_email: u.user_email,
        }))} 
        teamMembers={teamMembers.map((m) => ({
          user_id: m.user_id,
          user_name: m.user_name || "No Name",
          user_email: m.user_email,
        }))}
      />

      {/* Task Activity Log */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <History className="h-4 w-4 text-primary" />
            Task Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {taskLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activities logged yet.</p>
          ) : (
            <div className="relative pl-6 border-l border-muted space-y-6">
              {taskLogs
                .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
                .map((log: EnrichedTaskLog, index) => {
                  const actor = log.createdByName || "System"
                  let actionText = ""

                  switch (log.task_status_old) {
                    case "CREATED":
                      actionText = "created the task"
                      break
                    case "UPDATED":
                      actionText = "updated task description"
                      break
                    case "TEAM_ADD":
                      actionText = `assigned ${log.targetUserName || "a user"} to the task`
                      break
                    case "TEAM_REMOVE":
                      actionText = `unassigned ${log.targetUserName || "a user"} from the task`
                      break
                    case "REPORT_SUBMIT":
                      actionText = `submitted a daily report (progress: ${log.task_status_new}%)`
                      break
                    case "RESTORED":
                      actionText = "restored the task from trash"
                      break
                    default: {
                      const oldStatus = statuses.find(s => s.id === log.task_status_old)?.name ?? log.task_status_old ?? "Unknown"
                      const newStatus = statuses.find(s => s.id === log.task_status_new)?.name ?? log.task_status_new ?? "Unknown"
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
                          <span className="font-semibold">{actor}</span> {actionText}
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
