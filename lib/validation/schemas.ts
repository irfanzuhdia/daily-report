import { z } from "zod";

// Base common fields
const baseEntity = z.object({
  id: z.string().uuid().optional(),
  created_by: z.string().uuid().nullable().optional(),
  created_at: z.string().datetime().nullable().optional(),
  updated_by: z.string().uuid().nullable().optional(),
  updated_at: z.string().datetime().nullable().optional(),
  deleted_by: z.string().uuid().nullable().optional(),
  deleted_at: z.string().datetime().nullable().optional(),
});

// User Validation Schema
export const userSchema = z.object({
  user_id: z.string().uuid(),
  user_email: z.string().email({ message: "Invalid email address" }),
  user_name: z.string().min(2, { message: "Name must be at least 2 characters" }).nullable().optional(),
  user_occupation: z.string().nullable().optional(),
  user_division: z.string().nullable().optional(),
  user_departement: z.string().nullable().optional(),
  user_site: z.string().nullable().optional(),
  user_team: z.string().nullable().optional(),
  user_unit: z.string().nullable().optional(),
  level: z.number().int().min(1).max(5).optional(),
}).merge(baseEntity.omit({ id: true }));

export type UserInput = z.infer<typeof userSchema>;

// Project Validation Schema
export const projectSchema = z.object({
  project_name: z.string().min(3, { message: "Project name must be at least 3 characters" }),
  project_description: z.string().nullable().optional(),
  project_start_date_plan: z.string().nullable().optional(),
  project_end_date_plan: z.string().nullable().optional(),
  project_status: z.enum(["NS", "OP", "D", "H", "CC"]),
  project_file: z.string().url().nullable().optional(),
  additional_link: z.string().url().nullable().optional().or(z.literal("")),
  category: z.string().nullable().optional(),
  ticket_reference: z.string().nullable().optional(),
  team_user_ids: z.array(z.string().uuid()).optional(),
}).merge(baseEntity);

export type ProjectInput = z.infer<typeof projectSchema>;

// Task Validation Schema
export const taskSchema = z.object({
  project_id: z.string().uuid({ message: "Valid Project ID is required" }),
  task_description: z.string().min(5, { message: "Task description must be at least 5 characters" }),
  task_status: z.enum(["NS", "OP", "D", "H", "CC", "C"]),
  task_latest_percentage: z.string().regex(/^\d{1,3}$/, { message: "Percentage must be a number between 0-100" }).nullable().optional(),
  task_file: z.string().url().nullable().optional(),
  additional_link: z.string().url().nullable().optional().or(z.literal("")),
  task_user_ids: z.array(z.string().uuid()).optional(),
}).merge(baseEntity);

export type TaskInput = z.infer<typeof taskSchema>;

// Daily Report Validation Schema
export const dailyReportSchema = z.object({
  task_id: z.string().uuid({ message: "Valid Task ID is required" }),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Date must be in YYYY-MM-DD format" }),
  progress_percentage: z.string().regex(/^\d{1,3}$/, { message: "Percentage must be between 0-100" }),
  total_hours: z.string().regex(/^\d+(\.\d+)?$/, { message: "Total hours must be a valid number" }),
  remarks: z.string().min(5, { message: "Remarks must be at least 5 characters" }).nullable().optional(),
  user_id: z.string().uuid({ message: "Valid User ID is required" }).nullable().optional(),
}).merge(baseEntity.omit({ updated_at: true, updated_by: true }));

export type DailyReportInput = z.infer<typeof dailyReportSchema>;

// Ticketing Validation Schema
export const ticketSchema = z.object({
  title: z.string().min(5, { message: "Title must be at least 5 characters long" }),
  description: z.string().min(10, { message: "Description must be at least 10 characters long" }),
  request_by: z.string().uuid(),
  request_to_division: z.string().nullable().optional(),
  tag_person: z.string().nullable().optional(),
  team_user_ids: z.array(z.string().uuid()).optional(),
  problem_type: z.string().min(1, { message: "Problem type is required" }),
  division_category: z.string().nullable().optional(),
  due_date: z.string().nullable().optional(),
  priority: z.enum(['Low', 'Medium', 'High', 'Critical']).default('Medium'),
  status: z.enum(['Open', 'In Progress', 'Resolved', 'Closed', 'Pending']).default('Open'),
  attachment_link: z.string().url().nullable().optional().or(z.literal("")),
  attachment_file: z.string().nullable().optional(),
}).merge(baseEntity);

export type TicketInput = z.infer<typeof ticketSchema>;
