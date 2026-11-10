# Rush Hours 2.2.1 (versionCode 25)

Mise à jour de la **2.2.0 (versionCode 24)** : le générateur de la carte devient bien plus rapide et ne fige plus l'app, sa feuille est plus claire, les plateaux denses sont plus variés sans jamais redonner un niveau déjà présent, et les véhicules dessinés regardent au hasard d'un côté ou de l'autre.

## Play Store (500 caractères max par langue)

À coller tel quel dans la Play Console (« Notes de version »).

```
<fr-FR>
Nouveautés :
• Générateur de niveaux bien plus rapide sur les grandes grilles et les difficultés élevées, et l'app reste utilisable pendant la génération
• Générateur plus clair : réglages en cartes, aide repliable
• Plateaux plus variés, et jamais deux fois le même niveau
• Les véhicules dessinés regardent au hasard d'un côté ou de l'autre
</fr-FR>
<en-US>
What's new:
• Much faster level generator on big grids and high difficulties, and the app stays usable while it runs
• Clearer generator: settings in cards, foldable help
• More varied boards, and never the same level twice
• Drawn vehicles now face either way at random
</en-US>
```

## Détail

### Carte : générateur de niveaux plus rapide (#337)

- **Une recette par difficulté et taille de grille** (`utils/mapGenerator.ts`) : tirage puis résolution pour Facile et Normal 6x6 ; pour les autres, exploration de toutes les positions d'un plateau et choix d'une position à la bonne distance de la sortie. Avant, un plateau était tiré au hasard, résolu en entier et jeté s'il n'avait pas le bon nombre de coups.
- **Hors du thread de l'app** : la génération tourne sur le runtime du solveur (Web Worker sur le web), par appels courts. L'app reste utilisable et **Annuler** agit à tout moment, plus seulement entre deux niveaux.
- Temps par niveau mesurés sur Node (avant → après) : Normal 8x8 61 s → 1,8 s ; Difficile 7x7 9 s → 0,9 s ; Expert 6x6 3 s → 0,5 s ; Expert 7x7 plus de 60 s → 1,2 s ; Maître 6x6, 7x7, 8x8 : aucun niveau en 60 s → 17 s, 9 s, 80 s. **Pas encore mesuré sur téléphone.**
- Table des temps estimés remesurée ; l'avertissement et la confirmation « génération longue » disent maintenant qu'on peut continuer à utiliser l'app.

### Carte : plateaux plus variés, jamais deux fois le même niveau (#337)

- Plateaux denses (8x8 à partir de Normal, Expert 7x7, Maître) : la part de camions est tirée pour chaque plateau (10 à 90 %). Un 8x8 a de 19 à 29 véhicules, dont 1 à 16 camions, au lieu de toujours 24 à 28.
- Normal 8x8 : un niveau sur trois a plus de cases libres (7 à 12 au lieu de 2 à 6).
- Un niveau que la carte a déjà (campagne ou généré), **même tourné ou en miroir**, n'est plus ajouté.

### Carte : feuille du générateur plus claire (#336)

- Réglages rangés en cartes (nombre, difficulté, taille de grille) ; chaque part montre ses niveaux par un badge et une barre.
- Les explications longues sont repliées derrière un bouton d'aide par carte.
- L'avertissement des générations lentes ne s'affiche que si Expert, Maître, 7x7 ou 8x8 est choisi.
- Le bas de la liste est estompé, avec « Fais défiler pour voir la suite », tant qu'il reste du contenu.

### Véhicules dessinés (#335)

- Les véhicules dessinés autres que la voiture cible regardent au hasard d'un côté ou de l'autre de leur axe. Le sens vient d'un hash stable (identifiant, longueur, voie, sortie) : il ne change pas quand le véhicule glisse, ni d'un affichage à l'autre d'un même niveau. La voiture cible garde l'avant vers la sortie.

## Données des joueurs

- `STORE_VERSION` inchangé (13), store multijoueur inchangé, serveur sans nouvelle étape : **aucun champ de progression ajouté, retiré ni renommé**, aucun identifiant ni numéro de niveau changé. Les niveaux générés sont toujours enregistrés en entier ; le générateur à graine du défi du jour et du serveur n'est pas modifié (`ARCHIVE_FIRST_DATE` reste au 14/10/2026).
- Seule l'entrée **`rush-hours-generation-times`** (temps de génération mesurés sur le téléphone, jamais exportés ni dans le `.rushsave`) passe en version 2 : les temps de l'ancien générateur sont abandonnés, sinon l'estimation annoncerait des minutes et demanderait une confirmation à tort. Perdre ces temps ramène seulement l'estimation à la table.
- L'orientation des véhicules est calculée à l'affichage : rien n'est sauvegardé. Les anciennes sauvegardes s'importent toujours (`__tests__/saveTransfer.test.ts`).

## Avant de publier

- Pas de nouveau module natif ni de nouvelle permission : un build normal suffit.
- **Mesurer le générateur sur un vrai téléphone** (Android et iOS) : Maître 8x8 et Expert 8x8 surtout, l'app doit rester fluide et Annuler répondre pendant la génération. Les temps n'ont été mesurés que sur Node.
- Vérifier la feuille du générateur sur téléphone : boutons d'aide, indicateur de défilement, lecture au lecteur d'écran.
- Regarder quelques niveaux avec des skins dessinés : les véhicules ne doivent pas changer de sens en glissant.
- Le serbe des nouveaux textes est à relire.
- Vérifier dans la Play Console que le versionCode 25 n'a pas déjà été utilisé.
