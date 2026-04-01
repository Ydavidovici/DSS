import {describe, test, expect} from "bun:test";
import {
    generateMockCandles,
    assertArraysApproxEqual,
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
    });

    describe("assertArraysApproxEqual", () => {
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
});