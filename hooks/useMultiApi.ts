import { useMemo } from 'react';
import { multiApi, type MultiApi } from '@/utils/multi/api';
import type { ServerAccount } from '@/store/multiStore';

/** The API client of a server, with the token of the player */
export function useMultiApi(account: ServerAccount | null): MultiApi | null {
  return useMemo(() => (account ? multiApi(account.url, account.token) : null), [account?.url, account?.token]);
}
