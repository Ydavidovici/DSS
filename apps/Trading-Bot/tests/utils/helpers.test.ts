/**
 * Tests for utility helper functions
 */

import { describe, test, expect } from 'bun:test';
import {
  formatDate,
  parseDate,
  formatCurrency,
  formatPercent,
  round,
  percentChange,
  parseList,
  generateId,
} from '../../src/utils/helpers';

describe('Utility Helpers', () => {
  describe('formatDate', () => {
    test('should format Date object to ISO string', () => {
      const date = new Date('2024-01-15T12:30:00Z');
      const formatted = formatDate(date);

      expect(formatted).toBe('2024-01-15T12:30:00.000Z');
    });

    test('should pass through string dates', () => {
      const dateStr = '2024-01-15T12:30:00Z';
      const formatted = formatDate(dateStr);

      expect(formatted).toBe(dateStr);
    });

    test('should convert timestamp to ISO string', () => {
      const timestamp = 1705324200000; // Jan 15, 2024
      const formatted = formatDate(timestamp);

      expect(formatted).toContain('2024-01-15');
    });
  });

  describe('parseDate', () => {
    test('should parse ISO string to Date', () => {
      const dateStr = '2024-01-15T12:30:00Z';
      const parsed = parseDate(dateStr);

      expect(parsed).toBeInstanceOf(Date);
      expect(parsed.toISOString()).toBe('2024-01-15T12:30:00.000Z');
    });

    test('should pass through Date objects', () => {
      const date = new Date('2024-01-15T12:30:00Z');
      const parsed = parseDate(date);

      expect(parsed).toBe(date);
    });

    test('should convert timestamp to Date', () => {
      const timestamp = 1705324200000;
      const parsed = parseDate(timestamp);

      expect(parsed).toBeInstanceOf(Date);
      expect(parsed.getTime()).toBe(timestamp);
    });
  });

  describe('formatCurrency', () => {
    test('should format number as USD currency', () => {
      expect(formatCurrency(1234.56)).toBe('$1,234.56');
      expect(formatCurrency(0.99)).toBe('$0.99');
      expect(formatCurrency(1000000)).toBe('$1,000,000.00');
    });

    test('should handle negative values', () => {
      expect(formatCurrency(-123.45)).toBe('-$123.45');
    });

    test('should round to 2 decimal places', () => {
      expect(formatCurrency(123.456)).toBe('$123.46');
      expect(formatCurrency(123.454)).toBe('$123.45');
    });
  });

  describe('formatPercent', () => {
    test('should format number as percentage', () => {
      expect(formatPercent(50)).toBe('50.00%');
      expect(formatPercent(0.5)).toBe('0.50%');
      expect(formatPercent(100)).toBe('100.00%');
    });

    test('should handle negative percentages', () => {
      expect(formatPercent(-25)).toBe('-25.00%');
    });

    test('should round to 2 decimal places', () => {
      expect(formatPercent(12.345)).toBe('12.35%');
    });
  });

  describe('round', () => {
    test('should round to specified decimal places', () => {
      expect(round(123.456, 2)).toBe(123.46);
      expect(round(123.456, 1)).toBe(123.5);
      expect(round(123.456, 0)).toBe(123);
    });

    test('should default to 2 decimal places', () => {
      expect(round(123.456)).toBe(123.46);
    });

    test('should handle negative numbers', () => {
      expect(round(-123.456, 2)).toBe(-123.46);
    });
  });

  describe('percentChange', () => {
    test('should calculate percentage change', () => {
      expect(percentChange(100, 110)).toBe(10);
      expect(percentChange(100, 90)).toBe(-10);
      expect(percentChange(50, 100)).toBe(100);
    });

    test('should return 0 when old value is 0', () => {
      expect(percentChange(0, 100)).toBe(0);
    });

    test('should handle same values', () => {
      expect(percentChange(100, 100)).toBe(0);
    });

    test('should handle negative values', () => {
      expect(percentChange(-100, -50)).toBe(50);
    });
  });

  describe('parseList', () => {
    test('should parse comma-separated string to array', () => {
      expect(parseList('AAPL,SPY,TSLA')).toEqual(['AAPL', 'SPY', 'TSLA']);
    });

    test('should trim whitespace', () => {
      expect(parseList('AAPL, SPY , TSLA')).toEqual(['AAPL', 'SPY', 'TSLA']);
    });

    test('should filter empty items', () => {
      expect(parseList('AAPL,,SPY')).toEqual(['AAPL', 'SPY']);
      expect(parseList('AAPL, , SPY')).toEqual(['AAPL', 'SPY']);
    });

    test('should handle single item', () => {
      expect(parseList('AAPL')).toEqual(['AAPL']);
    });

    test('should handle empty string', () => {
      expect(parseList('')).toEqual([]);
    });
  });

  describe('generateId', () => {
    test('should generate unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();

      expect(id1).not.toBe(id2);
    });

    test('should generate IDs in expected format', () => {
      const id = generateId();

      expect(id).toContain('-');
      expect(id.split('-')).toHaveLength(2);
    });

    test('should generate timestamp-based IDs', () => {
      const before = Date.now();
      const id = generateId();
      const after = Date.now();

      const timestamp = parseInt(id.split('-')[0]);

      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });
  });
});
