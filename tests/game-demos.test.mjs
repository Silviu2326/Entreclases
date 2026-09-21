import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import ts from 'typescript';

// Compile only local TypeScript modules: the games' rules are pure, with no
// browser, network or auth SDK behind them.
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
const { gameKinds } = load('lib/community/games/types.ts');
const { audienceChoices, audienceReach, inAudience } = load('lib/community/games/audience.ts');

// A campus small enough to reason about and varied enough to exercise audiences.
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

test('Audiences reach exactly the people they name, and never the person choosing', () => {
  const world = makeWorld();
  assert.equal(audienceReach({ kind: 'campus' }, world), 5);
  assert.equal(audienceReach({ kind: 'site' }, world), 3, 'Tarongers holds Paula, Marc and Aina');
  assert.equal(audienceReach({ kind: 'degree' }, world), 3, 'Economics holds the same three');
  assert.equal(audienceReach({ kind: 'course' }, world), 2, 'second year of Economics holds Paula and Aina');
  assert.equal(audienceReach({ kind: 'group', ref: 'g-study' }, world), 2);
  assert.equal(audienceReach({ kind: 'contacts' }, world), 2);
  assert.equal(audienceReach({ kind: 'person', ref: 'p1' }, world), 1);
  assert.equal(inAudience(world.me, { kind: 'campus' }, world), false, 'I am never part of my own audience');
});

test('An audience too small to hide an author is blocked for anonymous content', () => {
  const world = makeWorld();
  const open = audienceChoices(world, ['campus', 'course'], false);
  assert.ok(open.every(choice => !choice.blocked), 'nothing is blocked when the author signs');
  const hidden = audienceChoices(world, ['campus', 'course'], true);
  assert.ok(hidden.find(choice => choice.kind === 'course').blocked, 'two people cannot hide an author');
  assert.ok(hidden.find(choice => choice.kind === 'campus').blocked, 'five people cannot either');
});

test('Every game reads without side effects, in both languages', () => {
  for (const locale of ['es', 'va']) {
    resetDemoGames();
    for (const kind of gameKinds) {
      const world = makeWorld(locale);
      const first = demoPlay(kind, world, 'read', {});
      assert.ok(first && typeof first === 'object', `${kind} returns a state`);
      const second = demoPlay(kind, world, 'read', {});
      assert.deepEqual(second, first, `${kind} does not change anything when it is only read`);
    }
  }
  resetDemoGames();
});

test('Every game refuses an unknown command with a message meant for a person', () => {
  resetDemoGames();
  for (const kind of gameKinds) {
    const world = makeWorld();
    assert.throws(() => demoPlay(kind, world, 'no-existe', {}), error => {
      assert.ok(error instanceof Error, `${kind} throws an Error`);
      assert.ok(error.message.trim().length > 3, `${kind} explains itself`);
      return true;
    }, `${kind} refuses an unknown command`);
    assert.doesNotThrow(() => demoPlay(kind, world, 'read', {}), `${kind} still works after a refusal`);
  }
  resetDemoGames();
});

test('Every game seeds something to play with, and a reset starts it over', () => {
  const world = makeWorld();
  // Seeded content carries timestamps, so two seeds are alike in shape, not byte for byte.
  const shape = state => Object.entries(state).map(([key, value]) => `${key}:${Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value}`).sort().join(',');
  const before = gameKinds.map(kind => demoPlay(kind, world, 'read', {}));
  resetDemoGames();
  const after = gameKinds.map(kind => demoPlay(kind, world, 'read', {}));
  for (let index = 0; index < gameKinds.length; index++) {
    const kind = gameKinds[index];
    assert.ok(Object.keys(before[index]).length > 0, `${kind} seeds a state worth reading`);
    assert.equal(shape(after[index]), shape(before[index]), `${kind} rebuilds the same kind of starting point`);
  }
  resetDemoGames();
});

test('Seeded demo content belongs to the people in the world, never to strangers', () => {
  resetDemoGames();
  const world = makeWorld();
  const known = new Set([world.me.id, ...world.people.map(person => person.id)]);
  for (const kind of gameKinds) {
    const seen = JSON.stringify(demoPlay(kind, world, 'read', {})).match(/"(me|p[0-9]+)"/g) ?? [];
    for (const raw of seen) assert.ok(known.has(raw.slice(1, -1)), `${kind} only shows people who exist in this world`);
  }
  resetDemoGames();
});
