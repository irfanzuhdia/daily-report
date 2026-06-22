import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { FileRepository } from '@/lib/repositories';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const success = await FileRepository.softDelete(id, session.user_id);
  if (!success) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
