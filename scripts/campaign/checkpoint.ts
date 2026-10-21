// Levels generated so far (scripts/campaign/generated.jsonl): one JSON line per level, written as soon as
// it is found, so an interrupted generation resumes where it stopped.
import fs from 'fs';
import path from 'path';
import type { LevelPlan } from './plan';

export const CHECKPOINT_PATH = path.join(__dirname, 'generated.jsonl');

export interface GeneratedLevel {
  id: number;
  /** Parameters given to the generator (the plan, relaxed after failed attempts) */
  params: LevelPlan;
  /** Attempt number of this id, the rust seed and the restart that found it: replay with --seed --restart */
  attempt: number;
  seed: number;
  restart: number;
  /** Level in the compact format of data/levelCodec.ts */
  code: string;
  /** Distinct vehicles moved by the optimal solution */
  movers: number;
  seconds: number;
}

/** Reads the checkpoint; a line cut by an interruption is dropped from the file */
export function readCheckpoint(): Map<number, GeneratedLevel> {
  const levels = new Map<number, GeneratedLevel>();
  if (!fs.existsSync(CHECKPOINT_PATH)) return levels;

  const text = fs.readFileSync(CHECKPOINT_PATH, 'utf8');
  const complete = text.slice(0, text.lastIndexOf('\n') + 1);
  if (complete.length !== text.length) {
    console.warn('  Dernière ligne incomplète (génération interrompue) : ignorée');
    fs.writeFileSync(CHECKPOINT_PATH, complete);
  }
  for (const line of complete.split('\n')) {
    if (!line.trim()) continue;
    const level = JSON.parse(line) as GeneratedLevel;
    levels.set(level.id, level);
  }
  return levels;
}

/** Appends a level and forces it to the disk before going on */
export function appendCheckpoint(level: GeneratedLevel): void {
  const fd = fs.openSync(CHECKPOINT_PATH, 'a');
  try {
    fs.writeSync(fd, JSON.stringify(level) + '\n');
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
}
