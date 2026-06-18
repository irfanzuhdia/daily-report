"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, Plus, Pencil, FileText, Users, UserPlus, X } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { Task, Project, DailyReport, Status } from "@/lib/types"
import { formatDate, formatDateTime } from "@/lib/format"

const statusVariant: Record<string, "default" | "success" | "warning" | "destructive" | "secondary"> = {
  NS: "secondary",
  OP: "warning",
  D: "success",
  H: "destructive",
  CC: "destructive",
}

export function TaskDetailClient({
  task,
  project,
  reports,
  statuses,
  createdByName,
  updatedByName,
  userMap,
  teamMembers: initialTeamMembers,
  allUsers,
}: {
  task: Task
  project: Project | null
  reports: DailyReport[]
  statuses: Status[]
  createdByName: string
  updatedByName: string
  userMap: Record<string, string>
  teamMembers: { user_id: string; user_name: string; user_email: string; user_occupation: string | null }[]
  allUsers: { user_id: string; user_name: string; user_email: string; user_occupation: string | null }[]
}) {
  const statusName = statuses.find((s) => s.id === task.task_status)?.name ?? task.task_status
  const [teamMembers, setTeamMembers] = useState(initialTeamMembers)
  const [showAddMember, setShowAddMember] = useState(false)
  const [adding, setAdding] = useState(false)

  const availableUsers = allUsers.filter(
    (u) => !teamMembers.some((m) => m.user_id === u.user_id)
  )

  const handleAddMember = async (userId: string) => {
    setAdding(true)
    try {
      const res = await fetch(`/api/tasks/${task.id}/team`, {
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
      const res = await fetch(`/api/tasks/${task.id}/team`, {
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
            <Link href={`/tasks/${task.id}/edit`}>
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
              <p className="text-sm">{formatDateTime(task.updated_at)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Task Team */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Task Team
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

      {/* Reports */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Daily Reports</h2>
        <Link href={`/reports/new?task_id=${task.id}`}>
          <Button size="sm">
            <Plus className="mr-2 h-4 w-4" />
            New Report
          </Button>
        </Link>
      </div>

      {reports.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <p className="text-muted-foreground">No reports yet</p>
            <Link href={`/reports/new?task_id=${task.id}`} className="mt-4">
              <Button variant="outline" size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Create first report
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => (
            <Link key={report.report_id} href={`/reports/${report.report_id}`}>
              <Card className="transition-shadow hover:shadow-md">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium">{formatDate(report.date)}</p>
                      {report.total_hours && (
                        <Badge variant="secondary" className="text-xs">
                          {report.total_hours}h
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs">
                        {report.progress_percentage ?? 0}%
                      </Badge>
                    </div>
                    <p className="line-clamp-2 text-xs text-muted-foreground mt-1">
                      {report.remarks || "No remarks"}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>By: {userMap[report.user_id ?? ""] ?? report.user_id ?? "—"}</span>
                      <span>{formatDateTime(report.created_at)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
