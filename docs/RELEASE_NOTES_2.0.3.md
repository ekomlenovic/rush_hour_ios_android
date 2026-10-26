# Rush Hours 2.0.3 (versionCode 16)

Mise à jour de la **2.0.2 (versionCode 15)** : des duels plus justes, chaque plateau au style de son joueur en duel et dans les replays, et une carte du défi du jour plus claire.

## Play Store (500 caractères max par langue)

À coller tel quel dans la Play Console (« Notes de version »).

```
<fr-FR>
Nouveautés :
• Duel « Moins de coups » : seul le nombre de coups compte, le même nombre de coups est une égalité
• Sorti le premier ? Tu peux partir sans perdre, le résultat t'attend
• En duel et dans les replays, chaque plateau a le style de son joueur
• Défi du jour : où tu en es, les règles en bref, ta place et tes points
• « Créer mon serveur » depuis la liste des serveurs
</fr-FR>
<en-US>
New:
• "Fewest moves" duel: only moves count, the same number of moves is a draw
• Out first? You can leave without losing, the result waits for you
• In duels and replays, each board shows its player's style
• Daily challenge: your status, the rules at a glance, your rank and points
• "Create my server" from the server list
</en-US>
```

## Détail

### Multijoueur

- **Duel « Moins de coups »** : seul le nombre de coups compte, le même nombre de coups est une égalité (avant, le plus rapide gagnait à égalité). Le duel finit dès que l'autre ne peut plus faire aussi bien ; à l'optimum, l'autre peut encore égaler.
- **Départ libre une fois sorti** : le premier sorti peut quitter l'écran sans perdre (bouton « Partir », plus de confirmation « quitter, c'est perdre »). L'autre finit sa partie ; le duel reste dans « Reprendre », puis son résultat attend 24 h dans la liste des duels. Pas de revanche avec un joueur parti.
- **Le style de chaque joueur** : en duel, l'adversaire et les spectateurs voient ton plateau avec ton thème, ton skin de voiture cible et ta palette. Les replays (défi du jour et duels) montrent aussi chaque plateau avec le style de son joueur. Un style inconnu est dessiné classique ; les parties d'avant se rejouent au style de qui regarde.
- **Carte du défi du jour** : un badge dit où tu en es (À jouer, En cours, Réussi, Abandonné, Non terminé, En préparation), les règles en bref avant de commencer, ta place et tes points une fois réussi, « Comment ça marche ? » avec toutes les règles, compte à rebours du prochain défi.
- **« Créer mon serveur »** dans la feuille « Mes serveurs », qui ouvre le tuto d'installation.

## Données des joueurs

- `STORE_VERSION` inchangé, store multijoueur inchangé : aucune donnée de l'app touchée.
- Serveur : nouvelle étape à la fin de `server/src/db.ts` (`attempts.look_json`, `duels.look1_json`, `duels.look2_json`, nullables). Rien n'est converti ni perdu, les parties d'avant restent sans style.
- Le serveur doit être mis à jour pour les styles en duel et dans les replays ; une app ou un serveur plus ancien dessine le plateau au style de qui regarde.
