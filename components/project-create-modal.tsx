"use client"

import { useState, useRef, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
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
import { projectSchema, type ProjectInput } from "@/lib/validation/schemas"

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
  
  const today = new Date()
  const nextWeek = new Date()
  nextWeek.setDate(nextWeek.getDate() + 7)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProjectInput>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      project_name: "",
      project_description: "",
      project_start_date_plan: getLocalYMD(today),
      project_end_date_plan: getLocalYMD(nextWeek),
      project_status: "NS",
      category: "",
      additional_link: "",
      team_user_ids: [currentUserId],
      project_file: "",
    },
  })

  // Watch custom controlled fields
  const status = watch("project_status")
  const teamUserIds = watch("team_user_ids") || []
  const projectFile = watch("project_file")

  const [fileName, setFileName] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      reset({
        project_name: "",
        project_description: "",
        project_start_date_plan: getLocalYMD(today),
        project_end_date_plan: getLocalYMD(nextWeek),
        project_status: "NS",
        category: "",
        additional_link: "",
        team_user_ids: [currentUserId],
        project_file: "",
      })
      setFileName(null)
      setSaveError(null)
      setUploadError(null)
    }
  }, [isOpen, reset, currentUserId])

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
      setValue("project_file", data.webViewLink)
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
    setValue("project_file", "")
    setFileName(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const addTeamMember = (userId: string) => {
    if (!teamUserIds.includes(userId)) {
      setValue("team_user_ids", [...teamUserIds, userId])
    }
  }

  const removeTeamMember = (userId: string) => {
    setValue("team_user_ids", teamUserIds.filter((id) => id !== userId))
  }

  const onSubmit = async (data: ProjectInput) => {
    setSaveError(null)
    try {
      const payload = {
        ...data,
        project_description: data.project_description || undefined,
        additional_link: data.additional_link || undefined,
        category: data.category || undefined,
        project_file: data.project_file || undefined,
      }

      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to create project" }))
        // Handle Zod server-side errors
        if (err.errors) {
          throw new Error(err.errors.map((e: any) => e.message).join(", "))
        }
        throw new Error(err.error || "Failed to create project")
      }

      const newProject = await res.json()
      onSuccess(newProject)
      onClose()
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Failed to create project"
      setSaveError(msg)
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

        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
          {saveError && (
            <div className="p-3 text-xs bg-destructive/10 text-destructive rounded-lg font-medium">
              {saveError}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="modalProjName">Project Name *</Label>
            <Input
              id="modalProjName"
              {...register("project_name")}
              placeholder="e.g. Project Apollo"
              autoFocus
              className={errors.project_name ? "border-destructive focus-visible:ring-destructive" : ""}
            />
            {errors.project_name && <p className="text-[10px] text-destructive">{errors.project_name.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="modalProjDesc">Description</Label>
            <Textarea
              id="modalProjDesc"
              {...register("project_description")}
              placeholder="Enter project description..."
              rows={3}
              className={errors.project_description ? "border-destructive focus-visible:ring-destructive" : ""}
            />
            {errors.project_description && <p className="text-[10px] text-destructive">{errors.project_description.message}</p>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="modalProjStatus">Status</Label>
              <Select 
                value={status} 
                onValueChange={(val) => setValue("project_status", val as any)}
              >
                <SelectTrigger id="modalProjStatus" className={errors.project_status ? "border-destructive" : ""}>
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
              {errors.project_status && <p className="text-[10px] text-destructive">{errors.project_status.message}</p>}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="modalProjCategory">Category</Label>
              <Input
                id="modalProjCategory"
                {...register("category")}
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
                {...register("project_start_date_plan")}
                className={errors.project_start_date_plan ? "border-destructive focus-visible:ring-destructive" : ""}
              />
              {errors.project_start_date_plan && <p className="text-[10px] text-destructive">{errors.project_start_date_plan.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="modalProjEnd">End Date *</Label>
              <Input
                id="modalProjEnd"
                type="date"
                {...register("project_end_date_plan")}
                className={errors.project_end_date_plan ? "border-destructive focus-visible:ring-destructive" : ""}
              />
              {errors.project_end_date_plan && <p className="text-[10px] text-destructive">{errors.project_end_date_plan.message}</p>}
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
              {...register("additional_link")}
              placeholder="https://example.com/project-docs"
              className={errors.additional_link ? "border-destructive focus-visible:ring-destructive" : ""}
            />
            {errors.additional_link && <p className="text-[10px] text-destructive">{errors.additional_link.message}</p>}
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
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
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
