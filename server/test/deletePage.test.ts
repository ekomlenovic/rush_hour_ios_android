import { afterEach, describe, expect, it } from 'vitest';
import { testServer } from './helpers';
import { langOf } from '../src/deletePage';

let server: ReturnType<typeof testServer>;
const open = (options?: Parameters<typeof testServer>[0]) => (server = testServer(options));
afterEach(async () => { await server?.app.close(); });

const post = (code: string, lang = 'fr-FR,fr;q=0.9') => server.app.inject({
  method: 'POST', url: '/delete-account',
  headers: { 'content-type': 'application/x-www-form-urlencoded', 'accept-language': lang },
  payload: `code=${encodeURIComponent(code)}`,
});

describe('web page to delete an account (Google Play)', () => {
  it('a plain page, without script nor outside resource', async () => {
    open({ env: { SERVER_NAME: 'Les <amis>' } });
    const res = await server.app.inject({ method: 'GET', url: '/delete-account', headers: { 'accept-language': 'fr' } });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.headers['content-security-policy']).toContain("default-src 'none'");
    expect(res.body).toContain('Supprimer mon compte');
    expect(res.body).toContain('Les &lt;amis&gt;');
    expect(res.body).not.toContain('<script');
  });

  it('deletes the account of a recovery code, typed in any case, with its games', async () => {
    const { join, play, request, db } = open();
    const leo = await join('Léo');
    await play(leo.token);
    const res = await post(leo.recoveryCode.toLowerCase().replace(/-/g, ' '));
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('ont été supprimés');
    expect((await request('GET', '/me', leo.token)).status).toBe(401);
    expect(db.prepare('SELECT COUNT(*) AS n FROM attempts').get()).toEqual({ n: 0 });
  });

  it('a wrong code deletes nothing', async () => {
    const { join, request } = open();
    const leo = await join('Léo');
    const res = await post('AAAA-BBBB-CCCC-DDDD', 'en-US');
    expect(res.statusCode).toBe(403);
    expect(res.body).toContain('Wrong recovery code');
    expect((await request('GET', '/me', leo.token)).status).toBe(200);
    expect((await post('')).statusCode).toBe(403);
  });

  it('limits the attempts', async () => {
    open();
    const statuses = [];
    for (let i = 0; i < 11; i++) statuses.push((await post(`GUESS-${i}`)).statusCode);
    expect(statuses.slice(0, 10).every(s => s === 403)).toBe(true);
    const limited = await post('GUESS-11');
    expect(limited.statusCode).toBe(429);
    expect(limited.body).toContain('Trop de tentatives');
  });

  it('speaks French or English', () => {
    expect(langOf('fr-FR,fr;q=0.9,en;q=0.8')).toBe('fr');
    expect(langOf('en-GB')).toBe('en');
    expect(langOf(undefined)).toBe('en');
  });
});
