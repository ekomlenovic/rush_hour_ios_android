import { Platform } from 'react-native';
import { WEB_APP_URL } from '../webApp';

/**
 * Addresses of the multiplayer servers (#46) and the invitation links.
 * No URL object: the one of React Native is incomplete.
 */

/** Scheme of the app (app.json) */
export const APP_SCHEME = 'rush-hours';

/**
 * Start of the links: the app's own, or on the web the web version's, which opens in any
 * browser (see docs/GAME_DESIGN.md, Version web). Both are read everywhere.
 */
const linkBase = () => (Platform.OS === 'web' ? `${WEB_APP_URL}/` : `${APP_SCHEME}://`);
const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const JOIN_LINK = new RegExp(`^(?:${APP_SCHEME}://(?:/)?|${escapeRegExp(WEB_APP_URL)}/)multi/join/?\\?(.*)$`, 'i');

export type ServerUrlResult = { ok: true; url: string } | { ok: false; error: 'invalid_url' | 'not_https' };

/**
 * The base address of a server as typed or pasted: https is added when missing,
 * http is refused (iOS and Android block it anyway), the API path is dropped.
 * 'Monserveur.duckdns.org/api/v1/' → 'https://monserveur.duckdns.org'
 */
export function normalizeServerUrl(input: string): ServerUrlResult {
  let value = input.trim();
  if (!value) return { ok: false, error: 'invalid_url' };
  const scheme = /^([a-z][a-z0-9+.-]*):\/\//i.exec(value);
  if (!scheme) value = `https://${value}`;
  else if (scheme[1].toLowerCase() === 'http') return { ok: false, error: 'not_https' };
  else if (scheme[1].toLowerCase() !== 'https') return { ok: false, error: 'invalid_url' };

  const match = /^https:\/\/([^/?#\s@]+)(\/[^?#\s]*)?$/i.exec(value);
  if (!match) return { ok: false, error: 'invalid_url' };
  const host = match[1].toLowerCase();
  // A host name (with a dot, or localhost) or an IP, with an optional port
  if (!/^(localhost|\[[0-9a-f:]+\]|[a-z0-9-]+(\.[a-z0-9-]+)+)(:\d{1,5})?$/.test(host)) return { ok: false, error: 'invalid_url' };

  const path = (match[2] ?? '').replace(/\/+$/, '').replace(/\/api(\/v\d+)?$/, '');
  return { ok: true, url: `https://${host}${path}` };
}

/** The host of a server, to show it: 'https://monserveur.duckdns.org' → 'monserveur.duckdns.org' */
export const serverHost = (url: string): string => url.replace(/^https:\/\//, '');

/**
 * Link that opens the app on the join screen (app/multi/join.tsx), with the server and
 * its invite code: Expo Router opens the route of the link with its parameters.
 */
export function buildInviteLink(serverUrl: string, inviteCode: string): string {
  return `${linkBase()}multi/join?server=${encodeURIComponent(serverUrl)}&code=${encodeURIComponent(inviteCode)}`;
}

function queryParams(query: string): Record<string, string> {
  const params: Record<string, string> = {};
  for (const pair of query.split('&')) {
    const [key, value = ''] = pair.split('=');
    if (!key) continue;
    try {
      params[decodeURIComponent(key)] = decodeURIComponent(value.replace(/\+/g, ' '));
    } catch {
      // A malformed escape: ignore this parameter
    }
  }
  return params;
}

function parseLink(link: string, recover: boolean): { server: string; code: string } | null {
  const match = JOIN_LINK.exec(link.trim());
  if (!match) return null;
  const { server, code, mode } = queryParams(match[1]);
  if ((mode === 'recover') !== recover) return null;
  const url = server ? normalizeServerUrl(server) : null;
  if (!url?.ok || !code?.trim()) return null;
  return { server: url.url, code: code.trim() };
}

/** The server and the code of an invitation link, or null if it is not one */
export const parseInviteLink = (link: string) => parseLink(link, false);

/**
 * Link of a recovery code (shown as a QR code in the account screen): scanned
 * with a new phone, it opens the app ready to get the account back.
 */
export function buildRecoveryLink(serverUrl: string, recoveryCode: string): string {
  return `${linkBase()}multi/join?mode=recover&server=${encodeURIComponent(serverUrl)}&code=${encodeURIComponent(recoveryCode)}`;
}

export const parseRecoveryLink = (link: string) => parseLink(link, true);
