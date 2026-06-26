import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { TicketRepository } from '@/lib/repositories';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const ticket = await TicketRepository.findById(id);
    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    const [comments, logs] = await Promise.all([
      TicketRepository.findComments(id),
      TicketRepository.findLogs(id),
    ]);

    return NextResponse.json({
      ticket,
      comments,
      logs,
    });
  } catch (error) {
    console.error('GET /api/tickets/[id] error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(
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

    const updated = await TicketRepository.update(
      id,
      body,
      session.real_user_id ?? session.user_id
    );

    if (!updated) {
      return NextResponse.json({ error: 'Ticket not found or update failed' }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('PUT /api/tickets/[id] error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const success = await TicketRepository.softDelete(
      id,
      session.real_user_id ?? session.user_id
    );

    if (!success) {
      return NextResponse.json({ error: 'Ticket not found or deletion failed' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/tickets/[id] error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
