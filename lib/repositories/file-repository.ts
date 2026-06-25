import { sql } from '../db';
import type { FileRecord } from '../types';
import { unstable_cache, revalidateTag } from './shared';

// ============ CACHING HELPERS ============

const getCachedFiles = unstable_cache(
  async (): Promise<FileRecord[]> => {
    const rows = await sql`SELECT * FROM files WHERE deleted_at IS NULL`;
    return rows as unknown as FileRecord[];
  },
  ['files-all'],
  { tags: ['files'], revalidate: 60 }
);

const getCachedFilesByProjectId = unstable_cache(
  async (projectId: string): Promise<FileRecord[]> => {
    const rows = await sql`SELECT * FROM files WHERE project_id = ${projectId} AND deleted_at IS NULL`;
    return rows as unknown as FileRecord[];
  },
  ['files-by-project-id'],
  { tags: ['files'], revalidate: 60 }
);

const getCachedFilesByTaskId = unstable_cache(
  async (taskId: string): Promise<FileRecord[]> => {
    const rows = await sql`SELECT * FROM files WHERE task_id = ${taskId} AND deleted_at IS NULL`;
    return rows as unknown as FileRecord[];
  },
  ['files-by-task-id'],
  { tags: ['files'], revalidate: 60 }
);

const getCachedFilesByReportId = unstable_cache(
  async (reportId: string): Promise<FileRecord[]> => {
    const rows = await sql`SELECT * FROM files WHERE report_id = ${reportId} AND deleted_at IS NULL`;
    return rows as unknown as FileRecord[];
  },
  ['files-by-report-id'],
  { tags: ['files'], revalidate: 60 }
);

// ============ FILE REPOSITORY ============

export const FileRepository = {
  async findAll(): Promise<FileRecord[]> {
    return getCachedFiles();
  },

  async findByProjectId(projectId: string): Promise<FileRecord[]> {
    return getCachedFilesByProjectId(projectId);
  },

  async findByTaskId(taskId: string): Promise<FileRecord[]> {
    return getCachedFilesByTaskId(taskId);
  },

  async findByReportId(reportId: string): Promise<FileRecord[]> {
    return getCachedFilesByReportId(reportId);
  },

  async create(
    fileData: {
      project_id: string | null;
      task_id: string | null;
      report_id: string | null;
      file_url: string;
      file_description: string | null;
    },
    createdBy: string
  ): Promise<FileRecord> {
    const res = await sql`SELECT COALESCE(MAX(NULLIF(regexp_replace(id, '\\D', '', 'g'), '')::int), 0) as max_val FROM files`;
    const nextId = 'f-' + String((res[0].max_val || 0) + 1).padStart(3, '0');
    const now = new Date().toISOString();

    const newFile: FileRecord = {
      id: nextId,
      project_id: fileData.project_id || null,
      task_id: fileData.task_id || null,
      report_id: fileData.report_id || null,
      file_url: fileData.file_url,
      file_description: fileData.file_description || null,
      created_by: createdBy,
      created_at: now,
      updated_by: null,
      updated_at: null,
      deleted_by: null,
      deleted_at: null,
    };

    await sql`
      INSERT INTO files (
        id, project_id, task_id, report_id, file_url, file_description,
        created_by, created_at, updated_by, updated_at, deleted_by, deleted_at
      ) VALUES (
        ${newFile.id}, ${newFile.project_id}, ${newFile.task_id}, ${newFile.report_id},
        ${newFile.file_url}, ${newFile.file_description}, ${newFile.created_by}, ${newFile.created_at},
        ${newFile.updated_by}, ${newFile.updated_at}, ${newFile.deleted_by}, ${newFile.deleted_at}
      )
    `;

    revalidateTag('files');
    return newFile;
  },

  async softDelete(fileId: string, deletedBy: string): Promise<boolean> {
    const now = new Date().toISOString();
    await sql`
      UPDATE files SET
        deleted_by = ${deletedBy},
        deleted_at = ${now}
      WHERE id = ${fileId}
    `;

    revalidateTag('files');
    return true;
  },
};
