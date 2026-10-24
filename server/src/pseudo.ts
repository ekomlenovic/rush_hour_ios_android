export const PSEUDO_MIN = 2;
export const PSEUDO_MAX = 20;

/**
 * Filler characters that look like nothing (Hangul fillers, halfwidth Hangul
 * filler): they are letters by Unicode category, so they pass the shape
 * filter but render as blank.
 */
const FILLER = /[\u115f\u1160\u3164\ufafa]/u;

/**
 * A valid nickname, cleaned up, or null: letters (any alphabet), digits,
 * spaces inside, and . _ - ; no invisible or control characters.
 * On top of that: no fillers, no leading combining mark, and at least two
 * visible letters or digits (so a nickname of only combining marks, or of
 * only fillers, is refused even though it passes the shape filter).
 */
export function cleanPseudo(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const pseudo = input.normalize('NFC').trim().replace(/\s+/g, ' ');
  if (pseudo.length < PSEUDO_MIN || pseudo.length > PSEUDO_MAX) return null;
  if (!/^[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N} ._-]*$/u.test(pseudo)) return null;
  if (FILLER.test(pseudo)) return null;
  if (/^\p{M}/u.test(pseudo)) return null;
  const visible = (pseudo.match(/[\p{L}\p{N}]/gu) ?? []).length;
  if (visible < 2) return null;
  return pseudo;
}

/** Two nicknames that differ only by case or accents are the same nickname ('Léo' = 'LEO') */
export function pseudoKey(pseudo: string): string {
  return pseudo.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
}

/**
 * Confusables folded to their latin look-alike, on top of `pseudoKey`:
 * the usual cyrillic and greek letters that render identically to latin ones
 * (е vs e, о vs o, а vs a, р vs p, …). Used for the look-alike check, NOT
 * for the unique `pseudo_key` column (which keeps its current value so that
 * no existing account is deleted or renamed on purpose).
 */
const CONFUSABLES: Record<string, string> = {
  // cyrillic
  а: 'a', е: 'e', о: 'o', р: 'p', с: 'c', х: 'x', н: 'h', к: 'k',
  в: 'b', д: 'd', з: 'z', и: 'u', м: 'm', т: 't', у: 'y', і: 'i',
  // greek
  ο: 'o', α: 'a', ρ: 'p', μ: 'u', β: 'b', ε: 'e', χ: 'x', κ: 'k', ι: 'i',
};

/** The key of a nickname after case, accents AND confusables are folded ('Lе́o' = 'Léo') */
export function lookAlikeKey(pseudo: string): string {
  let out = '';
  for (const c of pseudoKey(pseudo)) out += CONFUSABLES[c] ?? c;
  // pseudoKey strips combining marks from latin letters, but a mark attached to
  // a confusable cyrillic/greek letter survives the fold, so strip it again
  return out.replace(/\p{M}/gu, '');
}
