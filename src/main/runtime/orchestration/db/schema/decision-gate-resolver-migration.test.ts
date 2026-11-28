import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import Database from '../../../../sqlite/sync-database'
import { OrchestrationDb } from '../orchestration-db'
import { SCHEMA_VERSION } from '../contract-constants'

it('adds the resolver column to an existing database without taking a schema version', () => {
  const root = mkdtempSync(join(tmpdir(), 'orca-gate-migration-'))
  const path = join(root, 'orchestration.db')
  try {
    const old = new Database(path)
    old.exec(`CREATE TABLE decision_gates (
      id TEXT PRIMARY KEY, run_id TEXT NOT NULL, task_id TEXT NOT NULL,
      question TEXT NOT NULL, options TEXT NOT NULL DEFAULT '[]', status TEXT NOT NULL DEFAULT 'pending',
      resolution TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), resolved_at TEXT
    ); INSERT INTO decision_gates (id, run_id, task_id, question, status, resolution)
    VALUES ('gate_old', 'run_legacy_local', 'task_old', 'Old question', 'resolved', 'yes');`)
    old.pragma('user_version = 43')
    old.close()
    const db = new OrchestrationDb(path)
    try {
      expect(db.db.pragma('user_version', { simple: true })).toBe(SCHEMA_VERSION)
      expect(db.getGate('gate_old')).toMatchObject({ resolution: 'yes', resolved_by: null })
      const task = db.createTask({ runId: 'run_legacy_local', spec: 'new' })
      const gate = db.createGate({ taskId: task.id, question: 'New?' })
      expect(db.resolveGate(gate.id, 'ok', 'user')?.resolved_by).toBe('user')
    } finally {
      db.close()
    }
    const reopened = new OrchestrationDb(path)
    try {
      expect(reopened.getGate('gate_old')?.resolved_by).toBeNull()
    } finally {
      reopened.close()
    }
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
