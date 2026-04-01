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
    retry,
    isMarketOpen,
    safeJsonParse,
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

    describe("retry", () => {
        test("should resolve immediately if function succeeds", async () => {
            let attemptCount = 0;
            const successFn = async () => {
                attemptCount++;
                return "success";
            };

            const result = await retry(successFn, 3, 1);
            expect(result).toBe("success");
            expect(attemptCount).toBe(1);
        });

        test("should retry upon failure and eventually succeed", async () => {
            let attemptCount = 0;
            const flakyFn = async () => {
                attemptCount++;
                if (attemptCount < 3) {
                    throw new Error("Failed attempt");
                }
                return "success";
            };

            const result = await retry(flakyFn, 4, 1);
            expect(result).toBe("success");
            expect(attemptCount).toBe(3);
        });

        test("should throw error if max retries are exceeded", async () => {
            let attemptCount = 0;
            const failingFn = async () => {
                attemptCount++;
                throw new Error("Persistent failure");
            };

            expect(retry(failingFn, 3, 1)).rejects.toThrow("Persistent failure");

            // Wait a tick to ensure async attempts have processed
            await sleep(10);
            expect(attemptCount).toBe(3);
        });
    });

    describe("isMarketOpen", () => {
        // The implementation assumes UTC-5 for ET calculation
        // Market hours: 9:30 AM - 4:00 PM ET

        test("should return false on weekends", () => {
            // Jan 6, 2024 is a Saturday
            const saturday = new Date("2024-01-06T15:00:00Z");
            expect(isMarketOpen(saturday)).toBe(false);

            // Jan 7, 2024 is a Sunday
            const sunday = new Date("2024-01-07T15:00:00Z");
            expect(isMarketOpen(sunday)).toBe(false);
        });

        test("should return true during market hours (Mon-Fri)", () => {
            // Jan 8, 2024 is a Monday
            // 17:00 UTC = 12:00 PM ET (UTC-5)
            const midDay = new Date("2024-01-08T17:00:00Z");
            expect(isMarketOpen(midDay)).toBe(true);

            // 14:30 UTC = 9:30 AM ET
            const marketOpen = new Date("2024-01-08T14:30:00Z");
            expect(isMarketOpen(marketOpen)).toBe(true);
        });

        test("should return false outside market hours (Mon-Fri)", () => {
            // Jan 8, 2024 is a Monday
            // 14:29 UTC = 9:29 AM ET
            const preMarket = new Date("2024-01-08T14:29:00Z");
            expect(isMarketOpen(preMarket)).toBe(false);

            // 21:00 UTC = 4:00 PM ET
            const marketClosed = new Date("2024-01-08T21:00:00Z");
            expect(isMarketOpen(marketClosed)).toBe(false);

            // 22:00 UTC = 5:00 PM ET
            const postMarket = new Date("2024-01-08T22:00:00Z");
            expect(isMarketOpen(postMarket)).toBe(false);
        });
    });

    describe("safeJsonParse", () => {
        test("should successfully parse valid JSON", () => {
            const validJson = "{\"symbol\": \"AAPL\", \"price\": 150}";
            const fallback = {symbol: "UNKNOWN", price: 0};

            const result = safeJsonParse(validJson, fallback);
            expect(result).toEqual({symbol: "AAPL", price: 150});
        });

        test("should return fallback object on invalid JSON", () => {
            const invalidJson = "{\"symbol\": \"AAPL\", price: 150";
            const fallback = {symbol: "UNKNOWN", price: 0};

            const result = safeJsonParse(invalidJson, fallback);
            expect(result).toBe(fallback);
        });

        test("should return fallback primitive on invalid JSON", () => {
            const invalidJson = "undefined";
            const fallback = [];

            const result = safeJsonParse(invalidJson, fallback);
            expect(result).toBe(fallback);
        });
    });
});