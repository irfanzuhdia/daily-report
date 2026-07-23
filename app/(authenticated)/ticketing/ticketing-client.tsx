"use client"

import React, { useState, useMemo, useCallback, useTransition, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useViewDensity } from "@/lib/view-density"
import dynamic from "next/dynamic"

const TicketingTable = dynamic(() => import("@/components/ticketing/ticketing-table").then(m => m.TicketingTable), {
  loading: () => <div className="min-h-[300px] flex items-center justify-center text-muted-foreground animate-pulse bg-muted/20 rounded-xl border border-border" />
})

import {
  LifeBuoy,
  Search,
  Plus,
  Trash2,
  Eye,
  Check,
  Clock,
  AlertCircle,
  X,
  MessageSquare,
  History,
  Paperclip,
  ExternalLink,
  User,
  Users,
  CheckCircle2,
  Tag,
  ChevronRight,
  ArrowLeft,
  Calendar,
  Shield,
  FileText,
  Loader2,
  Edit3,
  AtSign,
  FolderPlus,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Upload
} from "lucide-react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { SearchableUserSelect } from "@/components/ui/searchable-user-select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import type { Ticket, TicketComment, TicketLog } from "@/lib/types"

interface CleanUser {
  user_id: string
  user_name: string | null
  user_email: string
  user_occupation: string | null
  user_departement: string | null
  user_division: string | null
  user_site: string | null
  user_team: string | null
  user_unit: string | null
  level: number
}

