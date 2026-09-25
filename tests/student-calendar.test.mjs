import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import ts from 'typescript';

// Same loader as game-summary.test.mjs: transpile the plain TypeScript module
// and run it directly, so the pure calendar logic is tested with no React.
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
const cal = load('lib/community/student/calendar.ts');
const {
  emptyState, todayKey, addDays, diffDays, weekdayOf, startOfWeek,
  todayAgenda, weekGrid, upcoming, urgency, parseIcs, importIcs, toIcs,
} = cal;

const course = (id, name, color = 0) => ({ id, name, color });
const classSlot = (id, courseId, weekday, start, end, room, extra = {}) => ({ id, courseId, weekday, start, end, room, ...extra });
const deadline = (id, courseId, title, kind, date, extra = {}) => ({ id, courseId, title, kind, date, done: false, ...extra });

// ---- date arithmetic ----

test('date helpers stay in plain calendar-day arithmetic', () => {
  assert.equal(weekdayOf('2026-09-21'), 1, 'Monday');
  assert.equal(weekdayOf('2026-09-27'), 7, 'Sunday');
  assert.equal(addDays('2026-09-27', 1), '2026-09-28');
  assert.equal(addDays('2026-09-30', 1), '2026-10-01', 'crosses a month boundary');
  assert.equal(diffDays('2026-10-01', '2026-09-30'), 1);
  assert.equal(diffDays('2026-09-20', '2026-09-24'), -4);
  assert.equal(startOfWeek('2026-09-24'), '2026-09-21', 'Thursday rolls back to Monday');
  assert.equal(startOfWeek('2026-09-21'), '2026-09-21', 'Monday stays put');
  assert.match(todayKey(new Date('2026-09-24T22:30:00Z')), /^\d{4}-\d{2}-\d{2}$/);
});

test('urgency buckets by days left', () => {
  assert.equal(urgency(-1), 'past');
  assert.equal(urgency(0), 'today');
  assert.equal(urgency(3), 'soon');
  assert.equal(urgency(4), 'week');
  assert.equal(urgency(7), 'week');
  assert.equal(urgency(8), 'later');
});

// ---- todayAgenda / weekGrid ----

test('todayAgenda lists only today\'s classes, in order, and respects from/until bounds', () => {
  const state = {
    courses: [course('c1', 'Economía')],
    classes: [
      classSlot('s1', 'c1', 4, '11:00', '13:00', 'A1'), // Thursday
      classSlot('s2', 'c1', 4, '09:00', '10:00', 'A2'),
      classSlot('s3', 'c1', 3, '09:00', '10:00', 'A3'), // Wednesday, not today
      classSlot('s4', 'c1', 4, '15:00', '16:00', 'A4', { until: '2026-09-01' }), // expired
      classSlot('s5', 'c1', 4, '16:00', '17:00', 'A5', { from: '2027-01-01' }), // not started yet
    ],
    deadlines: [
      deadline('d1', 'c1', 'Entrega tema 3', 'delivery', '2026-09-24', { time: '23:59' }),
      deadline('d2', null, 'Examen parcial', 'exam', '2026-09-24', { time: '09:00' }),
      deadline('d3', 'c1', 'Otro día', 'other', '2026-09-25'),
    ],
  };
  const agenda = todayAgenda(state, '2026-09-24'); // a Thursday
  assert.deepEqual(agenda.classes.map(c => c.id), ['s2', 's1'], 'ordered by start time, out-of-range slots excluded');
  assert.equal(agenda.classes[0].course.name, 'Economía', 'the course is resolved');
  assert.deepEqual(agenda.deadlines.map(d => d.id), ['d2', 'd1'], 'ordered by time, other days excluded');
});

