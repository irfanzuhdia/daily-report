import { NextRequest } from 'next/server';
import { getSession } from '@/lib/session';
import { ticketSchema } from '@/lib/validation/schemas';
import { TicketService } from '@/lib/services/ticket-service';
import { handleApiError } from '@/lib/error-handler';
import { createSuccessResponse, createErrorResponse } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return createErrorResponse("UNAUTHORIZED", "Unauthorized", 401);
    }

    const { searchParams } = new URL(request.url);
    const params = {
      tab: searchParams.get('tab') as 'my' | 'requested' | undefined,
      request_by: searchParams.get('request_by') || undefined,
      request_to_division: searchParams.get('request_to_division') || undefined,
      tag_person: searchParams.get('tag_person') || undefined,
      status: searchParams.get('status') || undefined,
      priority: searchParams.get('priority') || undefined,
      search: searchParams.get('search') || undefined,
    };

    const currentUser = { id: session.user_id };
    const tickets = await TicketService.getAllTickets(params, currentUser);
    return createSuccessResponse(tickets);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return createErrorResponse("UNAUTHORIZED", "Unauthorized", 401);
    }

    const body = await request.json();
    const currentUser = { id: session.real_user_id ?? session.user_id };
    const dataToValidate = { ...body, request_by: currentUser.id };

    const validatedData = ticketSchema.parse(dataToValidate);
    
    const ticket = await TicketService.createTicket(validatedData, currentUser);
    return createSuccessResponse(ticket, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

