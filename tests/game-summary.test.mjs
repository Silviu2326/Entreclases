import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import ts from 'typescript';

// Same loader as game-demos.test.mjs: the summary is pure TypeScript over the demo engines.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url), cache = new Map();
function load(relative) {
  let filename = resolve(root, relative);
  if (!extname(filename)) filename = ['.ts', '.tsx', '/index.ts'].map(ext => filename + ext).find(existsSync);
  if (cache.has(filename)) return cache.get(filename).exports;
  const loaded = { exports: {} }; cache.set(filename, loaded);
  const code = ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  new Function('require', 'module', 'exports', code)(path => path.startsWith('@/') ? load(path.slice(2)) : path.startsWith('.') ? load(resolve(dirname(filename), path)) : require(path), loaded, loaded.exports);
  return loaded.exports;
}
const { demoPlay, resetDemoGames } = load('lib/community/games/demo.ts');
const { demoSummaries } = load('lib/community/games/summary.ts');
const { enabledGames } = load('lib/community/games/catalog.ts');

const person = (id, name, campus, degree, year, groups, contact) => ({ id, name, campus, degree, year, bio: `Soy ${name}.`, interests: ['Café'], groups, contact });
const makeWorld = (locale = 'es') => ({
  locale,
  t: (es, va) => locale === 'va' ? va : es,
  me: person('me', 'Álex Torres', 'Tarongers', 'Economía', 2, ['g-study'], false),
  people: [
    person('p1', 'Paula Martí', 'Tarongers', 'Economía', 2, ['g-study'], true),
    person('p2', 'Marc Ferrer', 'Tarongers', 'Economía', 3, ['g-study'], false),
    person('p3', 'Laia Soler', 'Blasco Ibáñez', 'Psicología', 2, ['g-out'], true),
    person('p4', 'Nico Vidal', 'Vera', 'Informática', 4, [], false),
    person('p5', 'Aina Costa', 'Tarongers', 'Economía', 2, [], false),
  ],
  groups: [{ id: 'g-study', name: 'Los del tema 4', members: ['me', 'p1', 'p2'] }, { id: 'g-out', name: 'Nos vemos fuera', members: ['p3'] }],
});

test('The profile summary covers every enabled game, in both languages, without changing any of them', () => {
  for (const locale of ['es', 'va']) {
    resetDemoGames();
    const world = makeWorld(locale);
    const before = enabledGames.map(game => demoPlay(game.id, world, 'read', {}));
    const summaries = demoSummaries(world);
    assert.deepEqual(summaries.map(summary => summary.id), enabledGames.map(game => game.id));
    for (const summary of summaries) {
      assert.equal(typeof summary.line, 'string', `${summary.id} has a line`);
      assert.equal(typeof summary.pending, 'boolean', `${summary.id} says whether it is waiting`);
      assert.ok(!summary.pending || summary.line, `${summary.id} explains what it is waiting for`);
    }
    assert.deepEqual(demoSummaries(world), summaries, 'summarising twice tells the same story');
    assert.deepEqual(enabledGames.map(game => demoPlay(game.id, world, 'read', {})), before, 'no game changed');
  }
  resetDemoGames();
});

test('Someone else’s profile only opens signed games, and never reads a game for a real account', () => {
  const { personHooks, personGames } = load('lib/community/games/summary.ts');
  assert.ok(!personGames.includes('crush') && !personGames.includes('blind'), 'no door that would say who I am after');
  for (const locale of ['es', 'va']) {
    resetDemoGames();
    const world = makeWorld(locale);
    const before = personGames.map(id => demoPlay(id, world, 'read', {}));
    for (const other of world.people) {
      const hooks = personHooks(world, other.id, true);
      assert.deepEqual(hooks.map(hook => hook.id), [...personGames]);
      assert.ok(hooks.every(hook => hook.line.trim().length > 3), 'every door says what it opens');
      const truth = before[personGames.indexOf('truth')], hangout = before[personGames.indexOf('hangout')];
      assert.equal(hooks.find(hook => hook.id === 'truth').pending, truth.deck.some(round => round.owner === other.id && !round.played));
      assert.equal(hooks.find(hook => hook.id === 'hangout').pending, hangout.discover.some(item => item.owner === other.id));
    }
    assert.deepEqual(personGames.map(id => demoPlay(id, world, 'read', {})), before, 'no game changed');
  }
  resetDemoGames();
  // With a real account nothing is seeded or read: a fresh demo store stays untouched.
  const real = personHooks(makeWorld(), 'p1', false);
  assert.ok(real.every(hook => !hook.pending && hook.line), 'real accounts get the plain doors');
});

test('The summary of ¿Me lío? never gives away who I chose', () => {
  resetDemoGames();
  const world = makeWorld();
  demoPlay('crush', world, 'read', {});
  const crush = () => demoSummaries(world).find(summary => summary.id === 'crush');
  const names = world.people.map(other => other.name);
  assert.ok(names.every(name => !crush().line.includes(name)), 'no names before playing');
  const state = demoPlay('crush', world, 'read', {});
  assert.ok(!/\d/.test(crush().line) || state.matches.length > 0, 'the only number it may show is the matches');
  assert.ok(names.every(name => !crush().line.includes(name)), 'and never a name');
  resetDemoGames();
});
