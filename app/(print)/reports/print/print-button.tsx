"use client"

/** On-screen only: the toolbar must not appear in the printed output. */
export function PrintButton() {
  return (
    <div className="no-print mb-6 flex items-center justify-between rounded-lg border border-neutral-300 bg-neutral-50 px-4 py-3">
      <p className="text-[12px] text-neutral-600">
        Use your browser&apos;s print dialog to save this as PDF.
      </p>
      <button
        type="button"
        onClick={() => window.print()}
        className="rounded-md bg-neutral-900 px-4 py-1.5 text-[13px] font-medium text-white hover:bg-neutral-700"
      >
        Print / Save as PDF
      </button>
    </div>
  )
}
