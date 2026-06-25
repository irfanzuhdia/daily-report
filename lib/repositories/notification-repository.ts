import { sql } from '../db';
import type { Notification } from '../types';

// ============ NOTIFICATION REPOSITORY ============

export const NotificationRepository = {
  async findByUserId(userId: string): Promise<Notification[]> {
    const rows = await sql`SELECT * FROM notifications WHERE user_id = ${userId} ORDER BY created_at DESC`;
    return rows as unknown as Notification[];
  },

  async findPaginated(userId: string, limit: number, offset: number): Promise<Notification[]> {
    const rows = await sql`
      SELECT * FROM notifications 
      WHERE user_id = ${userId} 
      ORDER BY created_at DESC 
      LIMIT ${limit} OFFSET ${offset}
    `;
    return rows as unknown as Notification[];
  },

  async findUnreadCount(userId: string): Promise<number> {
    const res = await sql`SELECT COUNT(*)::int as count FROM notifications WHERE user_id = ${userId} AND is_read = false`;
    return res[0].count || 0;
  },

  async markAsRead(id: string, userId: string): Promise<boolean> {
    await sql`UPDATE notifications SET is_read = true WHERE id = ${id} AND user_id = ${userId}`;
    return true;
  },

  async markAllAsRead(userId: string): Promise<boolean> {
    await sql`UPDATE notifications SET is_read = true WHERE user_id = ${userId}`;
    return true;
  },

  async create(
    notification: {
      user_id: string;
      type: string;
      title: string;
      content: string;
      link: string;
    }
  ): Promise<Notification> {
    const res = await sql`SELECT COALESCE(MAX(NULLIF(regexp_replace(id, '\\D', '', 'g'), '')::int), 0) as max_val FROM notifications`;
    const nextId = 'n-' + String((res[0].max_val || 0) + 1).padStart(3, '0');
    const now = new Date().toISOString();

    const newNotification: Notification = {
      id: nextId,
      user_id: notification.user_id,
      type: notification.type,
      title: notification.title,
      content: notification.content,
      link: notification.link,
      is_read: false,
      created_at: now,
    };

    await sql`
      INSERT INTO notifications (
        id, user_id, type, title, content, link, is_read, created_at
      ) VALUES (
        ${newNotification.id}, ${newNotification.user_id}, ${newNotification.type}, ${newNotification.title},
        ${newNotification.content}, ${newNotification.link}, ${newNotification.is_read}, ${newNotification.created_at}
      )
    `;

    return newNotification;
  },
};
