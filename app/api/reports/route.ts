import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { DailyReportRepository } from '@/lib/repositories'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const reports = await DailyReportRepository.findAll()
    return NextResponse.json(reports)
  } catch (error) {
    console.error('GET /api/reports error:', error)
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
    const report = await DailyReportRepository.create(
      { ...body, user_id: session.real_user_id ?? session.user_id },
      session.real_user_id ?? session.user_id
    )
    return NextResponse.json(report, { status: 201 })
  } catch (error) {
    console.error('POST /api/reports error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
