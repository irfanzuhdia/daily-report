import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { NotificationRepository } from '@/lib/repositories'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const countOnly = searchParams.get('count_only') === 'true'

    if (countOnly) {
      const unreadCount = await NotificationRepository.findUnreadCount(session.user_id)
      return NextResponse.json({ unreadCount })
    }

    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    const [notifications, unreadCount] = await Promise.all([
      NotificationRepository.findPaginated(session.user_id, limit, offset),
      NotificationRepository.findUnreadCount(session.user_id)
    ])

    return NextResponse.json({ notifications, unreadCount })
  } catch (error) {
    logger.error('GET /api/notifications error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id, all } = body

    if (all) {
      await NotificationRepository.markAllAsRead(session.user_id)
      return NextResponse.json({ success: true })
    }

    if (id) {
      await NotificationRepository.markAsRead(id, session.user_id)
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'id or all is required' }, { status: 400 })
  } catch (error) {
    logger.error('PUT /api/notifications error:', error)
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
    const { user_id, type, title, content, link } = body

    if (!user_id || !title || !content) {
      return NextResponse.json({ error: 'user_id, title, and content are required' }, { status: 400 })
    }

    const notification = await NotificationRepository.create({
      user_id,
      type: type || 'info',
      title,
      content,
      link: link || '/inbox',
    })

    return NextResponse.json({ success: true, notification })
  } catch (error) {
    logger.error('POST /api/notifications error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
