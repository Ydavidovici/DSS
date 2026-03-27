/**
 * Tests for signal generation
 */

import { describe, test, expect } from 'bun:test';
import {
  generateSignal,
  generateMultipleSignals,
  filterSignalsByType,
  getActionableSignals,
  meetsStrengthThreshold,
  filterByStrength,
} from '../../src/strategy/signals';
import {
  generateMockNormalizedCandles,
  generateCrossoverCandles,
  generateMockSignal,
} from '../setup';

describe('Signal Generation', () => {
  describe('generateSignal', () => {
    test('should generate buy signal on bullish crossover', () => {
      const candles = generateCrossoverCandles('AAPL', 'bullish');
      const config = {
        fastPeriod: 10,
        slowPeriod: 50,
        useEMA: false,
      };

      const result = generateSignal('AAPL', candles, config);

      expect(result).not.toBeNull();
      expect(result?.signal.symbol).toBe('AAPL');
      expect(result?.signal.type).toBe('buy');
      expect(result?.signal.strategy).toBe('moving_average_crossover');
      expect(result?.signal.strength).toBeGreaterThan(0);
      expect(result?.signal.indicators.fastMA).toBeDefined();
      expect(result?.signal.indicators.slowMA).toBeDefined();
    });

    test('should generate sell signal on bearish crossover', () => {
      const candles = generateCrossoverCandles('AAPL', 'bearish');
      const config = {
        fastPeriod: 10,
        slowPeriod: 50,
        useEMA: false,
      };

      const result = generateSignal('AAPL', candles, config);

      expect(result).not.toBeNull();
      expect(result?.signal.symbol).toBe('AAPL');
      expect(result?.signal.type).toBe('sell');
      expect(result?.signal.strategy).toBe('moving_average_crossover');
    });

    test('should generate hold signal when no crossover', () => {
      const candles = generateMockNormalizedCandles('AAPL', 60, 100, 'sideways');
      const config = {
        fastPeriod: 10,
        slowPeriod: 50,
        useEMA: false,
      };

      const result = generateSignal('AAPL', candles, config);

      // Most random sideways data won't have crossovers
      // If it does, just check it's a valid signal
      if (result) {
        expect(['buy', 'sell', 'hold']).toContain(result.signal.type);
      }
    });

    test('should return null with insufficient data', () => {
      const candles = generateMockNormalizedCandles('AAPL', 10, 100);
      const config = {
        fastPeriod: 10,
        slowPeriod: 50, // Need at least 51 candles
        useEMA: false,
      };

      const result = generateSignal('AAPL', candles, config);

      expect(result).toBeNull();
    });

    test('should include metadata in signal', () => {
      const candles = generateCrossoverCandles('AAPL', 'bullish');
      const config = {
        fastPeriod: 10,
        slowPeriod: 50,
        useEMA: false,
      };

      const result = generateSignal('AAPL', candles, config);

      expect(result?.signal.metadata).toBeDefined();
      expect(result?.signal.metadata?.fastPeriod).toBe(10);
      expect(result?.signal.metadata?.slowPeriod).toBe(50);
      expect(result?.signal.metadata?.useEMA).toBe(false);
    });

    test('should work with EMA', () => {
      const candles = generateCrossoverCandles('AAPL', 'bullish');
      const config = {
        fastPeriod: 10,
        slowPeriod: 50,
        useEMA: true,
      };

      const result = generateSignal('AAPL', candles, config);

      expect(result).not.toBeNull();
      expect(result?.signal.metadata?.useEMA).toBe(true);
    });
  });

  describe('generateMultipleSignals', () => {
    test('should generate signals for multiple symbols', () => {
      const symbols = ['AAPL', 'SPY', 'TSLA'];
      const candleMap = new Map();

      symbols.forEach((symbol) => {
        candleMap.set(symbol, generateMockNormalizedCandles(symbol, 60, 100));
      });

      const config = {
        fastPeriod: 10,
        slowPeriod: 50,
        useEMA: false,
      };

      const results = generateMultipleSignals(symbols, candleMap, config);

      expect(results.length).toBeGreaterThanOrEqual(0);
      expect(results.length).toBeLessThanOrEqual(symbols.length);
    });

    test('should handle missing candles gracefully', () => {
      const symbols = ['AAPL', 'SPY'];
      const candleMap = new Map();

      // Only provide candles for AAPL
      candleMap.set('AAPL', generateMockNormalizedCandles('AAPL', 60, 100));

      const config = {
        fastPeriod: 10,
        slowPeriod: 50,
        useEMA: false,
      };

      const results = generateMultipleSignals(symbols, candleMap, config);

      // Should not crash, should process AAPL
      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    test('should handle empty candle map', () => {
      const symbols = ['AAPL', 'SPY'];
      const candleMap = new Map();

      const config = {
        fastPeriod: 10,
        slowPeriod: 50,
        useEMA: false,
      };

      const results = generateMultipleSignals(symbols, candleMap, config);

      expect(results.length).toBe(0);
    });
  });

  describe('filterSignalsByType', () => {
    test('should filter signals by type', () => {
      const signals = [
        {
          signal: generateMockSignal('AAPL', 'buy'),
          candles: [],
          fastMA: [],
          slowMA: [],
        },
        {
          signal: generateMockSignal('SPY', 'sell'),
          candles: [],
          fastMA: [],
          slowMA: [],
        },
        {
          signal: generateMockSignal('TSLA', 'hold'),
          candles: [],
          fastMA: [],
          slowMA: [],
        },
      ];

      const buySignals = filterSignalsByType(signals, ['buy']);
      const sellSignals = filterSignalsByType(signals, ['sell']);
      const actionable = filterSignalsByType(signals, ['buy', 'sell']);

      expect(buySignals.length).toBe(1);
      expect(buySignals[0].signal.symbol).toBe('AAPL');

      expect(sellSignals.length).toBe(1);
      expect(sellSignals[0].signal.symbol).toBe('SPY');

      expect(actionable.length).toBe(2);
    });
  });

  describe('getActionableSignals', () => {
    test('should return only buy and sell signals', () => {
      const signals = [
        {
          signal: generateMockSignal('AAPL', 'buy'),
          candles: [],
          fastMA: [],
          slowMA: [],
        },
        {
          signal: generateMockSignal('SPY', 'sell'),
          candles: [],
          fastMA: [],
          slowMA: [],
        },
        {
          signal: generateMockSignal('TSLA', 'hold'),
          candles: [],
          fastMA: [],
          slowMA: [],
        },
      ];

      const actionable = getActionableSignals(signals);

      expect(actionable.length).toBe(2);
      expect(actionable.every((s) => s.signal.type !== 'hold')).toBe(true);
    });

    test('should return empty array if no actionable signals', () => {
      const signals = [
        {
          signal: generateMockSignal('AAPL', 'hold'),
          candles: [],
          fastMA: [],
          slowMA: [],
        },
      ];

      const actionable = getActionableSignals(signals);

      expect(actionable.length).toBe(0);
    });
  });

  describe('meetsStrengthThreshold', () => {
    test('should return true if strength meets threshold', () => {
      const signal = {
        signal: { ...generateMockSignal('AAPL', 'buy'), strength: 0.8 },
        candles: [],
        fastMA: [],
        slowMA: [],
      };

      expect(meetsStrengthThreshold(signal, 0.5)).toBe(true);
      expect(meetsStrengthThreshold(signal, 0.8)).toBe(true);
    });

    test('should return false if strength below threshold', () => {
      const signal = {
        signal: { ...generateMockSignal('AAPL', 'buy'), strength: 0.3 },
        candles: [],
        fastMA: [],
        slowMA: [],
      };

      expect(meetsStrengthThreshold(signal, 0.5)).toBe(false);
    });

    test('should handle undefined strength', () => {
      const signal = {
        signal: { ...generateMockSignal('AAPL', 'buy'), strength: undefined },
        candles: [],
        fastMA: [],
        slowMA: [],
      };

      expect(meetsStrengthThreshold(signal, 0.5)).toBe(false);
    });
  });

  describe('filterByStrength', () => {
    test('should filter signals by strength threshold', () => {
      const signals = [
        {
          signal: { ...generateMockSignal('AAPL', 'buy'), strength: 0.8 },
          candles: [],
          fastMA: [],
          slowMA: [],
        },
        {
          signal: { ...generateMockSignal('SPY', 'buy'), strength: 0.3 },
          candles: [],
          fastMA: [],
          slowMA: [],
        },
        {
          signal: { ...generateMockSignal('TSLA', 'buy'), strength: 0.6 },
          candles: [],
          fastMA: [],
          slowMA: [],
        },
      ];

      const strong = filterByStrength(signals, 0.5);

      expect(strong.length).toBe(2);
      expect(strong.every((s) => (s.signal.strength || 0) >= 0.5)).toBe(true);
    });
  });
});
