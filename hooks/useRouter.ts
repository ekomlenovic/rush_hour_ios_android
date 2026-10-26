import { useMemo } from 'react';
import { useRouter as useExpoRouter } from 'expo-router';
import { claimNavigation } from '@/utils/navigationLock';

/**
 * The router of Expo Router, with push and back ignored while a navigation has just started:
 * spamming a button (garage, profile…) no longer stacks the same screen twice. Replace and
 * dismissTo don't grow the stack and stay as they are (a redirect right after opening a screen).
 */
export function useRouter(): ReturnType<typeof useExpoRouter> {
  const router = useExpoRouter();
  return useMemo(() => ({
    ...router,
    push: (...args: Parameters<typeof router.push>) => {
      if (claimNavigation('push')) router.push(...args);
    },
    back: () => {
      if (claimNavigation('back')) router.back();
    },
  }), [router]);
}
