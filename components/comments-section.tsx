"use client"

import { useEffect, useState, useMemo } from "react"
import { Send, AtSign, Loader2, MessageSquare, Reply } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Comment } from "@/lib/types"

interface CommentsSectionProps {
  projectId?: string
  taskId?: string
  allUsers: { user_id: string; user_name: string; user_email: string }[]
}

export function CommentsSection({ projectId, taskId, allUsers }: CommentsSectionProps) {
  const [comments, setComments] = useState<(Comment & { created_by_name?: string })[]>([])
  const [content, setContent] = useState("")
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [activeReplyId, setActiveReplyId] = useState<string | null>(null)
  const [replyContent, setReplyContent] = useState("")

  useEffect(() => {
    let active = true
    const fetchComments = async () => {
      try {
        const query = projectId ? `project_id=${projectId}` : `task_id=${taskId}`
        const res = await fetch(`/api/comments?${query}`)
        if (res.ok && active) {
          const data = await res.json()
          setComments(data)
        }
      } catch (error) {
        console.error("Failed to fetch comments:", error)
      } finally {
        if (active) setLoading(false)
      }
    }

    fetchComments()
    return () => {
      active = false
    }
  }, [projectId, taskId, refreshTrigger])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim() || submitting) return
    setSubmitting(true)

    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: projectId || undefined,
          task_id: taskId || undefined,
          content: content.trim(),
        }),
      })

      if (res.ok) {
        setContent("")
        setRefreshTrigger((prev) => prev + 1)
      }
    } catch (error) {
      console.error("Failed to submit comment:", error)
    } finally {
      setSubmitting(false)
    }
  }

  const handleReplySubmit = async (e: React.FormEvent, parentId: string) => {
    e.preventDefault()
    if (!replyContent.trim() || submitting) return
    setSubmitting(true)

    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: projectId || undefined,
          task_id: taskId || undefined,
          parent_id: parentId,
          content: replyContent.trim(),
        }),
      })

      if (res.ok) {
        setReplyContent("")
        setActiveReplyId(null)
        setRefreshTrigger((prev) => prev + 1)
      }
    } catch (error) {
      console.error("Failed to submit reply:", error)
    } finally {
      setSubmitting(false)
    }
  }

  const handleMentionSelect = (user: typeof allUsers[0]) => {
    const mentionText = `@${user.user_name || user.user_email} `
    setContent((prev) => prev + mentionText)
  }

  const { rootComments, repliesByRoot, commentMap } = useMemo(() => {
    const commentMap = new Map(comments.map((c) => [c.id, c]))

    // Find root comments (either no parent_id, or parent_id not in map)
    const rootComments = comments.filter((c) => !c.parent_id || !commentMap.has(c.parent_id))

    // Helper to find the top-level parent ID
    const getRootParentId = (c: typeof comments[0]): string | null => {
      let curr = c
      while (curr.parent_id) {
        const next = commentMap.get(curr.parent_id)
        if (!next) break
        curr = next
      }
      return curr.parent_id ? null : curr.id
    }

    const repliesByRoot = new Map<string, typeof comments>()
    for (const c of comments) {
      if (c.parent_id) {
        const rootId = getRootParentId(c)
        if (rootId) {
          if (!repliesByRoot.has(rootId)) {
            repliesByRoot.set(rootId, [])
          }
          repliesByRoot.get(rootId)!.push(c)
        }
      }
    }

    return { rootComments, repliesByRoot, commentMap }
  }, [comments])

  const formatCommentContent = (text: string) => {
    return text.split(/(\s+)/).map((part, index) => {
      if (part.startsWith("@")) {
        return (
          <span key={index} className="rounded-md bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary inline-block">
            {part}
          </span>
        )
      }
      return part
    })
  }

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString)
      return date.toLocaleDateString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        day: "numeric",
        month: "short",
      })
    } catch {
      return isoString
    }
  }

  return (
    <Card className="border shadow-sm">
      <CardHeader className="flex flex-row items-center gap-2 border-b pb-4">
        <MessageSquare className="h-5 w-5 text-primary" />
        <CardTitle className="text-lg font-bold">Notes & Comments</CardTitle>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        {/* Comment Input */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write a comment or update... Use the dropdown to tag someone."
            rows={3}
            className="resize-none"
          />
          <div className="flex justify-between items-center">
            {/* Tag selector helper */}
            <div className="flex items-center gap-2">
              <AtSign className="h-4 w-4 text-muted-foreground" />
              <select
                onChange={(e) => {
                  const val = e.target.value
                  if (val) {
                    const user = allUsers.find((u) => u.user_id === val)
                    if (user) handleMentionSelect(user)
                    e.target.value = "" // Reset select element
                  }
                }}
                className="h-8 rounded-lg border border-input bg-card px-2.5 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Tag team member...</option>
                {allUsers.map((u) => (
                  <option key={u.user_id} value={u.user_id}>
                    {u.user_name || u.user_email}
                  </option>
                ))}
              </select>
            </div>

            <Button type="submit" size="sm" disabled={!content.trim() || submitting}>
              {submitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <>
                  <Send className="mr-1.5 h-3.5 w-3.5" />
                  Send
                </>
              )}
            </Button>
          </div>
        </form>

        {/* Comment List */}
        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : rootComments.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No comments yet. Be the first to share an update!
            </div>
          ) : (
            <div className="max-h-[500px] overflow-y-auto pr-2 space-y-6">
              {rootComments.map((rootComment, index) => {
                const replies = repliesByRoot.get(rootComment.id) || []
                return (
                  <div key={rootComment.id} className={`space-y-4 ${index > 0 ? "border-t pt-6" : ""}`}>
                    {/* Parent Comment */}
                    <div className="flex gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                        {(rootComment.created_by_name || rootComment.created_by || "S").charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-sm font-semibold text-foreground">
                            {rootComment.created_by_name || rootComment.created_by}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                          {formatCommentContent(rootComment.content)}
                        </p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-[10px] text-muted-foreground">
                            {formatTime(rootComment.created_at)}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveReplyId(rootComment.id)
                              setReplyContent("")
                            }}
                            className="text-[11px] font-medium text-primary hover:underline flex items-center gap-0.5"
                          >
                            <Reply className="h-3 w-3" />
                            Reply
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Parent Inline Reply Form */}
                    {activeReplyId === rootComment.id && (
                      <form onSubmit={(e) => handleReplySubmit(e, rootComment.id)} className="ml-11 mt-2 space-y-2 border p-3 rounded-xl bg-muted/20">
                        <Textarea
                          autoFocus
                          value={replyContent}
                          onChange={(e) => setReplyContent(e.target.value)}
                          placeholder={`Reply to ${rootComment.created_by_name || rootComment.created_by}...`}
                          rows={2}
                          className="resize-none text-sm"
                        />
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <AtSign className="h-3.5 w-3.5 text-muted-foreground" />
                            <select
                              onChange={(e) => {
                                const val = e.target.value
                                if (val) {
                                  const user = allUsers.find((u) => u.user_id === val)
                                  if (user) {
                                    const mentionText = `@${user.user_name || user.user_email} `
                                    setReplyContent((prev) => prev + mentionText)
                                  }
                                  e.target.value = ""
                                }
                              }}
                              className="h-7 rounded-md border border-input bg-card px-2 py-0.5 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
                            >
                              <option value="">Tag...</option>
                              {allUsers.map((u) => (
                                <option key={u.user_id} value={u.user_id}>
                                  {u.user_name || u.user_email}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="xs"
                              onClick={() => {
                                setActiveReplyId(null)
                                setReplyContent("")
                              }}
                            >
                              Cancel
                            </Button>
                            <Button type="submit" size="xs" disabled={!replyContent.trim() || submitting}>
                              {submitting ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <>
                                  <Send className="mr-1 h-3 w-3" />
                                  Reply
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      </form>
                    )}

                    {/* Replies List */}
                    {replies.length > 0 && (
                      <div className="ml-11 pl-4 border-l-2 border-muted/50 space-y-4">
                        {replies.map((reply) => {
                          const directParent = reply.parent_id ? commentMap.get(reply.parent_id) : null
                          const replyingToName = directParent ? (directParent.created_by_name || directParent.created_by) : null

                          return (
                            <div key={reply.id} className="space-y-2">
                              <div className="flex gap-3">
                                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                                  {(reply.created_by_name || reply.created_by || "S").charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0 flex-1 space-y-1">
                                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                                    <span className="text-xs font-semibold text-foreground">
                                      {reply.created_by_name || reply.created_by}
                                    </span>
                                    {replyingToName && (
                                      <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                        replying to <span className="font-semibold text-foreground/80">{replyingToName}</span>
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
                                    {formatCommentContent(reply.content)}
                                  </p>
                                  <div className="flex items-center gap-3 mt-1">
                                    <span className="text-[9px] text-muted-foreground">
                                      {formatTime(reply.created_at)}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveReplyId(reply.id)
                                        setReplyContent("")
                                      }}
                                      className="text-[10px] font-medium text-primary hover:underline flex items-center gap-0.5"
                                    >
                                      <Reply className="h-2.5 w-2.5" />
                                      Reply
                                    </button>
                                  </div>
                                </div>
                              </div>

                              {/* Reply Inline Reply Form */}
                              {activeReplyId === reply.id && (
                                <form onSubmit={(e) => handleReplySubmit(e, reply.id)} className="ml-9 space-y-2 border p-3 rounded-xl bg-muted/20">
                                  <Textarea
                                    autoFocus
                                    value={replyContent}
                                    onChange={(e) => setReplyContent(e.target.value)}
                                    placeholder={`Reply to ${reply.created_by_name || reply.created_by}...`}
                                    rows={2}
                                    className="resize-none text-sm"
                                  />
                                  <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                      <AtSign className="h-3.5 w-3.5 text-muted-foreground" />
                                      <select
                                        onChange={(e) => {
                                          const val = e.target.value
                                          if (val) {
                                            const user = allUsers.find((u) => u.user_id === val)
                                            if (user) {
                                              const mentionText = `@${user.user_name || user.user_email} `
                                              setReplyContent((prev) => prev + mentionText)
                                            }
                                            e.target.value = ""
                                          }
                                        }}
                                        className="h-7 rounded-md border border-input bg-card px-2 py-0.5 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
                                      >
                                        <option value="">Tag...</option>
                                        {allUsers.map((u) => (
                                          <option key={u.user_id} value={u.user_id}>
                                            {u.user_name || u.user_email}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                    <div className="flex gap-2">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="xs"
                                        onClick={() => {
                                          setActiveReplyId(null)
                                          setReplyContent("")
                                        }}
                                      >
                                        Cancel
                                      </Button>
                                      <Button type="submit" size="xs" disabled={!replyContent.trim() || submitting}>
                                        {submitting ? (
                                          <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : (
                                          <>
                                            <Send className="mr-1 h-3 w-3" />
                                            Reply
                                          </>
                                        )}
                                      </Button>
                                    </div>
                                  </div>
                                </form>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
