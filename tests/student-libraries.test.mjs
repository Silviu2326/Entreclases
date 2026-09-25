import test from 'node:test';
import assert from 'node:assert/strict';
import {
  libraries, isOpenNow, distanceKm, sortLibraries, filterLibraries, campusList,
} from '../lib/community/student/libraries.ts';

// A small fixture, independent of the real (verified) data, so the pure logic
// can be tested against known, controlled hours.
const fixture = {
  id: 'fixture', name: 'Fixture Library', network: 'UV', campus: 'Test',
  address: 'Test 1', lat: 39.4699, lng: -0.3763,
  url: 'https://example.test', hoursSource: 'https://example.test', verifiedAt: '2026-09-24',
  features: [],
  hours: {
    mon: [['09:00', '14:00'], ['16:00', '20:00']],
    tue: [['09:00', '14:00']],
    wed: null, thu: null, fri: null, sat: null, sun: null,
  },
};
const noHours = { ...fixture, id: 'no-hours', hours: null, hoursSource: null };

// 2026-09-21 is a Monday and 2026-09-22 a Tuesday in Europe/Madrid (CEST, UTC+2 in September).
const monday = (utcHour, utcMinute = 0) => new Date(Date.UTC(2026, 8, 21, utcHour, utcMinute));
const tuesday = (utcHour, utcMinute = 0) => new Date(Date.UTC(2026, 8, 22, utcHour, utcMinute));

test('isOpenNow reads the right day and interval in Europe/Madrid, regardless of the machine time zone', () => {
  // Monday 12:00 Madrid (10:00 UTC): inside the first morning interval.
  assert.deepEqual(isOpenNow(fixture, monday(10, 0)), { open: true, until: '14:00', unknown: false });
  // Monday 15:00 Madrid (13:00 UTC): between the two intervals.
  assert.deepEqual(isOpenNow(fixture, monday(13, 0)), { open: false, opensAt: '16:00', unknown: false });
  // Monday 08:00 Madrid (06:00 UTC): before opening.
  assert.deepEqual(isOpenNow(fixture, monday(6, 0)), { open: false, opensAt: '09:00', unknown: false });
  // Monday 21:00 Madrid (19:00 UTC): after closing, but Tuesday opens next.
  assert.deepEqual(isOpenNow(fixture, monday(19, 0)), { open: false, opensAt: '09:00', unknown: false });
  // Tuesday 12:00 Madrid (10:00 UTC): open, closes at 14:00 (no evening session that day).
  assert.deepEqual(isOpenNow(fixture, tuesday(10, 0)), { open: true, until: '14:00', unknown: false });
});

test('isOpenNow looks across the week (wrapping) for the next opening when the coming days are closed', () => {
  // From Tuesday 15:00 Madrid onward, only Monday has hours again: the search must wrap around the week.
  const status = isOpenNow(fixture, tuesday(13, 0));
  assert.equal(status.open, false);
  assert.equal(status.opensAt, '09:00');
});

test('isOpenNow says "unknown" instead of guessing when a library has no published hours', () => {
  assert.deepEqual(isOpenNow(noHours, monday(10, 0)), { open: false, unknown: true });
});

test('distanceKm is symmetric, zero for the same point, and matches the real Valencia-Madrid distance', () => {
  const valencia = { lat: 39.4699, lng: -0.3763 };
  const madrid = { lat: 40.4168, lng: -3.7038 };
  assert.equal(distanceKm(valencia, valencia), 0);
  assert.equal(distanceKm(valencia, madrid), distanceKm(madrid, valencia));
  assert.ok(Math.abs(distanceKm(valencia, madrid) - 302.5) < 3, 'roughly 302-303 km apart');
});

test('sortLibraries puts open libraries first, then nearest (with a position), then alphabetical', () => {
  // Names deliberately disagree with distance, so the two sort modes can be told apart.
  const openFar = { ...fixture, id: 'open-far', name: 'A open far', lat: 40.0, lng: -0.3763 };
  const openNear = { ...fixture, id: 'open-near', name: 'Z open near', lat: 39.47, lng: -0.3763 };
  const closed = { ...fixture, id: 'closed', name: 'B closed', hours: { ...fixture.hours, mon: null } };
  const list = [openFar, closed, openNear];
  const at = monday(10, 0); // both openFar and openNear are open (Monday morning); closed has no Monday hours.
  const home = { lat: 39.4699, lng: -0.3763 }; // right next to openNear.

  const byName = sortLibraries(list, { now: at });
  assert.deepEqual(byName.map(l => l.id), ['open-far', 'open-near', 'closed'], 'open first, then name order without a position');

  const byDistance = sortLibraries(list, { now: at, position: home });
  assert.deepEqual(byDistance.map(l => l.id), ['open-near', 'open-far', 'closed'], 'open first, nearest of the open ones first');
});

