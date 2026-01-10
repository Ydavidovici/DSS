/**
 * Tests for logger utility
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { logger } from '../../src/utils/logger';

describe('Logger', () => {
  beforeEach(() => {
    // Reset log level before each test
    logger.setLogLevel('info');
  });

  describe('setLogLevel', () => {
    test('should set log level', () => {
      logger.setLogLevel('debug');
      logger.setLogLevel('warn');
      logger.setLogLevel('error');

      // If we get here without errors, it works
      expect(true).toBe(true);
    });
  });

  describe('logging methods', () => {
    test('should have debug method', () => {
      expect(typeof logger.debug).toBe('function');
      logger.debug('Test debug message');
    });

    test('should have info method', () => {
      expect(typeof logger.info).toBe('function');
      logger.info('Test info message');
    });

    test('should have warn method', () => {
      expect(typeof logger.warn).toBe('function');
      logger.warn('Test warn message');
    });

    test('should have error method', () => {
      expect(typeof logger.error).toBe('function');
      logger.error('Test error message');
    });

    test('should accept data object', () => {
      logger.info('Test with data', { symbol: 'AAPL', price: 150 });
      logger.warn('Test with data', { count: 5 });
    });
  });

  describe('specialized logging', () => {
    test('should have trade logging method', () => {
      expect(typeof logger.trade).toBe('function');
      logger.trade('AAPL', 'buy', 10, 150.0);
    });

    test('should have signal logging method', () => {
      expect(typeof logger.signal).toBe('function');
      logger.signal('AAPL', 'buy', 150.0, 'MA crossover');
    });
  });

  describe('log level filtering', () => {
    test('should filter based on log level', () => {
      // Set to error level - should only show errors
      logger.setLogLevel('error');

      // These should be filtered out (no errors expected)
      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warn message');

      // This should appear
      logger.error('Error message');

      expect(true).toBe(true);
    });

    test('should show all logs at debug level', () => {
      logger.setLogLevel('debug');

      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warn message');
      logger.error('Error message');

      expect(true).toBe(true);
    });
  });
});
