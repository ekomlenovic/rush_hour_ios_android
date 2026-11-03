# Rush Hours 2.1.0 (versionCode 23)

Mise à jour de la **2.0.7 (versionCode 22)** : la voiture à sortir regarde toujours vers la sortie, et un Garage plus pratique.

> Notes en cours de rédaction : à compléter avec les autres changements de la 2.1.0 avant la publication.

## Play Store (500 caractères max par langue)

À coller tel quel dans la Play Console (« Notes de version »).

```
<fr-FR>
Nouveautés :
• Taxi, voiture dorée, Mafia… : la voiture à sortir a toujours l'avant vers la sortie, de quelque côté qu'elle soit
• Garage : l'aperçu et les onglets restent en haut, seule la liste défile ; le nom du style choisi ou comment le débloquer s'affiche sous l'aperçu
</fr-FR>
<en-US>
New:
• Taxi, golden car, Mafia…: the car to get out always faces the exit, whichever side it is on
• Garage: the preview and tabs stay at the top, only the list scrolls; the chosen style's name or how to unlock it shows under the preview
</en-US>
```

## Détail

### Styles

- **La voiture cible face à la sortie** (#286) : les skins dessinés (taxi, voiture dorée, Mafia, goélette…) étaient toujours tournés vers la droite (horizontal) ou le haut (vertical). Avec une sortie à gauche ou en bas, la voiture à sortir partait en marche arrière. Elle a maintenant toujours l'avant vers sa sortie (miroir à gauche, miroir du quart de tour en bas, la lumière reste du même côté) ; les autres véhicules ne changent pas. Sur le plateau de jeu (solo, duels, défis), dans les aperçus du Garage et de Mes niveaux, et dans le créateur.
- **Garage** (#287) : l'aperçu du plateau et les onglets restent en haut de l'écran, seule la liste des styles défile : on voit l'aperçu même en choisissant tout en bas de la liste. Sous l'aperçu, le nom du style choisi ou la condition pour débloquer un style verrouillé, sur une hauteur fixe pour que la liste ne bouge pas. L'aperçu rapetisse sur un écran court.

## Données des joueurs

- `STORE_VERSION` inchangé, store multijoueur inchangé, serveur sans nouvelle étape : aucune donnée des joueurs touchée (rendu et mise en page seulement).
