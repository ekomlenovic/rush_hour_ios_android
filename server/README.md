# Serveur multijoueur Rush Hours

Serveur **auto-hébergé** pour s'affronter entre amis sur un **défi multijoueur quotidien**, avec des classements jour / semaine / mois. Règles complètes : epic #46.

- Un puzzle par jour, **généré à l'avance** et **secret** jusqu'à ce qu'un joueur appuie sur « Commencer ».
- **Un seul essai** par joueur et par jour. Le chrono est celui du serveur.
- Chaque victoire est **vérifiée** : le serveur rejoue les coups avec les mêmes règles que l'app.
- Rien n'est envoyé ailleurs : les données restent sur ton serveur.

## Installation (Docker)

Il faut une machine avec Docker, un nom de domaine (par exemple duckdns) et un reverse proxy en **HTTPS** (nginx, Caddy…). L'app refuse les serveurs en `http://`.

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

       location /api/ {
           limit_req zone=rushhours burst=20 nodelay;
           proxy_pass http://127.0.0.1:3000;
           proxy_set_header Host $host;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```
4. Vérifier : `https://monserveur.duckdns.org/api/v1/info` doit répondre.

**Mise à jour** : `docker compose pull && docker compose up -d`. **Sauvegarde** : le volume `rush-hours-data` (un fichier SQLite).

## Configuration

| Variable | Défaut | Rôle |
|---|---|---|
| `SERVER_SECRET` | *obligatoire* | graine secrète des puzzles (≥ 16 caractères). Qui la connaît peut calculer les puzzles à l'avance : ne jamais la partager |
| `ADMIN_TOKEN` | *obligatoire* | jeton d'administration (≥ 16 caractères) |
| `INVITE_CODE` | *généré* | code pour rejoindre le serveur. Vide : généré au premier démarrage et affiché dans les logs |
| `SERVER_NAME` | `Rush Hours` | nom affiché dans l'app |
| `TZ` | `Europe/Paris` | fuseau du serveur |
| `RELEASE_TIME` | `12:00` | heure de sortie du défi (`HH:MM`). Un défi dure jusqu'à la sortie du suivant |
| `PREGENERATE_AHEAD` | `48h` | combien de temps avant sa sortie un puzzle est généré (`30m`, `12h`, `2d`…) |
| `DIFFICULTY` | `NORMAL,MONDAY=HARD` | difficulté (`EASY`, `NORMAL`, `HARD`, `EXPERT`, `MASTER`), réglable par jour de la semaine en anglais. Un changement ne touche que les puzzles **pas encore sortis** |
| `GRACE_PERIOD` | `1h` | délai pour finir, après la sortie du défi suivant, une partie commencée à temps |
| `REPLAY_RETENTION_DAYS` | `7` | durée de conservation des coups (replays). Les scores sont gardés |
| `TRUST_PROXY` | `loopback,uniquelocal` | proxys dont l'en-tête `X-Forwarded-For` est cru (limites de débit par IP) |
| `PORT`, `HOST`, `DATA_DIR` | `3000`, `0.0.0.0`, `/data` | |

## Sécurité

- Sans **jeton de joueur**, on n'accède à rien d'autre que `/info`. Sans **code d'invitation**, on ne peut pas créer de compte. L'URL seule ne donne rien.
- Tentatives limitées : 10 par quart d'heure et par IP pour rejoindre ou récupérer un compte, 120 requêtes par minute pour le reste.
- Jetons et codes de récupération **hachés** en base. Pas de log par requête, donc pas d'adresse IP conservée.
- Conteneur **non root**, en lecture seule sauf `/data`, sans capacités Linux.

## API (`/api/v1`)

Toutes les routes sauf `/info`, `/join` et `/recover` exigent `Authorization: Bearer <jeton>`. Les erreurs sont de la forme `{ "error": "code" }`.

| Route | Rôle |
|---|---|
| `GET /info` | nom, `apiVersion`, `minAppVersion` |
| `POST /join` `{ inviteCode, pseudo }` | crée un compte → `{ token, recoveryCode, player }` |
| `POST /recover` `{ recoveryCode }` | nouveau jeton pour un compte (l'ancien téléphone est déconnecté) |
| `GET /me`, `PATCH /me` `{ pseudo }`, `DELETE /me` | mon compte ; supprimer efface aussi mes parties |
| `POST /me/recovery` | nouveau code de récupération (l'ancien ne marche plus) |
| `GET /challenge/today` | défi en cours (sans le puzzle), ma partie, partie de la veille encore jouable (`pending`), résultats du jour |
| `POST /challenge/start` `{ date? }` | commence le défi en cours, ou reprend une partie → le puzzle (sans son optimum) |
| `POST /challenge/submit` `{ date, moves, clientMs?, backgroundMs? }` | envoie les coups `{ vehicleId, delta, t }` d'une victoire → coups, temps, rang, points |
| `POST /challenge/abandon` `{ date }` | abandonne la partie |
| `GET /leaderboard?period=day\|week\|month&date=` | classement : coups puis temps pour un jour ; points pour une semaine ou un mois (10, 8, 6, 5, 4, 3, 2, puis 1 par victoire) |

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
