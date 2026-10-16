import type { TFunction } from 'i18next';

/** Time left before an instant: '3 h 12', '12 min', '< 1 min' */
export function formatRemaining(t: TFunction, ms: number): string {
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  if (minutes < 1) return t('multi.duration_less_minute');
  if (minutes < 60) return t('multi.duration_minutes', { m: minutes });
  return t('multi.duration_hours', { h: Math.floor(minutes / 60), m: String(minutes % 60).padStart(2, '0') });
}
