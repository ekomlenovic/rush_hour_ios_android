/** The pages of the admin panel, opened from its home (app/multi/admin/[section].tsx) */
export const ADMIN_SECTIONS = ['games', 'reports', 'players', 'invites', 'puzzles', 'challenge', 'anticheat', 'server', 'reset'] as const;
export type AdminSection = typeof ADMIN_SECTIONS[number];

export const isAdminSection = (value: unknown): value is AdminSection => (ADMIN_SECTIONS as readonly unknown[]).includes(value);
