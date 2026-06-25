import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { CommentRepository, UserRepository, NotificationRepository } from '@/lib/repositories'
import type { Comment } from '@/lib/types'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('project_id')
    const taskId = searchParams.get('task_id')

    if (!projectId && !taskId) {
      return NextResponse.json({ error: 'project_id or task_id is required' }, { status: 400 })
    }

    let comments: Comment[] = []
    if (projectId) {
      comments = await CommentRepository.findByProjectId(projectId)
    } else if (taskId) {
      comments = await CommentRepository.findByTaskId(taskId)
    }

    // Enrich with creator name
    const users = await UserRepository.findAll()
    const userMap = new Map(users.map(u => [u.user_id, u.user_name || u.user_email]))

    const enriched = comments.map(c => ({
      ...c,
      created_by_name: c.created_by ? (userMap.get(c.created_by) || c.created_by) : 'System'
    }))

    return NextResponse.json(enriched)
  } catch (error) {
    console.error('GET /api/comments error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { project_id, task_id, parent_id, content } = body

    if (!content || !content.trim()) {
      return NextResponse.json({ error: 'Comment content is required' }, { status: 400 })
    }

    if (!project_id && !task_id) {
      return NextResponse.json({ error: 'project_id or task_id is required' }, { status: 400 })
    }

    const comment = await CommentRepository.create(
      {
        project_id: project_id || null,
        task_id: task_id || null,
        parent_id: parent_id || null,
        content: content.trim()
      },
      session.real_user_id ?? session.user_id
    )

    const parent = parent_id ? await CommentRepository.findById(parent_id) : null
    const senderName = session.real_name ?? session.name ?? session.email ?? 'Someone'
    const truncatedComment = content.length > 80 ? content.substring(0, 80) + '...' : content
    const link = task_id ? `/tasks/${task_id}` : `/projects/${project_id}`

    // Notify parent commenter if someone replies
    if (parent && parent.created_by && parent.created_by !== (session.real_user_id ?? session.user_id)) {
      const title = task_id ? 'Replied to Task Comment' : 'Replied to Project Comment'
      await NotificationRepository.create({
        user_id: parent.created_by,
        type: 'reply',
        title,
        content: `${senderName} replied: "${truncatedComment}"`,
        link
      })
    }

    // Mention parsing
    const users = await UserRepository.findAll()
    const lowerContent = content.toLowerCase()
    
    // Find mentioned users
    const mentionedUsers = users.filter(u => {
      // Don't notify the user who made the comment
      if (u.user_id === (session.real_user_id ?? session.user_id)) return false
      // Avoid double notification if this user was already notified as the parent commenter
      if (parent && u.user_id === parent.created_by) return false

      const namePart = u.user_name ? u.user_name.toLowerCase() : ''
      const emailPart = u.user_email.toLowerCase()

      // Match @name (ignoring spaces if it matches full name) or @email or @user_id
      return (
        (namePart && lowerContent.includes(`@${namePart}`)) ||
        lowerContent.includes(`@${emailPart}`) ||
        lowerContent.includes(`@${u.user_id.toLowerCase()}`)
      )
    })

    for (const user of mentionedUsers) {
      const title = task_id ? 'Tagged in Task Comment' : 'Tagged in Project Comment'
      await NotificationRepository.create({
        user_id: user.user_id,
        type: 'mention',
        title,
        content: `${senderName} tagged you: "${truncatedComment}"`,
        link
      })
    }

    return NextResponse.json(comment, { status: 201 })
  } catch (error) {
    console.error('POST /api/comments error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
