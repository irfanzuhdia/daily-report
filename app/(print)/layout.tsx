import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"

/**
 * Standalone shell for printable pages: same auth gate as the app, none of the
 * chrome. Sidebar and nav would only have to be hidden again at print time.
 */
export default async function PrintLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect("/login")

  return <div className="print-root bg-white text-black">{children}</div>
}
