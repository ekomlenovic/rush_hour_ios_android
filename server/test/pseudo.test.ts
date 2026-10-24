import { describe, expect, it } from 'vitest';
import { cleanPseudo, pseudoKey, lookAlikeKey } from '../src/pseudo';

const FILLER = '\u3164'; // HANGUL FILLER
const COMBINING = '\u0301'; // COMBINING ACUTE ACCENT
const CYR_E = '\u0435'; // cyrillic е

describe('cleanPseudo', () => {
  it('refuses a nickname made only of Hangul fillers', () => {
    expect(cleanPseudo(FILLER + FILLER)).toBe(null);
  });

  it('refuses a nickname made only of combining marks', () => {
    expect(cleanPseudo(COMBINING + COMBINING + COMBINING)).toBe(null);
  });

  it('refuses a nickname that starts with a combining mark', () => {
    expect(cleanPseudo(COMBINING + 'Léo')).toBe(null);
  });

  it('keeps accepting ordinary nicknames of every script', () => {
    expect(cleanPseudo('Léo')).toBe('Léo');
    expect(cleanPseudo('Эмилия')).toBe('Эмилия'); // fully cyrillic
    expect(cleanPseudo('김철수')).toBe('김철수'); // fully korean
    expect(cleanPseudo('Joueur 3')).toBe('Joueur 3');
  });

  it('still refuses the previous edge cases', () => {
    for (const p of ['a', 'x'.repeat(21), 'bad<script>', ' ', '-dash', 'zero​width']) {
      expect(cleanPseudo(p)).toBe(null);
    }
  });
});

describe('pseudoKey', () => {
  it('folds case and accents only (unchanged behavior)', () => {
    expect(pseudoKey('LÉO')).toBe('leo');
    expect(pseudoKey('L\u00e9o')).toBe('leo');
    // pseudoKey does NOT fold confusables: a cyrillic е stays a cyrillic е
    expect(pseudoKey('L' + CYR_E + 'o')).toBe('l' + CYR_E + 'o');
  });
});

describe('lookAlikeKey', () => {
  it('folds the usual confusables to latin', () => {
    // cyrillic е looks like latin e
    expect(lookAlikeKey('L' + CYR_E + 'o')).toBe(lookAlikeKey('Leo'));
    // cyrillic с / е look like latin c / e
    expect(lookAlikeKey('\u0441' + CYR_E + 'o')).toBe(lookAlikeKey('ceo'));
    // greek ο / α / ρ look like o / a / p
    expect(lookAlikeKey('\u03bf\u03bf')).toBe('oo');
    expect(lookAlikeKey('\u03b1')).toBe('a');
    expect(lookAlikeKey('\u03c1')).toBe('p');
    // case and accents still fold
    expect(lookAlikeKey('LÉO')).toBe(lookAlikeKey('leo'));
    expect(lookAlikeKey('L\u00e9o')).toBe(lookAlikeKey('leo'));
    // a cyrillic letter carrying a combining mark still folds ('Lе́o' = 'Léo')
    expect(lookAlikeKey('L' + CYR_E + COMBINING + 'o')).toBe(lookAlikeKey('Léo'));
  });

  it('leaves other scripts untouched', () => {
    expect(lookAlikeKey('Эмилия')).not.toBe(lookAlikeKey('Emilia'));
    expect(lookAlikeKey('김철수')).not.toBe(lookAlikeKey('Kim'));
  });
});
