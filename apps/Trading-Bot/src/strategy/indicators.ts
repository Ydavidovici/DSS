import type {NormalizedCandle} from "../types/candle";
import {logger} from "../utils/logger";

/**
 * Calculate Simple Moving Average (SMA)
 * @param values Array of values (typically closing prices)
 * @param period Number of periods to average
 * @returns Array of SMA values (shorter than input by period-1)
 */
export function calculateSMA(values: number[], period: number): number[] {
    if (values.length < period) {
        logger.warn("Insufficient data for SMA calculation", {
            dataLength: values.length,
            period,
        });
        return [];
    }

    const sma: number[] = [];

    let sum = 0;
    for (let i = 0; i < period; i++) {
        sum += values[i];
    }
    sma.push(sum / period);

    for (let i = period; i < values.length; i++) {
        sum = sum - values[i - period] + values[i];
        sma.push(sum / period);
    }

    return sma;
}

/**
 * Calculate Exponential Moving Average (EMA)
 * @param values Array of values (typically closing prices)
 * @param period Number of periods for EMA
 * @returns Array of EMA values (length = values.length - period + 1)
 */
export function calculateEMA(values: number[], period: number): number[] {
    if (values.length < period) {
        logger.warn("Insufficient data for EMA calculation", {
            dataLength: values.length,
            period,
        });
        return [];
    }

    const ema: number[] = [];
    const multiplier = 2 / (period + 1);

    const firstSMA = values.slice(0, period).reduce((accumulator, currentValue) => accumulator + currentValue, 0) / period;
    ema.push(firstSMA);

    for (let i = period; i < values.length; i++) {
        const emaValue = (values[i] - ema[ema.length - 1]) * multiplier + ema[ema.length - 1];
        ema.push(emaValue);
    }

    return ema;
}

/**
 * Extract closing prices from candles
 * @param candles Array of candles
 * @returns Array of closing prices
 */
export function extractClosePrices(candles: NormalizedCandle[]): number[] {
    return candles.map((candle) => candle.close);
}

/**
 * Calculate multiple moving averages for candles
 * @param candles Array of candles
 * @param fastPeriod Fast MA period
 * @param slowPeriod Slow MA period
 * @param useEMA Use EMA instead of SMA
 * @returns Object containing both MA arrays
 */
export function calculateMovingAverages(
    candles: NormalizedCandle[],
    fastPeriod: number,
    slowPeriod: number,
    useEMA: boolean = false,
): {fastMA: number[]; slowMA: number[]} {
    const closePrices = extractClosePrices(candles);

    const calculateMA = useEMA ? calculateEMA : calculateSMA;

    const fastMA = calculateMA(closePrices, fastPeriod);
    const slowMA = calculateMA(closePrices, slowPeriod);

    logger.debug("Calculated moving averages", {
        fastPeriod,
        slowPeriod,
        useEMA,
        fastMALength: fastMA.length,
        slowMALength: slowMA.length,
    });

    return {fastMA, slowMA};
}

/**
 * Detect crossover between two moving averages
 * @param fastMA Fast moving average array
 * @param slowMA Slow moving average array
 * @returns 'bullish' (fast crosses above slow), 'bearish' (fast crosses below slow), or null
 */
export function detectCrossover(
    fastMA: number[],
    slowMA: number[],
): "bullish" | "bearish" | null {
    if (fastMA.length < 2 || slowMA.length < 2) {
        return null;
    }

    const currentFast = fastMA[fastMA.length - 1];
    const previousFast = fastMA[fastMA.length - 2];
    const currentSlow = slowMA[slowMA.length - 1];
    const previousSlow = slowMA[slowMA.length - 2];

    if (previousFast <= previousSlow && currentFast > currentSlow) {
        logger.debug("Bullish crossover detected", {
            previousFast,
            currentFast,
            previousSlow,
            currentSlow,
        });
        return "bullish";
    }

    if (previousFast >= previousSlow && currentFast < currentSlow) {
        logger.debug("Bearish crossover detected", {
            previousFast,
            currentFast,
            previousSlow,
            currentSlow,
        });
        return "bearish";
    }

    return null;
}

/**
 * Calculate Relative Strength Index (RSI)
 * @param values Price values
 * @param period RSI period
 * @returns Array of RSI values (0-100)
 * @todo Implement RSI calculation for future strategies
 */
export function calculateRSI(values: number[], period: number = 14): number[] {
    logger.warn("RSI calculation not yet implemented");
    return [];
}

/**
 * Calculate Bollinger Bands
 * @param values Price values
 * @param period Period for bands
 * @param standardDeviations Number of standard deviations
 * @returns Object with upper, middle, and lower band arrays
 * @todo Implement Bollinger Bands for future strategies
 */
export function calculateBollingerBands(
    values: number[],
    period: number = 20,
    standardDeviations: number = 2,
): {upper: number[]; middle: number[]; lower: number[]} {
    logger.warn("Bollinger Bands calculation not yet implemented");
    return {upper: [], middle: [], lower: []};
}

/**
 * Calculate MACD (Moving Average Convergence Divergence)
 * @param values Price values
 * @param fastPeriod Fast EMA period (typically 12)
 * @param slowPeriod Slow EMA period (typically 26)
 * @param signalPeriod Signal line period (typically 9)
 * @returns Object with macd, signal, and histogram arrays
 * @todo Implement MACD for future strategies
 */
export function calculateMACD(
    values: number[],
    fastPeriod: number = 12,
    slowPeriod: number = 26,
    signalPeriod: number = 9,
): {macd: number[]; signal: number[]; histogram: number[]} {
    logger.warn("MACD calculation not yet implemented");
    return {macd: [], signal: [], histogram: []};
}
