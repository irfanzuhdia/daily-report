import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { TicketRepository } from '@/lib/repositories';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const request_by = searchParams.get('request_by') || undefined;
    const request_to_division = searchParams.get('request_to_division') || undefined;
    const tag_person = searchParams.get('tag_person') || undefined;
    const status = searchParams.get('status') || undefined;
    const priority = searchParams.get('priority') || undefined;
    const search = searchParams.get('search') || undefined;

    const tickets = await TicketRepository.findAll({
      request_by,
      request_to_division,
      tag_person,
      status,
      priority,
      search,
    });

    return NextResponse.json(tickets);
  } catch (error) {
    console.error('GET /api/tickets error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      title,
      description,
      request_to_division,
      problem_type,
      priority,
      due_date,
      attachment_link,
      attachment_file,
      tag_person,
      team_user_ids,
    } = body;

    // Validate required fields: either request_to_division OR a specific handler must be present
    const hasSpecificHandler = (team_user_ids && team_user_ids.length > 0) || tag_person;
    const targetDivision = request_to_division?.trim() || null;
    if (!title?.trim() || !description?.trim() || !problem_type?.trim() || (!targetDivision && !hasSpecificHandler)) {
      return NextResponse.json(
        { error: 'Title, description, problem type, and either a target division or a tagged handler are required.' },
        { status: 400 }
      );
    }

    const ticket = await TicketRepository.create(
      {
        title,
        description,
        request_by: session.user_id,
        request_to_division: targetDivision,
        problem_type,
        priority,
        due_date,
        attachment_link,
        attachment_file,
        tag_person: tag_person || null,
        team_user_ids: team_user_ids || [],
      },
      session.real_user_id ?? session.user_id
    );

    return NextResponse.json(ticket, { status: 201 });
  } catch (error) {
    console.error('POST /api/tickets error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
