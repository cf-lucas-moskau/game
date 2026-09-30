// End-to-end online test: a local PeerJS broker (the same protocol as the public one players use), two browser pages,
// a real WebRTC connection between them. Host creates a lobby, the client joins by code, both play a match, and the
// client's world must match the host's exactly. Run: node tools/e2e-online.mjs (after npm run build).
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';
import { PeerServer } from 'peer';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH || '/home/claude/.npm-global/lib/node_modules/playwright');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const results = []; let failed = 0;
const check = (name, ok, info = '') => { results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? `  (${info})` : ''}`); if (!ok) failed++; };
const until = async (page, fn, arg, ms = 30000) => { try { await page.waitForFunction(fn, arg, { timeout: ms, polling: 100 }); return true; } catch { return false; } };
const freePort = () => new Promise((res) => { const s = createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => res(p)); }); });

const port = await freePort();
const broker = PeerServer({ port, host: '127.0.0.1', path: '/' });
await new Promise((r) => setTimeout(r, 300));
// host candidates between two pages on one machine; no mDNS obfuscation so they can reach each other
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-features=WebRtcHideLocalIpsWithMdns'] });
const url = (q) => `file://${root}/dist/index.html?cpu=1&quality=low&broker=127.0.0.1:${port}${process.env.NETDEBUG ? '&netdebug=1' : ''}&${q}`;
const errors = [];
const open = async (q) => { const page = await browser.newPage({ viewport: { width: 1100, height: 700 } }); page.on('pageerror', (e) => errors.push(e.message)); if (process.env.NETDEBUG) page.on('console', (m) => console.log(`   [${q ? 'guest' : 'host'}] ${m.text().slice(0, 220)}`)); await page.goto(url(q)); return page; };

try {
  const host = await open('');
  await host.waitForSelector('[data-act=online]', { timeout: 90000 });
  await host.click('[data-act=online]');
  await host.fill('.online input[aria-label="Your name"]', 'Ana');
  await host.click('[data-act=host]');
  const opened = await until(host, () => { const c = document.querySelector('.online .code'); return c && /^[A-Z2-9]{5}$/.test(c.textContent); });
  const code = opened ? await host.evaluate(() => document.querySelector('.online .code').textContent) : '';
  check('host opens a lobby and gets a five-letter code', opened, code);

  const guest = await open(`join=${code}`); // an invite link
  await guest.waitForSelector('.online', { timeout: 90000 });
  const joined = await until(host, () => [...document.querySelectorAll('.online .seat')].filter((s) => !s.classList.contains('bot')).length === 2);
  check('the guest joins by code over WebRTC and appears in the host\'s lobby', joined);
  check('the guest sees the same lobby', await until(guest, () => document.querySelectorAll('.online .seat.mine').length === 1 && document.querySelectorAll('.online .seat.bot').length === 4));
  await guest.click('.online .mini-roster [data-hero=kestrel]');
  check('a hero pick reaches the host', await until(host, () => [...document.querySelectorAll('.online .seat')].some((s) => /Kestrel/.test(s.textContent))));
  check('start waits until the guest is ready', await host.evaluate(() => document.querySelector('[data-act=start]').disabled));
  await guest.click('[data-act=ready]');
  check('the guest\'s ready enables start', await until(host, () => !document.querySelector('[data-act=start]').disabled));
  if (process.env.SHOTS) { await host.screenshot({ path: `${process.env.SHOTS}/lobby-host.png` }); await guest.setViewportSize({ width: 390, height: 844 }); await guest.waitForTimeout(400); await guest.screenshot({ path: `${process.env.SHOTS}/lobby-guest-phone.png`, fullPage: true }); await guest.setViewportSize({ width: 1100, height: 700 }); }
  await host.click('[data-act=start]');
  const both = await until(host, () => window.__game && window.__game.world.tick > 150, null, 60000) && await until(guest, () => window.__game && window.__game.world.tick > 150, null, 60000);
  check('both players are in the match and it runs', both);
  const roles = await Promise.all([host, guest].map((p) => p.evaluate(() => ({ online: window.__game.online, player: window.__game.player, hero: window.__game.me.heroKey }))));
  check('host and guest play their own heroes', roles[0].online === 'host' && roles[1].online === 'client' && roles[1].hero === 'kestrel' && roles[0].player !== roles[1].player, JSON.stringify(roles));
  // the guest moves: its command travels to the host and back through the stream
  const g0 = await guest.evaluate(() => { const g = window.__game, m = g.me; g.send({ t: 1, p: g.player, x: Math.round(m.x + (m.team === 0 ? 500 : -500)), y: 450 }); return m.x; });
  check('the guest\'s command moves its hero on the host', await until(host, ([p, x0]) => { const h = window.__game.world.heroes.find((e) => e.playerId === p); return Math.abs(h.x - x0) > 150; }, [roles[1].player, g0]));
  // freeze the host, let the guest catch up, compare worlds
  await host.evaluate(() => window.__game.stop());
  const hostState = await host.evaluate(() => ({ tick: window.__game.world.tick, hash: window.__game.hash() }));
  await until(guest, (t) => window.__game.world.tick >= t, hostState.tick);
  const guestState = await guest.evaluate(() => { window.__game.stop(); return { tick: window.__game.world.tick, hash: window.__game.hash(), ping: window.__game.authority.ping, stalls: window.__game.authority.stalls }; });
  check('the guest\'s world is identical to the host\'s', guestState.tick === hostState.tick && guestState.hash === hostState.hash, `tick ${hostState.tick}/${guestState.tick}, hash ${hostState.hash}/${guestState.hash}, rtt ${guestState.ping} ms`);
  // the guest leaves: a bot takes over its hero on the host
  await host.evaluate(() => window.__game.start());
  await guest.close();
  check('when the guest leaves, the host keeps playing with a bot in its seat', await until(host, () => !!document.querySelector('.toast') && /bot plays/.test(document.querySelector('.toast').textContent), null, 20000));
  check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
} catch (e) {
  check(`no exception (${e.message.split('\n')[0]})`, false);
  for (const p of browser.contexts().flatMap((c) => c.pages())) { try { console.log('   page text:', (await p.evaluate(() => (document.querySelector('.online') || document.body).innerText)).replace(/\s+/g, ' ').slice(0, 300)); } catch { /* closed */ } }
} finally {
  await browser.close(); broker.close?.();
}
console.log(results.map((r) => `   ${r}`).join('\n'));
console.log(failed ? `   E2E ONLINE: ${failed} failure(s)` : '   E2E ONLINE: lobby, WebRTC and lockstep checks passed');
process.exit(failed ? 1 : 0);
