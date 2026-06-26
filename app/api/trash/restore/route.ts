import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { 
  restoreProject, 
  restoreTask, 
  restoreReport,
  findAllProjectsIncludingDeleted,
  findAllTasksIncludingDeleted,
  findAllReportsIncludingDeleted
} from '@/lib/repositories';

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();

    // Check if it's a batch restore
    if (body.items && Array.isArray(body.items)) {
      const items = body.items as { type: string; id: string }[];
      let successCount = 0;
      for (const item of items) {
        let success = false;
        switch (item.type) {
          case 'project': {
            const projects = await findAllProjectsIncludingDeleted(session.user_id);
            if (projects.some((p) => p.project_id === item.id && p.deleted_at)) {
              success = await restoreProject(item.id, session.real_user_id ?? session.user_id);
            }
            break;
          }
          case 'task': {
            const tasks = await findAllTasksIncludingDeleted(session.user_id);
            if (tasks.some((t) => t.id === item.id && t.deleted_at)) {
              success = await restoreTask(item.id, session.real_user_id ?? session.user_id);
            }
            break;
          }
          case 'report': {
            const reports = await findAllReportsIncludingDeleted(session.user_id);
            if (reports.some((r) => r.report_id === item.id && r.deleted_at)) {
              success = await restoreReport(item.id);
            }
            break;
          }
        }
        if (success) successCount++;
      }
      return NextResponse.json({ success: true, count: successCount });
    }

    const { type, id } = body as { type: string; id: string };

    if (!type || !id) {
      return NextResponse.json({ error: 'Missing type or id' }, { status: 400 });
    }

    let success = false;
    switch (type) {
      case 'project': {
        const projects = await findAllProjectsIncludingDeleted(session.user_id);
        if (!projects.some((p) => p.project_id === id && p.deleted_at)) {
          return NextResponse.json({ error: 'Unauthorized or not found' }, { status: 403 });
        }
        success = await restoreProject(id, session.real_user_id ?? session.user_id);
        break;
      }
      case 'task': {
        const tasks = await findAllTasksIncludingDeleted(session.user_id);
        if (!tasks.some((t) => t.id === id && t.deleted_at)) {
          return NextResponse.json({ error: 'Unauthorized or not found' }, { status: 403 });
        }
        success = await restoreTask(id, session.real_user_id ?? session.user_id);
        break;
      }
      case 'report': {
        const reports = await findAllReportsIncludingDeleted(session.user_id);
        if (!reports.some((r) => r.report_id === id && r.deleted_at)) {
          return NextResponse.json({ error: 'Unauthorized or not found' }, { status: 403 });
        }
        success = await restoreReport(id);
        break;
      }
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
