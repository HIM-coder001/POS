/**
 * Unit tests for SettingsContext defaults and merge behavior
 * Validates: Requirements 3.3
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { SettingsProvider, useSettings } from '../context/SettingsContext';

// Mock the api module so no real HTTP calls are made
vi.mock('../services/api', () => ({
  default: { get: vi.fn() },
}));

// Import the mocked api so we can configure its return value per test
import api from '../services/api';

// A simple consumer component that renders selected settings as text
function SettingsConsumer() {
  const { settings } = useSettings();
  return (
    <div>
      <span data-testid="gatewayMpesa">{String(settings.gatewayMpesa)}</span>
      <span data-testid="gatewayCash">{String(settings.gatewayCash)}</span>
      <span data-testid="gatewayCard">{String(settings.gatewayCard)}</span>
      <span data-testid="gatewaySplit">{String(settings.gatewaySplit)}</span>
      <span data-testid="receiptFontType">{settings.receiptFontType}</span>
      <span data-testid="receiptFontSize">{settings.receiptFontSize}</span>
      <span data-testid="receiptShowTaxBreakdown">{String(settings.receiptShowTaxBreakdown)}</span>
      <span data-testid="receiptShowServedBy">{String(settings.receiptShowServedBy)}</span>
      <span data-testid="receiptShowDateTime">{String(settings.receiptShowDateTime)}</span>
      <span data-testid="receiptPhone">{settings.receiptPhone}</span>
      <span data-testid="receiptAddress">{settings.receiptAddress}</span>
      <span data-testid="subscriptionStatus">{settings.subscriptionStatus}</span>
    </div>
  );
}

describe('SettingsContext', () => {
  beforeEach(() => {
    // Provide a fake user token so loadSettings does not early-return
    localStorage.setItem('retailedge_user', JSON.stringify({ token: 'test-token' }));
    vi.clearAllMocks();
  });

  it('preserves all DEFAULTS when API returns empty object', async () => {
    // API responds with an empty data object — no overrides
    api.get.mockResolvedValue({ data: {} });

    render(
      <SettingsProvider>
        <SettingsConsumer />
      </SettingsProvider>
    );

    // Wait for the async loadSettings effect to resolve
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/settings');
    });

    // All DEFAULTS should be preserved
    expect(screen.getByTestId('gatewayMpesa').textContent).toBe('true');
    expect(screen.getByTestId('gatewayCash').textContent).toBe('true');
    expect(screen.getByTestId('gatewayCard').textContent).toBe('true');
    expect(screen.getByTestId('gatewaySplit').textContent).toBe('true');
    expect(screen.getByTestId('receiptFontType').textContent).toBe('Arial');
    expect(screen.getByTestId('receiptFontSize').textContent).toBe('medium');
    expect(screen.getByTestId('receiptShowTaxBreakdown').textContent).toBe('false');
    expect(screen.getByTestId('receiptShowServedBy').textContent).toBe('true');
    expect(screen.getByTestId('receiptShowDateTime').textContent).toBe('true');
    expect(screen.getByTestId('receiptPhone').textContent).toBe('');
    expect(screen.getByTestId('receiptAddress').textContent).toBe('');
    expect(screen.getByTestId('subscriptionStatus').textContent).toBe('none');
  });

  it('API values override DEFAULTS', async () => {
    // API responds with a partial override
    api.get.mockResolvedValue({
      data: { receiptFontType: 'Georgia', subscriptionStatus: 'active' },
    });

    render(
      <SettingsProvider>
        <SettingsConsumer />
      </SettingsProvider>
    );

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/settings');
    });

    // Overridden values should reflect the API response
    expect(screen.getByTestId('receiptFontType').textContent).toBe('Georgia');
    expect(screen.getByTestId('subscriptionStatus').textContent).toBe('active');

    // Non-overridden defaults must still be intact
    expect(screen.getByTestId('receiptFontSize').textContent).toBe('medium');
    expect(screen.getByTestId('receiptShowTaxBreakdown').textContent).toBe('false');
    expect(screen.getByTestId('receiptShowServedBy').textContent).toBe('true');
    expect(screen.getByTestId('receiptShowDateTime').textContent).toBe('true');
    expect(screen.getByTestId('gatewayMpesa').textContent).toBe('true');
  });
});
