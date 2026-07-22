<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project-Specific Conventions & Learnings (MDM Daily Report & Payroll)

## 1. Google Sheets & API Rate Limits
- **Quota Protection**: Direct Google Sheets API calls can trigger `429 Quota Exceeded` errors during batch operations. Batch requests, rely on local/Supabase storage, and leverage Google Apps Script Webhooks (`/api/webhooks/sheet`).
- **Cache Size & UX**: Do not pass objects > 2MB into Next.js `unstable_cache`. Use optimistic UI updates with smooth loading states so users do not experience stale cache delays.

## 2. Google Drive & Document Services
- **Drive Ownership**: Drive uploads and payslip PDF saves must impersonate `gadmin@multidayamitra.co.id` via Google Service Account credentials.
- **Slip Generation**: Support single and bulk "Save to Drive" and email distribution.

## 3. Table UI/UX & Data Handling Standard
- **Row Limits**: Default table view pagination is **200 rows per page**.
- **Search Behavior**: Require pressing `Enter` or clicking the Filter button before executing search queries.
- **Primary Selections**: Single-primary constraint per user for Bank Accounts and Occupations using toggle switches/checkboxes.
- **Inactive / NA Views**: Separate inactive/deleted records into dedicated NA tabs with inline restore options.
- **Numerical Sorting**: Ensure duration and numeric columns (e.g., `0.4d`, `16h`) sort numerically instead of string sorting.

## 4. Payroll & Business Rules
- **Active Status Filter**: Payroll generation must exclusively target users with active status (`user_status_id`).
- **Strict Deduplication**: Guard against duplicate salary lines (base pay, overtime, fixed allowances `fa_id`, meal/travel requests).
- **Work Hours Safeguard**: Worker attendance hours are capped at 16h max; if exceeded due to entry error, default to 8h.
- **Worker KPI**: KPI reporting feeds directly into Cost Control metrics.

