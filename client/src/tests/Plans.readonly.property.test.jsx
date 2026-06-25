/**
 * Property 8: Non-admin users see Plans page in read-only mode
 * Validates: Requirements 4.7
 *
 * For any non-admin role, all plan selection buttons and the billing-cycle
 * toggle must have the `disabled` attribute.
 */
import { describe, it, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import * as fc from 'fast-check';
import * as AuthContext from '../context/AuthContext';
import * as SettingsContext from '../context/SettingsContext';

// ---------------------------------------------------------------------------
// Mock ThemeContext to prevent PageLayout -> Sidebar from throwing
// ---------------------------------------------------------------------------
vi.mock('../context/ThemeContext', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useTheme: () => ({
      theme: 'light',
      setTheme: vi.fn(),
      toggleTheme: vi.fn(),
    }),
  };
});

// ---------------------------------------------------------------------------
// Mock api module (Plans.jsx imports api for GET /settings and PUT /settings)
// ---------------------------------------------------------------------------
vi.mock('../services/api', () => ({
  default: {
    get: vi.fn().mockResolvedValue({
      data: { subscriptionPlan: 'starter', subscriptionStatus: 'active' },
    }),
    put: vi.fn().mockResolvedValue({ data: {} }),
  },
}));

// Lazy-import after mocks are in place
const { default: Plans } = await import('../pages/Plans');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockAuth(role) {
  vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
    isAuthenticated: true,
    user: { _id: 'u1', name: 'Test User', role },
  });
}

function mockSettings() {
  vi.spyOn(SettingsContext, 'useSettings').mockReturnValue({
    settings: { subscriptionStatus: 'active' },
    enabledMethods: [],
    loaded: true,
    refreshSettings: vi.fn(),
    setSettings: vi.fn(),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Property 8: Non-admin users see Plans page in read-only mode', () => {
  afterEach(() => vi.restoreAllMocks());

  it('all plan selection buttons and billing-cycle toggles are disabled for non-admin roles', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('manager', 'cashier'),
        (role) => {
          mockAuth(role);
          mockSettings();

          const { container, unmount } = render(
            <MemoryRouter>
              <Plans />
            </MemoryRouter>
          );

          // Find all buttons inside the component
          const buttons = container.querySelectorAll('button');
          let testFailed = false;

          for (const btn of buttons) {
            const text = btn.textContent || '';
            // Only verify the buttons related to plans
            if (text.includes('Monthly') || text.includes('Yearly') || text.includes('Select plan') || text.includes('Pay & Activate') || text.includes('Sending prompt')) {
              if (!btn.disabled) {
                testFailed = true;
                break;
              }
            }
          }

          unmount();
          vi.restoreAllMocks();

          return !testFailed;
        }
      ),
      { numRuns: 10 }
    );
  });

  it('plan selection buttons are NOT disabled for admin role', () => {
    mockAuth('admin');
    mockSettings();

    const { container, unmount } = render(
      <MemoryRouter>
        <Plans />
      </MemoryRouter>
    );

    const buttons = container.querySelectorAll('button');
    let hasEnabledPlanButton = false;

    for (const btn of buttons) {
      const text = btn.textContent || '';
      if (text.includes('Monthly') || text.includes('Yearly') || text.includes('Select plan') || text.includes('Pay & Activate')) {
        if (!btn.disabled) {
          hasEnabledPlanButton = true;
          break;
        }
      }
    }

    expect(hasEnabledPlanButton).toBe(true);
    unmount();
  });
});
