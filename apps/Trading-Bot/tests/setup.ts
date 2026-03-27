/**
 * Test setup and utilities
 * Provides mock data and helper functions for tests
 */

import type { Candle, NormalizedCandle } from '../src/types/candle';
import type { Signal } from '../src/types/signal';
import type { Trade } from '../src/types/trade';

/**
 * Generate mock candle data
 */
export function generateMockCandles(
  symbol: string,
  count: number,
  startPrice: number = 100,
  trend: 'up' | 'down' | 'sideways' = 'sideways'
): Candle[] {
  const candles: Candle[] = [];
  let price = startPrice;
  const baseDate = new Date('2024-01-01');

  for (let i = 0; i < count; i++) {
    const date = new Date(baseDate);
    date.setDate(date.getDate() + i);

    // Adjust price based on trend
    if (trend === 'up') {
      price += Math.random() * 2;
    } else if (trend === 'down') {
      price -= Math.random() * 2;
    } else {
      price += (Math.random() - 0.5) * 2;
    }

    const volatility = price * 0.02; // 2% daily volatility
    const open = price + (Math.random() - 0.5) * volatility;
    const close = price + (Math.random() - 0.5) * volatility;
    const high = Math.max(open, close) + Math.random() * volatility;
    const low = Math.min(open, close) - Math.random() * volatility;

    candles.push({
      symbol,
      timestamp: date.toISOString(),
      open,
      high,
      low,
      close,
      volume: Math.floor(1000000 + Math.random() * 500000),
      timeframe: '1d',
    });
  }

  return candles;
}

/**
 * Generate mock normalized candles
 */
export function generateMockNormalizedCandles(
  symbol: string,
  count: number,
  startPrice: number = 100,
  trend: 'up' | 'down' | 'sideways' = 'sideways'
): NormalizedCandle[] {
  const candles = generateMockCandles(symbol, count, startPrice, trend);
  return candles.map((c) => ({
    ...c,
    timestamp: new Date(c.timestamp),
  }));
}

/**
 * Generate candles with specific pattern for testing crossovers
 * Creates data where the crossover happens at the very end of the series
 */
export function generateCrossoverCandles(
  symbol: string,
  crossoverType: 'bullish' | 'bearish'
): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  const baseDate = new Date('2024-01-01');

  // Generate 60 candles to have enough data for MA calculation
  // For a crossover to happen at the end:
  // - Most candles are flat so fast MA ≈ slow MA
  // - Last candle has a price change that tips fast MA across slow MA
  for (let i = 0; i < 60; i++) {
    const date = new Date(baseDate);
    date.setDate(date.getDate() + i);

    let close: number;

    if (crossoverType === 'bullish') {
      // Flat prices, with last candle spiking up
      // This causes fast MA to cross above slow MA
      if (i < 59) {
        close = 100;
      } else {
        close = 110; // Spike on last candle
      }
    } else {
      // Flat prices, with last candle dropping
      // This causes fast MA to cross below slow MA
      if (i < 59) {
        close = 100;
      } else {
        close = 90; // Drop on last candle
      }
    }

    const volatility = close * 0.01;
    const open = close;
    const high = close + volatility;
    const low = close - volatility;

    candles.push({
      symbol,
      timestamp: date,
      open,
      high,
      low,
      close,
      volume: 1000000,
      timeframe: '1d',
    });
  }

  return candles;
}

/**
 * Generate mock signal
 */
export function generateMockSignal(
  symbol: string = 'AAPL',
  type: 'buy' | 'sell' | 'hold' = 'buy'
): Signal {
  return {
    symbol,
    type,
    timestamp: new Date().toISOString(),
    strategy: 'moving_average_crossover',
    strength: 0.75,
    price: 150.0,
    indicators: {
      fastMA: type === 'buy' ? 151 : 149,
      slowMA: 150,
    },
    reason: `Fast MA crossed ${type === 'buy' ? 'above' : 'below'} slow MA`,
  };
}

/**
 * Generate mock trade
 */
export function generateMockTrade(
  symbol: string = 'AAPL',
  side: 'buy' | 'sell' = 'buy'
): Trade {
  return {
    id: `trade-${Date.now()}`,
    symbol,
    side,
    quantity: 10,
    price: 150.0,
    value: 1500.0,
    timestamp: new Date().toISOString(),
    orderType: 'market',
    status: 'filled',
    orderId: `order-${Date.now()}`,
    strategy: 'moving_average_crossover',
  };
}

/**
 * Mock environment variables for testing
 */
export function setupTestEnv() {
  process.env.APCA_API_KEY = 'test-key';
  process.env.APCA_SECRET_KEY = 'test-secret';
  process.env.APCA_PAPER = 'true';
  process.env.DB_SERVICE_URL = 'http://localhost:3000/api';
  process.env.FAST_MA_PERIOD = '10';
  process.env.SLOW_MA_PERIOD = '50';
  process.env.TIMEFRAME = '1d';
  process.env.SYMBOLS = 'AAPL,SPY';
  process.env.LOG_LEVEL = 'error'; // Suppress logs during tests
}

/**
 * Clean up test environment
 */
export function cleanupTestEnv() {
  delete process.env.APCA_API_KEY;
  delete process.env.APCA_SECRET_KEY;
  delete process.env.APCA_PAPER;
  delete process.env.DB_SERVICE_URL;
}

/**
 * Assert arrays are approximately equal (for floating point comparisons)
 */
export function assertArraysApproxEqual(
  actual: number[],
  expected: number[],
  tolerance: number = 0.01
): void {
  if (actual.length !== expected.length) {
    throw new Error(
      `Array lengths differ: actual=${actual.length}, expected=${expected.length}`
    );
  }

  for (let i = 0; i < actual.length; i++) {
    const diff = Math.abs(actual[i] - expected[i]);
    if (diff > tolerance) {
      throw new Error(
        `Values at index ${i} differ: actual=${actual[i]}, expected=${expected[i]}, diff=${diff}`
      );
    }
  }
}

/**
 * Round number to fixed decimal places
 */
export function round(value: number, decimals: number = 2): number {
  const multiplier = Math.pow(10, decimals);
  return Math.round(value * multiplier) / multiplier;
}
