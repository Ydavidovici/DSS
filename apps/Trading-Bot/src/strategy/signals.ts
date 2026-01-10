/**
 * Signal generation logic
 * Implements moving average crossover strategy
 */

import type { NormalizedCandle } from '../types/candle';
import type { Signal, SignalType, SignalResult } from '../types/signal';
import {
  calculateMovingAverages,
  detectCrossover,
  extractClosePrices,
} from './indicators';
import { logger } from '../utils/logger';
import { formatDate } from '../utils/helpers';

export interface StrategyConfig {
  /** Fast MA period (default: 10) */
  fastPeriod: number;

  /** Slow MA period (default: 50) */
  slowPeriod: number;

  /** Use EMA instead of SMA (default: false) */
  useEMA?: boolean;

  /** Minimum signal strength (0-1, default: 0.5) */
  minStrength?: number;
}

/**
 * Generate trading signal based on moving average crossover
 * @param symbol Trading symbol
 * @param candles Historical candles (must include enough data for slow MA)
 * @param config Strategy configuration
 * @returns Trading signal and supporting data
 */
export function generateSignal(
  symbol: string,
  candles: NormalizedCandle[],
  config: StrategyConfig
): SignalResult | null {
  const { fastPeriod, slowPeriod, useEMA = false } = config;

  // Validate we have enough data
  const requiredCandles = Math.max(fastPeriod, slowPeriod) + 1;
  if (candles.length < requiredCandles) {
    logger.warn(`Insufficient candles for signal generation`, {
      symbol,
      available: candles.length,
      required: requiredCandles,
    });
    return null;
  }

  // Sort candles by timestamp (oldest to newest)
  const sortedCandles = [...candles].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
  );

  // Calculate moving averages
  const { fastMA, slowMA } = calculateMovingAverages(
    sortedCandles,
    fastPeriod,
    slowPeriod,
    useEMA
  );

  // Detect crossover
  const crossover = detectCrossover(fastMA, slowMA);

  // Get latest values
  const latestCandle = sortedCandles[sortedCandles.length - 1];
  const currentPrice = latestCandle.close;
  const currentFastMA = fastMA[fastMA.length - 1];
  const currentSlowMA = slowMA[slowMA.length - 1];

  // Determine signal type
  let signalType: SignalType = 'hold';
  let reason = 'No crossover detected';
  let strength = 0;

  if (crossover === 'bullish') {
    signalType = 'buy';
    reason = `Fast MA (${fastPeriod}) crossed above slow MA (${slowPeriod})`;
    // Calculate strength based on separation between MAs
    strength = Math.min(
      Math.abs(currentFastMA - currentSlowMA) / currentSlowMA,
      1
    );
  } else if (crossover === 'bearish') {
    signalType = 'sell';
    reason = `Fast MA (${fastPeriod}) crossed below slow MA (${slowPeriod})`;
    strength = Math.min(
      Math.abs(currentFastMA - currentSlowMA) / currentSlowMA,
      1
    );
  }

  // Create signal
  const signal: Signal = {
    symbol,
    type: signalType,
    timestamp: formatDate(new Date()),
    strategy: 'moving_average_crossover',
    strength,
    price: currentPrice,
    indicators: {
      fastMA: currentFastMA,
      slowMA: currentSlowMA,
    },
    reason,
    metadata: {
      fastPeriod,
      slowPeriod,
      useEMA,
      crossoverType: crossover,
      candleCount: candles.length,
    },
  };

  // Log signal generation
  if (signalType !== 'hold') {
    logger.signal(symbol, signalType, currentPrice, reason);
  } else {
    logger.debug(`No signal for ${symbol}`, { symbol, reason });
  }

  return {
    signal,
    candles: sortedCandles.map((c) => ({
      timestamp: c.timestamp,
      close: c.close,
    })),
    fastMA,
    slowMA,
  };
}

/**
 * Generate signals for multiple symbols
 * @param symbols Array of trading symbols
 * @param candleMap Map of symbol to candles
 * @param config Strategy configuration
 * @returns Array of generated signals
 */
export function generateMultipleSignals(
  symbols: string[],
  candleMap: Map<string, NormalizedCandle[]>,
  config: StrategyConfig
): SignalResult[] {
  const signals: SignalResult[] = [];

  for (const symbol of symbols) {
    const candles = candleMap.get(symbol);
    if (!candles || candles.length === 0) {
      logger.warn(`No candles found for ${symbol}`);
      continue;
    }

    try {
      const result = generateSignal(symbol, candles, config);
      if (result) {
        signals.push(result);
      }
    } catch (error) {
      logger.error(`Failed to generate signal for ${symbol}`, {
        symbol,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  logger.info(`Generated ${signals.length} signals for ${symbols.length} symbols`, {
    totalSymbols: symbols.length,
    signalsGenerated: signals.length,
  });

  return signals;
}

/**
 * Filter signals by type
 * @param signals Array of signal results
 * @param types Signal types to include
 * @returns Filtered signals
 */
export function filterSignalsByType(
  signals: SignalResult[],
  types: SignalType[]
): SignalResult[] {
  return signals.filter((result) => types.includes(result.signal.type));
}

/**
 * Get actionable signals (buy/sell only, excluding hold)
 * @param signals Array of signal results
 * @returns Actionable signals only
 */
export function getActionableSignals(signals: SignalResult[]): SignalResult[] {
  return filterSignalsByType(signals, ['buy', 'sell']);
}

/**
 * Validate signal strength against minimum threshold
 * @param signal Signal result
 * @param minStrength Minimum strength threshold (0-1)
 * @returns True if signal meets threshold
 */
export function meetsStrengthThreshold(
  signal: SignalResult,
  minStrength: number = 0.5
): boolean {
  const strength = signal.signal.strength || 0;
  return strength >= minStrength;
}

/**
 * Filter signals by strength
 * @param signals Array of signal results
 * @param minStrength Minimum strength threshold
 * @returns Strong signals only
 */
export function filterByStrength(
  signals: SignalResult[],
  minStrength: number = 0.5
): SignalResult[] {
  return signals.filter((signal) => meetsStrengthThreshold(signal, minStrength));
}
