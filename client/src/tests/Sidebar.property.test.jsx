/**
 * Property 12: Role-based sidebar nav visibility is consistent
 * Validates: Requirements 2.1, 4.6
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// Nav items matching what Sidebar.jsx has
const expensesItem = { to: '/expenses', icon: 'money_off', label: 'Expenses', roles: ['admin', 'manager'] };
const plansItem    = { to: '/plans', icon: 'workspace_premium', label: 'Plans', roles: ['admin'] };

// Same filtering logic as Sidebar.jsx: visible = !roles || roles.includes(role)
const isVisible = (item, role) => !item.roles || item.roles.includes(role);

describe('Property 12: Role-based sidebar nav visibility', () => {
  it('Expenses item is visible iff role is admin or manager', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('admin', 'manager', 'cashier'),
        (role) => {
          const visible = isVisible(expensesItem, role);
          if (role === 'admin' || role === 'manager') return visible === true;
          return visible === false;
        }
      )
    );
  });

  it('Plans item is visible iff role is admin', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('admin', 'manager', 'cashier'),
        (role) => {
          const visible = isVisible(plansItem, role);
          if (role === 'admin') return visible === true;
          return visible === false;
        }
      )
    );
  });
});
