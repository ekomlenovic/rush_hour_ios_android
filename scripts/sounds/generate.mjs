// Writes the sound effects of the game (assets/sounds/*.wav), synthesized here: no recording, no
// licence to follow (see docs/GAME_DESIGN.md, Effets sonores).
//   node scripts/sounds/generate.mjs
// Short (under a second), mono, 22 050 Hz, 16 bits: a few kilobytes each, precached by the service worker
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const RATE = 22050;
const out = join(import.meta.dirname, '..', '..', 'assets', 'sounds');
mkdirSync(out, { recursive: true });

// Same sounds at each run: the noise comes from a fixed seed
let seed = 1;
const noise = () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return (seed / 0x3fffffff) - 1;
};

const samples = seconds => new Float32Array(Math.round(seconds * RATE));

/** A note with a few harmonics, a fast attack and an exponential decay, added at `start` (s) */
function note(buffer, { start = 0, freq, length, decay, gain = 1, harmonics = [1, 0.3, 0.1], bend = 0 }) {
  const from = Math.round(start * RATE);
  const count = Math.min(Math.round(length * RATE), buffer.length - from);
  let phase = 0;
  for (let i = 0; i < count; i++) {
    const t = i / RATE;
    const attack = Math.min(1, t / 0.004);
    const env = attack * Math.exp(-t / decay);
    // bend: the pitch falls (or rises) by this ratio over the note
    phase += (2 * Math.PI * freq * (1 + bend * (i / count))) / RATE;
    let value = 0;
    harmonics.forEach((h, k) => { value += h * Math.sin(phase * (k + 1)); });
    buffer[from + i] += gain * env * value;
  }
}

/** Filtered noise: a one-pole low-pass whose cutoff follows `cutoff(t)` (0..1), shaped by `env(t)` */
function hiss(buffer, { start = 0, length, gain = 1, cutoff, env }) {
  const from = Math.round(start * RATE);
  const count = Math.min(Math.round(length * RATE), buffer.length - from);
  let low = 0;
  for (let i = 0; i < count; i++) {
    const t = i / count;
    low += cutoff(t) * (noise() - low);
    buffer[from + i] += gain * env(t) * low;
  }
}

/** Normalized to `peak`, faded out on its last 5 ms (no click), written as 16-bit PCM */
function write(name, buffer, peak = 0.7) {
  const max = buffer.reduce((m, v) => Math.max(m, Math.abs(v)), 0) || 1;
  const fade = Math.round(0.005 * RATE);
  const pcm = Buffer.alloc(44 + buffer.length * 2);
  pcm.write('RIFF', 0); pcm.writeUInt32LE(36 + buffer.length * 2, 4); pcm.write('WAVE', 8);
  pcm.write('fmt ', 12); pcm.writeUInt32LE(16, 16); pcm.writeUInt16LE(1, 20); pcm.writeUInt16LE(1, 22);
  pcm.writeUInt32LE(RATE, 24); pcm.writeUInt32LE(RATE * 2, 28); pcm.writeUInt16LE(2, 32); pcm.writeUInt16LE(16, 34);
  pcm.write('data', 36); pcm.writeUInt32LE(buffer.length * 2, 40);
  buffer.forEach((v, i) => {
    const tail = Math.min(1, (buffer.length - 1 - i) / fade);
    pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, (v / max) * peak * tail)) * 32767), 44 + i * 2);
  });
  writeFileSync(join(out, `${name}.wav`), pcm);
  console.log(`${name}.wav ${(pcm.length / 1024).toFixed(1)} KB`);
}

// A vehicle set in its new cell: a soft wooden tock
{
  const b = samples(0.09);
  note(b, { freq: 320, length: 0.09, decay: 0.018, harmonics: [1, 0.5, 0.2], bend: -0.25 });
  hiss(b, { length: 0.03, gain: 0.35, cutoff: () => 0.5, env: t => 1 - t });
  write('slide', b, 0.55);
}

// Blocked: a dull thud, lower and shorter
{
  const b = samples(0.11);
  note(b, { freq: 110, length: 0.11, decay: 0.03, harmonics: [1, 0.4], bend: -0.4 });
  hiss(b, { length: 0.02, gain: 0.25, cutoff: () => 0.2, env: t => 1 - t });
  write('bump', b, 0.6);
}

// The target car leaves the board: a whoosh that rises then fades
{
  const b = samples(0.42);
  hiss(b, { length: 0.42, cutoff: t => 0.05 + 0.5 * t, env: t => Math.sin(Math.PI * Math.min(1, t * 1.15)) ** 2 });
  note(b, { freq: 220, length: 0.4, decay: 0.15, gain: 0.25, harmonics: [1], bend: 1 });
  write('exit', b, 0.55);
}

// Victory: an ascending arpeggio, C E G C
{
  const b = samples(0.95);
  [523.25, 659.25, 783.99].forEach((freq, i) => note(b, { start: i * 0.09, freq, length: 0.5, decay: 0.12, gain: 0.8 }));
  note(b, { start: 0.27, freq: 1046.5, length: 0.68, decay: 0.25 });
  note(b, { start: 0.27, freq: 1318.5, length: 0.68, decay: 0.2, gain: 0.35 });
  write('win', b, 0.7);
}

// One ping per star, each a step higher: E6, G6, C7
[1318.5, 1567.98, 2093].forEach((freq, i) => {
  const b = samples(0.32);
  note(b, { freq, length: 0.32, decay: 0.08, harmonics: [1, 0.15, 0.25] });
  note(b, { freq: freq * 2, length: 0.2, decay: 0.03, gain: 0.2, harmonics: [1] });
  write(`star${i + 1}`, b, 0.5);
});

// Unlocked (achievement, style, player level): a two-note chime with a sparkle
{
  const b = samples(0.7);
  note(b, { freq: 783.99, length: 0.4, decay: 0.12, harmonics: [1, 0.2, 0.3] });
  note(b, { start: 0.11, freq: 1174.66, length: 0.59, decay: 0.2, harmonics: [1, 0.2, 0.3] });
  note(b, { start: 0.11, freq: 2349.3, length: 0.3, decay: 0.05, gain: 0.25, harmonics: [1] });
  write('unlock', b, 0.6);
}

// Duel countdown: a tick each second, a higher note on the start
{
  const b = samples(0.1);
  note(b, { freq: 880, length: 0.1, decay: 0.025, harmonics: [1, 0.2] });
  write('tick', b, 0.5);
}
{
  const b = samples(0.3);
  note(b, { freq: 1318.5, length: 0.3, decay: 0.09, harmonics: [1, 0.25, 0.1] });
  write('go', b, 0.55);
}
