export const PSEUDO_MIN = 2;
export const PSEUDO_MAX = 20;

/**
 * A valid nickname, cleaned up, or null: letters (any alphabet), digits,
 * spaces inside, and . _ - ; no invisible or control characters.
 */
export function cleanPseudo(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const pseudo = input.normalize('NFC').trim().replace(/\s+/g, ' ');
  if (pseudo.length < PSEUDO_MIN || pseudo.length > PSEUDO_MAX) return null;
  if (!/^[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N} ._-]*$/u.test(pseudo)) return null;
  return pseudo;
}

/** Two nicknames that differ only by case or accents are the same nickname ('Léo' = 'LEO') */
export function pseudoKey(pseudo: string): string {
  return pseudo.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
}
