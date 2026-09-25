import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import ts from 'typescript';

// Same loader as student-grades.test.mjs: teamwork.ts is plain TypeScript with no React.
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
const { progress, daysLeft, addDays, formatDate, balance, balanceMessage, splitBrief, groupSummary, sampleWork, todayISO } =
  load('lib/community/student/teamwork.ts');

const t = (es, va) => es; // tests read the Spanish strings; the va branch is exercised separately below
const member = (id, name) => ({ id, name });
const task = (id, title, assignee, status, due = null) => ({ id, title, assignee, status, due });
const work = (overrides = {}) => ({
  id: 'w1', title: 'Trabajo de Historia', subject: 'Historia', due: '2026-10-05',
  members: [member('me', 'Silvia'), member('ana', 'Ana'), member('marc', 'Marc')],
  tasks: [], notes: '', createdAt: '2026-09-01T00:00:00.000Z',
  ...overrides,
});

test('progress counts done tasks against the total and rounds a percent', () => {
  assert.deepEqual(progress(work({ tasks: [] })), { done: 0, total: 0, percent: 0 });
  const w = work({ tasks: [task('t1', 'A', 'me', 'done'), task('t2', 'B', 'me', 'doing'), task('t3', 'C', 'me', 'todo')] });
  assert.deepEqual(progress(w), { done: 1, total: 3, percent: 33 });
  const half = work({ tasks: [task('t1', 'A', 'me', 'done'), task('t2', 'B', 'me', 'todo')] });
  assert.equal(progress(half).percent, 50);
});

test('daysLeft counts whole days to a due date and goes negative once it has passed; null with no due date', () => {
  assert.equal(daysLeft('2026-10-05', '2026-09-24'), 11);
  assert.equal(daysLeft('2026-09-24', '2026-09-24'), 0);
  assert.equal(daysLeft('2026-09-20', '2026-09-24'), -4);
  assert.equal(daysLeft(null, '2026-09-24'), null);
});

test('addDays and formatDate round-trip across a month boundary without drifting a day', () => {
  assert.equal(addDays('2026-09-24', 12), '2026-10-06');
  assert.equal(addDays('2026-01-01', -1), '2025-12-31');
  assert.equal(formatDate('2026-10-06', 'es'), new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, 9, 6))));
  assert.equal(formatDate('2026-10-06', 'va'), new Intl.DateTimeFormat('ca-ES', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, 9, 6))));
});

test('todayISO reads the local date parts of a given Date, zero-padded', () => {
  assert.equal(todayISO(new Date(2026, 0, 5, 23, 0)), '2026-01-05');
  assert.equal(todayISO(new Date(2026, 10, 30, 0, 1)), '2026-11-30');
});

test('balance reports even when nobody has an outsized share', () => {
  const w = work({ tasks: [task('t1', 'A', 'me', 'todo'), task('t2', 'B', 'ana', 'todo'), task('t3', 'C', 'marc', 'todo')] });
  const result = balance(w);
  assert.equal(result.even, true);
  assert.deepEqual(result.overloaded, []);
  assert.deepEqual(result.idle, []);
  assert.deepEqual(result.entries.map(e => e.count), [1, 1, 1]);
});

test('balance flags someone carrying at least twice the average as overloaded', () => {
  // 3 members, 6 tasks: average is 2, and Marc has 4 (>= 2x average).
  const w = work({
    tasks: [
      task('t1', 'A', 'me', 'todo'), task('t2', 'B', 'me', 'todo'),
      task('t3', 'C', 'marc', 'todo'), task('t4', 'D', 'marc', 'todo'), task('t5', 'E', 'marc', 'todo'), task('t6', 'F', 'marc', 'todo'),
    ],
  });
  const result = balance(w);
  assert.equal(result.even, false);
  assert.deepEqual(result.overloaded, ['marc']);
});

test('balance flags someone with zero tasks as idle once the work has 3+ tasks total', () => {
  const w = work({ tasks: [task('t1', 'A', 'me', 'todo'), task('t2', 'B', 'me', 'todo'), task('t3', 'C', 'ana', 'todo')] });
  const result = balance(w);
  assert.equal(result.even, false);
  assert.deepEqual(result.idle, ['marc']);
});

test('balance stays even with fewer than 3 tasks even if someone has none yet', () => {
  const w = work({ tasks: [task('t1', 'A', 'me', 'todo'), task('t2', 'B', 'ana', 'todo')] });
  assert.equal(balance(w).even, true);
});

