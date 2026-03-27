/**
 * Tests for logger utility
 */

import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { logger } from '../../src/utils/logger';

describe('Logger', () => {
  let consoleLogMock: any;
  let originalConsoleLog: any;

  beforeEach(() => {
    // Reset log level before each test
    logger.setLogLevel('info');

    // Mock console.log to capture output
    originalConsoleLog = console.log;
    consoleLogMock = mock(() => {});
    console.log = consoleLogMock;
  });

  afterEach(() => {
    // Restore original console.log
    console.log = originalConsoleLog;
  });

  describe('setLogLevel', () => {
    test('should set log level and affect filtering', () => {
      logger.setLogLevel('error');
      logger.info('Should not appear');
      expect(consoleLogMock).not.toHaveBeenCalled();

      logger.error('Should appear');
      expect(consoleLogMock).toHaveBeenCalled();
    });
  });

  describe('logging methods', () => {
    test('should log debug message', () => {
      logger.setLogLevel('debug');
      logger.debug('Test debug message');

      expect(consoleLogMock).toHaveBeenCalledTimes(1);
      const call = consoleLogMock.mock.calls[0][0];
      expect(call).toContain('[DEBUG]');
      expect(call).toContain('Test debug message');
    });

    test('should log info message', () => {
      logger.info('Test info message');

      expect(consoleLogMock).toHaveBeenCalledTimes(1);
      const call = consoleLogMock.mock.calls[0][0];
      expect(call).toContain('[INFO]');
      expect(call).toContain('Test info message');
    });

    test('should log warn message', () => {
      logger.warn('Test warn message');

      expect(consoleLogMock).toHaveBeenCalledTimes(1);
      const call = consoleLogMock.mock.calls[0][0];
      expect(call).toContain('[WARN]');
      expect(call).toContain('Test warn message');
    });

    test('should log error message', () => {
      logger.error('Test error message');

      expect(consoleLogMock).toHaveBeenCalledTimes(1);
      const call = consoleLogMock.mock.calls[0][0];
      expect(call).toContain('[ERROR]');
      expect(call).toContain('Test error message');
    });

    test('should accept data object', () => {
      logger.info('Test with data', { symbol: 'AAPL', price: 150 });

      expect(consoleLogMock).toHaveBeenCalledTimes(1);
      const args = consoleLogMock.mock.calls[0];
      expect(args[0]).toContain('Test with data');
      expect(args[1]).toEqual({ symbol: 'AAPL', price: 150 });
    });
  });

  describe('specialized logging', () => {
    test('should log trade with formatted message', () => {
      logger.trade('AAPL', 'buy', 10, 150.0);

      expect(consoleLogMock).toHaveBeenCalledTimes(1);
      const args = consoleLogMock.mock.calls[0];
      expect(args[0]).toContain('Trade executed');
      expect(args[0]).toContain('BUY');
      expect(args[0]).toContain('10');
      expect(args[0]).toContain('AAPL');
      expect(args[0]).toContain('$150.00');
      expect(args[1]).toEqual({
        symbol: 'AAPL',
        side: 'buy',
        quantity: 10,
        price: 150.0,
        value: 1500.0,
      });
    });

    test('should log signal with formatted message', () => {
      logger.signal('AAPL', 'buy', 150.0, 'MA crossover');

      expect(consoleLogMock).toHaveBeenCalledTimes(1);
      const args = consoleLogMock.mock.calls[0];
      expect(args[0]).toContain('Signal generated');
      expect(args[0]).toContain('BUY');
      expect(args[0]).toContain('AAPL');
      expect(args[0]).toContain('$150.00');
      expect(args[1]).toEqual({
        symbol: 'AAPL',
        type: 'buy',
        price: 150.0,
        reason: 'MA crossover',
      });
    });
  });

  describe('log level filtering', () => {
    test('should filter debug when level is info', () => {
      logger.setLogLevel('info');
      logger.debug('Debug message');

      expect(consoleLogMock).not.toHaveBeenCalled();
    });

    test('should filter debug and info when level is warn', () => {
      logger.setLogLevel('warn');
      logger.debug('Debug message');
      logger.info('Info message');

      expect(consoleLogMock).not.toHaveBeenCalled();

      logger.warn('Warn message');
      expect(consoleLogMock).toHaveBeenCalledTimes(1);
    });

    test('should only show errors when level is error', () => {
      logger.setLogLevel('error');

      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warn message');

      expect(consoleLogMock).not.toHaveBeenCalled();

      logger.error('Error message');
      expect(consoleLogMock).toHaveBeenCalledTimes(1);
    });

    test('should show all logs at debug level', () => {
      logger.setLogLevel('debug');

      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warn message');
      logger.error('Error message');

      expect(consoleLogMock).toHaveBeenCalledTimes(4);
    });
  });
});
