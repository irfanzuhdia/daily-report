# PostgreSQL Database Transition Setup Guide

This guide describes how to connect, migrate, and deploy the Daily Report application using **Neon PostgreSQL** and **Vercel**, while keeping the Google Drive integration for uploaded files intact.

---

## 1. Create a Neon PostgreSQL Database

1. Go to [Neon Console](https://neon.tech) and sign in.
2. Click **Create Project**.
3. Name your project (e.g., `daily-report-db`), select your preferred region, and click **Create Project**.
4. You will see a popup displaying your **Database connection string**.
   - Select **Connection string** > **Node.js** or **Parameters-only**.
   - The connection string looks like this:
     ```
     postgres://alex:AbC123dEf@ep-cool-water-123456.us-east-2.aws.neon.tech/neondb?sslmode=require
     ```
   - Copy this connection string.

---

## 2. Configure Environment Variables Locally

1. Open your local `.env` file in the project root: [`.env`](file:///Users/irfanzuhdiabdillah/Code/2026/daily-report/dr2/daily-report/.env)
2. Add the `DATABASE_URL` parameter with your Neon connection string:
   ```env
   # PostgreSQL Connection (Neon)
   DATABASE_URL="postgres://alex:AbC123dEf@ep-cool-water-123456.us-east-2.aws.neon.tech/neondb?sslmode=require"
   ```

---

## 3. Run the Automated Migration Script

We have created an automated migration script that reads all tables and rows directly from your Google Sheets spreadsheet, creates the relational PostgreSQL schema, and inserts the data.

1. Ensure your `.env` contains both the Google Sheets credentials (`GOOGLE_SERVICE_ACCOUNT_CREDENTIALS` and `GOOGLE_SPREADSHEET_ID`) and the new `DATABASE_URL`.
2. Run the migration script in your terminal:
   ```bash
   node scripts/migrate-to-postgres.mjs
   ```
3. The script will:
   - Drop any conflicting tables to avoid schema mismatches.
   - Create tables: `statuses`, `users`, `projects`, `project_teams`, `tasks`, `task_teams`, `daily_reports`, `project_logs`, `task_logs`, `files` (metadata).
   - Create appropriate indexes for search performance.
   - Fetch and insert all existing data, ensuring **zero data loss**.

---

## 4. Deploy on Vercel

1. Go to your [Vercel Dashboard](https://vercel.com) and select the project.
2. Navigate to **Settings** > **Environment Variables**.
3. Add the new environment variable:
   - **Key**: `DATABASE_URL`
   - **Value**: *[Your Neon Connection String]*
   - **Target**: Production, Preview, and Development.
4. Click **Save**.
5. Trigger a new deployment of the project (e.g., by pushing code or clicking **Redeploy** in the Vercel dashboard).

---

## 5. Google Drive Storage Integration

No changes are required for Google Drive storage. File uploads (via the `/api/upload` route) will continue to place files inside Google Drive as before. Only the file metadata records (the SQL `files` table mapping file urls to project/task/report IDs) have been moved to PostgreSQL.
