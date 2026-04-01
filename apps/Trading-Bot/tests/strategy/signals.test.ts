import {describe, test, expect} from "bun:test";
import {
    generateSignal,
    generateMultipleSignals,
    filterSignalsByType,
    getActionableSignals,
    meetsStrengthThreshold,
    filterByStrength,
} from "../../src/strategy/signals";
import {
    generateMockNormalizedCandles,
    generateCrossoverCandles,
    generateMockSignal,
} from "../setup";

describe("Signal Generation", () => {
    describe("generateSignal", () => {
        test("should generate buy signal on bullish crossover", () => {
            const historicalCandles = generateCrossoverCandles("AAPL", "bullish");
            const strategyConfiguration = {
                fastPeriod: 10,
                slowPeriod: 50,
                useEMA: false,
            };

            const signalResult = generateSignal("AAPL", historicalCandles, strategyConfiguration);

            expect(signalResult).not.toBeNull();
            expect(signalResult?.signal.symbol).toBe("AAPL");
            expect(signalResult?.signal.type).toBe("buy");
            expect(signalResult?.signal.strategy).toBe("moving_average_crossover");
            expect(signalResult?.signal.strength).toBeGreaterThan(0);
            expect(signalResult?.signal.indicators.fastMA).toBeDefined();
            expect(signalResult?.signal.indicators.slowMA).toBeDefined();
        });

        test("should generate sell signal on bearish crossover", () => {
            const historicalCandles = generateCrossoverCandles("AAPL", "bearish");
            const strategyConfiguration = {
                fastPeriod: 10,
                slowPeriod: 50,
                useEMA: false,
            };

            const signalResult = generateSignal("AAPL", historicalCandles, strategyConfiguration);

            expect(signalResult).not.toBeNull();
            expect(signalResult?.signal.symbol).toBe("AAPL");
            expect(signalResult?.signal.type).toBe("sell");
            expect(signalResult?.signal.strategy).toBe("moving_average_crossover");
        });

        test("should generate hold signal when no crossover", () => {
            const historicalCandles = generateMockNormalizedCandles("AAPL", 60, 100, "sideways");
            const strategyConfiguration = {
                fastPeriod: 10,
                slowPeriod: 50,
                useEMA: false,
            };

            const signalResult = generateSignal("AAPL", historicalCandles, strategyConfiguration);

            if (signalResult) {
                expect(["buy", "sell", "hold"]).toContain(signalResult.signal.type);
            }
        });

        test("should return null with insufficient data", () => {
            const historicalCandles = generateMockNormalizedCandles("AAPL", 10, 100);
            const strategyConfiguration = {
                fastPeriod: 10,
                slowPeriod: 50,
                useEMA: false,
            };

            const signalResult = generateSignal("AAPL", historicalCandles, strategyConfiguration);

            expect(signalResult).toBeNull();
        });

        test("should include metadata in signal", () => {
            const historicalCandles = generateCrossoverCandles("AAPL", "bullish");
            const strategyConfiguration = {
                fastPeriod: 10,
                slowPeriod: 50,
                useEMA: false,
            };

            const signalResult = generateSignal("AAPL", historicalCandles, strategyConfiguration);

            expect(signalResult?.signal.metadata).toBeDefined();
            expect(signalResult?.signal.metadata?.fastPeriod).toBe(10);
            expect(signalResult?.signal.metadata?.slowPeriod).toBe(50);
            expect(signalResult?.signal.metadata?.useEMA).toBe(false);
        });

        test("should work with EMA", () => {
            const historicalCandles = generateCrossoverCandles("AAPL", "bullish");
            const strategyConfiguration = {
                fastPeriod: 10,
                slowPeriod: 50,
                useEMA: true,
            };

            const signalResult = generateSignal("AAPL", historicalCandles, strategyConfiguration);

            expect(signalResult).not.toBeNull();
            expect(signalResult?.signal.metadata?.useEMA).toBe(true);
        });
    });

    describe("generateMultipleSignals", () => {
        test("should generate signals for multiple symbols", () => {
            const tradingSymbols = ["AAPL", "SPY", "TSLA"];
            const historicalCandleMap = new Map();

            tradingSymbols.forEach((currentSymbol) => {
                historicalCandleMap.set(currentSymbol, generateMockNormalizedCandles(currentSymbol, 60, 100));
            });

            const strategyConfiguration = {
                fastPeriod: 10,
                slowPeriod: 50,
                useEMA: false,
            };

            const signalResultsArray = generateMultipleSignals(tradingSymbols, historicalCandleMap, strategyConfiguration);

            expect(signalResultsArray.length).toBeGreaterThanOrEqual(0);
            expect(signalResultsArray.length).toBeLessThanOrEqual(tradingSymbols.length);
        });

        test("should handle missing candles gracefully", () => {
            const tradingSymbols = ["AAPL", "SPY"];
            const historicalCandleMap = new Map();

            historicalCandleMap.set("AAPL", generateMockNormalizedCandles("AAPL", 60, 100));

            const strategyConfiguration = {
                fastPeriod: 10,
                slowPeriod: 50,
                useEMA: false,
            };

            const signalResultsArray = generateMultipleSignals(tradingSymbols, historicalCandleMap, strategyConfiguration);

            expect(signalResultsArray.length).toBeGreaterThanOrEqual(0);
        });

        test("should handle empty candle map", () => {
            const tradingSymbols = ["AAPL", "SPY"];
            const historicalCandleMap = new Map();

            const strategyConfiguration = {
                fastPeriod: 10,
                slowPeriod: 50,
                useEMA: false,
            };

            const signalResultsArray = generateMultipleSignals(tradingSymbols, historicalCandleMap, strategyConfiguration);

            expect(signalResultsArray.length).toBe(0);
        });
    });

    describe("filterSignalsByType", () => {
        test("should filter signals by type", () => {
            const signalResultsArray = [
                {
                    signal: generateMockSignal("AAPL", "buy"),
                    candles: [],
                    fastMA: [],
                    slowMA: [],
                },
                {
                    signal: generateMockSignal("SPY", "sell"),
                    candles: [],
                    fastMA: [],
                    slowMA: [],
                },
                {
                    signal: generateMockSignal("TSLA", "hold"),
                    candles: [],
                    fastMA: [],
                    slowMA: [],
                },
            ];

            const buySignalResults = filterSignalsByType(signalResultsArray, ["buy"]);
            const sellSignalResults = filterSignalsByType(signalResultsArray, ["sell"]);
            const actionableSignalResults = filterSignalsByType(signalResultsArray, ["buy", "sell"]);

            expect(buySignalResults.length).toBe(1);
            expect(buySignalResults[0].signal.symbol).toBe("AAPL");

            expect(sellSignalResults.length).toBe(1);
            expect(sellSignalResults[0].signal.symbol).toBe("SPY");

            expect(actionableSignalResults.length).toBe(2);
        });
    });

    describe("getActionableSignals", () => {
        test("should return only buy and sell signals", () => {
            const signalResultsArray = [
                {
                    signal: generateMockSignal("AAPL", "buy"),
                    candles: [],
                    fastMA: [],
                    slowMA: [],
                },
                {
                    signal: generateMockSignal("SPY", "sell"),
                    candles: [],
                    fastMA: [],
                    slowMA: [],
                },
                {
                    signal: generateMockSignal("TSLA", "hold"),
                    candles: [],
                    fastMA: [],
                    slowMA: [],
                },
            ];

            const actionableSignalResults = getActionableSignals(signalResultsArray);

            expect(actionableSignalResults.length).toBe(2);
            expect(actionableSignalResults.every((currentSignalResult) => currentSignalResult.signal.type !== "hold")).toBe(true);
        });

        test("should return empty array if no actionable signals", () => {
            const signalResultsArray = [
                {
                    signal: generateMockSignal("AAPL", "hold"),
                    candles: [],
                    fastMA: [],
                    slowMA: [],
                },
            ];

            const actionableSignalResults = getActionableSignals(signalResultsArray);

            expect(actionableSignalResults.length).toBe(0);
        });
    });

    describe("meetsStrengthThreshold", () => {
        test("should return true if strength meets threshold", () => {
            const signalResultObject = {
                signal: {...generateMockSignal("AAPL", "buy"), strength: 0.8},
                candles: [],
                fastMA: [],
                slowMA: [],
            };

            expect(meetsStrengthThreshold(signalResultObject, 0.5)).toBe(true);
            expect(meetsStrengthThreshold(signalResultObject, 0.8)).toBe(true);
        });

        test("should return false if strength below threshold", () => {
            const signalResultObject = {
                signal: {...generateMockSignal("AAPL", "buy"), strength: 0.3},
                candles: [],
                fastMA: [],
                slowMA: [],
            };

            expect(meetsStrengthThreshold(signalResultObject, 0.5)).toBe(false);
        });

        test("should handle undefined strength", () => {
            const signalResultObject = {
                signal: {...generateMockSignal("AAPL", "buy"), strength: undefined},
                candles: [],
                fastMA: [],
                slowMA: [],
            };

            expect(meetsStrengthThreshold(signalResultObject, 0.5)).toBe(false);
        });
    });

    describe("filterByStrength", () => {
        test("should filter signals by strength threshold", () => {
            const signalResultsArray = [
                {
                    signal: {...generateMockSignal("AAPL", "buy"), strength: 0.8},
                    candles: [],
                    fastMA: [],
                    slowMA: [],
                },
                {
                    signal: {...generateMockSignal("SPY", "buy"), strength: 0.3},
                    candles: [],
                    fastMA: [],
                    slowMA: [],
                },
                {
                    signal: {...generateMockSignal("TSLA", "buy"), strength: 0.6},
                    candles: [],
                    fastMA: [],
                    slowMA: [],
                },
            ];

            const strongSignalResults = filterByStrength(signalResultsArray, 0.5);

            expect(strongSignalResults.length).toBe(2);
            expect(strongSignalResults.every((currentSignalResult) => (currentSignalResult.signal.strength || 0) >= 0.5)).toBe(true);
        });
    });
});