import { describe, expect, it } from 'vitest';
import { PLAN_LIMITS } from './index.js';

describe('PLAN_LIMITS', () => {
  it('gives the pro plan more monitors than free', () => {
    expect(PLAN_LIMITS.pro.maxMonitors).toBeGreaterThan(PLAN_LIMITS.free.maxMonitors);
  });

  it('scans the pro plan more frequently (lower interval) than free', () => {
    expect(PLAN_LIMITS.pro.scanIntervalHours).toBeLessThan(PLAN_LIMITS.free.scanIntervalHours);
  });

  it('retains history longer on the pro plan than free', () => {
    expect(PLAN_LIMITS.pro.historyRetentionDays).toBeGreaterThan(PLAN_LIMITS.free.historyRetentionDays);
  });

  it('defines exactly the free and pro plans', () => {
    expect(Object.keys(PLAN_LIMITS).sort()).toEqual(['free', 'pro']);
  });
});
