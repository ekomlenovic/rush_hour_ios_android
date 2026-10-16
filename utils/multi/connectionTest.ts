import { checkCompatibility, multiApi, MultiApiError, type ServerInfo } from './api';
import { normalizeServerUrl } from './serverUrl';

/**
 * "Test the connection" of the create-my-server guide (#51): each step that can go
 * wrong when setting up a server, so that the message says what to fix.
 */
export type ConnectionStep = 'address' | 'reach' | 'server' | 'version';

export type ConnectionResult =
  | { ok: true; url: string; info: ServerInfo }
  | { ok: false; step: ConnectionStep; error: string; url?: string };

export async function testConnection(input: string, appVersion: string, fetchImpl: typeof fetch = fetch): Promise<ConnectionResult> {
  const address = normalizeServerUrl(input);
  if (!address.ok) return { ok: false, step: 'address', error: address.error };
  const url = address.url;

  let info: ServerInfo;
  try {
    info = await multiApi(url, undefined, fetchImpl).info();
  } catch (e) {
    const code = e instanceof MultiApiError ? e.code : 'network';
    // No answer: DNS, port 443, certificate, nginx not started
    if (code === 'network' || code === 'timeout') return { ok: false, step: 'reach', error: code, url };
    // Something answers, but not the server: proxy_pass, the container is down (502)…
    return { ok: false, step: 'server', error: code, url };
  }

  if (typeof info?.apiVersion !== 'number' || typeof info?.name !== 'string') return { ok: false, step: 'server', error: 'bad_response', url };
  const compat = checkCompatibility(info, appVersion);
  if (compat !== 'ok') return { ok: false, step: 'version', error: compat, url };
  return { ok: true, url, info };
}
