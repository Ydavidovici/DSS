/**
 * Tests for technical indicators
 */

import { describe, test, expect } from 'bun:test';
import {
  calculateSMA,
  calculateEMA,
  extractClosePrices,
  calculateMovingAverages,
  detectCrossover,
} from '../../src/strategy/indicators';
import {
  generateMockNormalizedCandles,
  generateCrossoverCandles,
  assertArraysApproxEqual,
  round,
} from '../setup';

describe('Technical Indicators', () => {
  describe('calculateSMA', () => {
    test('should calculate simple moving average correctly', () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const period = 3;

      const sma = calculateSMA(values, period);

      expect(sma.length).toBe(values.length - period + 1);
      expect(sma[0]).toBe(2); // (1+2+3)/3 = 2
      expect(sma[1]).toBe(3); // (2+3+4)/3 = 3
      expect(sma[2]).toBe(4); // (3+4+5)/3 = 4
      expect(sma[sma.length - 1]).toBe(9); // (8+9+10)/3 = 9
    });

    test('should return empty array if insufficient data', () => {
      const values = [1, 2, 3];
      const period = 5;

      const sma = calculateSMA(values, period);

      expect(sma.length).toBe(0);
    });

    test('should handle period of 1', () => {
      const values = [1, 2, 3, 4, 5];
      const period = 1;

      const sma = calculateSMA(values, period);

      expect(sma.length).toBe(values.length);
      expect(sma).toEqual(values);
    });
  });

  describe('calculateEMA', () => {
    test('should calculate exponential moving average correctly', () => {
      const values = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
      const period = 3;

      const ema = calculateEMA(values, period);

      expect(ema.length).toBe(values.length - period + 1);

      // First EMA value should be SMA
      expect(ema[0]).toBe(11); // (10+11+12)/3 = 11

      // Subsequent values should be weighted
      const multiplier = 2 / (period + 1);
      const expectedEma1 = (13 - ema[0]) * multiplier + ema[0];
      expect(round(ema[1], 2)).toBe(round(expectedEma1, 2));
    });

    test('should return empty array if insufficient data', () => {
      const values = [1, 2, 3];
      const period = 5;

      const ema = calculateEMA(values, period);

      expect(ema.length).toBe(0);
    });

    test('should give more weight to recent values than SMA', () => {
      const values = [10, 10, 10, 10, 10, 10, 10, 20]; // Spike at end
      const period = 5;

      const sma = calculateSMA(values, period);
      const ema = calculateEMA(values, period);

      const smaLast = sma[sma.length - 1];
      const emaLast = ema[ema.length - 1];

      // EMA should react faster to the spike
      expect(emaLast).toBeGreaterThan(smaLast);
    });
  });

  describe('extractClosePrices', () => {
    test('should extract close prices from candles', () => {
      const candles = generateMockNormalizedCandles('AAPL', 10, 100);

      const closes = extractClosePrices(candles);

      expect(closes.length).toBe(10);
      closes.forEach((price, i) => {
        expect(price).toBe(candles[i].close);
      });
    });

    test('should handle empty array', () => {
      const closes = extractClosePrices([]);

      expect(closes.length).toBe(0);
    });
  });

  describe('calculateMovingAverages', () => {
    test('should calculate both fast and slow MAs', () => {
      const candles = generateMockNormalizedCandles('AAPL', 60, 100);
      const fastPeriod = 10;
      const slowPeriod = 50;

      const { fastMA, slowMA } = calculateMovingAverages(
        candles,
        fastPeriod,
        slowPeriod,
        false
      );

      expect(fastMA.length).toBe(candles.length - fastPeriod + 1);
      expect(slowMA.length).toBe(candles.length - slowPeriod + 1);
    });

    test('should use SMA by default', () => {
      const candles = generateMockNormalizedCandles('AAPL', 20, 100);
      const period = 5;

      const { fastMA } = calculateMovingAverages(candles, period, 10, false);

      const closes = extractClosePrices(candles);
      const expectedSMA = calculateSMA(closes, period);

      assertArraysApproxEqual(fastMA, expectedSMA);
    });

    test('should use EMA when specified', () => {
      const candles = generateMockNormalizedCandles('AAPL', 20, 100);
      const period = 5;

      const { fastMA } = calculateMovingAverages(candles, period, 10, true);

      const closes = extractClosePrices(candles);
      const expectedEMA = calculateEMA(closes, period);

      assertArraysApproxEqual(fastMA, expectedEMA);
    });
  });

  describe('detectCrossover', () => {
    test('should detect bullish crossover', () => {
      // Fast crosses above slow
      const fastMA = [48, 49, 50, 51]; // Crossing upward
      const slowMA = [50, 50, 50, 50]; // Flat

      const crossover = detectCrossover(fastMA, slowMA);

      expect(crossover).toBe('bullish');
    });

    test('should detect bearish crossover', () => {
      // Fast crosses below slow
      const fastMA = [52, 51, 50, 49]; // Crossing downward
      const slowMA = [50, 50, 50, 50]; // Flat

      const crossover = detectCrossover(fastMA, slowMA);

      expect(crossover).toBe('bearish');
    });

    test('should return null if no crossover', () => {
      const fastMA = [55, 56, 57, 58]; // Above, moving up
      const slowMA = [50, 50, 50, 50]; // Flat

      const crossover = detectCrossover(fastMA, slowMA);

      expect(crossover).toBeNull();
    });

    test('should return null if insufficient data', () => {
      const fastMA = [50];
      const slowMA = [50];

      const crossover = detectCrossover(fastMA, slowMA);

      expect(crossover).toBeNull();
    });

    test('should detect crossover with real candle data', () => {
      const bullishCandles = generateCrossoverCandles('AAPL', 'bullish');
      const bearishCandles = generateCrossoverCandles('AAPL', 'bearish');

      const { fastMA: bullishFast, slowMA: bullishSlow } =
        calculateMovingAverages(bullishCandles, 10, 50);

      const { fastMA: bearishFast, slowMA: bearishSlow } =
        calculateMovingAverages(bearishCandles, 10, 50);

      const bullishCrossover = detectCrossover(bullishFast, bullishSlow);
      const bearishCrossover = detectCrossover(bearishFast, bearishSlow);

      expect(bullishCrossover).toBe('bullish');
      expect(bearishCrossover).toBe('bearish');
    });

    test('should handle exact equality at crossover point', () => {
      const fastMA = [49, 50, 51];
      const slowMA = [50, 50, 50];

      const crossover = detectCrossover(fastMA, slowMA);

      expect(crossover).toBe('bullish');
    });
  });
});
