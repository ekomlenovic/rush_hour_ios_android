import type { TFunction } from 'i18next';
import type { Flag, Verdict } from '@/utils/multi/api';
import { formatDuration } from '@/utils/date';
import type { IconName } from './IconText';

/** Suspect (automatic) or cheater (confirmed by the admin) */
export const verdictIcon = (verdict: NonNullable<Verdict>): IconName => (verdict === 'cheater' ? 'ban' : 'warning');

/** Why a game is suspect, in words, with its numbers */
export function flagText(t: TFunction, flag: Flag): string {
  switch (flag.code) {
    case 'too_fast': return t('multi.flag.too_fast', { ms: flag.values.msPerMove });
    case 'copied': return t('multi.flag.copied', { percent: flag.values.pausePercent, pause: formatDuration(flag.values.pauseMs ?? 0) });
    case 'clock_mismatch': return t('multi.flag.clock_mismatch');
    default: return t('multi.flag.unknown');
  }
}

export const reasonsText = (t: TFunction, flags: Flag[]): string => flags.map(f => flagText(t, f)).join(' · ');

/** Reasons a player can give when reporting someone (sent as a code, shown translated to the admin) */
export const REPORT_REASONS = ['pseudo', 'cheating', 'other'] as const;
export type ReportReason = typeof REPORT_REASONS[number];

export function reportReasonText(t: TFunction, reason: string): string {
  return (REPORT_REASONS as readonly string[]).includes(reason) ? t(`multi.report_reason.${reason}`) : reason;
}
