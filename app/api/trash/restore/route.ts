import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { restoreProject, restoreTask, restoreReport } from '@/lib/repositories';

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { type, id } = body as { type: string; id: string };

    if (!type || !id) {
      return NextResponse.json({ error: 'Missing type or id' }, { status: 400 });
    }

    let success = false;
    switch (type) {
      case 'project':
        success = await restoreProject(id);
        break;
      case 'task':
        success = await restoreTask(id);
        break;
      case 'report':
        success = await restoreReport(id);
        break;
      default:
        return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }

    if (!success) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Restore error:', error);
    return NextResponse.json({ error: 'Restore failed' }, { status: 500 });
  }
}
