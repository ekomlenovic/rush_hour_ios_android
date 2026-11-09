# Rush Hours 2.2.0 (versionCode 24)

Mise à jour de la **2.1.0 (versionCode 23)** : la carte gagne une recherche de niveaux et un vrai générateur (nombre libre, mélange de difficultés et de tailles de grille, coups minimum), un niveau généré ne débloque plus la campagne, et la carte n'a plus de plafond de niveaux générés sur Android.

## Play Store (500 caractères max par langue)

À coller tel quel dans la Play Console (« Notes de version »).

```
<fr-FR>
Nouveautés sur la carte :
• Recherche de niveaux : retrouve ceux où tu n'as pas 3 étoiles, par taille de grille, nombre de coups, boss… et passe de l'un à l'autre
• Va directement à un niveau en écrivant son numéro
• Générateur : choisis le nombre de niveaux (jusqu'à 100), mélange les difficultés et les tailles de grille, fixe un minimum de coups
• Un niveau généré ne débloque plus toute la campagne
</fr-FR>
<en-US>
New on the map:
• Level search: find the levels you do not have 3 stars on, by grid size, number of moves, bosses… and go from one to the next
• Go straight to a level by typing its number
• Generator: choose how many levels (up to 100), mix difficulties and grid sizes, set a minimum of moves
• A generated level no longer unlocks the whole campaign
</en-US>
```

## Détail

### Carte : chercher des niveaux

- **Recherche** (bouton loupe, en bas à droite de la carte) : étoiles (pas réussi, 1, 2, 3, avec le raccourci « Moins de 3 étoiles »), taille de grille, coups de la meilleure solution (≤ 14, 15-24, 25-39, 40 +), campagne ou générés, boss uniquement, jouables uniquement (activé au départ). Plusieurs choix d'un même critère s'ajoutent, les critères se combinent, et le bouton dit combien de niveaux sont trouvés.
- **Sur la carte elle-même**, pas dans une liste : les niveaux trouvés restent allumés, les autres sont estompés, et une barre en bas va au précédent / suivant (en boucle), en partant du niveau trouvé le plus proche du milieu de l'écran. On joue un niveau en le touchant, comme d'habitude.
- La recherche **suit la progression** : un niveau gagné avec 3 étoiles sort de « moins de 3 étoiles ». Elle dure tant que la carte reste ouverte, rien n'est sauvegardé.
- **Aller à un niveau** : en haut de la feuille de recherche, on écrit un numéro (de 1 au dernier niveau de la carte, verrouillé ou non) et la carte s'y place, le niveau mis en avant.

### Carte : générateur de niveaux

- Le générateur a **sa propre feuille**, ouverte par le bouton **+** de la carte ou par le cadenas de fin. Il quitte les options, où restent « Communauté et niveaux » et « Débloquer tous les niveaux ». « Supprimer les niveaux générés » est dans cette feuille.
- **Nombre de niveaux libre** : on l'écrit (1 à 100 à la fois) ou on touche 3, 10, 20, 50. Avant : 1, 3 ou 10.
- **Mélange par parts** : chaque difficulté et chaque taille de grille (6x6, 7x7, 8x8) a ses parts, réglées avec − / +. 2 parts de Normal et 1 de Difficile donnent deux tiers de niveaux normaux ; la ligne affiche le pourcentage et le nombre de niveaux. Avant : une seule difficulté et une seule taille par génération.
- **Coups minimum par difficulté** (facultatif) : vide (« Auto »), les coups habituels de la difficulté ; avec un nombre, chaque niveau de cette difficulté demande au moins ce nombre de coups au mieux, sans dépasser le maximum habituel de la difficulté. Un niveau trouvé plus long que d'habitude est gardé (jusqu'à 10 coups au-dessus).
- Les niveaux sont générés **du plus facile au plus dur**. L'estimation additionne chaque combinaison et tient compte du minimum de coups ; la confirmation « génération longue » nomme les combinaisons qui peuvent bloquer l'app.

### Carte : niveaux générés et campagne

