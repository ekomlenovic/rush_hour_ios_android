import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { MIGRATIONS, openDatabase } from '../src/db';

/** A database file left at a schema version, as an older server left it */
function databaseAt(version: number, fill: (db: DatabaseSync) => void) {
  const dir = mkdtempSync(path.join(tmpdir(), 'rush-db-'));
  const file = path.join(dir, 'rush.db');
  const old = new DatabaseSync(file);
  for (const step of MIGRATIONS.slice(0, version)) old.exec(step);
  old.exec(`PRAGMA user_version = ${version}`);
  fill(old);
  old.close();
  return { file, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

describe('schema migrations', () => {
  it('the challenges generated before their origin was kept: from scratch, generation time not known', () => {
    // The version before the step that keeps where a challenge comes from
    const before = MIGRATIONS.findIndex(step => step.includes('ADD COLUMN variant_of'));
    expect(before).toBeGreaterThan(0);
    const { file, cleanup } = databaseAt(before, (db) => {
      db.prepare(`INSERT INTO challenges (date, difficulty, level_json, min_moves, generated_at) VALUES (?, ?, ?, ?, ?)`)
        .run('2026-10-16', 'MASTER', '{"id":999996}', 45, 1_760_000_000_000);
    });
    try {
      const db = openDatabase(file);
      expect((db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version).toBe(MIGRATIONS.length);
      expect({ ...(db.prepare('SELECT * FROM challenges').get() as object) }).toEqual({
        date: '2026-10-16', difficulty: 'MASTER', level_json: '{"id":999996}', min_moves: 45, generated_at: 1_760_000_000_000,
        variant_of: null, generation_ms: null,
      });
      db.close();
    } finally {
      cleanup();
    }
  });
});
