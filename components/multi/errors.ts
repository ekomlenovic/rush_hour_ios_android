import type { TFunction } from 'i18next';
import { MultiApiError } from '@/utils/multi/api';

/** Error codes of the server and of the app that have their own message (multi.errors.*) */
export const MULTI_ERROR_CODES = [
  'network', 'timeout', 'bad_response', 'internal', 'rate_limited', 'unauthorized', 'invalid_request',
  'invalid_invite', 'invalid_pseudo', 'pseudo_taken', 'invalid_recovery_code',
  'preparing', 'already_finished', 'challenge_closed', 'too_late', 'no_game', 'invalid_moves', 'not_won',
  'invalid_url', 'not_https', 'update_app', 'update_server', 'unknown',
] as const;

export type MultiErrorCode = typeof MULTI_ERROR_CODES[number];

export function errorCode(error: unknown): MultiErrorCode {
  const code = error instanceof MultiApiError ? error.code : typeof error === 'string' ? error : 'unknown';
  return (MULTI_ERROR_CODES as readonly string[]).includes(code) ? code as MultiErrorCode : 'unknown';
}

/** What to tell the player about an error of the multiplayer mode */
export function multiErrorMessage(t: TFunction, error: unknown): string {
  return t(`multi.errors.${errorCode(error)}`);
}
