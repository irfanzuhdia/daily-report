import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { DailyReportRepository } from '@/lib/repositories'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const report = await DailyReportRepository.findById(id)
    if (!report) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json(report)
  } catch (error) {
    console.error('GET /api/reports/[id] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const existing = await DailyReportRepository.findById(id)
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    if (existing.user_id !== session.user_id && existing.created_by !== session.user_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const report = await DailyReportRepository.update(id, body, session.user_id)
    return NextResponse.json(report)
  } catch (error) {
    console.error('PUT /api/reports/[id] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const existing = await DailyReportRepository.findById(id)
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    if (existing.user_id !== session.user_id && existing.created_by !== session.user_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await DailyReportRepository.softDelete(id, session.user_id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/reports/[id] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

