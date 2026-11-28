import type Database from '../../../../sqlite/sync-database'

/**
 * Adds decision_gates.resolved_by (who answered: 'user' or 'coordinator') when it is missing.
 * Why outside the numbered chain: this column belongs to a personal patch; taking the next schema
 * version would collide with upstream's own v44 and skip it on databases this build has touched.
 */
export function ensureDecisionGateResolverColumn(db: Database): void {
  const columns = db.prepare('PRAGMA table_info(decision_gates)').all()
  const present = columns.some(
    (column) =>
      typeof column === 'object' &&
      column !== null &&
      'name' in column &&
      column.name === 'resolved_by'
  )
  if (!present) {
    db.exec('ALTER TABLE decision_gates ADD COLUMN resolved_by TEXT')
  }
}
