# Suivi de statistiques détaillées
labels: enhancement, phase-1

Prérequis à la plupart des nouveaux succès, missions et à l'écran profil.

## Données à enregistrer (store persistant, champ `stats`)
- [ ] Temps passé par niveau (début → victoire, en excluant le temps app en arrière-plan) et meilleur temps
- [ ] Temps de jeu total, nombre total de coups
- [ ] Par niveau : nombre d'indices utilisés, d'undo et de resets pendant la tentative gagnante (`LevelProgress` étendu)
- [ ] Niveaux réussis sans indice, sans undo, au premier essai
- [ ] Nombre de niveaux partagés, importés, créés et joués par d'autres (si mesurable)
- [ ] Répartition par taille de grille et par difficulté

## Affichage (`app/profile.tsx`)
- [ ] Section « Statistiques » enrichie : temps total, moyenne de coups vs optimal, % de 3 ⭐
- [ ] Historique des 30 derniers défis du jour (étoiles par jour)

## Notes techniques
- Prévoir une **migration** du store persistant (`version` + `migrate` dans `persist`), car les sauvegardes existantes n'ont pas ces champs.
- `hardReset` doit remettre les stats à zéro.
