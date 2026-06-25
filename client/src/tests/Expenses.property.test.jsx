/**
 * Property 4: Expense field validation correctly rejects invalid inputs
 * Validates: Requirements 2.7, 2.10
 */
import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import { validateExpenseForm } from '../pages/Expenses';

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** A valid expense form (category must be non-empty after trim) */
const validFormArb = fc.record({
  // Use alphanumeric characters to guarantee non-whitespace
  category: fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length >= 1 && s.trim().length <= 100),
  description: fc.string({ maxLength: 500 }),
  // Keep amount strictly within valid range to avoid float precision issues
  amount: fc.integer({ min: 1, max: 999999999 }).map((n) => n / 100),
  date: fc.string({ minLength: 1 }),
});

describe('Property 4: Expense field validation correctly rejects invalid inputs', () => {
  it('rejects a form with a missing category', () => {
    fc.assert(
      fc.property(validFormArb, (form) => {
        const errors = validateExpenseForm({ ...form, category: '' });
        return Object.keys(errors).length > 0 && 'category' in errors;
      })
    );
  });

  it('rejects a form when category exceeds 100 characters', () => {
    fc.assert(
      fc.property(
        validFormArb,
        // Generate a string whose trimmed length is > 100 chars
        fc.string({ minLength: 101, maxLength: 200 }).filter((s) => s.trim().length > 100),
        (form, longCategory) => {
          const errors = validateExpenseForm({ ...form, category: longCategory });
          return Object.keys(errors).length > 0 && 'category' in errors;
        }
      )
    );
  });

  it('rejects a form with amount <= 0', () => {
    fc.assert(
      fc.property(
        validFormArb,
        fc.oneof(
          fc.constant(0),
          fc.constant(-1),
          fc.float({ min: Math.fround(-100000), max: Math.fround(-0.001), noNaN: true })
        ),
        (form, badAmount) => {
          const errors = validateExpenseForm({ ...form, amount: badAmount });
          return Object.keys(errors).length > 0 && 'amount' in errors;
        }
      )
    );
  });

  it('rejects a form with amount greater than 999,999,999.99', () => {
    fc.assert(
      fc.property(
        validFormArb,
        fc.float({ min: Math.fround(1000000000), max: Math.fround(9999999999), noNaN: true }),
        (form, bigAmount) => {
          const errors = validateExpenseForm({ ...form, amount: bigAmount });
          return Object.keys(errors).length > 0 && 'amount' in errors;
        }
      )
    );
  });

  it('rejects a form with a missing date', () => {
    fc.assert(
      fc.property(validFormArb, (form) => {
        const errors = validateExpenseForm({ ...form, date: '' });
        return Object.keys(errors).length > 0 && 'date' in errors;
      })
    );
  });

  it('accepts a valid form (returns empty errors object)', () => {
    fc.assert(
      fc.property(validFormArb, (form) => {
        const errors = validateExpenseForm(form);
        return Object.keys(errors).length === 0;
      })
    );
  });

  it('rejects any combination of invalid fields', () => {
    fc.assert(
      fc.property(
        validFormArb,
        fc.record({
          corruptCategory: fc.boolean(),
          corruptAmount: fc.boolean(),
          corruptDate: fc.boolean(),
        }),
        (form, flags) => {
          // Ensure at least one field is corrupted
          if (!flags.corruptCategory && !flags.corruptAmount && !flags.corruptDate) {
            flags = { ...flags, corruptCategory: true };
          }
          let invalid = { ...form };
          if (flags.corruptCategory) invalid = { ...invalid, category: '' };
          if (flags.corruptAmount)   invalid = { ...invalid, amount: 0 };
          if (flags.corruptDate)     invalid = { ...invalid, date: '' };

          const errors = validateExpenseForm(invalid);
          return Object.keys(errors).length > 0;
        }
      )
    );
  });
});
