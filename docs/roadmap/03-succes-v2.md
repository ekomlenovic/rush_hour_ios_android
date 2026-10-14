# Système de succès v2 : déclaratif, progression, déblocage visible et nouveaux succès
labels: enhancement, phase-1

## Constat
- Les conditions sont codées en dur dans `checkAchievements` (`store/gameStore.ts`) et la liste est dupliquée dans `app/profile.tsx` (`ACHIEVEMENT_LIST`).
- Débloquer un succès ne produit qu'une vibration : **le joueur ne voit rien**.
- Pas de progression visible (« 12 / 50 niveaux »).

## Refonte technique
- [ ] Fichier unique `data/achievements.ts` : `{ id, icon, category, tier, hidden?, reward?, progress: (state) => { current, target } }`
- [ ] `checkAchievements` itère sur cette définition et renvoie la liste des nouveaux succès
- [ ] Profil : barre de progression par succès, regroupement par catégorie, compteur global « 14 / 40 »
- [ ] **Popup / toast animé** au déblocage (en jeu et sur l'écran de victoire), avec file d'attente si plusieurs succès d'un coup
- [ ] Récompense optionnelle : XP ou cosmétique
- [ ] Succès **cachés** (« ??? » tant qu'ils ne sont pas débloqués)

## Paliers (bronze / argent / or) sur les succès existants
- Niveaux réussis : 5 / 50 / 100 → ajouter 250 / 500
- Streak : 3 / 7 / 30 → ajouter 100 / 365
- Défis du jour : 1 / 7 → ajouter 30 / 100

## Nouveaux succès proposés
| Catégorie | Succès |
|---|---|
| Maîtrise | Première victoire · 10 / 50 niveaux à 3 ⭐ d'affilée · Finir un niveau MASTER · Réussir un niveau 8×8 |
| Pureté (carte uniquement) | Finir un niveau **sans indice ni undo** · 25 niveaux sans aucun indice |
| Vitesse | Finir un niveau en moins de 30 s · Défi du jour en moins de 1 min |
| Défi du jour | Défi du jour à 3 ⭐ · 7 jours d'affilée à 3 ⭐ · Réussir un défi du **lundi** · Défi du jour au premier coup gagnant possible (optimal) |
| Créateur | Créer un niveau à ≥ 20 coups minimum · Partager un niveau · Importer un niveau |
| Secrets (cachés) | Jouer entre minuit et 5 h · Faire 500 undo au total · Revenir après 30 jours d'absence · Jouer le 1er janvier |

⚠️ Respecter `docs/GAME_DESIGN.md` : aucun succès « sans indice / sans undo » sur le défi du jour (il n'y a jamais d'aide).

Dépend de : `02-statistiques.md`.