export function TicketingClient({
  initialTickets,
  users,
  currentUserId,
  currentUserDivision,
  divisions,
  ticketToProjectMap = {},
}: {
  initialTickets: Ticket[]
  users: CleanUser[]
  currentUserId: string
  currentUserDivision: string
  divisions: string[]
  ticketToProjectMap?: Record<string, string>
}) {
  const { density } = useViewDensity()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // State
  const [tickets, setTickets] = useState<Ticket[]>(initialTickets)
  const [activeTab, setActiveTab] = useState<"all" | "my">("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [priorityFilter, setPriorityFilter] = useState<string>("all")
  const [divisionFilter, setDivisionFilter] = useState<string>("all")

  // Sorting state
  const [sortBy, setSortBy] = useState<string>("due_date")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc")

  const toggleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc")
    } else {
      setSortBy(column)
      setSortOrder("asc")
    }
  }

  const renderSortIndicator = (column: string) => {
    if (sortBy !== column) {
      return <ArrowUpDown className="ml-1 h-3 w-3 inline-block opacity-40 hover:opacity-80 transition-opacity" />
    }
    return sortOrder === "asc" ? (
      <ArrowUp className="ml-1 h-3 w-3 inline-block text-primary" />
    ) : (
      <ArrowDown className="ml-1 h-3 w-3 inline-block text-primary" />
    )
  }

  // Modals / Detail Drawer
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [comments, setComments] = useState<(TicketComment & { author_name?: string; author_email?: string })[]>([])
  const [logs, setLogs] = useState<(TicketLog & { actor_name?: string; actor_email?: string })[]>([])
  const [activeDetailTab, setActiveDetailTab] = useState<"comments" | "logs">("comments")

  const selectedTicketIdRef = useRef<string | null>(null)
  useEffect(() => {
    selectedTicketIdRef.current = selectedTicket?.id || null
  }, [selectedTicket])

  // Sync initial tickets when refreshed from server
  useEffect(() => {
    setTickets(initialTickets)
  }, [initialTickets])

  // Realtime Websocket Supabase
  useEffect(() => {
    const { supabase } = require("@/lib/supabase-client")
    const channel = supabase
      .channel('realtime-ticketing')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tickets' },
        () => {
          router.refresh()
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ticket_comments' },
        (payload: any) => {
          if (selectedTicketIdRef.current && payload.new?.ticket_id === selectedTicketIdRef.current) {
             fetch(`/api/tickets/${selectedTicketIdRef.current}`)
               .then(res => res.json())
               .then(data => {
                  if (data.comments) setComments(data.comments)
                  if (data.logs) setLogs(data.logs)
               })
               .catch(err => console.error("WebSocket comment refresh error:", err))
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ticket_logs' },
        (payload: any) => {
          if (selectedTicketIdRef.current && payload.new?.ticket_id === selectedTicketIdRef.current) {
             fetch(`/api/tickets/${selectedTicketIdRef.current}`)
               .then(res => res.json())
               .then(data => {
                  if (data.comments) setComments(data.comments)
                  if (data.logs) setLogs(data.logs)
               })
               .catch(err => console.error("WebSocket log refresh error:", err))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [router])

  // Confirmation Modal States
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmConfig, setConfirmConfig] = useState<{
    title: string
    description: string
    confirmText: string
    cancelText: string
    variant: "default" | "destructive" | "success"
    onConfirm: () => void
  } | null>(null)

  // Form states
  const [newTicket, setNewTicket] = useState({
    title: "",
    description: "",
    request_to_division: "",
    problem_type: "",
    priority: "Medium" as Ticket["priority"],
    due_date: "",
    tag_person: "",
    attachment_link: "",
    attachment_file: "",
    team_user_ids: [] as string[],
  })

  // Detail edit/update states
  const [editStatus, setEditStatus] = useState<Ticket["status"]>("Open")
  const [editCategory, setEditCategory] = useState("")
  const [editTagPerson, setEditTagPerson] = useState("")
  const [editTeamUserIds, setEditTeamUserIds] = useState<string[]>([])
  const [editPriority, setEditPriority] = useState<Ticket["priority"]>("Medium")
  const [editDueDate, setEditDueDate] = useState("")
  const [submittingComment, setSubmittingComment] = useState(false)
  const [updatingTicket, setUpdatingTicket] = useState(false)

  // Form mode state
  const [isEditMode, setIsEditMode] = useState(false)

  // File upload states & ref
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)

  // Rich comment input states
  const [commentContent, setCommentContent] = useState("")
  const [commentFileUrl, setCommentFileUrl] = useState<string | null>(null)
  const [commentFileName, setCommentFileName] = useState<string | null>(null)
  const [commentUploading, setCommentUploading] = useState(false)
  const commentFileInputRef = useRef<HTMLInputElement>(null)

  // Mention Autocomplete States for Comment
  const [cMentionQuery, setCMentionQuery] = useState("")
  const [cShowSuggestions, setCShowSuggestions] = useState(false)
  const [cMentionStartIndex, setCMentionStartIndex] = useState(-1)
  const [cHighlightedIndex, setCHighlightedIndex] = useState(0)

  // Computed suggestions based on all users
  const commentSuggestions = useMemo(() => {
    if (!cShowSuggestions) return []
    const query = cMentionQuery.toLowerCase()
    
    return users.filter((u) => {
      const name = (u.user_name || "").toLowerCase()
      const email = u.user_email.toLowerCase()
      return name.includes(query) || email.includes(query)
    }).slice(0, 5) // Limit to 5 suggestions for cleaner UI
  }, [cShowSuggestions, cMentionQuery, users])

  const handleSelectCommentUser = (user: typeof users[0]) => {
    const currentText = commentContent
    const before = currentText.slice(0, cMentionStartIndex)
    const after = currentText.slice(cMentionStartIndex + cMentionQuery.length + 1)
    
    setCommentContent(before + `@${user.user_name || user.user_email} ` + after)
    setCShowSuggestions(false)
    setCMentionQuery("")

    setTimeout(() => {
      const el = document.getElementById("ticket-comment-textarea") as HTMLTextAreaElement
      if (el) {
        el.focus()
        const newPos = before.length + (user.user_name || user.user_email).length + 2
        el.setSelectionRange(newPos, newPos)
      }
    }, 50)
  }

  const handleCommentTextareaChange = (
    val: string,
    selectionStart: number
  ) => {
    setCommentContent(val)

    const textBeforeCursor = val.slice(0, selectionStart)
    const lastAtSymbolIndex = textBeforeCursor.lastIndexOf("@")

    if (lastAtSymbolIndex !== -1) {
      const textAfterAt = textBeforeCursor.slice(lastAtSymbolIndex + 1)
      if (!textAfterAt.includes(" ") && !textAfterAt.includes("\n")) {
        setCMentionQuery(textAfterAt)
        setCShowSuggestions(true)
        setCMentionStartIndex(lastAtSymbolIndex)
        return
      }
    }

    setCShowSuggestions(false)
    setCMentionQuery("")
  }

  const handleCommentKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!cShowSuggestions || commentSuggestions.length === 0) return

    if (e.key === "ArrowDown") {
      e.preventDefault()
      setCHighlightedIndex((prev) => (prev + 1) % commentSuggestions.length)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setCHighlightedIndex((prev) => (prev - 1 + commentSuggestions.length) % commentSuggestions.length)
    } else if (e.key === "Enter") {
      e.preventDefault()
      handleSelectCommentUser(commentSuggestions[cHighlightedIndex])
    } else if (e.key === "Escape") {
      e.preventDefault()
      setCShowSuggestions(false)
    }
  }

  const handleCommentFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setCommentUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const res = await fetch("/api/upload", { method: "POST", body: formData })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Upload failed")
      }
      const data = await res.json()
      const fileUrlWithName = data.webViewLink + (data.webViewLink.includes("?") ? "&" : "?") + "name=" + encodeURIComponent(data.fileName)
      setCommentFileUrl(fileUrlWithName)
      setCommentFileName(data.fileName)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Upload failed"
      triggerNotice("error", message)
    } finally {
      setCommentUploading(false)
      if (commentFileInputRef.current) commentFileInputRef.current.value = ""
    }
  }

  const handleRemoveCommentFile = () => {
    setCommentFileUrl(null)
    setCommentFileName(null)
    if (commentFileInputRef.current) commentFileInputRef.current.value = ""
  }

  const getFileIdFromUrl = (url: string): string | null => {
    if (!url) return null;
    if (url.startsWith("/api/files/")) {
      return url.replace("/api/files/", "").split("?")[0];
    }
    if (url.includes("drive.google.com")) {
      const fileDMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      if (fileDMatch && fileDMatch[1]) {
        return fileDMatch[1];
      }
      const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (idMatch && idMatch[1]) {
        return idMatch[1];
      }
    }
    return null;
  }

  const formatCommentContent = (text: string) => {
    if (!text) return null;

    let mainText = text;
    let attachment: { name: string; url: string } | null = null;
    
    const attachRegex = /\n\n📎 \[Attachment: (.*?)\]\((.*?)\)/;
    const match = text.match(attachRegex);
    if (match) {
      mainText = text.replace(attachRegex, "");
      attachment = { name: match[1], url: match[2] };
    }

    // Sort users by name length in descending order to match longest names first (e.g. `@Irfan Zuhdi Abdillah` before `@Irfan`)
    const sortedUsers = [...users].sort((a, b) => {
      const nameA = a.user_name || "";
      const nameB = b.user_name || "";
      return nameB.length - nameA.length;
    });

    // Build regex patterns for user names, emails, and IDs
    const matchPatterns: string[] = [];
    for (const u of sortedUsers) {
      if (u.user_name) {
        const escapedName = u.user_name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        matchPatterns.push(`@${escapedName}`);
      }
      const escapedEmail = u.user_email.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      matchPatterns.push(`@${escapedEmail}`);
      matchPatterns.push(`@${u.user_id.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}`);
    }

    let parts: React.ReactNode[] = [mainText];

    if (matchPatterns.length > 0) {
      const mentionRegex = new RegExp(`(${matchPatterns.join("|")})`, "gi");
      
      // Split the main text by the compiled mention pattern
      // Capturing parentheses in RegExp ensures the matched mention matches are kept in the returned array
      const splitParts = mainText.split(mentionRegex);
      
      parts = splitParts.map((part, index) => {
        if (part.startsWith("@")) {
          const lowerPart = part.toLowerCase();
          const isValidMention = sortedUsers.some(u => {
            const nameMatch = u.user_name && `@${u.user_name.toLowerCase()}` === lowerPart;
            const emailMatch = `@${u.user_email.toLowerCase()}` === lowerPart;
            const idMatch = `@${u.user_id.toLowerCase()}` === lowerPart;
            return nameMatch || emailMatch || idMatch;
          });

          if (isValidMention) {
            return (
              <span key={index} className="rounded-md bg-primary/15 px-1.5 py-0.5 text-xs font-bold text-primary inline-block transition-all hover:bg-primary/25">
                {part}
              </span>
            );
          }
        }
        return part;
      });
    } else {
      // Fallback simple whitespace parsing if no users exist
      parts = mainText.split(/(\s+)/).map((part, index) => {
        if (part.startsWith("@")) {
          return (
            <span key={index} className="rounded-md bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary inline-block">
              {part}
            </span>
          )
        }
        return part;
      });
    }

    const isImage = attachment && (
      /\.(png|jpe?g|gif|webp|svg|bmp|tiff|heic)/i.test(attachment.name) ||
      /\.(png|jpe?g|gif|webp|svg|bmp|tiff|heic)/i.test(attachment.url)
    );

    const fileId = attachment ? getFileIdFromUrl(attachment.url) : null;
    const downloadUrl = attachment ? (fileId ? `/api/files/${fileId}` : attachment.url) : "";

    return (
      <div className="space-y-2 max-w-full">
        <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed break-words">{parts}</p>
        {attachment && (
          isImage ? (
            <div className="mt-2 max-w-full sm:max-w-xs rounded-xl overflow-hidden border bg-background/50 backdrop-blur-sm shadow-sm hover:shadow-md transition-all duration-200 group relative">
              <a
                href={downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block cursor-zoom-in"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={downloadUrl}
                  alt={attachment.name}
                  className="max-h-48 w-full object-cover rounded-lg transition-transform duration-200 group-hover:scale-[1.02]"
                />
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/45 to-transparent p-2 text-[9px] text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-between">
                  <span className="truncate max-w-[85%] font-medium">{attachment.name}</span>
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </div>
              </a>
            </div>
          ) : (
            <a
              href={downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-medium rounded-lg border bg-background hover:bg-muted text-primary transition-all mt-1 max-w-full"
            >
              <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="truncate flex-1">{attachment.name}</span>
            </a>
          )
        )}
      </div>
    );
  }

  const canCreatorEdit = useMemo(() => {
    if (!selectedTicket) return false
    const isCreator = selectedTicket.request_by === currentUserId
    const isAdmin = users.find(u => u.user_id === currentUserId)?.level === 7
    if (!isCreator && !isAdmin) return false
    return selectedTicket.status !== "Closed"
  }, [selectedTicket, currentUserId, users])

  const canCreatorDelete = useMemo(() => {
    if (!selectedTicket) return false
    const isCreator = selectedTicket.request_by === currentUserId
    const isAdmin = users.find(u => u.user_id === currentUserId)?.level === 7
    if (!isCreator && !isAdmin) return false

    if (selectedTicket.status !== "Open") return false

    const hasLogsByOthers = logs.some(l => l.created_by !== selectedTicket.request_by)
    if (hasLogsByOthers) return false

    const hasCommentsByOthers = comments.some(c => c.created_by !== selectedTicket.request_by)
    if (hasCommentsByOthers) return false

    return true
  }, [selectedTicket, currentUserId, logs, comments, users])

  const isProcessedOrHandled = useMemo(() => {
    if (!selectedTicket || !isEditMode) return false
    if (selectedTicket.status !== "Open") return true
    const hasLogsByOthers = logs.some(l => l.created_by !== selectedTicket.request_by)
    const hasCommentsByOthers = comments.some(c => c.created_by !== selectedTicket.request_by)
    return hasLogsByOthers || hasCommentsByOthers
  }, [selectedTicket, isEditMode, logs, comments])

  const handleOpenCreate = () => {
    setIsEditMode(false)
    setNewTicket({
      title: "",
      description: "",
      request_to_division: "",
      problem_type: "",
      priority: "Medium",
      due_date: "",
      tag_person: "",
      attachment_link: "",
      attachment_file: "",
      team_user_ids: [],
    })
    setFileName(null)
    setIsCreateOpen(true)
  }

  const handleOpenEdit = () => {
    if (!selectedTicket) return
    setIsEditMode(true)
    setNewTicket({
      title: selectedTicket.title,
      description: selectedTicket.description,
      request_to_division: selectedTicket.request_to_division || "",
      problem_type: selectedTicket.problem_type,
      priority: selectedTicket.priority,
      due_date: selectedTicket.due_date || "",
      tag_person: selectedTicket.tag_person || "",
      attachment_link: selectedTicket.attachment_link || "",
      attachment_file: selectedTicket.attachment_file || "",
      team_user_ids: selectedTicket.team_user_ids || [],
    })
    
    const initialName = selectedTicket.attachment_file ? extractFileName(selectedTicket.attachment_file) : null
    setFileName(initialName)
    setIsCreateOpen(true)

    // Asynchronously resolve historical Google Drive filenames for the edit modal preview
    if (initialName === "Attached Document" && selectedTicket.attachment_file) {
      const fileId = getFileIdFromUrl(selectedTicket.attachment_file)
      if (fileId) {
        fetch(`/api/files/${fileId}?metadata=true`)
          .then((res) => res.json())
          .then((data) => {
            if (data.name) setFileName(data.name)
          })
          .catch(console.error)
      }
    }
  }

  function extractFileName(url: string): string {
    try {
      const urlObj = new URL(url)
      const params = new URLSearchParams(urlObj.search)
      const name = params.get("name")
      if (name) return name;
      
      const pop = url.split("/").pop() || url
      if (pop.includes("view")) {
        return "Attached Document"
      }
      return pop
    } catch {
      return url.length > 30 ? url.slice(0, 30) + "..." : url
    }
  }

  const AttachmentFileLink = ({ url }: { url: string }) => {
    const [resolvedName, setResolvedName] = useState<string | null>(null)
    const fileId = getFileIdFromUrl(url)

    useEffect(() => {
      const initialName = extractFileName(url)
      if (initialName !== "Attached Document") {
        setResolvedName(initialName)
        return
      }

      if (!fileId) {
        setResolvedName("Attached Document")
        return
      }

      let active = true
      fetch(`/api/files/${fileId}?metadata=true`)
        .then((res) => {
          if (res.ok) return res.json()
          throw new Error("Failed to load metadata")
        })
        .then((data) => {
          if (active && data.name) {
            setResolvedName(data.name)
          }
        })
        .catch(() => {
          if (active) setResolvedName("Attached Document")
        })

      return () => {
        active = false
      }
    }, [url, fileId])

    const displayName = resolvedName || "Loading file name..."
    const downloadUrl = fileId ? `/api/files/${fileId}` : url

    return (
      <a
        href={downloadUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border bg-background hover:bg-muted text-primary transition-all max-w-full min-w-0"
      >
        <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
        <span className="truncate max-w-[200px] sm:max-w-xs">{displayName}</span>
      </a>
    )
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
      const fileUrlWithName = data.webViewLink + (data.webViewLink.includes("?") ? "&" : "?") + "name=" + encodeURIComponent(data.fileName)
      setNewTicket((prev) => ({ ...prev, attachment_file: fileUrlWithName }))
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
    setNewTicket((prev) => ({ ...prev, attachment_file: "" }))
    setFileName(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }



  const addEditTeamMember = (userId: string) => {
    if (!editTeamUserIds.includes(userId)) {
      setEditTeamUserIds([...editTeamUserIds, userId])
    }
  }

  const removeEditTeamMember = (userId: string) => {
    setEditTeamUserIds(editTeamUserIds.filter((id) => id !== userId))
  }

  // Floating notifications
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null)

  const triggerNotice = (type: "success" | "error", message: string) => {
    setNotice({ type, message })
    setTimeout(() => setNotice(null), 4000)
  }

  // User list maps
  const userMap = useMemo(() => new Map(users.map((u) => [u.user_id, u.user_name || u.user_email])), [users])
  const userEmailMap = useMemo(() => new Map(users.map((u) => [u.user_id, u.user_email])), [users])

  // Computed summary metrics
  const stats = useMemo(() => {
    const open = tickets.filter((t) => t.status === "Open").length
    const inProgress = tickets.filter((t) => t.status === "In Progress").length
    const resolvedOrClosed = tickets.filter((t) => t.status === "Resolved" || t.status === "Closed").length
    
    // Due soon: not resolved/closed, and due date is set
    const now = new Date()
    const dueSoon = tickets.filter((t) => {
      if (t.status === "Resolved" || t.status === "Closed" || !t.due_date) return false
      const dDate = new Date(t.due_date)
      const diffTime = dDate.getTime() - now.getTime()
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      return diffDays >= 0 && diffDays <= 2 // within 2 days
    }).length

    return { open, inProgress, resolvedOrClosed, dueSoon }
  }, [tickets])

  // Filtered tickets
  const filteredTickets = useMemo(() => {
    const filtered = tickets.filter((t) => {
      // 1. Tab filter
      if (activeTab === "my") {
        const isMyTicket = t.request_by === currentUserId
        const isAssignedToMe = t.tag_person === currentUserId || t.team_user_ids?.includes(currentUserId)
        if (!isMyTicket && !isAssignedToMe) return false
      }

      // 2. Status filter
      if (statusFilter !== "all" && t.status !== statusFilter) return false

      // 3. Priority filter
      if (priorityFilter !== "all" && t.priority !== priorityFilter) return false

      // 4. Target division filter
      if (divisionFilter !== "all" && t.request_to_division !== divisionFilter) return false

      // 5. Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchTitle = t.title.toLowerCase().includes(q)
        const matchDesc = t.description.toLowerCase().includes(q)
        const matchId = t.id.toLowerCase().includes(q)
        const matchProb = t.problem_type.toLowerCase().includes(q)
        const matchCat = t.division_category?.toLowerCase().includes(q) || false
        const reqName = userMap.get(t.request_by)?.toLowerCase() || ""
        const matchReq = reqName.includes(q)

        if (!matchTitle && !matchDesc && !matchId && !matchProb && !matchCat && !matchReq) {
          return false
        }
      }

      return true
    })

    // Sort the filtered tickets
    return [...filtered].sort((a, b) => {
      let valA: any = ""
      let valB: any = ""

      switch (sortBy) {
        case "id":
          valA = a.id
          valB = b.id
          break
        case "title":
          valA = a.title.toLowerCase()
          valB = b.title.toLowerCase()
          break
        case "request_by":
          valA = (userMap.get(a.request_by) || a.request_by).toLowerCase()
          valB = (userMap.get(b.request_by) || b.request_by).toLowerCase()
          break
        case "request_to_division":
          valA = (a.request_to_division || "").toLowerCase()
          valB = (b.request_to_division || "").toLowerCase()
          break
        case "tag_person":
          valA = (a.tag_person ? userMap.get(a.tag_person) || a.tag_person : "").toLowerCase()
          valB = (b.tag_person ? userMap.get(b.tag_person) || b.tag_person : "").toLowerCase()
          break
        case "problem_type":
          valA = a.problem_type.toLowerCase()
          valB = b.problem_type.toLowerCase()
          break
        case "due_date":
          valA = a.due_date || ""
          valB = b.due_date || ""
          break
        case "priority":
          const priorityWeight = { Critical: 4, High: 3, Medium: 2, Low: 1 }
          valA = priorityWeight[a.priority] || 0
          valB = priorityWeight[b.priority] || 0
          break
        case "status":
          const statusWeight = { Open: 5, "In Progress": 4, Pending: 3, Resolved: 2, Closed: 1 }
          valA = statusWeight[a.status] || 0
          valB = statusWeight[b.status] || 0
          break
        default:
          valA = a.due_date || ""
          valB = b.due_date || ""
      }

      // Keep null/empty values at the bottom
      const isEmptyA = valA === "" || valA === null || valA === undefined
      const isEmptyB = valB === "" || valB === null || valB === undefined
      if (isEmptyA && isEmptyB) return 0
      if (isEmptyA) return 1
      if (isEmptyB) return -1

      if (valA < valB) return sortOrder === "asc" ? -1 : 1
      if (valA > valB) return sortOrder === "asc" ? 1 : -1
      return 0
    })
  }, [tickets, activeTab, currentUserId, currentUserDivision, statusFilter, priorityFilter, divisionFilter, searchQuery, userMap, sortBy, sortOrder])

  // Fetch ticket comments & logs on selection
  const handleViewTicket = async (ticket: Ticket) => {
    setSelectedTicket(ticket)
    setDetailOpen(true)
    setLoadingDetails(true)
    setActiveDetailTab("comments")
    
    // Set form edits to ticket values
    setEditStatus(ticket.status)
    setEditCategory(ticket.division_category || "")
    setEditTagPerson(ticket.tag_person || "")
    setEditTeamUserIds(ticket.team_user_ids || [])
    setEditPriority(ticket.priority)
    setEditDueDate(ticket.due_date || "")

    try {
      const res = await fetch(`/api/tickets/${ticket.id}`)
      if (res.ok) {
        const data = await res.json()
        setComments(data.comments || [])
        setLogs(data.logs || [])
        // Update ticket in list with the freshest data
        if (data.ticket) {
          setTickets((prev) => prev.map((t) => (t.id === ticket.id ? data.ticket : t)))
          setSelectedTicket(data.ticket)
        }
      }
    } catch (e) {
      console.error("Failed to load ticket details:", e)
      triggerNotice("error", "Failed to load comments and activity log.")
    } finally {
      setLoadingDetails(false)
    }
  }

  // Auto-open ticket detail drawer if ticketId query parameter exists in the URL
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search)
      const ticketId = params.get("ticketId")
      if (ticketId) {
        const ticket = tickets.find((t) => t.id === ticketId)
        if (ticket) {
          handleViewTicket(ticket)
          // Clean up the query parameter from the URL bar without reloading, keeping it clean
          const newUrl = window.location.pathname
          window.history.replaceState({ path: newUrl }, "", newUrl)
        }
      }
    }
  }, [tickets])

  // Live background auto-polling for comments & activity logs when ticket detail drawer is open
  useEffect(() => {
    if (!detailOpen || !selectedTicket?.id) return

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/tickets/${selectedTicket.id}`)
        if (res.ok) {
          const data = await res.json()
          if (data.comments) setComments(data.comments)
          if (data.logs) setLogs(data.logs)
        }
      } catch (e) {
        // Silent background poll error
      }
    }, 3500)

    return () => clearInterval(interval)
  }, [detailOpen, selectedTicket?.id])

  // Create / Edit Ticket Submission
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const hasUserTag = !!newTicket.tag_person;
    const divisionVal = newTicket.request_to_division === "none" || !newTicket.request_to_division ? null : newTicket.request_to_division;
    
    if (!newTicket.title.trim() || !newTicket.description.trim() || (!divisionVal && !hasUserTag) || !newTicket.problem_type.trim()) {
      triggerNotice("error", "Please fill in all required fields. You must select either a target division or a specific user tag.")
      return
    }

    try {
      const url = isEditMode ? `/api/tickets/${selectedTicket?.id}` : "/api/tickets"
      const method = isEditMode ? "PUT" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTicket.title.trim(),
          description: newTicket.description.trim(),
          request_to_division: divisionVal,
          problem_type: newTicket.problem_type.trim(),
          priority: newTicket.priority,
          due_date: newTicket.due_date || null,
          attachment_link: newTicket.attachment_link || null,
          attachment_file: newTicket.attachment_file || null,
          tag_person: newTicket.tag_person || null,
          team_user_ids: isEditMode ? (selectedTicket?.team_user_ids || []) : [],
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || `Failed to ${isEditMode ? 'update' : 'create'} ticket`)
      }

      const data = await res.json()
      if (isEditMode) {
        setTickets((prev) => prev.map((t) => (t.id === data.id ? data : t)))
        setSelectedTicket(data)
        triggerNotice("success", `Ticket ${data.id} updated successfully!`)
      } else {
        setTickets((prev) => [data, ...prev])
        triggerNotice("success", `Ticket ${data.id} created successfully!`)
      }
      
      // Reset form
      setNewTicket({
        title: "",
        description: "",
        request_to_division: "",
        problem_type: "",
        priority: "Medium",
        due_date: "",
        tag_person: "",
        attachment_link: "",
        attachment_file: "",
        team_user_ids: [],
      })
      setFileName(null)
      setIsCreateOpen(false)
      startTransition(() => {
        router.refresh()
      })
    } catch (err: any) {
      triggerNotice("error", err.message || "An error occurred.")
    }
  }

  // Add Comment Submission
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTicket || (!commentContent.trim() && !commentFileUrl)) return

    setSubmittingComment(true)
    try {
      let finalContent = commentContent.trim()
      if (commentFileUrl && commentFileName) {
        finalContent += `\n\n📎 [Attachment: ${commentFileName}](${commentFileUrl})`
      }

      const res = await fetch(`/api/tickets/${selectedTicket.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: finalContent }),
      })

      if (res.ok) {
        const created = await res.json()
        
        const richComment = {
          ...created,
          author_name: userMap.get(currentUserId),
          author_email: userEmailMap.get(currentUserId),
        }

        setComments((prev) => [...prev, richComment])
        setCommentContent("")
        setCommentFileUrl(null)
        setCommentFileName(null)
        triggerNotice("success", "Comment added.")
      } else {
        const err = await res.json()
        triggerNotice("error", err.error || "Failed to add comment.")
      }
    } catch (e) {
      console.error(e)
      triggerNotice("error", "Error posting comment.")
    } finally {
      setSubmittingComment(false)
    }
  }

  // Requester Action: Close Request
  const handleRequesterClose = () => {
    if (!selectedTicket) return
    setConfirmConfig({
      title: "Close Ticket Request",
      description: "Are you sure you want to close this ticket request? Once closed, no further changes can be made to this ticket.",
      confirmText: "Close Request",
      cancelText: "Cancel",
      variant: "success",
      onConfirm: async () => {
        setConfirmOpen(false)
        setUpdatingTicket(true)
        try {
          const res = await fetch(`/api/tickets/${selectedTicket.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              status: "Closed",
              actionReason: "close",
            }),
          })
          if (!res.ok) {
            const err = await res.json()
            throw new Error(err.error || "Failed to close ticket")
          }
          const data = await res.json()
          setTickets((prev) => prev.map((t) => (t.id === data.id ? data : t)))
          setSelectedTicket(data)
          
          // Reload logs
          const logRes = await fetch(`/api/tickets/${selectedTicket.id}`)
          if (logRes.ok) {
            const logData = await logRes.json()
            setLogs(logData.logs || [])
          }

          triggerNotice("success", "Ticket has been closed successfully.")
          startTransition(() => {
            router.refresh()
          })
        } catch (err: any) {
          console.error(err)
          triggerNotice("error", err.message || "Failed to close ticket.")
        } finally {
          setUpdatingTicket(false)
        }
      }
    })
    setConfirmOpen(true)
  }

  // Requester Action: Cancel Request
  const handleRequesterCancel = () => {
    if (!selectedTicket) return
    setConfirmConfig({
      title: "Cancel Ticket Request",
      description: "Are you sure you want to cancel this ticket request? Once cancelled, no further changes can be made to this ticket.",
      confirmText: "Cancel Request",
      cancelText: "Keep Request",
      variant: "destructive",
      onConfirm: async () => {
        setConfirmOpen(false)
        setUpdatingTicket(true)
        try {
          const res = await fetch(`/api/tickets/${selectedTicket.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              status: "Closed",
              actionReason: "cancel",
            }),
          })
          if (!res.ok) {
            const err = await res.json()
            throw new Error(err.error || "Failed to cancel ticket")
          }
          const data = await res.json()
          setTickets((prev) => prev.map((t) => (t.id === data.id ? data : t)))
          setSelectedTicket(data)
          
          // Reload logs
          const logRes = await fetch(`/api/tickets/${selectedTicket.id}`)
          if (logRes.ok) {
            const logData = await logRes.json()
            setLogs(logData.logs || [])
          }

          triggerNotice("success", "Ticket has been cancelled successfully.")
          startTransition(() => {
            router.refresh()
          })
        } catch (err: any) {
          console.error(err)
          triggerNotice("error", err.message || "Failed to cancel ticket.")
        } finally {
          setUpdatingTicket(false)
        }
      }
    })
    setConfirmOpen(true)
  }

  // Update Ticket Status / Category / Assignment (Divisional Staff Panel)
  const handleUpdateTicket = async () => {
    if (!selectedTicket) return

    setUpdatingTicket(true)
    try {
      const res = await fetch(`/api/tickets/${selectedTicket.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: editStatus,
          division_category: editCategory.trim() || null,
          team_user_ids: editTeamUserIds,
          priority: editPriority,
          due_date: editDueDate || null,
        }),
      })

      if (res.ok) {
        const updated = await res.json()
        setTickets((prev) => prev.map((t) => (t.id === selectedTicket.id ? updated : t)))
        setSelectedTicket(updated)
        
        // Reload logs
        const logRes = await fetch(`/api/tickets/${selectedTicket.id}`)
        if (logRes.ok) {
          const logData = await logRes.json()
          setLogs(logData.logs || [])
        }

        triggerNotice("success", "Ticket updated successfully!")
        startTransition(() => {
          router.refresh()
        })
      } else {
        const err = await res.json()
        triggerNotice("error", err.error || "Failed to update ticket.")
      }
    } catch (e) {
      console.error(e)
      triggerNotice("error", "Error updating ticket.")
    } finally {
      setUpdatingTicket(false)
    }
  }

  // Soft Delete Ticket
  const handleDeleteTicket = async (ticketId: string) => {
    if (!confirm("Are you sure you want to delete this ticket?")) return

    try {
      const res = await fetch(`/api/tickets/${ticketId}`, {
        method: "DELETE",
      })

      if (res.ok) {
        setTickets((prev) => prev.filter((t) => t.id !== ticketId))
        setDetailOpen(false)
        setSelectedTicket(null)
        triggerNotice("success", "Ticket deleted successfully.")
        startTransition(() => {
          router.refresh()
        })
      } else {
        const err = await res.json()
        triggerNotice("error", err.error || "Failed to delete ticket.")
      }
    } catch (e) {
      console.error(e)
      triggerNotice("error", "Error deleting ticket.")
    }
  }

  // Priority styling
  const getPriorityBadge = (priority: Ticket["priority"]) => {
    const styles = {
      Low: "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-900/40 dark:text-slate-400 dark:border-slate-800",
      Medium: "bg-amber-50 text-amber-800 border-amber-200/50 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/50",
      High: "bg-orange-50 text-orange-800 border-orange-200/50 dark:bg-orange-950/20 dark:text-orange-400 dark:border-orange-900/50",
      Critical: "bg-rose-50 text-rose-800 border-rose-200/50 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-900/50 animate-pulse",
    }
    return (
      <Badge variant="outline" className={`font-medium ${styles[priority] || ""}`}>
        {priority}
      </Badge>
    )
  }

  // Status styling
  const getStatusBadge = (status: Ticket["status"]) => {
    const styles = {
      Open: "bg-blue-50 text-blue-800 border-blue-200/50 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/50",
      "In Progress": "bg-amber-50 text-amber-800 border-amber-200/50 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/50",
      Resolved: "bg-emerald-50 text-emerald-800 border-emerald-200/50 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50",
      Closed: "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-900/40 dark:text-slate-400 dark:border-slate-800",
      Pending: "bg-purple-50 text-purple-800 border-purple-200/50 dark:bg-purple-950/20 dark:text-purple-400 dark:border-purple-900/50",
    }
    return (
      <Badge variant="outline" className={`font-medium rounded-full ${styles[status] || ""}`}>
        {status}
      </Badge>
    )
  }

  // Format timestamp nicely
  const formatTime = (isoStr: string | null) => {
    if (!isoStr) return ""
    const d = new Date(isoStr)
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  // Check if current user belongs to the requested division
  const isMemberOfRequestedDivision = (reqToDiv: string | null | undefined) => {
    if (!reqToDiv) return false
    return currentUserDivision.toLowerCase() === reqToDiv.toLowerCase()
  }

  return (
    <div className={density === "compact" ? "space-y-4" : "space-y-6"}>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
            <LifeBuoy className="h-6 w-6 text-primary" />
            Ticketing Support
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Submit operational tickets, request divisional assistance, and monitor resolution timelines.
          </p>
        </div>
        <Button onClick={handleOpenCreate} className="gap-1.5 h-10 px-4">
          <Plus className="h-4 w-4" />
          Create New Ticket
        </Button>
      </div>

      {/* Notice Banner */}
      {notice && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2.5 rounded-xl border p-4 shadow-lg animate-in fade-in slide-in-from-top-4 duration-300 ${
            notice.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/20 dark:border-emerald-900/50 dark:text-emerald-400"
              : "bg-destructive/5 border-destructive/20 text-destructive dark:bg-destructive/10 dark:border-destructive/20"
          }`}
        >
          {notice.type === "success" ? (
            <CheckCircle2 className="h-5 w-5 shrink-0" />
          ) : (
            <AlertCircle className="h-5 w-5 shrink-0" />
          )}
          <p className="text-sm font-medium">{notice.message}</p>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="glassmorphism-card bg-card border">
          <CardHeader className="pb-2 p-4">
            <CardDescription className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Open Tickets
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.open}</div>
          </CardContent>
        </Card>
        <Card className="glassmorphism-card bg-card border">
          <CardHeader className="pb-2 p-4">
            <CardDescription className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              In Progress
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <div className="text-2xl font-bold text-amber-500">{stats.inProgress}</div>
          </CardContent>
        </Card>
        <Card className="glassmorphism-card bg-card border">
          <CardHeader className="pb-2 p-4">
            <CardDescription className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Resolved & Closed
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {stats.resolvedOrClosed}
            </div>
          </CardContent>
        </Card>
        <Card className="glassmorphism-card bg-card border">
          <CardHeader className="pb-2 p-4">
            <CardDescription className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Due Within 48h
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <div className="text-2xl font-bold text-rose-500">{stats.dueSoon}</div>
          </CardContent>
        </Card>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-muted">
        <button
          onClick={() => {
            setActiveTab("all")
            setSearchQuery("")
          }}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "all"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Users className="h-4 w-4" />
          All Tickets
        </button>
        <button
          onClick={() => {
            setActiveTab("my")
            setSearchQuery("")
          }}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "my"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <User className="h-4 w-4" />
          My Tickets
        </button>
      </div>

      {/* Filters and Controls */}
      <div className="flex flex-col gap-3 p-4 rounded-xl border bg-muted/20">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by ID, title, problem..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 bg-background"
            />
          </div>

          {/* Status filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 bg-background text-xs">
              <SelectValue placeholder="Status: All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Status: All</SelectItem>
              <SelectItem value="Open">Open</SelectItem>
              <SelectItem value="In Progress">In Progress</SelectItem>
              <SelectItem value="Pending">Pending</SelectItem>
              <SelectItem value="Resolved">Resolved</SelectItem>
              <SelectItem value="Closed">Closed</SelectItem>
            </SelectContent>
          </Select>

          {/* Priority filter */}
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="h-9 bg-background text-xs">
              <SelectValue placeholder="Priority: All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Priority: All</SelectItem>
              <SelectItem value="Low">Low</SelectItem>
              <SelectItem value="Medium">Medium</SelectItem>
              <SelectItem value="High">High</SelectItem>
              <SelectItem value="Critical">Critical</SelectItem>
            </SelectContent>
          </Select>

          {/* Division filter (only relevant for My Tickets or generally filtering) */}
          <Select value={divisionFilter} onValueChange={setDivisionFilter}>
            <SelectTrigger className="h-9 bg-background text-xs">
              <SelectValue placeholder="Target Division: All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Target Division: All</SelectItem>
              {divisions.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tickets Directory Table */}
      <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
        <TicketingTable
          tickets={filteredTickets}
          userMap={userMap}
          getPriorityBadge={getPriorityBadge}
          getStatusBadge={getStatusBadge}
          handleViewTicket={handleViewTicket}
        />
      </div>

      {/* Create Ticket Dialog Modal */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LifeBuoy className="h-5 w-5 text-primary" />
              {isEditMode ? "Edit Ticket" : "Create New Ticket"}
            </DialogTitle>
            <DialogDescription>
              {isEditMode ? "Modify ticket details. Target division staff will be notified of changes." : "Provide ticket details. Target division staff will be notified."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateSubmit} className="space-y-4 py-2">
            {isProcessedOrHandled && (
              <div className="p-3 rounded-lg border border-yellow-600/25 bg-yellow-600/5 text-xs text-yellow-500 text-left">
                This ticket is already in progress or has been handled/commented on by others. Core details cannot be modified; you can only adjust the due date.
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              {/* Target Division */}
              <div className="space-y-1">
                <Label htmlFor="request_to_division" className="text-xs font-semibold">
                  Request To (Division) {!newTicket.tag_person && <span className="text-red-500">*</span>}
                </Label>
                <Select
                  value={newTicket.request_to_division}
                  onValueChange={(val) => setNewTicket((prev) => ({ ...prev, request_to_division: val }))}
                  disabled={isProcessedOrHandled}
                >
                  <SelectTrigger id="request_to_division" className="h-9 bg-background text-xs">
                    <SelectValue placeholder="Select division" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (Specific user tag only)</SelectItem>
                    {divisions.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Problem Type */}
              <div className="space-y-1">
                <Label htmlFor="problem_type" className="text-xs font-semibold">
                  Problem Type <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="problem_type"
                  placeholder="e.g. Software Bug, Network"
                  value={newTicket.problem_type}
                  onChange={(e) => setNewTicket((prev) => ({ ...prev, problem_type: e.target.value }))}
                  className="h-9 bg-background"
                  disabled={isProcessedOrHandled}
                  required
                />
              </div>
            </div>

            {/* Title */}
            <div className="space-y-1">
              <Label htmlFor="title" className="text-xs font-semibold">
                Title / Short Issue <span className="text-red-500">*</span>
              </Label>
              <Input
                id="title"
                placeholder="Brief summary of the issue"
                value={newTicket.title}
                onChange={(e) => setNewTicket((prev) => ({ ...prev, title: e.target.value }))}
                className="h-9 bg-background"
                disabled={isProcessedOrHandled}
                required
              />
            </div>

            {/* Description */}
            <div className="space-y-1">
              <Label htmlFor="description" className="text-xs font-semibold">
                Description <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="description"
                placeholder="Detail description of your problem, steps to reproduce, or support requirements..."
                value={newTicket.description}
                onChange={(e) => setNewTicket((prev) => ({ ...prev, description: e.target.value }))}
                rows={4}
                className="bg-background"
                disabled={isProcessedOrHandled}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Priority */}
              <div className="space-y-1">
                <Label htmlFor="priority" className="text-xs font-semibold">
                  Priority
                </Label>
                <Select
                  value={newTicket.priority}
                  onValueChange={(val) =>
                    setNewTicket((prev) => ({ ...prev, priority: val as Ticket["priority"] }))
                  }
                  disabled={isProcessedOrHandled}
                >
                  <SelectTrigger id="priority" className="h-9 bg-background text-xs">
                    <SelectValue placeholder="Medium" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Low">Low</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                    <SelectItem value="Critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Due date */}
              <div className="space-y-1">
                <Label htmlFor="due_date" className="text-xs font-semibold">
                  Due Date
                </Label>
                <Input
                  id="due_date"
                  type="date"
                  value={newTicket.due_date}
                  onChange={(e) => setNewTicket((prev) => ({ ...prev, due_date: e.target.value }))}
                  min={new Date().toLocaleDateString('en-CA')}
                  className="h-9 bg-background text-xs"
                />
              </div>
            </div>

            {/* Specific User Tag */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Specific User Tag (Optional)</Label>
              <p className="text-[10px] text-muted-foreground">
                Tag a specific user that this request is directed to. Either a Target Division or a Specific User Tag must be selected.
              </p>
              {isProcessedOrHandled ? (
                <div className="min-h-9 p-2 rounded-lg border bg-muted/20 text-left">
                  {newTicket.tag_person ? (
                    <Badge variant="secondary" className="text-xs">
                      {userMap.get(newTicket.tag_person) || newTicket.tag_person}
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground italic">No specific user tag</span>
                  )}
                </div>
              ) : (
                <SearchableUserSelect
                  allUsers={users}
                  selectedUserIds={newTicket.tag_person ? [newTicket.tag_person] : []}
                  onAddUser={(userId) => setNewTicket((prev) => ({ ...prev, tag_person: userId }))}
                  onRemoveUser={() => setNewTicket((prev) => ({ ...prev, tag_person: "" }))}
                  placeholder="Select Specific User Tag..."
                />
              )}
            </div>


            {/* File Upload Section */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Attachment File (Optional)</Label>
              <p className="text-[10px] text-muted-foreground">
                Upload supporting documents (PDF, Excel, Word, images, ZIP). Max 50MB.
              </p>

              {fileName ? (
                <div className="flex items-center gap-3 rounded-xl border p-2.5 bg-background">
                  <FileText className="h-4 w-4 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{fileName}</p>
                    {newTicket.attachment_file && (
                      <a
                        href={newTicket.attachment_file}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-primary hover:underline"
                      >
                        View file
                      </a>
                    )}
                  </div>
                  <Badge variant="secondary" className="text-[9px] px-1.5 py-0">Uploaded</Badge>
                  {!isProcessedOrHandled && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="h-7 w-7"
                      onClick={handleRemoveFile}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
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
                    className="w-full h-9 text-xs"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading || isProcessedOrHandled}
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-3.5 w-3.5" />
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
              <Label htmlFor="attachment_link" className="text-xs font-semibold">Additional Link URL (Optional)</Label>
              <Input
                id="attachment_link"
                value={newTicket.attachment_link}
                onChange={(e) => setNewTicket((prev) => ({ ...prev, attachment_link: e.target.value }))}
                placeholder="Enter additional link (e.g. Google Drive, Figma, Notion)"
                className="h-9 bg-background"
                disabled={isProcessedOrHandled}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">{isEditMode ? "Save Changes" : "Submit Ticket"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Ticket Detail Drawer Modal */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedTicket && (
            <>
              <DialogHeader className="border-b pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="space-y-1 text-left">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-sm font-semibold bg-primary/15 text-primary px-2 py-0.5 rounded border border-primary/30">
                      {selectedTicket.id}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Created on {formatTime(selectedTicket.created_at)}
                    </span>
                  </div>
                  <DialogTitle className="text-xl font-bold tracking-tight text-left mt-1">
                    {selectedTicket.title}
                  </DialogTitle>
                </div>
                <div className="flex items-center gap-2 ml-auto sm:ml-0">
                  {/* Edit/Delete Options for Creator or Admin */}
                  {canCreatorEdit && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleOpenEdit}
                      className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                    >
                      <Edit3 className="h-4 w-4 mr-1.5" />
                      Edit
                    </Button>
                  )}
                  {(selectedTicket.request_by === currentUserId || users.find(u => u.user_id === currentUserId)?.level === 7) && (
                    <Button
                      variant="outline"
                      className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                      size="sm"
                      onClick={() => handleDeleteTicket(selectedTicket.id)}
                      disabled={
                        selectedTicket.status !== "Open" || 
                        (selectedTicket.request_by === currentUserId && !canCreatorDelete && users.find(u => u.user_id === currentUserId)?.level !== 7)
                      }
                      title={
                        selectedTicket.status !== "Open"
                          ? "Cannot delete tickets that are already started, handled, or closed"
                          : selectedTicket.request_by === currentUserId && !canCreatorDelete
                          ? "Cannot delete tickets that have comments or activity logs by others"
                          : ""
                      }
                    >
                      <Trash2 className="h-4 w-4 mr-1.5" />
                      Delete
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => setDetailOpen(false)}>
                    Close
                  </Button>
                </div>
              </DialogHeader>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 pt-4">
                {/* Left Side: Ticket Metadata & Action Panel (8 cols) */}
                <div className="md:col-span-7 space-y-5 text-left">
                  {/* Metadata cards */}
                  <div className="grid grid-cols-2 gap-4 p-4 rounded-xl border bg-muted/10">
                    <div>
                      <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground block">
                        Requester
                      </span>
                      <span className="text-sm font-medium">
                        {userMap.get(selectedTicket.request_by) || selectedTicket.request_by}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground block">
                        Target Division
                      </span>
                      <span className="text-sm font-medium">
                        <Badge variant="secondary" className="px-2 py-0">
                          {selectedTicket.request_to_division || "Direct Handlers"}
                        </Badge>
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground block mt-2">
                        Priority
                      </span>
                      <span className="mt-0.5 block">{getPriorityBadge(selectedTicket.priority)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground block mt-2">
                        Status
                      </span>
                      <span className="mt-0.5 block">{getStatusBadge(selectedTicket.status)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground block mt-2">
                        Problem Type
                      </span>
                      <span className="text-xs font-medium text-foreground bg-background px-2 py-1 rounded border inline-block mt-0.5">
                        {selectedTicket.problem_type}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground block mt-2">
                        Division Category
                      </span>
                      <span className="text-xs font-medium text-foreground bg-background px-2 py-1 rounded border inline-block mt-0.5">
                        {selectedTicket.division_category || "Not categorized yet"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground block mt-2">
                        Tagged / Assigned Staff
                      </span>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {selectedTicket.team_user_ids && selectedTicket.team_user_ids.length > 0 ? (
                          selectedTicket.team_user_ids.map((uid) => (
                            <Badge key={uid} variant="outline" className="flex items-center gap-1 text-[11px] font-medium bg-background text-foreground py-0.5 px-2">
                              <User className="h-3 w-3 text-primary shrink-0" />
                              <span>{userMap.get(uid) || uid}</span>
                            </Badge>
                          ))
                        ) : selectedTicket.tag_person ? (
                          <Badge variant="outline" className="flex items-center gap-1 text-[11px] font-medium bg-background text-foreground py-0.5 px-2">
                            <User className="h-3 w-3 text-primary shrink-0" />
                            <span>{userMap.get(selectedTicket.tag_person) || selectedTicket.tag_person}</span>
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Unassigned</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground block mt-2">
                        Due Date
                      </span>
                      <span className="text-xs font-medium block mt-1 flex items-center gap-1 text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                        {selectedTicket.due_date ? new Date(selectedTicket.due_date).toLocaleDateString() : "No due date"}
                      </span>
                    </div>
                  </div>

                  {/* Description */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Description / Problem Detail
                    </h3>
                    <div className="p-4 rounded-xl border bg-card text-sm leading-relaxed whitespace-pre-wrap">
                      {selectedTicket.description}
                    </div>
                  </div>

                  {/* Attachments */}
                  {(selectedTicket.attachment_link || selectedTicket.attachment_file) && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Attachments
                      </h3>
                      <div className="flex flex-wrap gap-2.5">
                        {selectedTicket.attachment_link && (
                          <a
                            href={selectedTicket.attachment_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border bg-background hover:bg-muted text-primary transition-all max-w-full min-w-0"
                          >
                            <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate max-w-[200px] sm:max-w-xs">{selectedTicket.attachment_link}</span>
                          </a>
                        )}
                        {selectedTicket.attachment_file && (
                          <AttachmentFileLink url={selectedTicket.attachment_file} />
                        )}
                      </div>
                    </div>
                  )}

                  {/* Project Link / Convert Section */}
                  <div className="mt-4 pt-4 border-t">
                    {ticketToProjectMap?.[selectedTicket.id] ? (
                      <div className="flex items-center justify-between p-3.5 rounded-xl border bg-muted/30">
                        <div className="space-y-0.5 text-left">
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Linked Project</p>
                          <p className="text-sm font-medium">This ticket is actively linked to a project.</p>
                        </div>
                        <Link href={`/projects/${ticketToProjectMap[selectedTicket.id]}`}>
                          <Button size="sm" variant="outline" className="flex items-center gap-1">
                            <FileText className="h-4 w-4" />
                            View Project
                          </Button>
                        </Link>
                      </div>
                    ) : (
                      selectedTicket.status !== 'Closed' && 
                      (isMemberOfRequestedDivision(selectedTicket.request_to_division) || 
                       selectedTicket.team_user_ids?.includes(currentUserId) ||
                       selectedTicket.tag_person === currentUserId ||
                       users.find(u => u.user_id === currentUserId)?.level === 7) && (
                        <div className="flex items-center justify-between p-3.5 rounded-xl border border-dashed border-primary/30 bg-primary/5">
                          <div className="space-y-0.5 text-left">
                            <p className="text-xs font-semibold uppercase tracking-wider text-primary">Project Integration</p>
                            <p className="text-sm font-medium">Convert this ticket into a structured project.</p>
                          </div>
                          <Link href={`/projects/new?ticketRef=${selectedTicket.id}&title=${encodeURIComponent(selectedTicket.title)}&desc=${encodeURIComponent(selectedTicket.description)}&team=${encodeURIComponent((selectedTicket.team_user_ids || []).join(','))}&category=${encodeURIComponent(selectedTicket.division_category || '')}`}>
                            <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground flex items-center gap-1.5 shadow-sm">
                              <FolderPlus className="h-4 w-4" />
                              Convert to Project
                            </Button>
                          </Link>
                        </div>
                      )
                    )}
                  </div>

                  {/* Action Control Panel */}
                  {selectedTicket.status === "Closed" ? (
                    <div className="p-4 rounded-xl border border-muted/20 bg-muted/5 space-y-2 text-center">
                      <Shield className="h-5 w-5 mx-auto text-muted-foreground/60" />
                      <h3 className="text-sm font-bold tracking-tight text-muted-foreground">Ticket Closed</h3>
                      <p className="text-[11px] text-muted-foreground/80">
                        This request has been closed and cannot be modified.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Requester Control Panel: visible if requester */}
                      {selectedTicket.request_by === currentUserId && (
                        <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-3">
                          <div className="flex items-center gap-2">
                            <Shield className="h-4.5 w-4.5 text-primary" />
                            <h3 className="text-sm font-bold tracking-tight text-primary">Ticket Requester Controls</h3>
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            As the requester, you can close this ticket if the issue is resolved, or cancel it if it is no longer needed.
                          </p>
                          <div className="grid grid-cols-2 gap-2 pt-1">
                            <Button
                              size="sm"
                              className="text-xs font-semibold h-8 bg-emerald-600 hover:bg-emerald-500 text-white border-none"
                              onClick={handleRequesterClose}
                              disabled={updatingTicket}
                            >
                              Close Request
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="text-xs font-semibold h-8"
                              onClick={handleRequesterCancel}
                              disabled={updatingTicket}
                            >
                              Cancel Request
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Division Staff / Handler / Admin Control Panel */}
                      {(isMemberOfRequestedDivision(selectedTicket.request_to_division) || 
                        selectedTicket.team_user_ids?.includes(currentUserId) ||
                        selectedTicket.tag_person === currentUserId ||
                        users.find(u => u.user_id === currentUserId)?.level === 7) && (
                        <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-4">
                          <div className="flex items-center gap-2">
                            <Shield className="h-4.5 w-4.5 text-primary" />
                            <h3 className="text-sm font-bold tracking-tight text-primary">
                              Requested Division Control Panel
                            </h3>
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            As a member of the requested division, assigned handler, or admin, you can manage assignments, status, and category.
                          </p>

                          <div className="grid grid-cols-2 gap-4">
                            {/* Status Update */}
                            <div className="space-y-1 text-left">
                              <Label htmlFor="edit_status" className="text-[10px] font-bold uppercase text-muted-foreground">
                                Update Status
                              </Label>
                              <Select
                                value={editStatus}
                                onValueChange={(val) => setEditStatus(val as Ticket["status"])}
                              >
                                <SelectTrigger id="edit_status" className="h-8 text-xs bg-background">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Open">Open</SelectItem>
                                  <SelectItem value="In Progress">In Progress</SelectItem>
                                  <SelectItem value="Pending">Pending</SelectItem>
                                  <SelectItem value="Resolved">Resolved</SelectItem>
                                  {users.find(u => u.user_id === currentUserId)?.level === 7 && (
                                    <SelectItem value="Closed">Closed</SelectItem>
                                  )}
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Edit Priority */}
                            <div className="space-y-1 text-left">
                              <Label htmlFor="edit_priority" className="text-[10px] font-bold uppercase text-muted-foreground">
                                Priority Adjust
                              </Label>
                              <Select
                                value={editPriority}
                                onValueChange={(val) => setEditPriority(val as Ticket["priority"])}
                              >
                                <SelectTrigger id="edit_priority" className="h-8 text-xs bg-background">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Low">Low</SelectItem>
                                  <SelectItem value="Medium">Medium</SelectItem>
                                  <SelectItem value="High">High</SelectItem>
                                  <SelectItem value="Critical">Critical</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            {/* Division Category */}
                            <div className="space-y-1 text-left">
                              <Label htmlFor="edit_cat" className="text-[10px] font-bold uppercase text-muted-foreground">
                                Assign Category
                              </Label>
                              <Input
                                id="edit_cat"
                                placeholder="e.g. Bug Fix, Server Setup"
                                value={editCategory}
                                onChange={(e) => setEditCategory(e.target.value)}
                                className="h-8 text-xs bg-background"
                              />
                            </div>

                            {/* Adjust Due Date */}
                            <div className="space-y-1 text-left">
                              <Label htmlFor="edit_due" className="text-[10px] font-bold uppercase text-muted-foreground">
                                Adjust Due Date {!(selectedTicket.request_by === currentUserId || users.find(u => u.user_id === currentUserId)?.level === 7) && "(Requester Only)"}
                              </Label>
                              <Input
                                id="edit_due"
                                type="date"
                                value={editDueDate}
                                onChange={(e) => setEditDueDate(e.target.value)}
                                min={new Date().toLocaleDateString('en-CA')}
                                disabled={
                                  !(selectedTicket.request_by === currentUserId || users.find(u => u.user_id === currentUserId)?.level === 7) ||
                                  selectedTicket.status === "Resolved"
                                }
                                className="h-8 text-xs bg-background disabled:opacity-75 disabled:bg-muted/30"
                              />
                            </div>
                          </div>

                          {/* Assign Handlers */}
                          <div className="space-y-1 text-left">
                            <Label className="text-[10px] font-bold uppercase text-muted-foreground">
                              Assign Handlers
                            </Label>
                            <SearchableUserSelect
                              allUsers={users}
                              selectedUserIds={editTeamUserIds}
                              onAddUser={addEditTeamMember}
                              onRemoveUser={removeEditTeamMember}
                              placeholder="Assign handlers..."
                            />
                          </div>

                          <div className="pt-2">
                            <Button
                              size="sm"
                              className="w-full text-xs font-semibold h-8"
                              onClick={handleUpdateTicket}
                              disabled={updatingTicket}
                            >
                              {updatingTicket ? "Saving Changes..." : "Save Changes"}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Right Side: Tabbed panel for Comments and Timeline (5 cols) */}
                <div className="md:col-span-5 flex flex-col h-[500px] border rounded-xl overflow-hidden bg-muted/5 text-left">
                  <div className="flex border-b bg-muted/25 text-xs">
                    <button
                      onClick={() => setActiveDetailTab("comments")}
                      className={`flex-1 py-3 text-center font-bold tracking-wide uppercase transition-colors flex items-center justify-center gap-1.5 ${
                        activeDetailTab === "comments"
                          ? "bg-background border-b-2 border-primary text-primary"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      Comments ({comments.length})
                    </button>
                    <button
                      onClick={() => setActiveDetailTab("logs")}
                      className={`flex-1 py-3 text-center font-bold tracking-wide uppercase transition-colors flex items-center justify-center gap-1.5 ${
                        activeDetailTab === "logs"
                          ? "bg-background border-b-2 border-primary text-primary"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <History className="h-3.5 w-3.5" />
                      Activity Log ({logs.length})
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {loadingDetails ? (
                      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                        Loading ticket timeline details...
                      </div>
                    ) : activeDetailTab === "comments" ? (
                      comments.length === 0 ? (
                        <div className="flex h-full items-center justify-center text-xs text-muted-foreground italic">
                          No comments posted yet.
                        </div>
                      ) : (
                        comments.map((c) => {
                          const isMe = c.created_by === currentUserId;
                          return (
                            <div key={c.id} className={`flex gap-3 text-sm ${isMe ? "flex-row-reverse text-right" : "text-left"}`}>
                              {/* Profile Picture */}
                              <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                                isMe ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"
                              }`}>
                                {(c.author_name || "U").charAt(0).toUpperCase()}
                              </div>
                              
                              {/* Comment Content Box */}
                              <div className={`space-y-1 max-w-[80%] p-3 rounded-xl border ${
                                isMe 
                                  ? "bg-primary/10 border-primary/20 text-left" 
                                  : "bg-muted/20 border-muted text-left"
                              }`}>
                                <div className="flex items-center justify-between gap-4">
                                  <span className="font-semibold text-xs text-foreground">
                                    {isMe ? "You" : (c.author_name || c.created_by)}
                                  </span>
                                  <span className="text-[9px] text-muted-foreground shrink-0">
                                    {formatTime(c.created_at)}
                                  </span>
                                </div>
                                <div className="mt-1">{formatCommentContent(c.content)}</div>
                              </div>
                            </div>
                          );
                        })
                      )
                    ) : logs.length === 0 ? (
                      <div className="flex h-full items-center justify-center text-xs text-muted-foreground italic">
                        No activity logged yet.
                      </div>
                    ) : (
                      <div className="space-y-4 pl-2 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-muted">
                        {logs.map((l) => (
                          <div key={l.id} className="flex gap-3 text-xs relative">
                            <div className="h-6 w-6 rounded-full border bg-background text-primary flex items-center justify-center shrink-0 z-10">
                              <Check className="h-3 w-3" />
                            </div>
                            <div className="space-y-0.5 pt-0.5 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold text-foreground">
                                  {l.action.replace("_", " ")}
                                </span>
                                <span className="text-[9px] text-muted-foreground shrink-0">
                                  {formatTime(l.created_at)}
                                </span>
                              </div>
                              <p className="text-muted-foreground text-[11px]">{l.details}</p>
                              <p className="text-[10px] text-primary/80 font-medium">
                                By {l.actor_name || l.created_by}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Comment Input Box (only shown for Comments Tab) */}
                  {activeDetailTab === "comments" && (
                    <form onSubmit={handleAddComment} className="p-3 border-t bg-muted/10 space-y-2">
                      {/* File Attachment preview */}
                      {commentFileName && (
                        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border bg-background text-xs animate-in fade-in duration-100">
                          <Paperclip className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span className="truncate flex-1 font-medium text-muted-foreground">{commentFileName}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="h-5 w-5 hover:bg-destructive/10 hover:text-destructive"
                            onClick={handleRemoveCommentFile}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      )}

                      <div className="relative">
                        <Textarea
                          id="ticket-comment-textarea"
                          placeholder="Write a comment... Type @ to tag people."
                          value={commentContent}
                          onChange={(e) => handleCommentTextareaChange(e.target.value, e.target.selectionStart)}
                          onKeyDown={handleCommentKeyDown}
                          rows={2}
                          className="resize-none text-xs bg-background"
                          disabled={submittingComment || commentUploading}
                        />

                        {/* Suggestions dropdown */}
                        {cShowSuggestions && commentSuggestions.length > 0 && (
                          <div className="absolute bottom-full left-0 z-50 mb-1 w-full max-h-36 overflow-y-auto rounded-lg border bg-popover text-popover-foreground shadow-lg p-1 space-y-0.5 animate-in fade-in duration-100">
                            <div className="text-[9px] text-muted-foreground font-semibold px-2 py-0.5 border-b mb-1">
                              Suggestions
                            </div>
                            {commentSuggestions.map((u, i) => (
                              <button
                                key={u.user_id}
                                type="button"
                                onClick={() => handleSelectCommentUser(u)}
                                onMouseEnter={() => setCHighlightedIndex(i)}
                                className={`w-full text-left px-2 py-1 rounded text-[11px] transition-colors ${
                                  cHighlightedIndex === i ? "bg-primary/10 text-primary" : "hover:bg-muted"
                                }`}
                              >
                                <span className="font-medium">{u.user_name || u.user_email}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {/* File Upload Input */}
                          <input
                            ref={commentFileInputRef}
                            type="file"
                            accept=".pdf,.xlsx,.xls,.docx,.doc,.zip,.png,.jpg,.jpeg,.gif,.webp"
                            onChange={handleCommentFileSelect}
                            className="hidden"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg"
                            onClick={() => commentFileInputRef.current?.click()}
                            disabled={commentUploading || submittingComment}
                            title="Attach file"
                          >
                            {commentUploading ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Paperclip className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </div>

                        <Button
                          type="submit"
                          size="xs"
                          className="h-7 px-3 text-xs"
                          disabled={submittingComment || commentUploading || (!commentContent.trim() && !commentFileUrl)}
                        >
                          {submittingComment ? "..." : "Send"}
                        </Button>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Premium Confirmation Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-left">
              <Shield className="h-5 w-5 text-primary shrink-0" />
              {confirmConfig?.title || "Are you sure?"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-2 text-left">
              {confirmConfig?.description || "This action cannot be undone."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex justify-end gap-2 mt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setConfirmOpen(false)}
              className="text-xs"
            >
              {confirmConfig?.cancelText || "Cancel"}
            </Button>
            <Button
              type="button"
              variant={confirmConfig?.variant === "destructive" ? "destructive" : "default"}
              size="sm"
              onClick={() => {
                if (confirmConfig?.onConfirm) {
                  confirmConfig.onConfirm()
                }
              }}
              className={`text-xs ${
                confirmConfig?.variant === "success" 
                  ? "bg-emerald-600 hover:bg-emerald-500 text-white border-none" 
                  : ""
              }`}
            >
              {confirmConfig?.confirmText || "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
