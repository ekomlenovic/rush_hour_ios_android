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

  it("the games before the looks were kept: no look, their replays drawn as the viewer's own board", () => {
    const before = MIGRATIONS.findIndex(step => step.includes('ADD COLUMN look1_json'));
    expect(before).toBeGreaterThan(0);
    const { file, cleanup } = databaseAt(before, (db) => {
      db.prepare(`INSERT INTO players (id, pseudo, pseudo_key, token_hash, recovery_hash, created_at) VALUES (1, 'Léo', 'leo', 'a', 'b', 0), (2, 'Emma', 'emma', 'c', 'd', 0)`).run();
      db.prepare(`INSERT INTO challenges (date, difficulty, level_json, min_moves, generated_at) VALUES ('2026-10-16', 'EASY', '{}', 2, 0)`).run();
      db.prepare(`INSERT INTO attempts (player_id, date, status, started_at, moves_json) VALUES (1, '2026-10-16', 'won', 0, '[]')`).run();
      db.prepare(`
        INSERT INTO duels (date, difficulty, level_json, min_moves, started_at, ended_at, reason, winner_id, player1_id, player2_id, moves1, moves2, moves1_json, moves2_json)
        VALUES ('2026-10-16', 'EASY', '{}', 2, 0, 1, 'won', 1, 1, 2, 2, 0, '[]', '[]')
      `).run();
    });
    try {
      const db = openDatabase(file);
      expect((db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version).toBe(MIGRATIONS.length);
      expect({ ...(db.prepare('SELECT moves_json, look_json FROM attempts').get() as object) }).toEqual({ moves_json: '[]', look_json: null });
      expect({ ...(db.prepare('SELECT winner_id, moves1_json, look1_json, look2_json FROM duels').get() as object) })
        .toEqual({ winner_id: 1, moves1_json: '[]', look1_json: null, look2_json: null });
      db.close();
    } finally {
      cleanup();
    }
  });
});