- **Un niveau généré ne débloque plus la campagne.** Avant, gagner un niveau généré (numéroté après la campagne) ouvrait d'un coup toute la campagne. Il reste toujours jouable et sa victoire compte comme une autre (étoiles, XP, missions, succès), mais le niveau « Suivant » reste là où en est la campagne.
- Les niveaux générés font avancer la carte **une fois la campagne terminée**, ou débloquée par **« Débloquer tous les niveaux »** (options de la carte), inchangé.
- Tant que la campagne est en cours, la carte et « Jouer » rouvrent sur le premier niveau généré pas encore réussi après celui qu'on vient de gagner ; s'il n'y en a plus, sur le prochain niveau de la campagne.

### Sauvegarde

- **Plus de plafond de niveaux générés** (#330) : écrits en une seule entrée JSON (environ 1,7 Ko par niveau), les niveaux générés ne se relisaient plus sur Android au-delà de 2 Mo, vers 1 200 niveaux. Ils sont maintenant écrits en forme compacte (environ 70 octets par niveau), 500 par entrée. Avec le générateur qui en fait jusqu'à 100 à la fois, ce plafond aurait été atteint bien plus vite.

## Données des joueurs

- `STORE_VERSION` inchangé (13), store multijoueur inchangé, serveur sans nouvelle étape : **aucun champ sauvegardé ajouté, retiré ni renommé**, aucun identifiant ni numéro de niveau changé.
- **`maxUnlockedLevel`** garde sa forme, sa valeur et sa signification ; seul ce qui le fait avancer change (un niveau généré ne le fait plus avancer tant que la campagne n'est pas terminée ou débloquée). Pas de migration : une campagne déjà débloquée en gagnant un niveau généré **le reste** (valeur la plus favorable au joueur, et on ne la distingue pas d'un « Débloquer tous les niveaux »). Testé dans `__tests__/game.test.ts` à partir de cet état.
- **Rangement de la sauvegarde sur le téléphone** (#330) : les niveaux générés passent de l'entrée `rush-hour-storage:generatedLevels` (JSON) à des entrées compactes de 500 niveaux (`…:generatedLevels:packed:<n>`) avec un manifeste. L'état relu, l'export et les migrations ne voient aucune différence, d'où `STORE_VERSION` inchangé. L'entrée d'une 2.1.0 est relue tant qu'il n'y a pas de manifeste, convertie à l'écriture suivante et laissée telle quelle pour une version plus ancienne réinstallée ; une entrée manquante fait échouer le chargement plutôt que d'écraser la sauvegarde. Testé dans `__tests__/saveStorage.test.ts` à partir d'un rangement 2.1.0 écrit en dur.
- La recherche, les réglages du générateur et le minimum de coups restent dans l'état de l'écran : rien dans `partialize`, rien dans le `.rushsave`. Les anciennes sauvegardes s'importent toujours (`__tests__/saveTransfer.test.ts`).
- Le générateur du **défi du jour ne change pas** (les niveaux plus longs ne sont gardés que sur demande du générateur de la carte) : `ARCHIVE_FIRST_DATE` reste au 14/10/2026.

## Avant de publier

- Pas de nouveau module natif ni de nouvelle permission : un build normal suffit.
- **Vérifications sur téléphone** (les nouveautés n'ont été vérifiées que par les tests et sur la version web) : clavier numérique dans les deux feuilles (nombre de niveaux, coups minimum, aller à un niveau), saut vers un niveau lointain sur Android, barre de recherche et boutons flottants au-dessus de la barre de navigation, lecture au lecteur d'écran.
- **Mise à jour depuis la 2.1.0 sur un vrai téléphone Android**, avec des niveaux générés déjà présents : ils doivent être là après la mise à jour, puis après en avoir généré d'autres et relancé l'app (#330).
- Essayer une génération avec un minimum de coups proche du maximum de la difficulté : l'estimation est basse dans ce cas, vérifier que la confirmation s'affiche bien.
- Le serbe des nouveaux textes est à relire.
- Vérifier dans la Play Console que le versionCode 24 n'a pas déjà été utilisé.
