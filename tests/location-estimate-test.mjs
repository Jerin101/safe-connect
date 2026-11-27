import test from 'node:test';
import assert from 'node:assert/strict';
import { nearestUpazilaCentre } from '../src/js/location.js';

const centres = [
  { district: 'Gazipur', upazila_en: 'Gazipur Sadar', upazila_bn: 'গাজীপুর সদর', lat: 24.00, lon: 90.42 },
  { district: 'Dhaka', upazila_en: 'Savar', upazila_bn: 'সাভার', lat: 23.85, lon: 90.27 },
];

test('returns the closest mapped upazila centre and its distance', () => {
  const result = nearestUpazilaCentre(centres, { lat: 24.001, lon: 90.421 });
  assert.equal(result.district, 'Gazipur');
  assert.equal(result.upazila, 'Gazipur Sadar');
  assert.equal(result.upazilaBn, 'গাজীপুর সদর');
  assert.ok(result.distanceKm < 1);
});

test('returns null when the nearest centre is beyond the configured limit', () => {
  assert.equal(nearestUpazilaCentre(centres, { lat: 24.8, lon: 90.42 }, 20), null);
});

test('does not label coordinates outside the Bangladesh bounding box', () => {
  assert.equal(nearestUpazilaCentre(centres, { lat: 27.1, lon: 90.42 }), null);
  assert.equal(nearestUpazilaCentre(centres, { lat: 24.0, lon: 93.0 }), null);
});

test('ignores malformed centre records and handles an empty centre list', () => {
  const mixed = [{ district: 'Bad', upazila_en: 'No coords' }, ...centres];
  const result = nearestUpazilaCentre(mixed, { lat: 24.001, lon: 90.421 });
  assert.equal(result.upazila, 'Gazipur Sadar');
  assert.equal(nearestUpazilaCentre([], { lat: 24, lon: 90.42 }), null);
});
