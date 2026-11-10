# Rush Hours 2.2.2 (versionCode 26)

Mise à jour de la **2.2.1 (versionCode 25)** : la régularité paie beaucoup plus. Les 3 missions du jour rapportent 200 XP, et deux bonus d'XP (la série de missions et le streak du défi du jour) augmentent toute l'XP gagnée, jusqu'à ×3. Le niveau joueur se montre par un emblème, aussi à côté du pseudo dans le multijoueur, et la flamme du streak et le flocon des gels de l'accueil ouvrent chacun un écran.

## Play Store (500 caractères max par langue)

À coller tel quel dans la Play Console (« Notes de version »).

```
<fr-FR>
Nouveautés :
• Les 3 missions du jour rapportent 200 XP
• Bonus d'XP : chaque jour d'affilée de missions terminées ou de défi du jour réussi augmente toute l'XP que tu gagnes, jusqu'à ×3
• Une carte « Bonus d'XP » dans le profil, et le bonus au bout de ta barre d'XP
• Ton niveau a son emblème, aussi à côté de ton pseudo en multijoueur
• La flamme du streak et le flocon des gels ouvrent leur propre écran
</fr-FR>
<en-US>
What's new:
• The 3 daily missions now give 200 XP
• XP bonuses: every day in a row with your missions done or the daily challenge won boosts all the XP you earn, up to ×3
• An "XP bonus" card in your profile, and your bonus at the end of your XP bar
• Your level has its own emblem, also next to your nickname in multiplayer
• The streak flame and the freeze snowflake open their own screen
</en-US>
```

## Détail

### XP : la régularité paie plus

- **Missions du jour** : les 3 missions terminées donnent **200 XP** (100 avant), **+50 XP** si le stock de gels est plein, et toujours 1 gel sinon.
- **Deux bonus d'XP** sur **toute** l'XP gagnée (niveaux, défis, archives, missions, boss, succès) :
  - la **série de missions** : jours d'affilée avec les 3 missions terminées ; un jour manqué la remet à zéro (les gels ne la protègent pas) ;
  - le **streak** du défi du jour (un gel garde aussi son bonus).
- Mêmes paliers pour les deux : **+5 % par jour d'affilée** la première semaine (+30 % au 7ᵉ jour), **+60 % à 30 jours**, **+100 % à 60 jours**. Ils s'additionnent : de +0 % à +200 % (XP ×3).
- Avec le défi du jour et les missions chaque jour, le niveau 10 vient en trois semaines environ, le niveau 20 en trois à quatre mois (environ un an avant).

### Profil et accueil

- Carte **« Bonus d'XP »** dans le profil : bonus total, puis pour chaque bonus les jours d'affilée, ce qu'il ajoute, les paliers (7, 30, 60 jours) et le prochain.
- Accueil : le bonus total s'affiche **au bout de la barre d'XP** du badge, sans hauteur en plus ; le toucher ouvre le profil sur la carte des bonus.
- La **flamme du streak** ouvre un écran (ce qu'est le streak, son bonus, sa règle, le prochain palier) au lieu d'une alerte ; le **flocon des gels** aussi (ce qu'est un gel, comment en gagner, le stock, le niveau du prochain emplacement).
- L'écran des missions et les cartes des défis annoncent l'XP bonus compris.

### Emblème du niveau joueur (#342)

- Le niveau se montre par un **emblème** : un panneau routier par titre (rond, losange, écusson, hexagone, octogone, écusson couronné, étoile), chacun dans sa matière, avec des boulons pour l'avancée dans le palier. Sur l'accueil, dans l'anneau d'XP du profil et dans « Voir toute la progression ».
- **Multijoueur** : l'emblème s'affiche après le pseudo dans les classements des défis et des duels, la fiche du joueur, les duels, le face-à-face et les barres des joueurs. Le niveau est dit par l'app au serveur, il est **décoratif** et ne sert jamais à classer. Seulement sur un serveur à jour (`features: ['player_level']`) ; sinon rien ne change.
- Politique de confidentialité mise à jour (10/11/2026) : le serveur multijoueur reçoit et montre le niveau joueur.

## Données des joueurs

- **`STORE_VERSION` 13 → 14** : nouveau champ persisté `missionStreak` et calcul de l'XP modifié. La migration v14 **crédite 100 XP par jour de missions déjà terminé** (l'écart entre l'ancienne et la nouvelle récompense) et démarre la série à 1 jour si les missions du dernier jour étaient faites ; rien n'est retiré. La migration v3 garde l'ancienne valeur (`LEGACY_MISSIONS_XP`). Testé dans `__tests__/migrations.test.ts`.
- **Import d'une sauvegarde** : `maxPlausibleXp` tient compte des bonus au maximum (×3) et la série est plafonnée aux jours de missions faits ; les anciennes sauvegardes s'importent toujours (`__tests__/saveTransfer.test.ts`).
- **Serveur** : nouvelle étape de base `ALTER TABLE players ADD COLUMN level INTEGER` (`null` pour tous les joueurs existants, jusqu'à ce que leur app dise leur niveau). Rien de sauvegardé en plus sur le téléphone pour le multijoueur.
- Ce commit de version ne change lui-même aucune donnée sauvegardée.

## Avant de publier

- Pas de nouveau module natif ni de nouvelle permission : un build normal suffit.
- **Mettre à jour les serveurs multijoueur** pour voir les emblèmes (la nouvelle étape de base s'applique au démarrage) ; une app 2.2.2 sur un ancien serveur marche comme avant, sans emblème.
- **Migration v14 sur un vrai téléphone** : installer la 2.2.2 par-dessus la 2.2.1 avec des jours de missions faits, vérifier l'XP créditée et la série de missions.
- Vérifier sur téléphone : badge de l'accueil avec et sans bonus (le défi hebdo ne doit pas sortir de l'écran), écrans du streak et des gels, carte « Bonus d'XP » du profil, emblèmes dans les classements et les duels, au lecteur d'écran aussi.
- Le serbe des nouveaux textes est à relire.
- Mettre à jour la politique de confidentialité publiée si elle est hébergée ailleurs que dans le dépôt.
- Vérifier dans la Play Console que le versionCode 26 n'a pas déjà été utilisé.