test('balance ignores a work with no members', () => {
  assert.deepEqual(balance(work({ members: [], tasks: [] })), { entries: [], even: true, overloaded: [], idle: [] });
});

test('balanceMessage names the overloaded and idle member, or returns null when balanced', () => {
  const w = work({
    members: [member('marc', 'Marc'), member('ana', 'Ana')],
    tasks: [
      task('t1', 'A', 'marc', 'todo'), task('t2', 'B', 'marc', 'todo'), task('t3', 'C', 'marc', 'todo'),
      task('t4', 'D', 'marc', 'todo'), task('t5', 'E', 'marc', 'todo'),
    ],
  });
  const message = balanceMessage(w, t);
  assert.match(message, /Marc tiene 5 tareas y Ana ninguna\./);
  const even = work({ tasks: [task('t1', 'A', 'me', 'todo'), task('t2', 'B', 'ana', 'todo')] });
  assert.equal(balanceMessage(even, t), null);
});

test('splitBrief turns bullet lines into one proposal per line', () => {
  const text = '- Buscar fuentes\n- Redactar la introducción\n* Preparar las diapositivas';
  assert.deepEqual(splitBrief(text), ['Buscar fuentes', 'Redactar la introducción', 'Preparar las diapositivas']);
});

test('splitBrief strips numbering and lettered markers', () => {
  const text = '1. Analizar los datos\n2) Redactar conclusiones\na. Revisar el formato';
  assert.deepEqual(splitBrief(text), ['Analizar los datos', 'Redactar conclusiones', 'Revisar el formato']);
});

test('splitBrief splits a single pasted paragraph at sentences that open with an action verb', () => {
  const text = 'Analizar el mercado del sector. Buscar tres competidores directos. Presentar los resultados en clase.';
  assert.deepEqual(splitBrief(text), ['Analizar el mercado del sector', 'Buscar tres competidores directos', 'Presentar los resultados en clase']);
});

test('splitBrief keeps a sentence attached to the previous one when it does not start with an action verb', () => {
  const text = 'Preparar la presentación. Debe tener al menos diez diapositivas y una portada.';
  assert.deepEqual(splitBrief(text), ['Preparar la presentación. Debe tener al menos diez diapositivas y una portada']);
});

test('splitBrief drops empty lines, dedupes case-insensitively and caps at 12 proposals', () => {
  const lines = Array.from({ length: 15 }, (_, i) => `- Tarea número ${i}`);
  const result = splitBrief(lines.join('\n'));
  assert.equal(result.length, 12);
  assert.deepEqual(splitBrief('- Buscar datos\n\n- buscar datos\n- Buscar Datos'), ['Buscar datos']);
});

test('groupSummary is ready to paste: title, date, days left and tasks grouped by person with status icons', () => {
  const w = work({
    title: 'Trabajo de Historia', subject: 'Historia', due: '2026-10-05',
    tasks: [
      task('t1', 'Buscar fuentes', 'ana', 'done'),
      task('t2', 'Redactar', 'marc', 'doing'),
      task('t3', 'Revisar', 'marc', 'todo'),
      task('t4', 'Portada', null, 'todo'),
    ],
  });
  const summary = groupSummary(w, 'es', '2026-09-24');
  assert.match(summary, /^Trabajo de Historia/);
  assert.match(summary, /Historia/);
  assert.match(summary, /quedan 11 días/);
  assert.match(summary, /Ana:\n✅ Buscar fuentes/);
  assert.match(summary, /Marc:\n🟡 Redactar\n⬜ Revisar/);
  assert.match(summary, /Sin asignar:\n⬜ Portada/);
});

test('groupSummary handles an overdue work and one with no due date at all', () => {
  const overdue = groupSummary(work({ due: '2026-09-20', tasks: [] }), 'es', '2026-09-24');
  assert.match(overdue, /hace 4 días/);
  const noDue = groupSummary(work({ due: null, tasks: [] }), 'es', '2026-09-24');
  assert.match(noDue, /Sin fecha de entrega/);
});

test('sampleWork gives a demo work with the viewer as a member, a due date 12 days out and mixed task states', () => {
  const w = sampleWork('Silvia', t, '2026-09-24');
  assert.equal(w.due, '2026-10-06');
  assert.ok(w.members.some(m => m.name === 'Silvia'));
  assert.ok(w.members.some(m => m.name === 'Ana'));
  assert.ok(w.members.some(m => m.name === 'Marc'));
  assert.equal(w.tasks.length, 4);
  const statuses = new Set(w.tasks.map(task => task.status));
  assert.ok(statuses.has('done') && statuses.has('doing') && statuses.has('todo'));
});
