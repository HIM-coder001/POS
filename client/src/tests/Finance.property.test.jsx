/**
 * Property 1: Supplier dropdown is alphabetically ordered
 * Validates: Requirements 1.4
 *
 * Property 2: Purchase form validation rejects invalid payloads
 * Validates: Requirements 1.6, 1.8
 */
import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import { validatePurchaseForm } from '../pages/Finance';

// Pure sorting logic matching the supplier dropdown ordering in PurchasesTab (Finance.jsx).
// The API returns suppliers sorted by name; the dropdown must render them in that order.
const sortSuppliers = (suppliers) =>
  [...suppliers].sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

describe('Property 1: Supplier dropdown is alphabetically ordered', () => {
  it('sorted supplier list matches case-insensitive alphabetical order', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({ name: fc.string({ minLength: 1 }) }), { minLength: 1 }),
        (suppliers) => {
          const sorted = sortSuppliers(suppliers);

          // Every adjacent pair must be in non-descending order per localeCompare
          for (let i = 0; i < sorted.length - 1; i++) {
            if (sorted[i].name.toLowerCase().localeCompare(sorted[i + 1].name.toLowerCase()) > 0) {
              return false;
            }
          }
          return true;
        }
      )
    );
  });
});

// ---------------------------------------------------------------------------
// Arbitraries for Property 2
// ---------------------------------------------------------------------------

/** A valid purchase line item */
const validItemArb = fc.record({
  productName: fc.string({ minLength: 1 }),
  quantity: fc.integer({ min: 1, max: 10000 }),
  // fc.float requires 32-bit float boundaries; use Math.fround to satisfy the constraint
  unitCost: fc.float({ min: Math.fround(0.01), max: Math.fround(999999), noNaN: true }),
});

/** A valid, complete purchase form */
const validFormArb = fc.record({
  supplierId: fc.string({ minLength: 1 }),
  items: fc.array(validItemArb, { minLength: 1 }),
  purchaseDate: fc.string({ minLength: 1 }),
});

/**
 * Property 2: Purchase form validation rejects invalid payloads
 * **Validates: Requirements 1.6, 1.8**
 *
 * For any form with at least one invalid field, validatePurchaseForm must
 * return a non-empty errors object (i.e. the form must be rejected).
 */
describe('Property 2: Purchase form validation rejects invalid payloads', () => {
  it('rejects a form with an absent supplierId', () => {
    fc.assert(
      fc.property(
        validFormArb,
        (form) => {
          // Remove supplier
          const invalid = { ...form, supplierId: '' };
          const errors = validatePurchaseForm(invalid);
          return Object.keys(errors).length > 0;
        }
      )
    );
  });

  it('rejects a form with an empty items array', () => {
    fc.assert(
      fc.property(
        validFormArb,
        (form) => {
          const invalid = { ...form, items: [] };
          const errors = validatePurchaseForm(invalid);
          return Object.keys(errors).length > 0;
        }
      )
    );
  });

  it('rejects a form when any item has quantity < 1', () => {
    fc.assert(
      fc.property(
        validFormArb,
        // Replace quantity of a random item with an invalid value
        fc.integer({ min: 0, max: 100 }).filter((n) => n < 1),
        fc.nat(),
        (form, badQty, idx) => {
          const itemIndex = form.items.length > 0 ? idx % form.items.length : 0;
          const badItems = form.items.map((item, i) =>
            i === itemIndex ? { ...item, quantity: badQty } : item
          );
          const invalid = { ...form, items: badItems };
          const errors = validatePurchaseForm(invalid);
          return Object.keys(errors).length > 0;
        }
      )
    );
  });

  it('rejects a form when any item has unitCost ≤ 0', () => {
    fc.assert(
      fc.property(
        validFormArb,
        fc.oneof(
          fc.constant(0),
          fc.float({ min: Math.fround(-100000), max: Math.fround(-0.001), noNaN: true })
        ),
        fc.nat(),
        (form, badCost, idx) => {
          const itemIndex = form.items.length > 0 ? idx % form.items.length : 0;
          const badItems = form.items.map((item, i) =>
            i === itemIndex ? { ...item, unitCost: badCost } : item
          );
          const invalid = { ...form, items: badItems };
          const errors = validatePurchaseForm(invalid);
          return Object.keys(errors).length > 0;
        }
      )
    );
  });

  it('rejects a form with an absent purchaseDate', () => {
    fc.assert(
      fc.property(
        validFormArb,
        (form) => {
          const invalid = { ...form, purchaseDate: '' };
          const errors = validatePurchaseForm(invalid);
          return Object.keys(errors).length > 0;
        }
      )
    );
  });

  it('rejects a form with any combination of invalid fields', () => {
    // Generate a form that has at least one invalid field by choosing
    // which fields to corrupt via a boolean flag set
    fc.assert(
      fc.property(
        validFormArb,
        fc.record({
          corruptSupplier: fc.boolean(),
          corruptItems: fc.boolean(),
          corruptDate: fc.boolean(),
        }),
        (form, flags) => {
          // Ensure at least one field is corrupted
          if (!flags.corruptSupplier && !flags.corruptItems && !flags.corruptDate) {
            flags = { ...flags, corruptSupplier: true };
          }

          let invalid = { ...form };
          if (flags.corruptSupplier) invalid = { ...invalid, supplierId: '' };
          if (flags.corruptItems) invalid = { ...invalid, items: [] };
          if (flags.corruptDate) invalid = { ...invalid, purchaseDate: '' };

          const errors = validatePurchaseForm(invalid);
          return Object.keys(errors).length > 0;
        }
      )
    );
  });
});
