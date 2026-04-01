import {describe, test, expect} from "bun:test";
import {
    calculateSMA,
    calculateEMA,
    extractClosePrices,
    calculateMovingAverages,
    detectCrossover,
    calculateRSI,
    calculateBollingerBands,
    calculateMACD,
} from "../../src/strategy/indicators";
import {
    generateMockNormalizedCandles,
    generateCrossoverCandles,
    assertArraysApproxEqual,
    round,
} from "../setup";

describe("Technical Indicators", () => {
    describe("calculateSMA", () => {
        test("should calculate simple moving average correctly", () => {
            const priceValues = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
            const movingAveragePeriod = 3;

            const simpleMovingAverageArray = calculateSMA(priceValues, movingAveragePeriod);

            expect(simpleMovingAverageArray.length).toBe(priceValues.length - movingAveragePeriod + 1);
            expect(simpleMovingAverageArray[0]).toBe(2);
            expect(simpleMovingAverageArray[1]).toBe(3);
            expect(simpleMovingAverageArray[2]).toBe(4);
            expect(simpleMovingAverageArray[simpleMovingAverageArray.length - 1]).toBe(9);
        });

        test("should return empty array if insufficient data", () => {
            const priceValues = [1, 2, 3];
            const movingAveragePeriod = 5;

            const simpleMovingAverageArray = calculateSMA(priceValues, movingAveragePeriod);

            expect(simpleMovingAverageArray.length).toBe(0);
        });

        test("should handle period of 1", () => {
            const priceValues = [1, 2, 3, 4, 5];
            const movingAveragePeriod = 1;

            const simpleMovingAverageArray = calculateSMA(priceValues, movingAveragePeriod);

            expect(simpleMovingAverageArray.length).toBe(priceValues.length);
            expect(simpleMovingAverageArray).toEqual(priceValues);
        });
    });

    describe("calculateEMA", () => {
        test("should calculate exponential moving average correctly", () => {
            const priceValues = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
            const movingAveragePeriod = 3;

            const exponentialMovingAverageArray = calculateEMA(priceValues, movingAveragePeriod);

            expect(exponentialMovingAverageArray.length).toBe(priceValues.length - movingAveragePeriod + 1);
            expect(exponentialMovingAverageArray[0]).toBe(11);

            const weightMultiplier = 2 / (movingAveragePeriod + 1);
            const expectedExponentialMovingAverage = (13 - exponentialMovingAverageArray[0]) * weightMultiplier + exponentialMovingAverageArray[0];
            expect(round(exponentialMovingAverageArray[1], 2)).toBe(round(expectedExponentialMovingAverage, 2));
        });

        test("should return empty array if insufficient data", () => {
            const priceValues = [1, 2, 3];
            const movingAveragePeriod = 5;

            const exponentialMovingAverageArray = calculateEMA(priceValues, movingAveragePeriod);

            expect(exponentialMovingAverageArray.length).toBe(0);
        });

        test("should give more weight to recent values than SMA", () => {
            const priceValues = [10, 10, 10, 10, 10, 10, 10, 20];
            const movingAveragePeriod = 5;

            const simpleMovingAverageArray = calculateSMA(priceValues, movingAveragePeriod);
            const exponentialMovingAverageArray = calculateEMA(priceValues, movingAveragePeriod);

            const lastSimpleMovingAverage = simpleMovingAverageArray[simpleMovingAverageArray.length - 1];
            const lastExponentialMovingAverage = exponentialMovingAverageArray[exponentialMovingAverageArray.length - 1];

            expect(lastExponentialMovingAverage).toBeGreaterThan(lastSimpleMovingAverage);
        });
    });

    describe("extractClosePrices", () => {
        test("should extract close prices from candles", () => {
            const historicalCandles = generateMockNormalizedCandles("AAPL", 10, 100);

            const closingPriceArray = extractClosePrices(historicalCandles);

            expect(closingPriceArray.length).toBe(10);
            closingPriceArray.forEach((priceValue, priceIndex) => {
                expect(priceValue).toBe(historicalCandles[priceIndex].close);
            });
        });

        test("should handle empty array", () => {
            const closingPriceArray = extractClosePrices([]);

            expect(closingPriceArray.length).toBe(0);
        });
    });

    describe("calculateMovingAverages", () => {
        test("should calculate both fast and slow MAs", () => {
            const historicalCandles = generateMockNormalizedCandles("AAPL", 60, 100);
            const fastPeriodLimit = 10;
            const slowPeriodLimit = 50;

            const {fastMA: fastMovingAverageArray, slowMA: slowMovingAverageArray} = calculateMovingAverages(
                historicalCandles,
                fastPeriodLimit,
                slowPeriodLimit,
                false,
            );

            expect(fastMovingAverageArray.length).toBe(historicalCandles.length - fastPeriodLimit + 1);
            expect(slowMovingAverageArray.length).toBe(historicalCandles.length - slowPeriodLimit + 1);
        });

        test("should use SMA by default", () => {
            const historicalCandles = generateMockNormalizedCandles("AAPL", 20, 100);
            const movingAveragePeriod = 5;

            const {fastMA: fastMovingAverageArray} = calculateMovingAverages(historicalCandles, movingAveragePeriod, 10, false);

            const closingPriceArray = extractClosePrices(historicalCandles);
            const expectedSimpleMovingAverage = calculateSMA(closingPriceArray, movingAveragePeriod);

            assertArraysApproxEqual(fastMovingAverageArray, expectedSimpleMovingAverage);
        });

        test("should use EMA when specified", () => {
            const historicalCandles = generateMockNormalizedCandles("AAPL", 20, 100);
            const movingAveragePeriod = 5;

            const {fastMA: fastMovingAverageArray} = calculateMovingAverages(historicalCandles, movingAveragePeriod, 10, true);

            const closingPriceArray = extractClosePrices(historicalCandles);
            const expectedExponentialMovingAverage = calculateEMA(closingPriceArray, movingAveragePeriod);

            assertArraysApproxEqual(fastMovingAverageArray, expectedExponentialMovingAverage);
        });
    });

    describe("detectCrossover", () => {
        test("should indicate bullish position when fast average definitively crosses above slow average", () => {
            const fastMovingAverageArray = [48, 49, 50, 52];
            const slowMovingAverageArray = [50, 50, 50, 50];

            const crossoverResult = detectCrossover(fastMovingAverageArray, slowMovingAverageArray);

            expect(crossoverResult).toBe("bullish");
        });

        test("should indicate bearish position when fast average definitively crosses below slow average", () => {
            const fastMovingAverageArray = [52, 51, 50, 48];
            const slowMovingAverageArray = [50, 50, 50, 50];

            const crossoverResult = detectCrossover(fastMovingAverageArray, slowMovingAverageArray);

            expect(crossoverResult).toBe("bearish");
        });

        test("should indicate hold position when fast average remains strictly above slow average", () => {
            const fastMovingAverageArray = [55, 56, 57, 58];
            const slowMovingAverageArray = [50, 50, 50, 50];

            const crossoverResult = detectCrossover(fastMovingAverageArray, slowMovingAverageArray);

            expect(crossoverResult).toBeNull();
        });

        test("should indicate hold position when fast average remains strictly below slow average", () => {
            const fastMovingAverageArray = [45, 44, 43, 42];
            const slowMovingAverageArray = [50, 50, 50, 50];

            const crossoverResult = detectCrossover(fastMovingAverageArray, slowMovingAverageArray);

            expect(crossoverResult).toBeNull();
        });

        test("should indicate hold position when fast average approaches slow average but bounces upward without crossing", () => {
            const fastMovingAverageArray = [55, 52, 51, 54];
            const slowMovingAverageArray = [50, 50, 50, 50];

            const crossoverResult = detectCrossover(fastMovingAverageArray, slowMovingAverageArray);

            expect(crossoverResult).toBeNull();
        });

        test("should indicate hold position when fast average approaches slow average but bounces downward without crossing", () => {
            const fastMovingAverageArray = [45, 48, 49, 46];
            const slowMovingAverageArray = [50, 50, 50, 50];

            const crossoverResult = detectCrossover(fastMovingAverageArray, slowMovingAverageArray);

            expect(crossoverResult).toBeNull();
        });

        test("should indicate bullish position when averages were exactly equal previously and fast average moves higher", () => {
            const fastMovingAverageArray = [48, 49, 50, 51];
            const slowMovingAverageArray = [50, 50, 50, 50];

            const crossoverResult = detectCrossover(fastMovingAverageArray, slowMovingAverageArray);

            expect(crossoverResult).toBe("bullish");
        });

        test("should indicate bearish position when averages were exactly equal previously and fast average moves lower", () => {
            const fastMovingAverageArray = [52, 51, 50, 49];
            const slowMovingAverageArray = [50, 50, 50, 50];

            const crossoverResult = detectCrossover(fastMovingAverageArray, slowMovingAverageArray);

            expect(crossoverResult).toBe("bearish");
        });

        test("should indicate hold position if insufficient data exists to determine a trend", () => {
            const fastMovingAverageArray = [50];
            const slowMovingAverageArray = [50];

            const crossoverResult = detectCrossover(fastMovingAverageArray, slowMovingAverageArray);

            expect(crossoverResult).toBeNull();
        });

        test("should correctly detect indicators using generated real candle datasets", () => {
            const bullishHistoricalCandles = generateCrossoverCandles("AAPL", "bullish");
            const bearishHistoricalCandles = generateCrossoverCandles("AAPL", "bearish");

            const {fastMA: bullishFastAverage, slowMA: bullishSlowAverage} = calculateMovingAverages(bullishHistoricalCandles, 10, 50);
            const {fastMA: bearishFastAverage, slowMA: bearishSlowAverage} = calculateMovingAverages(bearishHistoricalCandles, 10, 50);

            const bullishCrossoverResult = detectCrossover(bullishFastAverage, bullishSlowAverage);
            const bearishCrossoverResult = detectCrossover(bearishFastAverage, bearishSlowAverage);

            expect(bullishCrossoverResult).toBe("bullish");
            expect(bearishCrossoverResult).toBe("bearish");
        });
    });

    describe("calculateRSI", () => {
        test("should return empty array for unimplemented function", () => {
            const priceValues = [1, 2, 3];
            const relativeStrengthIndexPeriod = 14;

            const relativeStrengthIndexArray = calculateRSI(priceValues, relativeStrengthIndexPeriod);

            expect(relativeStrengthIndexArray).toEqual([]);
        });
    });

    describe("calculateBollingerBands", () => {
        test("should return empty arrays for unimplemented function", () => {
            const priceValues = [1, 2, 3];
            const bollingerBandPeriod = 20;
            const standardDeviationMultiplier = 2;

            const bollingerBandsObject = calculateBollingerBands(priceValues, bollingerBandPeriod, standardDeviationMultiplier);

            expect(bollingerBandsObject).toEqual({upper: [], middle: [], lower: []});
        });
    });

    describe("calculateMACD", () => {
        test("should return empty arrays for unimplemented function", () => {
            const priceValues = [1, 2, 3];
            const fastExponentialPeriod = 12;
            const slowExponentialPeriod = 26;
            const signalLinePeriod = 9;

            const movingAverageConvergenceDivergenceObject = calculateMACD(priceValues, fastExponentialPeriod, slowExponentialPeriod, signalLinePeriod);

            expect(movingAverageConvergenceDivergenceObject).toEqual({macd: [], signal: [], histogram: []});
        });
    });
});