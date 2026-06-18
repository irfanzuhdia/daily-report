# Discovered Spreadsheet Schema

## Spreadsheet: "daily-reports"
ID: `1XDhdBSwCqPlrUEBeRN-3K7hmKdcqnfguDaZlLs43aeo`

## Sheets

### 1. `user`
| Column | Description |
|--------|-------------|
| user_id | Primary key (e.g., "u-001") |
| user_email | Google email address |
| user_name | Display name |
| user_occupation | Job title |
| user_division | Division |
| user_departement | Department (sic) |
| created_by | Creator user_id |
| created_at | Timestamp |
| updated_by | Last updater |
| updated_at | Last update timestamp |
| deleted_by | Soft delete by |
| deleted_at | Soft delete timestamp |

**Existing data**: 2 users (u-001: IT Admin, u-002: Irfan Zuhdi Abdillah), 3 empty rows (u-003 to u-005)

### 2. `project`
| Column | Description |
|--------|-------------|
| project_id | Primary key |
| project_name | Name |
| project_description | Description |
| project_start_date_plan | Planned start |
| project_end_date_plan | Planned end |
| project_status | Status (references status.id) |
| created_by, created_at, updated_by, updated_at, deleted_by, deleted_at | Audit |

**Existing data**: Empty (schema only)

### 3. `project_log`
| Column | Description |
|--------|-------------|
| id | Primary key |
| project_id | FK → project |
| project_status_old | Previous status |
| project_status_new | New status |
| created_by, created_at | Audit |

### 4. `project_team`
| Column | Description |
|--------|-------------|
| id | Primary key |
| project_id | FK → project |
| user_id | FK → user |
| audit columns | created_by, created_at, updated_by, updated_at, deleted_by, deleted_at |

### 5. `task`
| Column | Description |
|--------|-------------|
| id | Primary key |
| project_id | FK → project |
| task_description | Description |
| task_status | Status (references status.id) |
| task_latest_percentage | Latest progress % |
| audit columns | created_by, created_at, updated_by, updated_at, deleted_by, deleted_at |

### 6. `task_log`
| Column | Description |
|--------|-------------|
| id | Primary key |
| task_id | FK → task |
| task_status_old | Previous status |
| task_status_new | New status |
| created_by, created_at | Audit |

### 7. `task_team`
| Column | Description |
|--------|-------------|
| id | Primary key |
| task_id | FK → task |
| user_id | FK → user |
| audit columns | (same as project_team) |

### 8. `report` (Daily Report)
| Column | Description |
|--------|-------------|
| report_id | Primary key |
| task_id | FK → task |
| date | Report date |
| progress_percentage | Progress % |
| remarks | Notes/remarks |
| user_id | FK → user (who created the report) |
| created_by, created_at, deleted_by, deleted_at | Audit |

### 9. `status` (Lookup table)
| id | name |
|----|------|
| NS | Not Started |
| OP | On Progress |
| D | Done |
| H | Hold |
| CC | Cancel |

## Relationships

```
user ──┬── project_team ─── project ──┬── task ─── report
       │                              │
       └── task_team ─────────────────┘
       
status ──→ project.project_status
status ──→ task.task_status
```

## Key Design Notes
- All tables have soft delete (deleted_by, deleted_at)
- Audit trail via created_by, created_at, updated_by, updated_at
- Status is stored as code (NS, OP, D, H, CC) with label in status sheet
- User lookup for auth is by user_email
- No explicit "role" column in user sheet — role/permissions must be inferred from relationships (project_team, task_team) or added
- "user_occupation" may serve as role equivalent
