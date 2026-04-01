import {describe, test, expect, beforeEach, afterEach} from "bun:test";
import {
    generateMockCandles,
    generateMockNormalizedCandles,
    generateCrossoverCandles,
    generateMockSignal,
    generateMockTrade,
    setupTestEnvironment,
    cleanupTestEnvironment,
    assertArraysApproxEqual,
    round,
} from "./setup";

describe("Test Setup Utilities", () => {
    describe("generateMockCandles", () => {
        test("should generate upward trending candles", () => {
            const upwardTrendingCandles = generateMockCandles("AAPL", 10, 100, "up");

            expect(upwardTrendingCandles.length).toBe(10);
            expect(upwardTrendingCandles[9].close).toBeGreaterThan(100);
        });

        test("should generate downward trending candles", () => {
            const downwardTrendingCandles = generateMockCandles("AAPL", 10, 100, "down");

            expect(downwardTrendingCandles.length).toBe(10);
            expect(downwardTrendingCandles[9].close).toBeLessThan(100);
        });

        test("should generate sideways trending candles", () => {
            const sidewaysCandles = generateMockCandles("AAPL", 10, 100, "sideways");

            expect(sidewaysCandles.length).toBe(10);
            expect(sidewaysCandles[0].symbol).toBe("AAPL");
            expect(typeof sidewaysCandles[0].timestamp).toBe("string");
        });
    });

    describe("generateMockNormalizedCandles", () => {
        test("should return candles with Date objects", () => {
            const normalized = generateMockNormalizedCandles("AAPL", 5);

            expect(normalized.length).toBe(5);
            expect(normalized[0].timestamp).toBeInstanceOf(Date);
        });
    });

    describe("generateCrossoverCandles", () => {
        test("should generate bullish crossover", () => {
            const candles = generateCrossoverCandles("AAPL", "bullish");

            expect(candles.length).toBe(60);
            expect(candles[58].close).toBe(100);
            expect(candles[59].close).toBe(110);
        });

        test("should generate bearish crossover", () => {
            const candles = generateCrossoverCandles("AAPL", "bearish");

            expect(candles.length).toBe(60);
            expect(candles[58].close).toBe(100);
            expect(candles[59].close).toBe(90);
        });
    });

    describe("generateMockSignal", () => {
        test("should generate default buy signal", () => {
            const signal = generateMockSignal();

            expect(signal.type).toBe("buy");
            expect(signal.indicators?.fastMA).toBeGreaterThan(signal.indicators?.slowMA as number);
        });

        test("should generate sell signal", () => {
            const signal = generateMockSignal("TSLA", "sell");

            expect(signal.symbol).toBe("TSLA");
            expect(signal.type).toBe("sell");
            expect(signal.indicators?.fastMA).toBeLessThan(signal.indicators?.slowMA as number);
        });
    });

    describe("generateMockTrade", () => {
        test("should generate default buy trade", () => {
            const trade = generateMockTrade();

            expect(trade.side).toBe("buy");
            expect(trade.symbol).toBe("AAPL");
        });

        test("should generate sell trade", () => {
            const trade = generateMockTrade("TSLA", "sell");

            expect(trade.side).toBe("sell");
            expect(trade.symbol).toBe("TSLA");
        });
    });

    describe("Environment Setup and Cleanup", () => {
        const originalEnv = process.env;

        beforeEach(() => {
            process.env = {...originalEnv};
        });

        afterEach(() => {
            process.env = {...originalEnv};
        });

        test("should set required environment variables", () => {
            setupTestEnvironment();

            expect(process.env["APCA_API_KEY"]).toBe("test-key");
            expect(process.env["LOG_LEVEL"]).toBe("error");
            expect(process.env["SYMBOLS"]).toBe("AAPL,SPY");
        });

        test("should clean up environment variables", () => {
            setupTestEnvironment();
            cleanupTestEnvironment();

            expect(process.env["APCA_API_KEY"]).toBeUndefined();
            expect(process.env["LOG_LEVEL"]).toBeUndefined();
            expect(process.env["SYMBOLS"]).toBeUndefined();
        });
    });

    describe("assertArraysApproxEqual", () => {
        test("should pass when arrays are within tolerance limits", () => {
            const firstArray = [1.0, 2.0];
            const secondArray = [1.005, 1.995];

            expect(() => assertArraysApproxEqual(firstArray, secondArray, 0.01)).not.toThrow();
        });

        test("should throw error when array lengths differ", () => {
            const firstArray = [1, 2];
            const secondArray = [1];

            expect(() => assertArraysApproxEqual(firstArray, secondArray)).toThrow("Array lengths differ: actual=2, expected=1");
        });

        test("should throw error when values exceed tolerance limit", () => {
            const firstArray = [1.0];
            const secondArray = [2.0];
            const toleranceLimit = 0.1;

            expect(() => assertArraysApproxEqual(firstArray, secondArray, toleranceLimit)).toThrow();
        });
    });

    describe("round", () => {
        test("should round numbers to correct decimal places", () => {
            expect(round(1.234)).toBe(1.23);
            expect(round(1.235)).toBe(1.24);
            expect(round(1.23456, 4)).toBe(1.2346);
        });
    });
});