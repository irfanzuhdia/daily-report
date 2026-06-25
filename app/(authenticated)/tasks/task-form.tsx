"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Save, FileText, X, Upload, Loader2 } from "lucide-react"
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
import { ProjectCreateModal } from "@/components/project-create-modal"
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
  currentUserId,
  uniqueCategories = [],
}: {
  task?: Task
  projects: Project[]
  statuses: Status[]
  defaultProjectId?: string
  defaultTeamUserIds?: string[]
  allUsers: { user_id: string; user_name: string; user_email: string; user_occupation: string | null }[]
  currentUserId: string
  uniqueCategories?: string[]
}) {
  const router = useRouter()
  const isEdit = !!task

  const [localProjects, setLocalProjects] = useState<Project[]>(projects)

  const [projectId, setProjectId] = useState(
    task?.project_id ?? defaultProjectId ?? ""
  )
  const [description, setDescription] = useState(task?.task_description ?? "")
  const [status, setStatus] = useState(task?.task_status ?? "NS")
  const [percentage, setPercentage] = useState(
    task?.task_latest_percentage ?? "0"
  )

  const [showProjectModal, setShowProjectModal] = useState(false)
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false)
  
  const [saving, setSaving] = useState(false)
  const [teamUserIds, setTeamUserIds] = useState<string[]>(defaultTeamUserIds ?? [])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [taskFile, setTaskFile] = useState<string | null>(task?.task_file ?? null)
  const [fileName, setFileName] = useState<string | null>(
    task?.task_file ? extractFileName(task.task_file) : null
  )
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [additionalLink, setAdditionalLink] = useState(task?.additional_link ?? "")

  function extractFileName(url: string): string {
    try {
      const urlObj = new URL(url)
      const params = new URLSearchParams(urlObj.search)
      return params.get("name") || url.split("/").pop() || url
    } catch {
      return url.length > 30 ? url.slice(0, 30) + "..." : url
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadError(null)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const res = await fetch("/api/upload", { method: "POST", body: formData })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Upload failed")
      }
      const data = await res.json()
      setTaskFile(data.webViewLink)
      setFileName(data.fileName)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Upload failed"
      setUploadError(message)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const handleRemoveFile = () => {
    setTaskFile(null)
    setFileName(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

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
        task_file: taskFile || undefined,
        additional_link: additionalLink || undefined,
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

            {/* File Upload Section */}
            <div className="space-y-2">
              <Label>Task File</Label>
              <p className="text-xs text-muted-foreground">
                Upload supporting documents (PDF, Excel, Word, images, ZIP). Max 50MB.
              </p>

              {fileName ? (
                <div className="flex items-center gap-3 rounded-xl border p-3">
                  <FileText className="h-5 w-5 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{fileName}</p>
                    {taskFile && (
                      <a
                        href={taskFile}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline"
                      >
                        View file
                      </a>
                    )}
                  </div>
                  <span className="inline-flex items-center rounded-md bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground transition-colors hover:bg-secondary/80">
                    Uploaded
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={handleRemoveFile}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.xlsx,.xls,.docx,.doc,.zip,.png,.jpg,.jpeg,.gif,.webp"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Choose File
                      </>
                    )}
                  </Button>
                </div>
              )}

              {uploadError && (
                <p className="text-xs text-destructive">{uploadError}</p>
              )}
            </div>

            {/* Additional Link */}
            <div className="space-y-2">
              <Label htmlFor="additionalLink">Additional Link</Label>
              <Input
                id="additionalLink"
                value={additionalLink}
                onChange={(e) => setAdditionalLink(e.target.value)}
                placeholder="Enter additional link (e.g. Google Drive, Figma, Notion)"
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
            disabled={saving || !description.trim() || !projectId}
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
        onSelect={(id) => setProjectId(id)}
      />

      <ProjectCreateModal
        isOpen={showCreateProjectModal}
        onClose={() => setShowCreateProjectModal(false)}
        onSuccess={(newProject) => {
          setLocalProjects((prev) => [...prev, newProject])
          setProjectId(newProject.project_id)
        }}
        statuses={statuses}
        users={allUsers}
        currentUserId={currentUserId}
        uniqueCategories={uniqueCategories}
      />
    </div>
  )
}