test('filterLibraries narrows by network, campus and group rooms independently', () => {
  const list = [
    { ...fixture, id: 'a', network: 'UV', campus: 'Vera', features: ['group_rooms'] },
    { ...fixture, id: 'b', network: 'UPV', campus: 'Vera', features: [] },
    { ...fixture, id: 'c', network: 'UV', campus: 'Tarongers', features: ['group_rooms'] },
  ];
  assert.deepEqual(filterLibraries(list, {}).map(l => l.id), ['a', 'b', 'c']);
  assert.deepEqual(filterLibraries(list, { network: 'UV' }).map(l => l.id), ['a', 'c']);
  assert.deepEqual(filterLibraries(list, { campus: 'Vera' }).map(l => l.id), ['a', 'b']);
  assert.deepEqual(filterLibraries(list, { groupRooms: true }).map(l => l.id), ['a', 'c']);
  assert.deepEqual(filterLibraries(list, { network: 'UV', campus: 'Vera' }).map(l => l.id), ['a']);
});

test('campusList returns each campus once, in first-seen order', () => {
  const list = [
    { ...fixture, id: 'a', campus: 'Vera' },
    { ...fixture, id: 'b', campus: 'Tarongers' },
    { ...fixture, id: 'c', campus: 'Vera' },
  ];
  assert.deepEqual(campusList(list), ['Vera', 'Tarongers']);
});

// ---- The real, verified data set ----

test('The verified library data set is well-formed and stays inside its declared shape', () => {
  assert.ok(libraries.length >= 10 && libraries.length <= 16, `expected 10-16 libraries, got ${libraries.length}`);

  const ids = new Set();
  const networks = new Set(['UV', 'UPV', 'UCV', 'CEU', 'Pública']);
  const features = new Set(['group_rooms', 'exam_24h', 'reservable', 'silent', 'wifi']);
  const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;

  for (const library of libraries) {
    assert.ok(!ids.has(library.id), `duplicate id ${library.id}`);
    ids.add(library.id);
    assert.ok(networks.has(library.network), `${library.id} has a valid network`);
    assert.ok(library.name.length > 0 && library.campus.length > 0 && library.address.length > 0, `${library.id} has name/campus/address`);
    assert.ok(Number.isFinite(library.lat) && library.lat > 37 && library.lat < 41, `${library.id} has a Comunitat Valenciana-ish latitude`);
    assert.ok(Number.isFinite(library.lng) && library.lng > -1.5 && library.lng < 1, `${library.id} has a Comunitat Valenciana-ish longitude`);
    assert.ok(/^https:\/\//.test(library.url), `${library.id} has an https url`);
    for (const feature of library.features) assert.ok(features.has(feature), `${library.id} has a valid feature: ${feature}`);

    if (library.hours === null) {
      assert.equal(library.hoursSource, null, `${library.id} has no hoursSource when hours is null`);
    } else {
      assert.ok(/^https:\/\//.test(library.hoursSource), `${library.id} has an https hoursSource when hours is set`);
      for (const day of days) {
        const intervals = library.hours[day];
        if (intervals === null) continue;
        assert.ok(Array.isArray(intervals) && intervals.length > 0, `${library.id} ${day} is null or a non-empty list`);
        for (const [open, close] of intervals) {
          assert.match(open, timeRe, `${library.id} ${day} open time`);
          assert.match(close, timeRe, `${library.id} ${day} close time`);
          assert.ok(open < close, `${library.id} ${day} opens before it closes`);
        }
      }
    }
    assert.match(library.verifiedAt, dateRe, `${library.id} has a verification date`);
  }
});

test('The verified data set covers every required network and UV campus', () => {
  const networksSeen = new Set(libraries.map(l => l.network));
  for (const network of ['UV', 'UPV', 'UCV', 'CEU', 'Pública']) {
    assert.ok(networksSeen.has(network), `missing network ${network}`);
  }
  const uvCampuses = new Set(libraries.filter(l => l.network === 'UV').map(l => l.campus));
  for (const campus of ['Blasco Ibáñez', 'Tarongers', 'Burjassot-Paterna']) {
    assert.ok(uvCampuses.has(campus), `missing UV campus ${campus}`);
  }
  assert.ok(libraries.some(l => l.network === 'UPV' && l.campus === 'Vera'), 'missing UPV Vera');
  assert.ok(libraries.filter(l => l.network === 'Pública').length >= 2, 'at least two public libraries');
});
