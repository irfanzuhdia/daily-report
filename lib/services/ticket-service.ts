import { TicketRepository, UserRepository } from '@/lib/repositories';
import { AppError } from '@/lib/api-response';

export const TicketService = {
  async getAllTickets(params: any, currentUser: { id: string }) {
    let currentUserDivision = '';
    if (params.tab === 'requested') {
      const user = await UserRepository.findById(currentUser.id);
      currentUserDivision = user?.user_division || '';
    }

    return await TicketRepository.findAll({
      ...params,
      currentUserId: currentUser.id,
      currentUserDivision,
    });
  },

  async getTicketDetails(ticketId: string) {
    const ticket = await TicketRepository.findById(ticketId);
    if (!ticket) {
      throw new AppError("NOT_FOUND", "Ticket not found", 404);
    }

    const [comments, logs] = await Promise.all([
      TicketRepository.findComments(ticketId),
      TicketRepository.findLogs(ticketId),
    ]);

    return { ticket, comments, logs };
  },

  async createTicket(ticketData: any, currentUser: { id: string }) {
    const hasSpecificHandler = (ticketData.team_user_ids && ticketData.team_user_ids.length > 0) || ticketData.tag_person;
    const targetDivision = ticketData.request_to_division?.trim() || null;
    
    if (!targetDivision && !hasSpecificHandler) {
      throw new AppError("VALIDATION_ERROR", "Either a target division or a tagged handler are required.", 400);
    }

    return await TicketRepository.create(
      {
        ...ticketData,
        request_to_division: targetDivision,
        tag_person: ticketData.tag_person || null,
        team_user_ids: ticketData.team_user_ids || [],
      },
      currentUser.id
    );
  },

  async updateTicket(ticketId: string, ticketData: any, currentUser: { id: string }) {
    const updated = await TicketRepository.update(ticketId, ticketData, currentUser.id);
    if (!updated) {
      throw new AppError("NOT_FOUND", "Ticket not found or update failed", 404);
    }
    return updated;
  },

  async deleteTicket(ticketId: string, currentUser: { id: string }) {
    const success = await TicketRepository.softDelete(ticketId, currentUser.id);
    if (!success) {
      throw new AppError("NOT_FOUND", "Ticket not found or deletion failed", 404);
    }
    return { success: true };
  }
};
