"use client"

import { useState, useRef } from "react"
import { X, Upload, FileText, Loader2 } from "lucide-react"
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
import { SearchableUserSelect, getSelectableUsers, type UserSelectItem } from "@/components/ui/searchable-user-select"
import type { Project, Status } from "@/lib/types"

interface ProjectCreateModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (newProject: Project) => void
  statuses: Status[]
  users: UserSelectItem[]
  currentUserId: string
  uniqueCategories: string[]
}

const getLocalYMD = (d: Date) => {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function ProjectCreateModal({
  isOpen,
  onClose,
  onSuccess,
  statuses,
  users,
  currentUserId,
  uniqueCategories = [],
}: ProjectCreateModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  
  const today = new Date()
  const nextWeek = new Date()
  nextWeek.setDate(nextWeek.getDate() + 7)
  
  const [startDate, setStartDate] = useState(getLocalYMD(today))
  const [endDate, setEndDate] = useState(getLocalYMD(nextWeek))
  const [status, setStatus] = useState("NS")
  const [category, setCategory] = useState("")
  const [projectFile, setProjectFile] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [additionalLink, setAdditionalLink] = useState("")
  const [teamUserIds, setTeamUserIds] = useState<string[]>([currentUserId])
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  if (!isOpen) return null

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
      setProjectFile(data.webViewLink)
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
    setProjectFile(null)
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
    if (!name.trim() || !startDate || !endDate || saving) return
    setSaving(true)
    setSaveError(null)

    try {
      const payload = {
        project_name: name.trim(),
        project_description: description.trim() || undefined,
        project_start_date_plan: startDate || undefined,
        project_end_date_plan: endDate || undefined,
        project_status: status,
        project_file: projectFile || undefined,
        additional_link: additionalLink.trim() || undefined,
        category: category.trim() || undefined,
        team_user_ids: teamUserIds,
      }

      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to create project" }))
        throw new Error(err.error || "Failed to create project")
      }

      const newProject = await res.json()
      onSuccess(newProject)
      
      // Reset form
      setName("")
      setDescription("")
      setStartDate(getLocalYMD(today))
      setEndDate(getLocalYMD(nextWeek))
      setStatus("NS")
      setCategory("")
      setProjectFile(null)
      setFileName(null)
      setAdditionalLink("")
      setTeamUserIds([currentUserId])
      onClose()
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Failed to create project"
      setSaveError(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-card text-card-foreground w-full max-w-lg rounded-2xl border shadow-lg overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center px-6 py-4 border-b shrink-0">
          <div>
            <h3 className="font-bold text-lg text-foreground">Create New Project</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Define full project settings inline</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => {
              onClose()
              setSaveError(null)
            }}
            className="h-8 w-8 rounded-lg"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
          {saveError && (
            <div className="p-3 text-xs bg-destructive/10 text-destructive rounded-lg font-medium">
              {saveError}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="modalProjName">Project Name *</Label>
            <Input
              id="modalProjName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Project Apollo"
              required
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="modalProjDesc">Description</Label>
            <Textarea
              id="modalProjDesc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter project description..."
              rows={3}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="modalProjStatus">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="modalProjStatus">
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
              <Label htmlFor="modalProjCategory">Category</Label>
              <Input
                id="modalProjCategory"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Frontend, Backend"
                list="modal-project-categories"
              />
              <datalist id="modal-project-categories">
                {uniqueCategories.map((cat) => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="grid gap-4 grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="modalProjStart">Start Date *</Label>
              <Input
                id="modalProjStart"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="modalProjEnd">End Date *</Label>
              <Input
                id="modalProjEnd"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Project File Upload */}
          <div className="space-y-2">
            <Label>Project Attachment</Label>
            <div className="flex flex-col gap-2 rounded-xl border border-dashed p-4 text-center">
              {projectFile ? (
                <div className="flex items-center justify-between rounded-lg border bg-muted/50 p-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 shrink-0 text-primary" />
                    <span className="text-xs font-medium truncate max-w-[220px]">
                      {fileName || "Project file"}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={handleRemoveFile}
                    className="h-7 w-7 text-destructive"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    className="hidden"
                    accept="image/*,application/pdf,application/zip,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                    className="h-8 text-xs text-muted-foreground hover:text-foreground"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-1.5 h-3.5 w-3.5" />
                        Upload Project Document
                      </>
                    )}
                  </Button>
                  <p className="text-[10px] text-muted-foreground">PDF, Office, Images, ZIP up to 10MB</p>
                </div>
              )}
              {uploadError && (
                <p className="text-[10px] font-medium text-destructive mt-1">{uploadError}</p>
              )}
            </div>
          </div>

          {/* Additional Link */}
          <div className="space-y-2">
            <Label htmlFor="modalProjLink">Additional Link</Label>
            <Input
              id="modalProjLink"
              type="url"
              value={additionalLink}
              onChange={(e) => setAdditionalLink(e.target.value)}
              placeholder="https://example.com/project-docs"
            />
          </div>

          {/* Project Team Members Selector */}
          <div className="space-y-2 pt-2 border-t">
            <Label>Project Team Assignment</Label>
            <SearchableUserSelect
              allUsers={getSelectableUsers(currentUserId, users)}
              selectedUserIds={teamUserIds}
              onAddUser={addTeamMember}
              onRemoveUser={removeTeamMember}
              placeholder="Assign person..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onClose()
                setSaveError(null)
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !name.trim()}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
  )
}
