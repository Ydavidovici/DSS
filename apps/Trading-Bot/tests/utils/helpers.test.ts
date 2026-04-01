import {describe, test, expect} from "bun:test";
import {
    formatDate,
    parseDate,
    formatCurrency,
    formatPercent,
    round,
    percentChange,
    parseList,
    generateId,
    sleep,
} from "../../src/utils/helpers";

describe("Utility Helpers", () => {
    describe("formatDate", () => {
        test("should format Date object to ISO string", () => {
            const targetDate = new Date("2024-01-15T12:30:00Z");
            const formattedDateString = formatDate(targetDate);

            expect(formattedDateString).toBe("2024-01-15T12:30:00.000Z");
        });

        test("should pass through string dates", () => {
            const dateString = "2024-01-15T12:30:00Z";
            const formattedDateString = formatDate(dateString);

            expect(formattedDateString).toBe(dateString);
        });

        test("should convert timestamp to ISO string", () => {
            const timestampValue = 1705324200000;
            const formattedDateString = formatDate(timestampValue);

            expect(formattedDateString).toContain("2024-01-15");
        });
    });

    describe("parseDate", () => {
        test("should parse ISO string to Date", () => {
            const dateString = "2024-01-15T12:30:00Z";
            const parsedDate = parseDate(dateString);

            expect(parsedDate).toBeInstanceOf(Date);
            expect(parsedDate.toISOString()).toBe("2024-01-15T12:30:00.000Z");
        });

        test("should pass through Date objects", () => {
            const targetDate = new Date("2024-01-15T12:30:00Z");
            const parsedDate = parseDate(targetDate);

            expect(parsedDate).toBe(targetDate);
        });

        test("should convert timestamp to Date", () => {
            const timestampValue = 1705324200000;
            const parsedDate = parseDate(timestampValue);

            expect(parsedDate).toBeInstanceOf(Date);
            expect(parsedDate.getTime()).toBe(timestampValue);
        });
    });

    describe("formatCurrency", () => {
        test("should format number as USD currency", () => {
            expect(formatCurrency(1234.56)).toBe("$1,234.56");
            expect(formatCurrency(0.99)).toBe("$0.99");
            expect(formatCurrency(1000000)).toBe("$1,000,000.00");
        });

        test("should handle negative values", () => {
            expect(formatCurrency(-123.45)).toBe("-$123.45");
        });

        test("should round to 2 decimal places", () => {
            expect(formatCurrency(123.456)).toBe("$123.46");
            expect(formatCurrency(123.454)).toBe("$123.45");
        });
    });

    describe("formatPercent", () => {
        test("should format number as percentage", () => {
            expect(formatPercent(50)).toBe("50.00%");
            expect(formatPercent(0.5)).toBe("0.50%");
            expect(formatPercent(100)).toBe("100.00%");
        });

        test("should handle negative percentages", () => {
            expect(formatPercent(-25)).toBe("-25.00%");
        });

        test("should round to 2 decimal places", () => {
            expect(formatPercent(12.345)).toBe("12.35%");
        });
    });

    describe("round", () => {
        test("should round to specified decimal places", () => {
            expect(round(123.456, 2)).toBe(123.46);
            expect(round(123.456, 1)).toBe(123.5);
            expect(round(123.456, 0)).toBe(123);
        });

        test("should default to 2 decimal places", () => {
            expect(round(123.456)).toBe(123.46);
        });

        test("should handle negative numbers", () => {
            expect(round(-123.456, 2)).toBe(-123.46);
        });
    });

    describe("percentChange", () => {
        test("should calculate percentage change", () => {
            expect(percentChange(100, 110)).toBe(10);
            expect(percentChange(100, 90)).toBe(-10);
            expect(percentChange(50, 100)).toBe(100);
        });

        test("should return 0 when old value is 0", () => {
            expect(percentChange(0, 100)).toBe(0);
        });

        test("should handle same values", () => {
            expect(percentChange(100, 100)).toBe(0);
        });

        test("should handle negative values", () => {
            expect(percentChange(-100, -50)).toBe(-50);
        });
    });

    describe("parseList", () => {
        test("should parse comma-separated string to array", () => {
            expect(parseList("AAPL,SPY,TSLA")).toEqual(["AAPL", "SPY", "TSLA"]);
        });

        test("should trim whitespace", () => {
            expect(parseList("AAPL, SPY , TSLA")).toEqual(["AAPL", "SPY", "TSLA"]);
        });

        test("should filter empty items", () => {
            expect(parseList("AAPL,,SPY")).toEqual(["AAPL", "SPY"]);
            expect(parseList("AAPL, , SPY")).toEqual(["AAPL", "SPY"]);
        });

        test("should handle single item", () => {
            expect(parseList("AAPL")).toEqual(["AAPL"]);
        });

        test("should handle empty string", () => {
            expect(parseList("")).toEqual([]);
        });
    });

    describe("generateId", () => {
        test("should generate unique IDs", () => {
            const firstIdentifier = generateId();
            const secondIdentifier = generateId();

            expect(firstIdentifier).not.toBe(secondIdentifier);
        });

        test("should generate IDs in expected format", () => {
            const generatedIdentifier = generateId();

            expect(generatedIdentifier).toContain("-");
            expect(generatedIdentifier.split("-")).toHaveLength(2);
        });

        test("should generate timestamp-based IDs", () => {
            const timeBeforeGeneration = Date.now();
            const generatedIdentifier = generateId();
            const timeAfterGeneration = Date.now();

            const extractedTimestamp = parseInt(generatedIdentifier.split("-")[0]);

            expect(extractedTimestamp).toBeGreaterThanOrEqual(timeBeforeGeneration);
            expect(extractedTimestamp).toBeLessThanOrEqual(timeAfterGeneration);
        });
    });

    describe("sleep", () => {
        test("should resolve after specified milliseconds", async () => {
            const timeBeforeSleep = Date.now();
            await sleep(50);
            const timeAfterSleep = Date.now();

            const elapsedMilliseconds = timeAfterSleep - timeBeforeSleep;
            expect(elapsedMilliseconds).toBeGreaterThanOrEqual(45);
        });
    });
});