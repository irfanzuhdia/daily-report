import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { TicketRepository } from '@/lib/repositories';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { content } = body;

    if (!content || !content.trim()) {
      return NextResponse.json({ error: 'Comment content is required.' }, { status: 400 });
    }

    const comment = await TicketRepository.createComment(
      id,
      content,
      session.real_user_id ?? session.user_id
    );

    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    logger.error('POST /api/tickets/[id]/comments error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
