# Brancher le défi hebdomadaire dans l'UI
labels: enhancement, phase-1

## Constat
La logique existe dans `store/gameStore.ts` (`weeklyChallenge`, `completeWeeklyChallenge`), avec les traductions (`home.weekly_challenge`, `home.weekly_done`) et le succès `weekly_warrior`, mais **aucun écran n'y mène**. Le succès est donc impossible à débloquer.

## À faire
- [ ] Générer le niveau de la semaine de façon déterministe à partir de la clé ISO (`2026-W42`), même principe que `generateDailyLevel`, avec une difficulté supérieure (EXPERT/MASTER, grille plus grande).
- [ ] Bouton « Défi hebdomadaire » sur l'accueil (`app/index.tsx`), sous le défi du jour, avec le temps restant (« encore 3 j »).
- [ ] Route `game?levelId=weekly&week=2026-W42`, réutilisant le flux du défi du jour (sauvegarde `savedStates["weekly-…"]`).
- [ ] Réinitialiser `weeklyChallenge` quand la clé de semaine change. Aujourd'hui `completed` reste à `true` indéfiniment.
- [ ] Récompense : XP et/ou cosmétique (voir `08-cosmetiques.md`).

## Décision de design à prendre (à reporter dans `docs/GAME_DESIGN.md`)
Le défi hebdo suit-il les règles du défi du jour (one-shot, sans aide) ? Proposition : **plusieurs tentatives autorisées toute la semaine, sans indice, meilleur score retenu**. Le défi du jour reste le one-shot, l'hebdo devient le « gros puzzle » qu'on peaufine.
