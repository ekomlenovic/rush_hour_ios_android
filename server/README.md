# Serveur multijoueur Rush Hours

Serveur **auto-hébergé** pour s'affronter entre amis sur un **défi multijoueur quotidien**, avec des classements jour / semaine / mois. Règles complètes : epic #46.

- Un puzzle par jour, **généré à l'avance** et **secret** jusqu'à ce qu'un joueur appuie sur « Commencer ».
- **Un seul essai** par joueur et par jour. Le chrono est celui du serveur.
- Chaque victoire est **vérifiée** : le serveur rejoue les coups avec les mêmes règles que l'app.
- **Duels 1v1 en temps réel** : deux joueurs sur le même puzzle aléatoire, chacun voit le plateau de l'autre ; le serveur vérifie chaque coup. Historique, scores entre joueurs, replays et classement des duels.
- Rien n'est envoyé ailleurs : les données restent sur ton serveur.

## Installation (Docker)

Il faut une machine avec Docker, un nom de domaine (par exemple duckdns) et un reverse proxy en **HTTPS** (nginx, Caddy…). L'app refuse les serveurs en `http://`.

> 💡 Le plus simple : dans l'app, **Multijoueur → Créer mon serveur**. Le guide pas à pas génère le `docker-compose.yml` et le site nginx avec tes réglages, puis **teste la connexion** depuis le téléphone.

1. Copier [`docker-compose.yml`](docker-compose.yml) et remplir `SERVER_SECRET` et `ADMIN_TOKEN` avec deux longues valeurs aléatoires :
   ```sh
   openssl rand -hex 32
   ```
2. Lancer :
   ```sh
   docker compose up -d
   docker compose logs rush-hours   # le code d'invitation est affiché au premier démarrage
   ```
3. Rediriger le domaine vers `127.0.0.1:3000`. Exemple nginx :
   ```nginx
   limit_req_zone $binary_remote_addr zone=rushhours:10m rate=5r/s;

   server {
       listen 443 ssl;
       server_name monserveur.duckdns.org;
       # ssl_certificate … (Let's Encrypt)

       location / {
           limit_req zone=rushhours burst=20 nodelay;
           proxy_pass http://127.0.0.1:3000;
           # Duels 1v1 en temps réel (WebSocket)
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "upgrade";
           proxy_set_header Host $host;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```
   Le certificat : par exemple `sudo certbot certonly --nginx -d monserveur.duckdns.org`.

   > Les **duels** passent par un WebSocket : les trois lignes `proxy_http_version`, `Upgrade` et `Connection` sont nécessaires (Caddy le fait tout seul). Un serveur installé avant les duels doit les ajouter à son site nginx puis `sudo nginx -s reload`.
