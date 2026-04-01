import type {NormalizedCandle} from "../types/candle";
import type {Signal, SignalType, SignalResult} from "../types/signal";
import {
    calculateMovingAverages,
    detectCrossover,
    extractClosePrices,
} from "./indicators";
import {logger} from "../utils/logger";
import {formatDate} from "../utils/helpers";

export interface StrategyConfig {
    fastPeriod: number;
    slowPeriod: number;
    useEMA?: boolean;
    minStrength?: number;
}

/**
 * Calculate signal strength based on MA separation
 * @param fastMA Current fast MA value
 * @param slowMA Current slow MA value
 * @returns Strength value between 0 and 1
 */
function calculateSignalStrength(fastMA: number, slowMA: number): number {
    if (slowMA === 0) {
        logger.warn("Slow MA is zero, cannot calculate signal strength");
        return 0;
    }

    return Math.min(Math.abs(fastMA - slowMA) / slowMA, 1);
}

/**
 * Generate trading signal based on moving average crossover
 * @param symbol Trading symbol
 * @param candles Historical candles (must be sorted oldest to newest and have enough data for slow MA)
 * @param config Strategy configuration
 * @returns Trading signal and supporting data
 */
export function generateSignal(
    symbol: string,
    candles: NormalizedCandle[],
    config: StrategyConfig,
): SignalResult | null {
    const {fastPeriod, slowPeriod, useEMA = false} = config;

    const requiredCandles = Math.max(fastPeriod, slowPeriod) + 1;
    if (candles.length < requiredCandles) {
        logger.warn(`Insufficient candles for signal generation`, {
            symbol,
            available: candles.length,
            required: requiredCandles,
        });
        return null;
    }

    const {fastMA, slowMA} = calculateMovingAverages(
        candles,
        fastPeriod,
        slowPeriod,
        useEMA,
    );

    const crossover = detectCrossover(fastMA, slowMA);

    const latestCandle = candles[candles.length - 1];
    const currentPrice = latestCandle.close;
    const currentFastMA = fastMA[fastMA.length - 1];
    const currentSlowMA = slowMA[slowMA.length - 1];

    let signalType: SignalType = "hold";
    let reason = "No crossover detected";
    let strength = 0;

    if (crossover === "bullish") {
        signalType = "buy";
        reason = `Fast MA (${fastPeriod}) crossed above slow MA (${slowPeriod})`;
        strength = calculateSignalStrength(currentFastMA, currentSlowMA);
    } else if (crossover === "bearish") {
        signalType = "sell";
        reason = `Fast MA (${fastPeriod}) crossed below slow MA (${slowPeriod})`;
        strength = calculateSignalStrength(currentFastMA, currentSlowMA);
    }

    const signal: Signal = {
        symbol,
        type: signalType,
        timestamp: formatDate(new Date()),
        strategy: "moving_average_crossover",
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

    if (signalType !== "hold") {
        logger.signal(symbol, signalType, currentPrice, reason);
    } else {
        logger.debug(`No signal for ${symbol}`, {symbol, reason});
    }

    return {
        signal,
        candles: candles.map((candle) => ({
            timestamp: candle.timestamp,
            close: candle.close,
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
    config: StrategyConfig,
): SignalResult[] {
    const signals: SignalResult[] = [];

    for (const symbol of symbols) {
        const candles = candleMap.get(symbol);
        if (!candles || candles.length === 0) {
            logger.warn(`No candles found for ${symbol}`);
            continue;
        }

        try {
            // Sort candles before processing
            const sortedCandles = [...candles].sort(
                (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
            );

            const result = generateSignal(symbol, sortedCandles, config);
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
    types: SignalType[],
): SignalResult[] {
    return signals.filter((result) => types.includes(result.signal.type));
}

/**
 * Get actionable signals (buy/sell only, excluding hold)
 * @param signals Array of signal results
 * @returns Actionable signals only
 */
export function getActionableSignals(signals: SignalResult[]): SignalResult[] {
    return filterSignalsByType(signals, ["buy", "sell"]);
}

/**
 * Validate signal strength against minimum threshold
 * @param signal Signal result
 * @param minStrength Minimum strength threshold (0-1)
 * @returns True if signal meets threshold
 */
export function meetsStrengthThreshold(
    signal: SignalResult,
    minStrength: number = 0.5,
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
    minStrength: number = 0.5,
): SignalResult[] {
    return signals.filter((signal) => meetsStrengthThreshold(signal, minStrength));
}
