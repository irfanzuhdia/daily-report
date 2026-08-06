/**
 * Server-rendered SVG charts for the printable report.
 *
 * Inline SVG on purpose: no chart library, no client JS, so the page prints
 * identically whether or not scripts ran, and "Save as PDF" keeps the vectors sharp.
 */

const PALETTE = [
  "#2563eb", "#0891b2", "#059669", "#65a30d", "#ca8a04",
  "#ea580c", "#dc2626", "#db2777", "#7c3aed", "#4f46e5",
]

export const colorAt = (i: number) => PALETTE[i % PALETTE.length]

export const formatHours = (h: number) =>
  Number.isInteger(h) ? `${h}h` : `${h.toFixed(1)}h`

/** Horizontal bars — far easier to read in print than a donut, and label-friendly. */
export function BarChart({
  data,
  maxRows = 10,
}: {
  data: { label: string; hours: number }[]
  maxRows?: number
}) {
  const rows = [...data].sort((a, b) => b.hours - a.hours).slice(0, maxRows)
  if (rows.length === 0) {
    return <p className="text-xs text-neutral-500">No data for this period.</p>
  }

  const max = Math.max(...rows.map((r) => r.hours))
  const rowH = 22
  const gap = 6
  const labelW = 160
  const barW = 300
  const height = rows.length * (rowH + gap)

  return (
    <svg
      viewBox={`0 0 ${labelW + barW + 60} ${height}`}
      width="100%"
      role="img"
      aria-label="Hours by group"
      style={{ maxWidth: 560 }}
    >
      {rows.map((r, i) => {
        const y = i * (rowH + gap)
        const w = max > 0 ? Math.max((r.hours / max) * barW, 2) : 2
        return (
          <g key={r.label}>
            <text x={labelW - 8} y={y + rowH * 0.7} textAnchor="end" fontSize="11" fill="#374151">
              {r.label.length > 26 ? r.label.slice(0, 25) + "…" : r.label}
            </text>
            <rect x={labelW} y={y} width={w} height={rowH} rx="3" fill={colorAt(i)} />
            <text x={labelW + w + 6} y={y + rowH * 0.7} fontSize="11" fill="#111827">
              {formatHours(r.hours)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

/** GitHub-style contribution grid for the selected range. */
export function Heatmap({ data, start, end }: { data: Record<string, number>; start: string; end: string }) {
  const days: string[] = []
  const cur = new Date(start + "T00:00:00Z")
  const last = new Date(end + "T00:00:00Z")
  while (cur <= last) {
    days.push(cur.toISOString().slice(0, 10))
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  if (days.length === 0) return null

  const max = Math.max(0, ...Object.values(data))
  const cell = 9
  const gapPx = 2
  const step = cell + gapPx

  // Pad so every column is a full Sun–Sat week.
  const lead = new Date(days[0] + "T00:00:00Z").getUTCDay()
  const cols = Math.ceil((days.length + lead) / 7)

  const shade = (h: number) => {
    if (!h) return "#ebedf0"
    const t = max > 0 ? h / max : 0
    if (t > 0.75) return "#166534"
    if (t > 0.5) return "#22803a"
    if (t > 0.25) return "#4ade80"
    return "#bbf7d0"
  }

  // Fixed cell size rather than a percentage width: stretching to fill the column
  // turns a short range into a grid of giant squares.
  return (
    <svg
      viewBox={`0 0 ${cols * step} ${7 * step}`}
      width={cols * step}
      height={7 * step}
      role="img"
      aria-label="Daily contribution heatmap"
      style={{ maxWidth: "100%" }}
    >
      {days.map((d, i) => {
        const pos = i + lead
        return (
          <rect
            key={d}
            x={Math.floor(pos / 7) * step}
            y={(pos % 7) * step}
            width={cell}
            height={cell}
            rx="2"
            fill={shade(data[d] ?? 0)}
          />
        )
      })}
    </svg>
  )
}

export function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-neutral-300 px-4 py-3">
      <div className="text-[10px] uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="text-xl font-semibold text-neutral-900">{value}</div>
      {sub && <div className="text-[11px] text-neutral-500">{sub}</div>}
    </div>
  )
}
