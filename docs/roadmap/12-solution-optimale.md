# Revoir la solution optimale après une victoire
labels: enhancement, phase-4

Quand le joueur gagne avec plus de coups que l'optimal, lui donner envie de **réessayer pour les 3 ⭐**.

- [ ] Sur l'écran de victoire (carte uniquement) : « Solution optimale en 12 coups — tu en as fait 17 »
- [ ] Bouton « Voir la solution » : animation coup par coup via `utils/solver.ts` (déjà utilisé pour les indices)
- [ ] Bouton « Réessayer pour 3 ⭐ » qui relance le niveau
- [ ] Défi du jour : solution visible **seulement le lendemain** (pas de spoiler, et cohérent avec le one-shot)
