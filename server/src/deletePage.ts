import type { FastifyInstance } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import type { Database } from './db';
import { normalizeRecoveryCode, sha256 } from './secrets';

/**
 * Web page to delete an account (#51): Google Play asks for a way to delete an account
 * from the web too, not only from the app (where it is in My account). The recovery
 * code proves the account is yours. Plain HTML, no script, no outside resource.
 */

const TEXT = {
  fr: {
    title: 'Supprimer mon compte',
    intro: 'Ton compte et toutes tes parties seront effacés de ce serveur. C\'est définitif.',
    where: 'Ton code de récupération est dans l\'app : Multijoueur → Mon compte. Tu peux aussi supprimer ton compte directement depuis cet écran.',
    label: 'Code de récupération',
    submit: 'Supprimer définitivement',
    done: 'Ton compte et tes parties ont été supprimés de ce serveur.',
    wrong: 'Code de récupération incorrect.',
    limited: 'Trop de tentatives. Réessaie plus tard.',
  },
  en: {
    title: 'Delete my account',
    intro: 'Your account and all your games will be erased from this server. This cannot be undone.',
    where: 'Your recovery code is in the app: Multiplayer → My account. You can also delete your account from that screen.',
    label: 'Recovery code',
    submit: 'Delete for good',
    done: 'Your account and your games were deleted from this server.',
    wrong: 'Wrong recovery code.',
    limited: 'Too many attempts. Try again later.',
  },
};

type Lang = keyof typeof TEXT;

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export const langOf = (acceptLanguage: string | undefined): Lang => (/^\s*fr\b/i.test(acceptLanguage ?? '') ? 'fr' : 'en');

function page(lang: Lang, serverName: string, message?: { ok: boolean; text: string }): string {
  const t = TEXT[lang];
  const name = escapeHtml(serverName);
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${t.title} · ${name}</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 30rem; margin: 2rem auto; padding: 0 1rem; line-height: 1.5; color: #1a1a2e; background: #f7f7fb; }
  h1 { font-size: 1.5rem; }
  label { display: block; font-weight: 700; margin-top: 1rem; }
  input { width: 100%; box-sizing: border-box; font-size: 1.1rem; padding: .6rem; border: 1px solid #bbb; border-radius: .5rem; text-transform: uppercase; }
  button { margin-top: 1rem; width: 100%; padding: .8rem; font-size: 1rem; font-weight: 700; color: #fff; background: #c62828; border: 0; border-radius: .5rem; }
  .msg { padding: .8rem; border-radius: .5rem; font-weight: 700; }
  .ok { background: #e8f5e9; } .ko { background: #ffebee; }
  @media (prefers-color-scheme: dark) { body { color: #eee; background: #0f0f1a; } input { background: #1c1c2b; color: #eee; } }
</style>
</head>
<body>
<h1>${t.title}</h1>
<p><strong>${name}</strong></p>
${message ? `<p class="msg ${message.ok ? 'ok' : 'ko'}" role="status">${message.text}</p>` : ''}
${message?.ok ? '' : `<p>${t.intro}</p>
<p>${t.where}</p>
<form method="post" action="/delete-account">
  <label for="code">${t.label}</label>
  <input id="code" name="code" required autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXX-XXXX-XXXX-XXXX" maxlength="40">
  <button type="submit">${t.submit}</button>
</form>`}
</body>
</html>
`;
}

export async function deletePage(app: FastifyInstance, { db, serverName, onDeleted }: {
  db: Database; serverName: () => string;
  /** Called with the id of a deleted player, to end what they are still doing on the server (their duel) */
  onDeleted: (playerId: number) => void;
}) {
  await app.register(rateLimit, {
    max: 10,
    timeWindow: '15 minutes',
    errorResponseBuilder: () => ({ statusCode: 429, error: 'rate_limited' }),
  });

  // Errors of this page (too many attempts, a malformed form) are pages too
  app.setErrorHandler((error: Error & { statusCode?: number }, request, reply) => {
    const lang = langOf(request.headers['accept-language']);
    const limited = error.statusCode === 429;
    reply.status(limited ? 429 : 400).type('text/html; charset=utf-8')
      .send(page(lang, serverName(), { ok: false, text: limited ? TEXT[lang].limited : TEXT[lang].wrong }));
  });

  app.addContentTypeParser('application/x-www-form-urlencoded', { parseAs: 'string', bodyLimit: 2048 }, (_req, body, done) => {
    done(null, Object.fromEntries(new URLSearchParams(body as string)));
  });

  // No script, nothing loaded from elsewhere, never in a frame
  app.addHook('onSend', async (_req, reply) => {
    reply.header('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'");
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Referrer-Policy', 'no-referrer');
  });

  app.get('/delete-account', async (request, reply) =>
    reply.type('text/html; charset=utf-8').send(page(langOf(request.headers['accept-language']), serverName())));

  app.post<{ Body: { code?: string } }>('/delete-account', async (request, reply) => {
    const lang = langOf(request.headers['accept-language']);
    const code = typeof request.body?.code === 'string' ? request.body.code : '';
    const row = code
      ? db.prepare('DELETE FROM players WHERE recovery_hash = ? RETURNING id').get(sha256(normalizeRecoveryCode(code))) as { id: number } | undefined
      : undefined;
    const deleted = !!row;
    if (row) onDeleted(Number(row.id));
    return reply
      .status(deleted ? 200 : 403)
      .type('text/html; charset=utf-8')
      .send(page(lang, serverName(), { ok: deleted, text: deleted ? TEXT[lang].done : TEXT[lang].wrong }));
  });
}
