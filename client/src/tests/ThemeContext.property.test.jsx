/**
 * Property 10: Color name resolution is case-insensitive for preset matches
 * Validates: Requirements 5.3, 5.6
 *
 * Property 11: Color name resolves to "Custom" for any non-preset hex
 * Validates: Requirements 5.5, 5.7
 */
import { describe, it } from 'vitest';
import { expect } from 'vitest';
import * as fc from 'fast-check';
import { resolveColorName, COLOR_PRESETS } from '../context/ThemeContext';

// ---------------------------------------------------------------------------
// Property 10: Case-insensitive preset matching
// ---------------------------------------------------------------------------

describe('Property 10: Color name resolution is case-insensitive for preset matches', () => {
  it('returns preset name for exact lowercase hex match', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...COLOR_PRESETS),
        (preset) => {
          return resolveColorName(preset.hex.toLowerCase(), COLOR_PRESETS) === preset.name;
        }
      )
    );
  });

  it('returns preset name for uppercase hex match', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...COLOR_PRESETS),
        (preset) => {
          return resolveColorName(preset.hex.toUpperCase(), COLOR_PRESETS) === preset.name;
        }
      )
    );
  });

  it('returns preset name for mixed-case hex match', () => {
    // Generate a mixed-case variant: uppercase first half, lowercase second half
    fc.assert(
      fc.property(
        fc.constantFrom(...COLOR_PRESETS),
        fc.boolean(), // flip whether to upper or lower each char
        (preset, flipFirst) => {
          const raw = preset.hex.replace('#', '');
          const mixed = raw
            .split('')
            .map((ch, i) => (i % 2 === 0) === flipFirst ? ch.toUpperCase() : ch.toLowerCase())
            .join('');
          const hexVariant = '#' + mixed;
          return resolveColorName(hexVariant, COLOR_PRESETS) === preset.name;
        }
      )
    );
  });

  it('returns "Custom" for empty / falsy hex', () => {
    expect(resolveColorName('', COLOR_PRESETS)).toBe('Custom');
    expect(resolveColorName(null, COLOR_PRESETS)).toBe('Custom');
    expect(resolveColorName(undefined, COLOR_PRESETS)).toBe('Custom');
  });
});

// ---------------------------------------------------------------------------
// Property 11: Non-preset hex resolves to "Custom"
// ---------------------------------------------------------------------------

describe('Property 11: Color name resolves to "Custom" for any non-preset hex', () => {
  /** Set of all preset hex values normalized to lowercase (without #) */
  const presetHexSet = new Set(COLOR_PRESETS.map((p) => p.hex.toLowerCase()));

  it('returns "Custom" for any hex string not in COLOR_PRESETS', () => {
    // Generate a 6-digit hex number and format as #rrggbb
    const hexArb = fc.nat({ max: 0xffffff }).map((n) => '#' + n.toString(16).padStart(6, '0'));
    fc.assert(
      fc.property(
        hexArb.filter((h) => !presetHexSet.has(h.toLowerCase())),
        (hex) => {
          return resolveColorName(hex, COLOR_PRESETS) === 'Custom';
        }
      )
    );
  });

  it('returns "Custom" for non-preset uppercase hex that does not match any preset', () => {
    const hexArb = fc.nat({ max: 0xffffff }).map((n) => '#' + n.toString(16).padStart(6, '0').toUpperCase());
    fc.assert(
      fc.property(
        hexArb.filter((h) => !presetHexSet.has(h.toLowerCase())),
        (hex) => {
          return resolveColorName(hex, COLOR_PRESETS) === 'Custom';
        }
      )
    );
  });
});
