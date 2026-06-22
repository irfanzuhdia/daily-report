import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { FileRepository, UserRepository } from '@/lib/repositories';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('project_id');
  const taskId = searchParams.get('task_id');
  const reportId = searchParams.get('report_id');

  let files = [];
  if (projectId) {
    files = await FileRepository.findByProjectId(projectId);
  } else if (taskId) {
    files = await FileRepository.findByTaskId(taskId);
  } else if (reportId) {
    files = await FileRepository.findByReportId(reportId);
  } else {
    files = await FileRepository.findAll();
  }

  // Enrich with user name
  const users = await UserRepository.findAll();
  const userMap = new Map(users.map((u) => [u.user_id, u.user_name || u.user_email]));

  const enrichedFiles = files.map((f) => ({
    ...f,
    created_by_name: f.created_by ? (userMap.get(f.created_by) || f.created_by) : 'System',
  }));

  return NextResponse.json(enrichedFiles);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { project_id, task_id, report_id, file_url, file_description } = body;

    if (!file_url) {
      return NextResponse.json({ error: 'file_url is required' }, { status: 400 });
    }

    if (!project_id && !task_id && !report_id) {
      return NextResponse.json(
        { error: 'At least one of project_id, task_id, or report_id must be provided' },
        { status: 400 }
      );
    }

    const file = await FileRepository.create(
      {
        project_id: project_id || null,
        task_id: task_id || null,
        report_id: report_id || null,
        file_url,
        file_description: file_description || null,
      },
      session.user_id
    );

    return NextResponse.json(file, { status: 201 });
  } catch (error: unknown) {
    console.error('Failed to create file:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
