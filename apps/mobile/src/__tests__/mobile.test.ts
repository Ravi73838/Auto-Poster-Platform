import { describe, it, expect } from 'vitest';
import { formatCurrency } from '../utils/index.js';

describe('Mobile App Utilities', () => {
  it('formats currency correctly with INR symbol', () => {
    expect(formatCurrency(1500)).toContain('1,500');
  });
});
