# Protection de streak (« gel »)
labels: enhancement, phase-2

## Problème
Un seul jour manqué remet le streak à 1 (`updateStreak`). Perdre un streak de 40 jours est la première cause d'abandon dans ce genre de mécanique.

## Proposition
- [ ] Objet « gel de streak » ❄️ : si un jour est manqué, un gel est consommé automatiquement et le streak est conservé
- [ ] Obtention : 1 gel gagné tous les 7 jours de streak (et éventuellement en récompense de succès ou de défi hebdo), maximum 2 en stock. Pas de monnaie.
- [ ] Calendrier du profil : afficher les jours « gelés » avec une icône distincte
- [ ] Message au retour : « Ton gel a protégé ton streak de 23 jours ! »

## Notes techniques
- `updateStreak` ne compare aujourd'hui qu'avec la veille ; il faut calculer le nombre de jours manqués et consommer autant de gels que possible.
- Ne change rien aux règles du défi du jour lui-même (toujours one-shot).
