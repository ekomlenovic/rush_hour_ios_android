# Cosmétiques à débloquer : thèmes de plateau et skins de véhicules
labels: enhancement, phase-3

Donne un **but** aux étoiles et succès accumulés.

## Contenu
- [ ] Thèmes de plateau : Classique, Nuit néon, Bois, Papier/croquis, Pixel art, Neige (saisonnier)
- [ ] Skins de la voiture cible : couleurs, voiture de sport, taxi, bus, fusée…
- [ ] Palettes pour les autres véhicules
- [ ] Effets de victoire : confettis, feu d'artifice, trace de vitesse

## Déblocage
- Paliers d'étoiles totales (50 ⭐, 150 ⭐, 300 ⭐…)
- Succès spécifiques (streak 30 → thème « En feu »)
- Niveau joueur (cf. `09-niveau-joueur-xp.md`)
- Récompenses de défi hebdo

## Technique
- [ ] Centraliser les couleurs dans un objet de thème (aujourd'hui en dur dans chaque écran, ex. `colors` de `app/game.tsx`)
- [ ] `components/Block.tsx` / `Board.tsx` lisent le thème actif depuis le store
- [ ] Écran « Garage » ou « Personnalisation » avec aperçu
