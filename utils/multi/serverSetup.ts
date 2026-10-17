/**
 * Files of the "create my server" guide (#51), filled in with the choices of the player:
 * the same docker-compose.yml as server/docker-compose.yml, and an nginx site.
 */

export const SERVER_IMAGE = 'ghcr.io/ekomlenovic/rush-hours-server:latest';
export const SERVER_PORT = 3000;
/** Shown where the player pastes the output of `openssl rand -hex 32` */
export const SECRET_PLACEHOLDER = 'PASTE-A-SECRET-HERE';

export interface SetupChoices {
  name: string;
  timeZone: string;
  /** 'HH:MM' */
  releaseTime: string;
  /** e.g. 'NORMAL,MONDAY=HARD' */
  difficulty: string;
}

/** Double quotes and backslashes would break the YAML string */
const yamlString = (value: string) => `"${value.replace(/[\\"]/g, '')}"`;

export function buildCompose({ name, timeZone, releaseTime, difficulty }: SetupChoices): string {
  return `services:
  rush-hours:
    image: ${SERVER_IMAGE}
    container_name: rush-hours
    restart: unless-stopped
    ports:
      - "127.0.0.1:${SERVER_PORT}:${SERVER_PORT}"
    environment:
      SERVER_NAME: ${yamlString(name.trim() || 'Rush Hours')}
      # openssl rand -hex 32 (never share it)
      SERVER_SECRET: "${SECRET_PLACEHOLDER}"
      # openssl rand -hex 32 (another one)
      ADMIN_TOKEN: "${SECRET_PLACEHOLDER}"
      INVITE_CODE: ""
      TZ: ${yamlString(timeZone)}
      RELEASE_TIME: ${yamlString(releaseTime)}
      PREGENERATE_AHEAD: "48h"
      DIFFICULTY: ${yamlString(difficulty)}
      GRACE_PERIOD: "1h"
      REPLAY_RETENTION_DAYS: "7"
    volumes:
      - rush-hours-data:/data
    read_only: true
    tmpfs:
      - /tmp
    cap_drop:
      - ALL
    security_opt:
      - no-new-privileges:true

volumes:
  rush-hours-data:
`;
}

/** The host of a domain as typed: 'https://Mon.duckdns.org/' → 'mon.duckdns.org' */
export function domainOf(input: string): string {
  return input.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/[/?#].*$/, '');
}

export function buildNginx(domain: string): string {
  const host = domainOf(domain) || 'monserveur.duckdns.org';
  return `limit_req_zone $binary_remote_addr zone=rushhours:10m rate=5r/s;

server {
    listen 443 ssl;
    server_name ${host};
    ssl_certificate     /etc/letsencrypt/live/${host}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${host}/privkey.pem;

    location / {
        limit_req zone=rushhours burst=20 nodelay;
        proxy_pass http://127.0.0.1:${SERVER_PORT};
        # Duels in real time (WebSocket)
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
`;
}

export const SETUP_COMMANDS = {
  secrets: 'openssl rand -hex 32',
  start: 'docker compose up -d',
  inviteCode: 'docker compose logs rush-hours | grep inviteCode',
  update: 'docker compose pull && docker compose up -d',
};

/** The time zone of the phone, the default of the server */
export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Paris';
  } catch {
    return 'Europe/Paris';
  }
}
