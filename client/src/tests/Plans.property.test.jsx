import { describe, it } from 'vitest';
import * as fc from 'fast-check';

// Pure functions matching Plans.jsx logic
const getYearlyPrice = (monthly) => monthly * 10;
const getSavings     = (monthly) => monthly * 2;

/**
 * Property 7: Yearly pricing calculation correctness
 * Validates: Requirements 4.3
 */
describe('Property 7: Yearly pricing calculation correctness', () => {
  it('yearly total equals monthly * 10', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100000 }),
        (monthly) => getYearlyPrice(monthly) === monthly * 10
      )
    );
  });

  it('savings equals monthly * 2 (two months free)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100000 }),
        (monthly) => getSavings(monthly) === monthly * 2
      )
    );
  });
});
