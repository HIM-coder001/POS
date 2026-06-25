/**
 * Property 9: Subscription guard redirects all protected routes except /login and /plans
 * Validates: Requirements 4.8
 */
import { describe, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import * as fc from 'fast-check';
import ProtectedRoute from '../components/ProtectedRoute';
import * as AuthContext from '../context/AuthContext';
import * as SettingsContext from '../context/SettingsContext';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Mock useAuth to return an authenticated admin */
function mockAuth() {
  vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
    isAuthenticated: true,
    user: { _id: 'u1', name: 'Test Admin', role: 'admin' },
  });
}

/** Mock useSettings with a given subscriptionStatus */
function mockSettings(subscriptionStatus) {
  vi.spyOn(SettingsContext, 'useSettings').mockReturnValue({
    settings: { subscriptionStatus },
    enabledMethods: [],
    loaded: true,
    refreshSettings: vi.fn(),
    setSettings: vi.fn(),
  });
}

/**
 * Renders ProtectedRoute at a given path and returns the document body text.
 * We use a sentinel <div data-testid="child"> as the guarded child and
 * a <div data-testid="plans"> at /plans to detect the redirect.
 */
function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="*"
          element={
            <ProtectedRoute allowedRoles={['admin', 'manager', 'cashier']}>
              <div data-testid="child">child-content</div>
            </ProtectedRoute>
          }
        />
        <Route path="/plans" element={<div data-testid="plans">plans-page</div>} />
        <Route path="/" element={<div data-testid="login">login-page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Property 9: Subscription guard redirects protected routes to /plans', () => {
  afterEach(() => vi.restoreAllMocks());

  it('redirects to /plans for any path that is not /plans or / when overdue', () => {
    fc.assert(
      fc.property(
        // Generate paths that are not /plans and not / (login), and not // (double slash)
        fc.webPath().filter((p) => p !== '/plans' && p !== '/' && p.startsWith('/') && !p.startsWith('//')),
        (path) => {
          mockAuth();
          mockSettings('overdue');
          const { queryByTestId, unmount } = renderAt(path);

          // The guard must redirect away from the child
          const childVisible = !!queryByTestId('child');
          const plansVisible = !!queryByTestId('plans');

          unmount();
          vi.restoreAllMocks();

          // Child must NOT be rendered; plans page must be rendered
          return !childVisible && plansVisible;
        }
      ),
      { numRuns: 50 }
    );
  });

  it('does NOT redirect to /plans when subscription is active (status = active)', () => {
    fc.assert(
      fc.property(
        fc.webPath().filter((p) => p !== '/plans' && p !== '/' && p.startsWith('/') && !p.startsWith('//')),
        (path) => {
          mockAuth();
          mockSettings('active');
          const { queryByTestId, unmount } = renderAt(path);

          const childVisible = !!queryByTestId('child');
          unmount();
          vi.restoreAllMocks();

          return childVisible;
        }
      ),
      { numRuns: 50 }
    );
  });

  it('redirects to /plans when subscription status is none', () => {
    fc.assert(
      fc.property(
        fc.webPath().filter((p) => p !== '/plans' && p !== '/' && p.startsWith('/') && !p.startsWith('//')),
        (path) => {
          mockAuth();
          mockSettings('none');
          const { queryByTestId, unmount } = renderAt(path);

          const childVisible = !!queryByTestId('child');
          const plansVisible = !!queryByTestId('plans');
          unmount();
          vi.restoreAllMocks();

          return !childVisible && plansVisible;
        }
      ),
      { numRuns: 50 }
    );
  });
});
