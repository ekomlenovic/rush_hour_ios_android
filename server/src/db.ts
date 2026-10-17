import { DatabaseSync } from 'node:sqlite';

export type Database = DatabaseSync;

/** Schema versions, applied in order (PRAGMA user_version): only ever add one at the end */
const MIGRATIONS: string[] = [
  `
  CREATE TABLE players (
    id INTEGER PRIMARY KEY,
    pseudo TEXT NOT NULL,
    pseudo_key TEXT NOT NULL UNIQUE,
    token_hash TEXT NOT NULL UNIQUE,
    recovery_hash TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE challenges (
    date TEXT PRIMARY KEY,
    difficulty TEXT NOT NULL,
    level_json TEXT NOT NULL,
    min_moves INTEGER NOT NULL,
    generated_at INTEGER NOT NULL
  );
  CREATE TABLE attempts (
    id INTEGER PRIMARY KEY,
    player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('playing', 'won', 'abandoned')),
    started_at INTEGER NOT NULL,
    finished_at INTEGER,
    move_count INTEGER,
    server_ms INTEGER,
    client_ms INTEGER,
    background_ms INTEGER,
    moves_json TEXT,
    UNIQUE (player_id, date)
  );
  CREATE INDEX attempts_date ON attempts(date);
  CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  `,
  // Anti-cheat, moderation and admin (#50)
  `
  ALTER TABLE players ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE players ADD COLUMN banned INTEGER NOT NULL DEFAULT 0;
  -- Suspicion signals computed when the win was sent (JSON list)
  ALTER TABLE attempts ADD COLUMN flags_json TEXT;
  -- Decision of the admin: 'cheater' (confirmed) or 'cleared' (suspicion lifted); NULL: none yet
  ALTER TABLE attempts ADD COLUMN verdict TEXT CHECK (verdict IN ('cheater', 'cleared'));
  CREATE TABLE reports (
    id INTEGER PRIMARY KEY,
    reporter_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    reason TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    UNIQUE (reporter_id, player_id)
  );
  `,
  // Duels 1v1: results for the scores and rankings, moves for the replays (purged like the games)
  `
  CREATE TABLE duels (
    id INTEGER PRIMARY KEY,
    -- Day of the end, in the time zone of the server (rankings, admin reset)
    date TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    level_json TEXT NOT NULL,
    min_moves INTEGER NOT NULL,
    started_at INTEGER NOT NULL,
    ended_at INTEGER NOT NULL,
    reason TEXT NOT NULL CHECK (reason IN ('won', 'forfeit', 'disconnected', 'timeout')),
    -- NULL: a draw
    winner_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
    player1_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    player2_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    moves1 INTEGER NOT NULL,
    moves2 INTEGER NOT NULL,
    moves1_json TEXT,
    moves2_json TEXT
  );
  CREATE INDEX duels_date ON duels(date);
  CREATE INDEX duels_player1 ON duels(player1_id);
  CREATE INDEX duels_player2 ON duels(player2_id);
  `,
  // Puzzles generated ahead for the duels (server/src/puzzlePool.ts)
  `
  CREATE TABLE puzzle_pool (
    id INTEGER PRIMARY KEY,
    difficulty TEXT NOT NULL,
    level_json TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX puzzle_pool_difficulty ON puzzle_pool(difficulty, id);
  `,
  // Variants of the hard levels of the app for the hardest duels, prepared once; a variant played is marked
  `
  CREATE TABLE duel_variants (
    id INTEGER PRIMARY KEY,
    difficulty TEXT NOT NULL,
    -- The level of the app it comes from
    source_id INTEGER NOT NULL,
    level_json TEXT NOT NULL,
    used_at INTEGER
  );
  CREATE INDEX duel_variants_difficulty ON duel_variants(difficulty, source_id);
  `,
];

export function openDatabase(path: string): Database {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  const { user_version: version } = db.prepare('PRAGMA user_version').get() as { user_version: number };
  for (let v = version; v < MIGRATIONS.length; v++) {
    db.exec('BEGIN');
    try {
      db.exec(MIGRATIONS[v]);
      db.exec(`PRAGMA user_version = ${v + 1}`);
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  }
  return db;
}

export function getSetting(db: Database, key: string): string | undefined {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value;
}

export function setSetting(db: Database, key: string, value: string): void {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
}
