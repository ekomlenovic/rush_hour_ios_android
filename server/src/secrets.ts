import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

/** Only hashes of tokens and codes are stored: a stolen database gives no access */
export const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

/** Compares two secrets without leaking through the time taken */
export function secretEquals(a: string, b: string): boolean {
  return timingSafeEqual(Buffer.from(sha256(a), 'hex'), Buffer.from(sha256(b), 'hex'));
}

/** Identifies a player on each request (Authorization: Bearer …) */
export const newToken = (): string => randomBytes(32).toString('base64url');

// Crockford base 32: no I, L, O, U, easy to read and to type
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function randomCode(length: number): string {
  let code = '';
  for (let i = 0; i < length; i++) code += ALPHABET[randomInt(ALPHABET.length)];
  return code;
}

/** Recovery code of an account, 'K7QM-3XPA-9TRB-V2HD' (80 bits) */
export function newRecoveryCode(): string {
  return randomCode(16).match(/.{4}/g)!.join('-');
}

/** A recovery code as typed: case, spaces and dashes do not matter, O/I/L read as 0/1/1 */
export function normalizeRecoveryCode(code: string): string {
  return code.toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
}

/** Invite code of the server (120 bits), carried by the invitation link */
export const newInviteCode = (): string => randomCode(24);

/** Seed of the puzzle of a day: secret, so that nobody can generate it in advance */
export function puzzleSeed(serverSecret: string, date: string, difficulty: string): string {
  return createHmac('sha256', serverSecret).update(`daily:${date}:${difficulty}`).digest('hex');
}
