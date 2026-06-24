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
  const [projectSearch, setProjectSearch] = useState("")

  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false)
  const [newProjectName, setNewProjectName] = useState("")
  const [newProjectDesc, setNewProjectDesc] = useState("")
  const [newProjectCategory, setNewProjectCategory] = useState("")
  const [newProjectStart, setNewProjectStart] = useState("")
  const [newProjectEnd, setNewProjectEnd] = useState("")
  const [projectCreating, setProjectCreating] = useState(false)
  const [projectCreateError, setProjectCreateError] = useState<string | null>(null)

  const filteredProjects = localProjects.filter((p) => {
    const q = projectSearch.toLowerCase()
    return (
      p.project_id.toLowerCase().includes(q) ||
      (p.project_name || "").toLowerCase().includes(q) ||
      (p.project_description || "").toLowerCase().includes(q)
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
                <div className="flex-1">
                  <Select value={projectId} onValueChange={setProjectId} required>
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
                          setProjectId(p.project_id)
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
                      category: newProjectCategory.trim() || undefined,
                      team_user_ids: [currentUserId],
                    }),
                  })

                  if (!res.ok) {
                    const err = await res.json().catch(() => ({ error: "Failed to create project" }))
                    throw new Error(err.error || "Failed to create project")
                  }

                  const newProject = await res.json()
                  setLocalProjects((prev) => [...prev, newProject])
                  setProjectId(newProject.project_id)
                  
                  // Reset form
                  setNewProjectName("")
                  setNewProjectDesc("")
                  setNewProjectCategory("")
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
              
              <div className="space-y-2">
                <Label htmlFor="newProjCategory">Category</Label>
                <Input
                  id="newProjCategory"
                  value={newProjectCategory}
                  onChange={(e) => setNewProjectCategory(e.target.value)}
                  placeholder="e.g. Frontend, Backend, Design, Marketing"
                  list="modal-project-categories"
                />
                <datalist id="modal-project-categories">
                  {uniqueCategories.map((cat) => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
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
    </div>
  )
}
