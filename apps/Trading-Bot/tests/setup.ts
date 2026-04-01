import type {Candle, NormalizedCandle} from "../src/types/candle";
import type {Signal} from "../src/types/signal";
import type {Trade} from "../src/types/trade";

export function generateMockCandles(
    symbol: string,
    candleCount: number,
    startingPrice: number = 100,
    priceTrend: "up" | "down" | "sideways" = "sideways",
): Candle[] {
    const generatedCandles: Candle[] = [];
    let currentPrice = startingPrice;
    const baseDate = new Date("2024-01-01");

    for (let index = 0; index < candleCount; index++) {
        const candleDate = new Date(baseDate);
        candleDate.setDate(candleDate.getDate() + index);

        if (priceTrend === "up") {
            currentPrice += Math.random() * 2;
        } else if (priceTrend === "down") {
            currentPrice -= Math.random() * 2;
        } else {
            currentPrice += (Math.random() - 0.5) * 2;
        }

        const priceVolatility = currentPrice * 0.02;
        const openingPrice = currentPrice + (Math.random() - 0.5) * priceVolatility;
        const closingPrice = currentPrice + (Math.random() - 0.5) * priceVolatility;
        const highPrice = Math.max(openingPrice, closingPrice) + Math.random() * priceVolatility;
        const lowPrice = Math.min(openingPrice, closingPrice) - Math.random() * priceVolatility;

        generatedCandles.push({
            symbol,
            timestamp: candleDate.toISOString(),
            open: openingPrice,
            high: highPrice,
            low: lowPrice,
            close: closingPrice,
            volume: Math.floor(1000000 + Math.random() * 500000),
            timeframe: "1d",
        });
    }

    return generatedCandles;
}

export function generateMockNormalizedCandles(
    symbol: string,
    candleCount: number,
    startingPrice: number = 100,
    priceTrend: "up" | "down" | "sideways" = "sideways",
): NormalizedCandle[] {
    const rawCandles = generateMockCandles(symbol, candleCount, startingPrice, priceTrend);
    return rawCandles.map((individualCandle) => ({
        ...individualCandle,
        timestamp: new Date(individualCandle.timestamp),
    }));
}

export function generateCrossoverCandles(
    symbol: string,
    crossoverType: "bullish" | "bearish",
): NormalizedCandle[] {
    const generatedCandles: NormalizedCandle[] = [];
    const baseDate = new Date("2024-01-01");

    for (let index = 0; index < 60; index++) {
        const candleDate = new Date(baseDate);
        candleDate.setDate(candleDate.getDate() + index);

        let closingPrice: number;

        if (crossoverType === "bullish") {
            if (index < 59) {
                closingPrice = 100;
            } else {
                closingPrice = 110;
            }
        } else {
            if (index < 59) {
                closingPrice = 100;
            } else {
                closingPrice = 90;
            }
        }

        const priceVolatility = closingPrice * 0.01;
        const openingPrice = closingPrice;
        const highPrice = closingPrice + priceVolatility;
        const lowPrice = closingPrice - priceVolatility;

        generatedCandles.push({
            symbol,
            timestamp: candleDate,
            open: openingPrice,
            high: highPrice,
            low: lowPrice,
            close: closingPrice,
            volume: 1000000,
            timeframe: "1d",
        });
    }

    return generatedCandles;
}

export function generateMockSignal(
    symbol: string = "AAPL",
    signalType: "buy" | "sell" | "hold" = "buy",
): Signal {
    return {
        symbol,
        type: signalType,
        timestamp: new Date().toISOString(),
        strategy: "moving_average_crossover",
        strength: 0.75,
        price: 150.0,
        indicators: {
            fastMA: signalType === "buy" ? 151 : 149,
            slowMA: 150,
        },
        reason: `Fast MA crossed ${signalType === "buy" ? "above" : "below"} slow MA`,
    };
}

export function generateMockTrade(
    symbol: string = "AAPL",
    tradingSide: "buy" | "sell" = "buy",
): Trade {
    const currentTimestamp = Date.now();
    return {
        id: `trade-${currentTimestamp}`,
        symbol,
        side: tradingSide,
        quantity: 10,
        price: 150.0,
        value: 1500.0,
        timestamp: new Date().toISOString(),
        orderType: "market",
        status: "filled",
        orderId: `order-${currentTimestamp}`,
        strategy: "moving_average_crossover",
    };
}

export function setupTestEnvironment(): void {
    process.env["APCA_API_KEY"] = "test-key";
    process.env["APCA_SECRET_KEY"] = "test-secret";
    process.env["APCA_PAPER"] = "true";
    process.env["DB_SERVICE_URL"] = "http://localhost:3000/api";
    process.env["FAST_MA_PERIOD"] = "10";
    process.env["SLOW_MA_PERIOD"] = "50";
    process.env["TIMEFRAME"] = "1d";
    process.env["SYMBOLS"] = "AAPL,SPY";
    process.env["LOG_LEVEL"] = "error";
}

export function cleanupTestEnvironment(): void {
    delete process.env["APCA_API_KEY"];
    delete process.env["APCA_SECRET_KEY"];
    delete process.env["APCA_PAPER"];
    delete process.env["DB_SERVICE_URL"];
    delete process.env["FAST_MA_PERIOD"];
    delete process.env["SLOW_MA_PERIOD"];
    delete process.env["TIMEFRAME"];
    delete process.env["SYMBOLS"];
    delete process.env["LOG_LEVEL"];
}

export function assertArraysApproxEqual(
    actualValues: number[],
    expectedValues: number[],
    toleranceLimit: number = 0.01,
): void {
    if (actualValues.length !== expectedValues.length) {
        throw new Error(
            `Array lengths differ: actual=${actualValues.length}, expected=${expectedValues.length}`,
        );
    }

    for (let index = 0; index < actualValues.length; index++) {
        const priceDifference = Math.abs(actualValues[index] - expectedValues[index]);
        if (priceDifference > toleranceLimit) {
            throw new Error(
                `Values at index ${index} differ: actual=${actualValues[index]}, expected=${expectedValues[index]}, difference=${priceDifference}`,
            );
        }
    }
}

export function round(numericValue: number, decimalPlaces: number = 2): number {
    const roundingMultiplier = Math.pow(10, decimalPlaces);
    return Math.round(numericValue * roundingMultiplier) / roundingMultiplier;
}