/**
 * Upper bound on rows an export may pull from a repository before slicing.
 *
 * Exports have no pagination, but the RBAC-aware finders they reuse all take a
 * limit, so this stands in for "everything the viewer may see". Well above any
 * realistic table size here, and low enough to stop a runaway query.
 */
export const EXPORT_ROW_CAP = 50_000
