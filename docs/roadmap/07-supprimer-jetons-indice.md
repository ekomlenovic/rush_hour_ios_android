# Supprimer le code mort des jetons d'indice
labels: cleanup, phase-1

## Contexte
Les indices sont **illimités par choix** (cf. `docs/GAME_DESIGN.md`) et il n'y aura pas de jetons d'indice. Il reste pourtant un système de jetons à moitié branché : on en gagne, mais ils ne servent à rien et ne sont affichés nulle part.

## À retirer
- [ ] `store/gameStore.ts` : `hintTokens`, `addHintTokens`, le `addHintTokens(2)` de `completeDailyChallenge`, et `hintTokens` dans `hardReset` et `partialize`
- [ ] Renommer `useHintToken` en `recordHintUsed` : il ne fait que compter `totalHintsUsed`, à garder pour les stats
- [ ] `app/game.tsx` : `hintTokens`, `addHintTokensFn` et la récompense « 3 ⭐ → +1 jeton »
- [ ] `app/index.tsx` : `hintTokens` déstructuré, `addHintTokens(3)` au retour, paramètre `tokens` du message de bienvenue
- [ ] `locales/fr.json` et `locales/en.json` : `game.hints_remaining`, `game.no_hints`, `game.no_hints_desc`, `game.hint_earned`, `profile.hint_tokens`

## Notes
- Le champ `hintTokens` déjà persisté chez les joueurs est simplement ignoré. On peut le nettoyer via `migrate` si une version du store est introduite (cf. `02-statistiques.md`).
- Aucune récompense de la roadmap ne doit réintroduire de monnaie liée aux indices.