4. Vérifier : `https://monserveur.duckdns.org/api/v1/info` doit répondre (ou « Tester la connexion » dans l'app).
5. Rejoindre son serveur depuis l'app avec le code d'invitation, puis **Mon compte → Devenir admin** avec `ADMIN_TOKEN`.

**Mise à jour** : `docker compose pull && docker compose up -d`. **Sauvegarde** : le volume `rush-hours-data` (un fichier SQLite).

## Configuration

| Variable | Défaut | Rôle |
|---|---|---|
| `SERVER_SECRET` | *obligatoire* | graine secrète des puzzles (≥ 16 caractères). Qui la connaît peut calculer les puzzles à l'avance : ne jamais la partager |
| `ADMIN_TOKEN` | *obligatoire* | jeton d'administration (≥ 16 caractères) |
| `INVITE_CODE` | *généré* | code pour rejoindre le serveur. Vide : généré au premier démarrage et affiché dans les logs. Un nouveau code généré depuis l'app (admin) le remplace |
| `SERVER_NAME` | `Rush Hours` | nom affiché dans l'app. Réglable aussi depuis l'app (admin) |
| `TZ` | `Europe/Paris` | fuseau du serveur |
| `RELEASE_TIME` | `12:00` | heure de sortie du défi (`HH:MM`). Un défi dure jusqu'à la sortie du suivant. Réglable aussi depuis l'app (admin) : le changement s'applique **à partir du prochain défi** (celui en cours dure plus ou moins longtemps), et il est refusé si le prochain défi sortait alors dans moins d'une heure |
| `PREGENERATE_AHEAD` | `48h` | combien de temps avant sa sortie un puzzle est généré (`30m`, `12h`, `2d`…). Réglable aussi depuis l'app (admin) |
| `DIFFICULTY` | `NORMAL,MONDAY=HARD` | difficulté (`EASY`, `NORMAL`, `HARD`, `EXPERT`, `MASTER`), réglable par jour de la semaine en anglais. Un changement ne touche que les puzzles **pas encore sortis**. Réglable aussi depuis l'app (admin), qui l'emporte alors |
| `GRACE_PERIOD` | `1h` | délai pour finir, après la sortie du défi suivant, une partie commencée à temps. Réglable aussi depuis l'app (admin) |
| `REPLAY_RETENTION_DAYS` | `7` | durée de conservation des coups (replays). Les scores sont gardés. Réglable aussi depuis l'app (admin) |
| `TRUST_PROXY` | `loopback,uniquelocal` | proxys dont l'en-tête `X-Forwarded-For` est cru (limites de débit par IP) |
| `PORT`, `HOST`, `DATA_DIR` | `3000`, `0.0.0.0`, `/data` | |

## Administration

Dans l'app : Multijoueur → Mon compte → **Devenir admin**, avec `ADMIN_TOKEN`. Le panneau admin permet de :
- revoir les **parties suspectes** (signaux, replay), confirmer la triche (🤡 : le joueur garde son rang, 0 point) ou lever le soupçon ;
- gérer les **joueurs** : renommer, exclure, donner un nouveau code de récupération à qui l'a perdu ;
- traiter les **signalements** de pseudos ;
- **régénérer le code d'invitation**, fermer les inscriptions, réserver les invitations à l'admin ;
- **remettre à zéro** les parties des défis et/ou les duels, sur une période et pour tous les joueurs ou certains (nouvelle saison) ;
- renommer le serveur, régler l'**heure de sortie**, le **délai de grâce** et la **pré-génération** ;
- régler la **difficulté** par jour, la **conservation des replays** et les **seuils de soupçon**.

Un réglage changé dans l'app l'emporte ensuite sur sa variable d'environnement. Les secrets (`SERVER_SECRET`, `ADMIN_TOKEN`), le fuseau `TZ` et `PORT`, `HOST`, `DATA_DIR`, `TRUST_PROXY` ne se règlent que dans le `docker-compose.yml`. Le bouton **Réinitialiser** remet tous les réglages aux valeurs du `docker-compose.yml` (l'heure de sortie à partir du prochain défi, le code d'invitation ne change pas).

### Soupçons automatiques (⚠️)

Calculés à l'envoi d'une victoire, visibles de tous avec leur raison. Le joueur garde ses points tant que l'admin n'a pas tranché.

| Signal | Défaut |
|---|---|
| Trop rapide : temps moyen par coup sous le seuil | 600 ms |
| « Recopié » : solution optimale d'au moins 8 coups, longue pause avant le 1er coup (≥ 60 % de la partie), puis un rythme très régulier (variation ≤ 0,3) | |
| Horloge incohérente : le temps du téléphone et celui du serveur diffèrent de plus de 15 s ou 10 % (app modifiée) | |

Le **temps passé hors de l'app** est montré à l'admin seulement : ce n'est jamais un soupçon à lui seul.

## Supprimer un compte

- Dans l'app : Multijoueur → Mon compte → **Supprimer mes données**.
- Sur le web, sans l'app : **`https://<ton serveur>/delete-account`**, avec le code de récupération (exigence de Google Play). Page sans script, tentatives limitées.

Le compte et toutes ses parties sont effacés. Rien n'est envoyé ailleurs que sur ce serveur.

## Sécurité

- Sans **jeton de joueur**, on n'accède à rien d'autre que `/info`. Sans **code d'invitation**, on ne peut pas créer de compte. L'URL seule ne donne rien.
- Tentatives limitées : 10 par quart d'heure et par IP pour rejoindre ou récupérer un compte, 120 requêtes par minute pour le reste.
- Jetons et codes de récupération **hachés** en base. Pas de log par requête, donc pas d'adresse IP conservée.
- Conteneur **non root**, en lecture seule sauf `/data`, sans capacités Linux.

## API (`/api/v1`)

Toutes les routes sauf `/info`, `/join` et `/recover` exigent `Authorization: Bearer <jeton>`. Les erreurs sont de la forme `{ "error": "code" }`.

| Route | Rôle |
|---|---|
| `GET /info` | nom, `apiVersion`, `minAppVersion`, `features` (`["duel"]`) |
| `POST /join` `{ inviteCode, pseudo }` | crée un compte → `{ token, recoveryCode, player }` |
| `POST /recover` `{ recoveryCode }` | nouveau jeton pour un compte (l'ancien téléphone est déconnecté) |
| `GET /me`, `PATCH /me` `{ pseudo }`, `DELETE /me` | mon compte ; supprimer efface aussi mes parties |
| `POST /me/recovery` | nouveau code de récupération (l'ancien ne marche plus) |
| `GET /invite` | code d'invitation, pour inviter un ami (refusé si l'admin réserve les invitations) |
| `GET /challenge/today` | défi en cours (sans le puzzle), ma partie, partie de la veille encore jouable (`pending`), résultats du jour |
| `POST /challenge/start` `{ date? }` | commence le défi en cours, ou reprend une partie → le puzzle (sans son optimum) |
| `POST /challenge/submit` `{ date, moves, clientMs?, backgroundMs? }` | envoie les coups `{ vehicleId, delta, t }` d'une victoire → coups, temps, rang, points |
| `POST /challenge/abandon` `{ date }` | abandonne la partie |
| `GET /leaderboard?period=day\|week\|month&date=` | classement : coups puis temps pour un jour ; points pour une semaine ou un mois (10, 8, 6, 5, 4, 3, 2, puis 1 par victoire). Chaque partie a son `verdict` (`suspect` avec ses `reasons`, `cheater`) |
| `GET /replay/:id` | les coups d'une partie gagnée, avec leurs temps : seulement une fois ma partie du jour terminée, ou le défi fermé |
| `POST /reports` `{ playerId, reason? }` | signaler un pseudo à l'admin |
| `POST /admin/claim` `{ adminToken }` | devenir admin |
| `GET /admin/games?filter=suspects\|all`, `POST /admin/games/:id/verdict` `{ verdict }` | parties à revoir ; `cheater`, `cleared` ou `null` |
| `GET /admin/players`, `PATCH /admin/players/:id` `{ pseudo?, banned? }`, `POST /admin/players/:id/transfer` | joueurs, renommer, exclure, nouveau code de récupération |
| `GET /admin/reports`, `DELETE /admin/reports/:id` | signalements |
| `POST /admin/invite` | nouveau code d'invitation |
| `GET /admin/settings`, `PATCH /admin/settings` | nom, heure de sortie (`release_too_soon` si le prochain défi sortirait dans moins d'une heure), délai de grâce, pré-génération, inscriptions, invitations, difficulté, conservation des replays, seuils. La réponse donne aussi `timeZone` et `nextReleaseAt` |
| `POST /admin/settings/reset` | retour aux variables d'environnement (sauf le code d'invitation) |
| `GET /duels` | les duels du serveur : ouverts (avec leur code, pour les rejoindre sans qu'on le donne) et en cours ; les duels privés n'y sont que pour leur joueur |
| `GET /duels/leaderboard?period=day\|week\|month\|all&date=` | classement des duels : victoires, puis moins de défaites |
| `GET /duels/history` | mes derniers duels, et mon score contre chaque adversaire |
| `GET /duels/:id` | un duel avec les coups des deux joueurs (replay) : pour ses joueurs et l'admin |
| `POST /admin/reset` `{ from?, to?, playerIds?, challenges, duels, dryRun? }` | efface les parties des défis et/ou les duels entre deux jours (sinon tout), de certains joueurs (sinon tous) ; `dryRun` compte sans effacer |
| `GET /duel` (WebSocket) | duels 1v1, voir ci-dessous |

### Duels (WebSocket `/api/v1/duel`)

Messages JSON. Le premier est `{ "type": "auth", "token": "…" }` → `{ type: "ready", player, duel }` (`duel` : celui en cours, pour reprendre après une coupure, ou `null`).

| Envoyé par l'app | Effet |
|---|---|
| `{ type: "create", difficulty?, private? }` | ouvre un duel → `{ type: "duel", duel }` avec son `code` ; privé : absent de `GET /duels` |
| `{ type: "join", code }` | rejoint un duel (`duel_not_found`, `duel_full`) ; 10 mauvais codes ferment la connexion |
| `{ type: "move", vehicleId, delta }` | un coup, vérifié puis envoyé aux deux : `{ type: "move", playerId, move }` (temps du serveur) |
| `{ type: "leave" }` | quitte le duel (en pleine partie : défaite) |
| `{ type: "rematch" }` | revanche, lancée quand les deux l'ont demandée |

Le serveur envoie aussi `duel` (tout le duel : statut `waiting`, `preparing`, `playing`, `over`, puzzle, `startsAt`, coups des deux joueurs), `presence` (adversaire connecté ou non), `end` (`winnerId`, `reason` : `won`, `forfeit`, `disconnected`, `timeout` ; l'optimum, `duelId` pour le replay et `score` des deux joueurs l'un contre l'autre), `closed` et `error`.

## Développement

Le serveur réutilise le générateur, le solveur et les collisions de l'app (`../utils`). L'image se construit donc depuis la racine du repo :

```sh
cd server
npm install
npm test            # vitest
npm run typecheck
npm run build       # dist/server.cjs + dist/worker.cjs
SERVER_SECRET=… ADMIN_TOKEN=… DATA_DIR=./data npm start

docker build -f server/Dockerfile -t rush-hours-server .   # depuis la racine
```
