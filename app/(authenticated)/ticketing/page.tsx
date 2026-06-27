import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { TicketRepository, UserRepository } from "@/lib/repositories";
import { TicketingClient } from "./ticketing-client";
import { sql } from "@/lib/db";

export const revalidate = 0; // Disable cache to ensure real-time ticketing state

export default async function TicketingPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const userId = session.user_id;

  // Fetch all tickets, users, and linked projects efficiently
  const [allTickets, allUsers, linkedProjects] = await Promise.all([
    TicketRepository.findAll(), // No filters, fetch ALL tickets
    UserRepository.findAll(),
    sql`SELECT project_id, ticket_reference FROM projects WHERE ticket_reference IS NOT NULL AND deleted_at IS NULL`,
  ]);

  const currentUser = allUsers.find((u) => u.user_id === userId);

  // Extract all existing divisions from users, with fallbacks
  const userDivisions = Array.from(
    new Set(allUsers.map((u) => u.user_division).filter(Boolean))
  ) as string[];
  
  const defaultDivisions = ["IT", "HR", "Finance", "Operations", "Sales", "Marketing", "Legal", "General Affairs"];
  const divisions = Array.from(new Set([...defaultDivisions, ...userDivisions])).sort();

  // Build a map of ticket references to project IDs
  const ticketToProjectMap: Record<string, string> = {};
  for (const project of linkedProjects) {
    if (project.ticket_reference) {
      ticketToProjectMap[project.ticket_reference] = project.project_id;
    }
  }

  // Clean objects for serialization safety
  const cleanTickets = allTickets.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    request_by: t.request_by,
    request_to_division: t.request_to_division,
    tag_person: t.tag_person,
    team_user_ids: t.team_user_ids || [],
    problem_type: t.problem_type,
    division_category: t.division_category,
    due_date: t.due_date,
    priority: t.priority,
    status: t.status,
    attachment_link: t.attachment_link,
    attachment_file: t.attachment_file,
    created_by: t.created_by,
    created_at: t.created_at,
    updated_by: t.updated_by,
    updated_at: t.updated_at,
    deleted_by: t.deleted_by,
    deleted_at: t.deleted_at,
  }));

  const cleanUsers = allUsers.map((u) => ({
    user_id: u.user_id,
    user_name: u.user_name,
    user_email: u.user_email,
    user_occupation: u.user_occupation,
    user_departement: u.user_departement,
    user_division: u.user_division,
    user_site: u.user_site,
    user_team: u.user_team,
    user_unit: u.user_unit,
    level: u.level ?? 1,
  }));

  return (
    <TicketingClient
      initialTickets={cleanTickets}
      users={cleanUsers}
      currentUserId={userId}
      currentUserDivision={currentUser?.user_division || ""}
      divisions={divisions}
      ticketToProjectMap={ticketToProjectMap}
    />
  );
}
