import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateStreaks } from '../services/streaks.js';

/**
 * Helper to build mock RoutineDay documents for streak calculation unit testing.
 */
const mockDay = (localDate, completed = true) => ({
  localDate,
  eligible: true,
  items: [{ isRequired: true, completed }],
});

test('counts consecutive successful routine dates and longest streak', () => {
  const testDays = [
    mockDay('2026-03-01', true),
    mockDay('2026-03-02', true),
    mockDay('2026-03-03', true),
  ];
  const result = calculateStreaks(testDays, '2026-03-03');
  assert.equal(result.currentStreak, 3);
  assert.equal(result.longestStreak, 3);
});

test('pending today does not break yesterday streak', () => {
  // If today's checklist is still in progress, yesterday's valid streak is preserved
  const testDays = [
    mockDay('2026-03-01', true),
    {
      localDate: '2026-03-02',
      eligible: true,
      items: [{ isRequired: true, completed: false }],
    },
  ];
  const result = calculateStreaks(testDays, '2026-03-02');
  assert.equal(result.currentStreak, 1);
});

test('missed date breaks the current streak and task data is irrelevant', () => {
  const testDays = [
    mockDay('2026-03-01', true),
    mockDay('2026-03-02', false), // Failed / missed day breaks streak
    mockDay('2026-03-03', true),
  ];
  const result = calculateStreaks(testDays, '2026-03-03');
  assert.equal(result.currentStreak, 1);
});

test('optional unfinished items do not block success', () => {
  const dayWithOptional = {
    localDate: '2026-03-03',
    eligible: true,
    items: [
      { isRequired: true, completed: true },
      { isRequired: false, completed: false }, // Optional item unfinished
    ],
  };
  const result = calculateStreaks([dayWithOptional], '2026-03-03');
  assert.equal(result.currentStreak, 1);
});

test('zero required items cannot earn a streak', () => {
  const restDay = {
    localDate: '2026-03-03',
    eligible: false,
    items: [{ isRequired: false, completed: true }],
  };
  const result = calculateStreaks([restDay], '2026-03-03');
  assert.equal(result.currentStreak, 0);
});

test('streak continues across month and year boundary', () => {
  const boundaryDays = [
    mockDay('2025-12-31', true),
    mockDay('2026-01-01', true),
  ];
  const result = calculateStreaks(boundaryDays, '2026-01-01');
  assert.equal(result.currentStreak, 2);
});

test('unchecking the only successful day removes current streak', () => {
  const uncheckedDay = [mockDay('2026-03-03', false)];
  const result = calculateStreaks(uncheckedDay, '2026-03-03');
  assert.equal(result.currentStreak, 0);
});
