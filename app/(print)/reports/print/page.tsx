import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { getViewModeFromCookies } from "@/lib/get-view-mode.server"
import {
  DailyReportRepository,
  ProjectRepository,
  UserRepository,
  getUserLevel,
} from "@/lib/repositories"
import { EXPORT_ROW_CAP } from "@/lib/export-scope"
import { BarChart, Heatmap, StatTile, formatHours } from "@/components/print/print-charts"
import { PrintButton } from "./print-button"

const toYMD = (d: Date) => d.toISOString().slice(0, 10)

export default async function PrintReportPage({
  searchParams,
}: {
  searchParams: Promise<{
    start_date?: string
    end_date?: string
    created_by?: string
    project_id?: string
    dept_filter?: string
    site_filter?: string
    div_filter?: string
    team_filter?: string
  }>
}) {
  const session = await getSession()
  if (!session) redirect("/login")

  const params = await searchParams
  const viewMode = await getViewModeFromCookies()
  const userId = session.user_id

  const me = await UserRepository.findById(userId)
  const level = await getUserLevel(me?.user_occupation ?? null)
  // Mirrors the pages: level 1 can only ever see their own rows.
  const effectiveViewMode = level === 1 ? "my" : viewMode

  const today = new Date()
  const monthAgo = new Date(today)
  monthAgo.setDate(monthAgo.getDate() - 29)
  const startDate = params.start_date || toYMD(monthAgo)
  const endDate = params.end_date || toYMD(today)

  // Same RBAC-aware finder the app uses, so the printout can never show more
  // than the viewer is allowed to see.
  const [{ reports }, { data: projects }, allUsers] = await Promise.all([
    DailyReportRepository.findPaginatedEnriched(userId, EXPORT_ROW_CAP, 0, {
      viewMode: effectiveViewMode,
      startDate,
      endDate,
      createdBy: params.created_by,
      projectId: params.project_id,
      dept: params.dept_filter,
      site: params.site_filter,
      div: params.div_filter,
      team: params.team_filter,
    }),
    ProjectRepository.findPaginated(userId, { viewMode: effectiveViewMode }, EXPORT_ROW_CAP, 0),
    UserRepository.findAll(),
  ])

  const userName = new Map(allUsers.map((u) => [u.user_id, u.user_name || u.user_email || u.user_id]))
  const projectById = new Map(projects.map((p) => [p.project_id, p]))

  const hoursOf = (r: { total_hours?: string | number | null }) => {
    const n = parseFloat(String(r.total_hours ?? "0"))
    return Number.isFinite(n) && n > 0 ? n : 0
  }

  // ── aggregations ──
  const daily: Record<string, number> = {}
  const byCategory = new Map<string, number>()
  const byProject = new Map<string, number>()
  const byPerson = new Map<string, { hours: number; reports: number; days: Set<string> }>()
  const perProject = new Map<
    string,
    { name: string; hours: number; reports: number; contributors: Set<string>; tasks: Set<string> }
  >()

  let totalHours = 0
  for (const r of reports) {
    const h = hoursOf(r)
    if (h <= 0) continue
    totalHours += h

    if (r.date) daily[r.date] = (daily[r.date] ?? 0) + h

    const proj = r.project_id ? projectById.get(r.project_id) : undefined
    const category = proj?.category ?? "Uncategorized"
    byCategory.set(category, (byCategory.get(category) ?? 0) + h)

    const projName = r.project_name ?? "No Project"
    byProject.set(projName, (byProject.get(projName) ?? 0) + h)

    const person = userName.get(r.user_id ?? "") ?? r.created_by_name ?? "Unknown"
    const p = byPerson.get(person) ?? { hours: 0, reports: 0, days: new Set<string>() }
    p.hours += h
    p.reports += 1
    if (r.date) p.days.add(r.date)
    byPerson.set(person, p)

    const key = r.project_id ?? "unassigned"
    const pp =
      perProject.get(key) ??
      { name: projName, hours: 0, reports: 0, contributors: new Set<string>(), tasks: new Set<string>() }
    pp.hours += h
    pp.reports += 1
    pp.contributors.add(person)
    if (r.task_id) pp.tasks.add(r.task_id)
    perProject.set(key, pp)
  }

  const activeDays = Object.values(daily).filter((h) => h > 0).length
  const rangeDays = Math.max(
    1,
    Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) + 1
  )

  const people = [...byPerson.entries()].sort((a, b) => b[1].hours - a[1].hours)
  const projectRows = [...perProject.values()].sort((a, b) => b.hours - a.hours)
  const detail = [...reports]
    .filter((r) => hoursOf(r) > 0)
    .sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")))

  const scopeLabel =
    effectiveViewMode === "my" ? "My View — only my own reports" : "Team View — everyone in my scope"

  return (
    <main className="mx-auto max-w-[900px] px-8 py-8 text-[13px] leading-relaxed">
      <PrintButton />

      <header className="mb-6 border-b border-neutral-300 pb-4">
        <h1 className="text-2xl font-bold text-neutral-900">Daily Report Summary</h1>
        <dl className="mt-2 grid grid-cols-2 gap-x-8 gap-y-1 text-[12px] text-neutral-600">
          <div><dt className="inline font-medium">Period: </dt><dd className="inline">{startDate} — {endDate} ({rangeDays} days)</dd></div>
          <div><dt className="inline font-medium">Scope: </dt><dd className="inline">{scopeLabel}</dd></div>
          <div><dt className="inline font-medium">Prepared by: </dt><dd className="inline">{session.name || session.email}</dd></div>
          <div><dt className="inline font-medium">Generated: </dt><dd className="inline">{toYMD(today)}</dd></div>
        </dl>
      </header>

      <section className="mb-8">
        <div className="grid grid-cols-4 gap-3">
          <StatTile label="Total hours" value={formatHours(totalHours)} />
          <StatTile label="Reports" value={String(detail.length)} />
          <StatTile label="Active days" value={`${activeDays}`} sub={`of ${rangeDays}`} />
          <StatTile label="Contributors" value={String(people.length)} />
        </div>
      </section>

      <section className="mb-8 break-inside-avoid">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-700">Daily activity</h2>
        <Heatmap data={daily} start={startDate} end={endDate} />
      </section>

      <section className="mb-8 grid grid-cols-2 gap-8 break-inside-avoid">
        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-700">Hours by category</h2>
          <BarChart data={[...byCategory].map(([label, hours]) => ({ label, hours }))} />
        </div>
        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-700">Hours by project</h2>
          <BarChart data={[...byProject].map(([label, hours]) => ({ label, hours }))} />
        </div>
      </section>

      <section className="mb-8 break-before-page">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-700">Per person</h2>
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="border-b border-neutral-400 text-left">
              <th className="py-1.5">Name</th>
              <th className="py-1.5 text-right">Hours</th>
              <th className="py-1.5 text-right">Reports</th>
              <th className="py-1.5 text-right">Active days</th>
              <th className="py-1.5 text-right">Avg h/day</th>
            </tr>
          </thead>
          <tbody>
            {people.map(([name, s]) => (
              <tr key={name} className="border-b border-neutral-200">
                <td className="py-1">{name}</td>
                <td className="py-1 text-right">{formatHours(s.hours)}</td>
                <td className="py-1 text-right">{s.reports}</td>
                <td className="py-1 text-right">{s.days.size}</td>
                <td className="py-1 text-right">{formatHours(s.days.size ? s.hours / s.days.size : 0)}</td>
              </tr>
            ))}
            {people.length === 0 && (
              <tr><td colSpan={5} className="py-3 text-center text-neutral-500">No activity in this period.</td></tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="mb-8 break-inside-avoid">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-700">Per project</h2>
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="border-b border-neutral-400 text-left">
              <th className="py-1.5">Project</th>
              <th className="py-1.5 text-right">Hours</th>
              <th className="py-1.5 text-right">Reports</th>
              <th className="py-1.5 text-right">Tasks</th>
              <th className="py-1.5 text-right">People</th>
            </tr>
          </thead>
          <tbody>
            {projectRows.map((p) => (
              <tr key={p.name} className="border-b border-neutral-200">
                <td className="py-1">{p.name}</td>
                <td className="py-1 text-right">{formatHours(p.hours)}</td>
                <td className="py-1 text-right">{p.reports}</td>
                <td className="py-1 text-right">{p.tasks.size}</td>
                <td className="py-1 text-right">{p.contributors.size}</td>
              </tr>
            ))}
            {projectRows.length === 0 && (
              <tr><td colSpan={5} className="py-3 text-center text-neutral-500">No activity in this period.</td></tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="break-before-page">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-700">
          Report detail ({detail.length})
        </h2>
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr className="border-b border-neutral-400 text-left">
              <th className="py-1.5">Date</th>
              <th className="py-1.5">Person</th>
              <th className="py-1.5">Project</th>
              <th className="py-1.5">Task</th>
              <th className="py-1.5 text-right">Hours</th>
              <th className="py-1.5">Remarks</th>
            </tr>
          </thead>
          <tbody>
            {detail.map((r) => (
              <tr key={r.report_id} className="border-b border-neutral-200 align-top">
                <td className="py-1 whitespace-nowrap">{r.date}</td>
                <td className="py-1">{userName.get(r.user_id ?? "") ?? r.created_by_name ?? "—"}</td>
                <td className="py-1">{r.project_name ?? "—"}</td>
                <td className="py-1">{r.task_description ?? "—"}</td>
                <td className="py-1 text-right whitespace-nowrap">{formatHours(hoursOf(r))}</td>
                <td className="py-1">{r.remarks ?? ""}</td>
              </tr>
            ))}
            {detail.length === 0 && (
              <tr><td colSpan={6} className="py-3 text-center text-neutral-500">No reports in this period.</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </main>
  )
}