test('weekGrid returns seven days from the given start, each with its own classes', () => {
  const state = {
    courses: [course('c1', 'Física')],
    classes: [
      classSlot('s1', 'c1', 1, '09:00', '10:00', 'A1'),
      classSlot('s2', 'c1', 5, '12:00', '13:00', 'A2'),
    ],
    deadlines: [],
  };
  const days = weekGrid(state, '2026-09-21'); // Monday
  assert.equal(days.length, 7);
  assert.deepEqual(days.map(d => d.date), ['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27']);
  assert.deepEqual(days.map(d => d.weekday), [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(days[0].classes.map(c => c.id), ['s1']);
  assert.deepEqual(days[4].classes.map(c => c.id), ['s2']);
  assert.equal(days[1].classes.length, 0);
});

// ---- upcoming ----

test('upcoming excludes done items, always keeps overdue ones, and stops at the day window', () => {
  const state = {
    courses: [],
    deadlines: [
      deadline('past', null, 'Ya venció', 'other', '2026-09-10'),
      deadline('gone', null, 'Hecho', 'other', '2026-09-25', { done: true }),
      deadline('soon', null, 'Pronto', 'delivery', '2026-09-26'),
      deadline('far', null, 'Lejos', 'exam', '2026-10-20'),
    ],
  };
  const items = upcoming(state, '2026-09-24', 14);
  assert.deepEqual(items.map(i => i.deadline.id), ['past', 'soon']);
  const past = items.find(i => i.deadline.id === 'past');
  assert.equal(past.daysLeft, -14);
  assert.equal(past.urgency, 'past');
  const soon = items.find(i => i.deadline.id === 'soon');
  assert.equal(soon.daysLeft, 2);
  assert.equal(soon.urgency, 'soon');
});

// ---- parseIcs ----

test('parseIcs turns a weekly RRULE VEVENT into a ClassSlot draft, with TZID kept as local time', () => {
  const text = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'BEGIN:VEVENT',
    'DTSTART;TZID=Europe/Madrid:20260921T090000',
    'DTEND;TZID=Europe/Madrid:20260921T110000',
    'SUMMARY:Cálculo I',
    'LOCATION:Aula 2.1',
    'RRULE:FREQ=WEEKLY;UNTIL=20261220T235959Z',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
  const { classes, deadlines } = parseIcs(text);
  assert.equal(deadlines.length, 0);
  assert.equal(classes.length, 1);
  const slot = classes[0];
  assert.equal(slot.courseName, 'Cálculo I');
  assert.equal(slot.weekday, 1, '2026-09-21 is a Monday');
  assert.equal(slot.start, '09:00');
  assert.equal(slot.end, '11:00');
  assert.equal(slot.room, 'Aula 2.1');
  assert.equal(slot.from, '2026-09-21');
  assert.equal(slot.until, '2026-12-20');
});

test('parseIcs converts a UTC (Z) DTSTART into the Europe/Madrid date and time', () => {
  // 2025-09-15 22:00 UTC is CEST (+2) in Madrid, so it lands just after midnight the next day.
  const text = ['BEGIN:VEVENT', 'DTSTART:20250915T220000Z', 'SUMMARY:Entrega del trabajo final', 'END:VEVENT'].join('\n');
  const { deadlines } = parseIcs(text);
  assert.equal(deadlines.length, 1);
  assert.equal(deadlines[0].date, '2025-09-16');
  assert.equal(deadlines[0].time, '00:00');
  assert.equal(deadlines[0].kind, 'delivery', 'guessed from "Entrega" in the title');
});

test('parseIcs unfolds continued lines and unescapes commas', () => {
  const text = [
    'BEGIN:VEVENT',
    'DTSTART:20260130T170000Z',
    'SUMMARY:Examen final de Historia\\, tema 1',
    '  y tema 2', // the leading space is the fold marker itself (RFC 5545); the 2nd space is real content
    'END:VEVENT',
  ].join('\n');
  const { deadlines } = parseIcs(text);
  assert.equal(deadlines.length, 1);
  assert.equal(deadlines[0].title, 'Examen final de Historia, tema 1 y tema 2');
  assert.equal(deadlines[0].kind, 'exam');
});

test('parseIcs skips events without a usable DTSTART and ignores stray VEVENT markers outside a block', () => {
  const text = ['END:VEVENT', 'BEGIN:VEVENT', 'SUMMARY:Sin fecha', 'END:VEVENT'].join('\n');
  const { classes, deadlines } = parseIcs(text);
  assert.equal(classes.length, 0);
  assert.equal(deadlines.length, 0);
});

// ---- importIcs ----

test('importIcs creates or reuses courses by name and reports duplicates by title + date', () => {
  const state = {
    courses: [course('c1', 'Cálculo I')],
    classes: [],
    deadlines: [deadline('d1', null, 'Entrega práctica 1', 'delivery', '2026-10-02')],
  };
  const text = [
    'BEGIN:VEVENT',
    'DTSTART;TZID=Europe/Madrid:20260921T090000',
    'DTEND;TZID=Europe/Madrid:20260921T110000',
    'SUMMARY:cálculo i', // same course, different case
    'RRULE:FREQ=WEEKLY',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'DTSTART:20261002T080000Z',
    'SUMMARY:Entrega práctica 1', // duplicate of d1 (same title + same Madrid date)
    'END:VEVENT',
    'BEGIN:VEVENT',
    'DTSTART:20261010T080000Z',
    'SUMMARY:Entrega práctica 2',
    'END:VEVENT',
  ].join('\n');
  const result = importIcs(state, text);
  assert.equal(result.addedClasses, 1);
  assert.equal(result.addedDeadlines, 1);
  assert.equal(result.duplicateDeadlines, 1);
  assert.equal(result.state.courses.length, 1, 'reused the existing course instead of creating a second one');
  assert.equal(result.state.classes[0].courseId, 'c1');
  assert.equal(result.state.deadlines.length, 2);

  // Importing the very same file again should add nothing new.
  const second = importIcs(result.state, text);
  assert.equal(second.addedClasses, 0);
  assert.equal(second.addedDeadlines, 0);
  assert.equal(second.duplicateClasses, 1);
  assert.equal(second.duplicateDeadlines, 2);
});

// ---- toIcs ----

test('toIcs round-trips through parseIcs: classes keep their weekday/time, deadlines keep their date/time', () => {
  const state = {
    courses: [course('c1', 'Química', 2)],
    classes: [classSlot('s1', 'c1', 3, '10:00', '12:00', 'Lab 3', { until: '2026-12-19' })],
    deadlines: [
      deadline('d1', 'c1', 'Entrega de laboratorio', 'delivery', '2026-11-05', { time: '23:59' }),
      deadline('d2', null, 'Examen final', 'exam', '2026-12-15'),
    ],
  };
  const ics = toIcs(state);
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /END:VCALENDAR\r\n$/);
  const parsed = parseIcs(ics);
  assert.equal(parsed.classes.length, 1);
  assert.equal(parsed.classes[0].weekday, 3, 'Wednesday, round-tripped');
  assert.equal(parsed.classes[0].start, '10:00');
  assert.equal(parsed.classes[0].end, '12:00');
  assert.equal(parsed.classes[0].room, 'Lab 3');
  assert.equal(parsed.classes[0].until, '2026-12-19');
  assert.equal(parsed.deadlines.length, 2);
  const laboratory = parsed.deadlines.find(d => d.title === 'Entrega de laboratorio');
  assert.equal(laboratory.date, '2026-11-05');
  assert.equal(laboratory.time, '23:59');
  const exam = parsed.deadlines.find(d => d.title === 'Examen final');
  assert.equal(exam.date, '2026-12-15');
  assert.equal(exam.time, undefined, 'an all-day deadline has no time');
});

test('emptyState starts with nothing', () => {
  assert.deepEqual(emptyState(), { courses: [], classes: [], deadlines: [] });
});
