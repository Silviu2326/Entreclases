import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { routes } from '../lib/i18n/routes.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url), cache = new Map();
function load(relative) {
  let filename = resolve(root, relative);
  if (!extname(filename)) filename = ['.tsx', '.ts', '/index.ts'].map(ext => filename + ext).find(existsSync);
  if (cache.has(filename)) return cache.get(filename).exports;
  const loaded = { exports: {} }; cache.set(filename, loaded);
  const code = ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  new Function('require', 'module', 'exports', code)(path => path.startsWith('@/') ? load(path.slice(2)) : path.startsWith('.') ? load(resolve(dirname(filename), path)) : require(path), loaded, loaded.exports);
  return loaded.exports;
}
const { enabledGames, gameCatalog, gamePath, gameBySlug, languageIndex } = load('lib/community/games/catalog');

// Every experience listed in Explorar links to a page of its own, generated for
// both languages and for the demo, so a game can be shared by address.
test('Every game has its own page in both languages, in the app and in the demo', () => {
  const seen = new Set();
  for (const game of enabledGames) for (const locale of ['es', 'va']) for (const demo of [false, true]) {
    const path = gamePath(locale, demo, game.id);
    assert.ok(path.startsWith(demo ? routes[locale].demo : routes[locale].app), `${path} stays under ${locale} ${demo ? 'demo' : 'app'}`);
    assert.match(path, /^\/(va\/)?(app|demo)\/(juegos|jocs)\/[a-z0-9-]+\/$/, `${path} is a clean static address`);
    assert.ok(!seen.has(path), `${path} is unique`); seen.add(path);
    assert.equal(gameBySlug(locale, game.slug[languageIndex(locale)])?.id, game.id);
  }
  assert.equal(seen.size, enabledGames.length * 4);
  assert.equal(gameBySlug('es', 'no-existe'), undefined);
});

test('The static routes for game pages exist for every language and mode', () => {
  for (const dir of ['app/(es)/app/juegos/[game]', 'app/(es)/demo/juegos/[game]', 'app/(va)/va/app/jocs/[game]', 'app/(va)/va/demo/jocs/[game]']) {
    const page = readFileSync(resolve(root, dir, 'page.tsx'), 'utf8');
    assert.match(page, /generateStaticParams/, `${dir} lists its pages for the static export`);
    assert.match(page, /dynamicParams = false/, `${dir} only serves catalogued games`);
  }
});

test('Every catalogued game has a screen file and a Spanish and Valencian text', () => {
  const screens = readFileSync(resolve(root, 'components/community/games/catalog.ts'), 'utf8');
  for (const game of gameCatalog) {
    assert.ok(screens.includes(`  ${game.id}: dynamic(`), `${game.id} is linked to a screen`);
    for (const index of [0, 1]) { assert.ok(game.title[index].length > 2); assert.ok(game.description[index].length > 10); assert.ok(game.slug[index].length > 2); }
  }
  const files = readdirSync(resolve(root, 'components/community/games'));
  for (const file of screens.matchAll(/import\("\.\/([a-z-]+)"\)/g)) assert.ok(files.includes(file[1] + '.tsx'), `${file[1]}.tsx exists`);
});

test('Every game has an opening banner for Explorar in both languages, and entering the page rotates them', () => {
  const { openings, currentOpening, rememberOpening } = load('lib/community/games/openings');
  const visit = ids => { const shown = currentOpening(ids); assert.deepEqual(currentOpening(ids), shown, 'reading the turn twice does not skip a banner'); rememberOpening(shown.turn); rememberOpening(shown.turn); return shown.game; };
  for (const game of gameCatalog) {
    const opening = openings[game.id];
    assert.ok(opening, game.id + ' has an opening banner');
    for (const text of [opening.headline, opening.highlight, opening.body, opening.note, opening.card.label, opening.card.title, opening.card.prompt, opening.card.idle, opening.card.cta, ...opening.card.options, ...opening.card.results]) {
      assert.equal(text.length, 2); assert.ok(text[0].trim() && text[1].trim(), game.id + ' has Spanish and Valencian copy');
    }
    assert.ok(opening.card.options.length >= 2, game.id + ' offers a choice');
    assert.equal(opening.card.results.length, opening.card.options.length, game.id + ' answers every choice');
  }
  const ids = enabledGames.map(game => game.id), store = new Map();
  globalThis.window = { localStorage: { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) } };
  try {
    const shown = ids.map(() => visit(ids));
    assert.deepEqual(shown, ids, 'seven consecutive visits show the seven banners');
    assert.equal(visit(ids), ids[0], 'then the rotation starts again');
  } finally { delete globalThis.window; }
  assert.ok(ids.includes(currentOpening(ids).game), 'without storage a banner is still chosen');
});

test('La cita empieza hablando keeps one 48-hour promise across its catalog and opening', () => {
  const catalog = readFileSync(resolve(root, 'lib/community/games/catalog.ts'), 'utf8');
  assert.match(catalog, /Ronda semanal\. 48 horas para conversar\./);
  const { openings } = load('lib/community/games/openings');
  const opening = openings.blind;
  const copy = [opening.body, opening.card.title, opening.card.results].flat(2).join(' ');
  assert.match(copy, /48/);
  assert.doesNotMatch(copy, /doce minutos|dotze minuts|12 minutos|12:00/i);
});
