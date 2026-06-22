"use client";

import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Paperclip,
  FileText,
  FileSpreadsheet,
  FileImage,
  FileArchive,
  File,
  Trash2,
  Eye,
  Loader2,
  UploadCloud,
  X,
  AlertCircle,
  Link2,
} from "lucide-react";
import { formatDateTime } from "@/lib/format";

interface FileRecord {
  id: string;
  project_id: string | null;
  task_id: string | null;
  report_id: string | null;
  file_url: string;
  file_description: string | null;
  created_by: string | null;
  created_at: string | null;
  created_by_name?: string;
}

interface FileSectionProps {
  projectId?: string;
  taskId?: string;
  reportId?: string;
}

export function FileSection({ projectId, taskId, reportId }: FileSectionProps) {
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileDescription, setFileDescription] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadType, setUploadType] = useState<"file" | "link">("file");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkTitle, setLinkTitle] = useState("");

  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    let active = true;
    const load = async () => {
      let url = "/api/files";
      if (projectId) url += `?project_id=${projectId}`;
      else if (taskId) url += `?task_id=${taskId}`;
      else if (reportId) url += `?report_id=${reportId}`;

      try {
        const res = await fetch(url);
        if (res.ok && active) {
          const data = await res.json();
          setFiles(data);
        }
      } catch (err) {
        console.error("Failed to fetch files:", err);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [projectId, taskId, reportId, refreshTrigger]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
      setError(null);
    }
  };

  const clearSelection = () => {
    setSelectedFile(null);
    setFileDescription("");
    setLinkUrl("");
    setLinkTitle("");
    const fileInput = document.getElementById("file-upload-input") as HTMLInputElement;
    if (fileInput) fileInput.value = "";
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (uploadType === "file" && !selectedFile) return;
    if (uploadType === "link" && (!linkUrl || !linkTitle)) return;

    setUploading(true);
    setError(null);

    try {
      let fileUrlResult = "";
      let descVal = "";

      if (uploadType === "file" && selectedFile) {
        // 1. Upload to Google Drive
        const formData = new FormData();
        formData.append("file", selectedFile);

        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!uploadRes.ok) {
          const errData = await uploadRes.json();
          throw new Error(errData.error || "Upload to Google Drive failed");
        }

        const driveResult = await uploadRes.json();
        fileUrlResult = driveResult.webViewLink;

        // Encode filename and optional description using the bracket prefix pattern
        descVal = fileDescription.trim()
          ? `[${selectedFile.name}] ${fileDescription.trim()}`
          : `[${selectedFile.name}]`;
      } else {
        fileUrlResult = linkUrl.trim();
        if (!/^https?:\/\//i.test(fileUrlResult)) {
          fileUrlResult = "https://" + fileUrlResult;
        }

        descVal = fileDescription.trim()
          ? `[${linkTitle.trim()}] ${fileDescription.trim()}`
          : `[${linkTitle.trim()}]`;
      }

      // 2. Save metadata to files sheet
      const metadataRes = await fetch("/api/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: projectId || null,
          task_id: taskId || null,
          report_id: reportId || null,
          file_url: fileUrlResult,
          file_description: descVal,
        }),
      });

      if (!metadataRes.ok) {
        const errData = await metadataRes.json();
        throw new Error(errData.error || "Failed to attach file metadata");
      }

      // Reset form and refresh files
      clearSelection();
      setLoading(true);
      setRefreshTrigger((prev) => prev + 1);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An error occurred during upload.";
      setError(message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (fileId: string) => {
    if (!confirm("Are you sure you want to remove this file attachment?")) return;

    setRemovingId(fileId);
    try {
      const res = await fetch(`/api/files/${fileId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setFiles((prev) => prev.filter((f) => f.id !== fileId));
      } else {
        const errData = await res.json();
        alert(errData.error || "Failed to delete file");
      }
    } catch (err) {
      console.error("Failed to delete file:", err);
    } finally {
      setRemovingId(null);
    }
  };

  // Helper to parse filename and description
  const parseFileDescription = (desc: string | null) => {
    if (!desc) return { name: "Attachment", description: "" };
    const match = desc.match(/^\[(.*?)\]\s*(.*)$/);
    if (match) {
      return { name: match[1], description: match[2] };
    }
    return { name: desc, description: "" };
  };

  const getFileIcon = (nameOrUrl: string, url?: string) => {
    const lower = nameOrUrl.toLowerCase();
    if (url && !url.includes("drive.google.com")) {
      return <Link2 className="h-5 w-5 text-sky-500" />;
    }
    if (lower.endsWith(".pdf")) return <FileText className="h-5 w-5 text-red-500" />;
    if (lower.endsWith(".xlsx") || lower.endsWith(".xls"))
      return <FileSpreadsheet className="h-5 w-5 text-emerald-500" />;
    if (lower.endsWith(".docx") || lower.endsWith(".doc"))
      return <FileText className="h-5 w-5 text-blue-500" />;
    if (lower.endsWith(".zip") || lower.endsWith(".rar") || lower.endsWith(".7z"))
      return <FileArchive className="h-5 w-5 text-amber-500" />;
    if (/\.(png|jpe?g|gif|webp|svg)$/i.test(lower))
      return <FileImage className="h-5 w-5 text-purple-500" />;
    return <File className="h-5 w-5 text-muted-foreground" />;
  };

  return (
    <Card className="shadow-sm border-muted">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg font-semibold">
          <Paperclip className="h-4 w-4 text-primary" />
          Attachments
          <Badge variant="secondary" className="ml-1">
            {files.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Upload Form */}
        <form onSubmit={handleUpload} className="space-y-4">
          <div className="flex border-b border-muted mb-2">
            <button
              type="button"
              className={`pb-2 px-4 text-xs font-semibold transition-colors border-b-2 -mb-[1px] ${
                uploadType === "file"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => {
                setUploadType("file");
                setError(null);
              }}
            >
              Upload File
            </button>
            <button
              type="button"
              className={`pb-2 px-4 text-xs font-semibold transition-colors border-b-2 -mb-[1px] ${
                uploadType === "link"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => {
                setUploadType("link");
                setError(null);
              }}
            >
              Add Link
            </button>
          </div>

          {uploadType === "file" ? (
            !selectedFile ? (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => document.getElementById("file-upload-input")?.click()}
                className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-6 cursor-pointer transition-all duration-200 ${
                  isDragOver
                    ? "border-primary bg-primary/5 scale-[0.99]"
                    : "border-muted hover:border-primary/50 hover:bg-muted/30"
                }`}
              >
                <UploadCloud className="h-10 w-10 text-muted-foreground mb-2" />
                <p className="text-sm font-medium text-center">
                  Drag & drop files here, or <span className="text-primary hover:underline">browse</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1 text-center">
                  PDF, Excel, Word, Images, or ZIP (Max 50MB)
                </p>
                <input
                  id="file-upload-input"
                  type="file"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
            ) : (
              <div className="rounded-xl border p-4 bg-muted/20 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                      {getFileIcon(selectedFile.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    onClick={clearSelection}
                    disabled={uploading}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="file-desc-input" className="text-xs font-semibold text-muted-foreground">
                    Description / Remarks
                  </Label>
                  <Input
                    id="file-desc-input"
                    placeholder="Optional note about this attachment..."
                    value={fileDescription}
                    onChange={(e) => setFileDescription(e.target.value)}
                    disabled={uploading}
                    className="h-9 text-sm"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={clearSelection}
                    disabled={uploading}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" disabled={uploading}>
                    {uploading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      "Upload & Attach"
                    )}
                  </Button>
                </div>
              </div>
            )
          ) : (
            <div className="rounded-xl border p-4 bg-muted/20 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="link-title-input" className="text-xs font-semibold text-muted-foreground">
                    Link Title *
                  </Label>
                  <Input
                    id="link-title-input"
                    placeholder="e.g. Project Repository"
                    value={linkTitle}
                    onChange={(e) => setLinkTitle(e.target.value)}
                    disabled={uploading}
                    required
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="link-url-input" className="text-xs font-semibold text-muted-foreground">
                    Link URL *
                  </Label>
                  <Input
                    id="link-url-input"
                    placeholder="e.g. https://github.com/my-project"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    disabled={uploading}
                    required
                    className="h-9 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="link-desc-input" className="text-xs font-semibold text-muted-foreground">
                  Description / Remarks
                </Label>
                <Input
                  id="link-desc-input"
                  placeholder="Optional note about this link..."
                  value={fileDescription}
                  onChange={(e) => setFileDescription(e.target.value)}
                  disabled={uploading}
                  className="h-9 text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearSelection}
                  disabled={uploading}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={uploading}>
                  {uploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving Link...
                    </>
                  ) : (
                    "Attach Link"
                  )}
                </Button>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 p-3 rounded-lg">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </form>

        {/* Attachments List */}
        {loading ? (
          <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Loading attachments...
          </div>
        ) : files.length === 0 ? (
          <div className="text-center py-8 border rounded-xl border-dashed bg-muted/10">
            <Paperclip className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm font-medium text-muted-foreground">No files attached yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {files.map((file) => {
              const { name, description } = parseFileDescription(file.file_description);
              return (
                <div
                  key={file.id}
                  className="flex items-center justify-between border rounded-xl p-3 hover:shadow-sm transition-all duration-200"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="p-2 bg-muted rounded-lg shrink-0 mt-0.5">
                      {getFileIcon(name, file.file_url)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate leading-snug">{name}</p>
                      {description && (
                        <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                          {description}
                        </p>
                      )}
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Attached by {file.created_by_name} • {formatDateTime(file.created_at)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 ml-3 shrink-0">
                    <a
                      href={file.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center"
                    >
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted" title="View Attachment">
                        <Eye className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                      </Button>
                    </a>
                    {removingId === file.id ? (
                      <div className="h-8 w-8 flex items-center justify-center">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                        title="Delete attachment"
                        onClick={() => handleDelete(file.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
