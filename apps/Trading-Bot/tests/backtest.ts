import * as fs from "fs";
import * as path from "path";
import {generateMultipleSignals, getActionableSignals} from "../src/strategy/signals";
import {getDbClient} from "../src/services/dbClient";
import {logger} from "../src/utils/logger";
import {config} from "../src/config";
import type {NormalizedCandle} from "../src/types/candle";

function loadCandlesFromCSV(filePath: string, symbol: string): NormalizedCandle[] {
    const absolutePath = path.resolve(filePath);
    const fileContent = fs.readFileSync(absolutePath, "utf-8");

    const lines = fileContent.split("\n").filter(line => line.trim().length > 0);
    const candles: NormalizedCandle[] = [];

    for (let index = 1; index < lines.length; index++) {
        const [date, close, open, high, low, volumeString] = lines[index].split("\",\"").map(cellValue => cellValue.replace(/"/g, ""));

        const parsePrice = (value: string) => parseFloat(value.replace(/,/g, "").trim());

        const parseVolume = (value: string) => {
            if (!value) {
                return 0;
            }
            const uppercaseValue = value.toUpperCase();
            let multiplier = 1;
            if (uppercaseValue.endsWith("K")) {
                multiplier = 1000;
            }
            if (uppercaseValue.endsWith("M")) {
                multiplier = 1000000;
            }
            if (uppercaseValue.endsWith("B")) {
                multiplier = 1000000000;
            }
            return parseFloat(uppercaseValue.replace(/[KMB]/g, "")) * multiplier;
        };

        candles.push({
            symbol: symbol,
            timeframe: "1d",
            timestamp: new Date(date),
            close: parsePrice(close),
            open: parsePrice(open),
            high: parsePrice(high),
            low: parsePrice(low),
            volume: parseVolume(volumeString),
        });
    }

    return candles.sort((firstCandle, secondCandle) => firstCandle.timestamp.getTime() - secondCandle.timestamp.getTime());
}

async function runBacktest() {
    logger.info("Starting Backtest Engine...");

    const symbol = "SPY";
    const csvPath = "./data/historical_spy.csv";

    const allHistoricalCandles = loadCandlesFromCSV(csvPath, symbol);
    logger.info(`Loaded ${allHistoricalCandles.length} historical candles for ${symbol}`);

    const {fastMAPeriod, slowMAPeriod, useEMA, minSignalStrength} = config.strategy;
    const requiredCandles = slowMAPeriod + 10;

    const tradeLog = [];
    let currentPosition = null;

    const databaseClient = getDbClient();

    for (let index = requiredCandles; index < allHistoricalCandles.length; index++) {
        const visibleCandles = allHistoricalCandles.slice(0, index + 1);
        const currentDay = visibleCandles[visibleCandles.length - 1];

        const candleMap = new Map<string, NormalizedCandle[]>();
        candleMap.set(symbol, visibleCandles);

        const signalResults = generateMultipleSignals(
            [symbol],
            candleMap,
            {fastPeriod: fastMAPeriod, slowPeriod: slowMAPeriod, useEMA, minStrength: minSignalStrength},
        );

        const actionableSignals = getActionableSignals(signalResults);

        if (actionableSignals.length > 0) {
            const signal = actionableSignals[0].signal;

            if (signal.type === "buy" && !currentPosition) {
                currentPosition = {
                    entryDate: currentDay.timestamp.toISOString(),
                    entryPrice: currentDay.close,
                };
                logger.info(`[BUY]  ${symbol} at $${currentPosition.entryPrice} on ${currentPosition.entryDate.split("T")[0]}`);

            } else if (signal.type === "sell" && currentPosition) {
                const exitPrice = currentDay.close;
                const profitLoss = exitPrice - currentPosition.entryPrice;
                const percentReturn = (profitLoss / currentPosition.entryPrice) * 100;

                const tradeResult = {
                    symbol,
                    entryDate: currentPosition.entryDate,
                    exitDate: currentDay.timestamp.toISOString(),
                    entryPrice: currentPosition.entryPrice,
                    exitPrice: exitPrice,
                    profitLoss: profitLoss.toFixed(2),
                    percentReturn: `${percentReturn.toFixed(2)}%`,
                };

                tradeLog.push(tradeResult);
                logger.info(`[SELL] ${symbol} at $${exitPrice}. P&L: ${percentReturn.toFixed(2)}%`);

                currentPosition = null;
            }
        }
    }

    logger.info("=".repeat(60));
    logger.info("BACKTEST COMPLETE");
    logger.info(`Total Trades Executed: ${tradeLog.length}`);

    if (tradeLog.length > 0) {
        const winningTrades = tradeLog.filter(trade => parseFloat(trade.profitLoss) > 0).length;
        logger.info(`Win Rate: ${((winningTrades / tradeLog.length) * 100).toFixed(2)}%`);
    }
    logger.info("=".repeat(60));

    const timestamp = new Date().toISOString().replace(/:/g, "-");

    fs.writeFileSync(`./data/backtest_results_${timestamp}.json`, JSON.stringify(tradeLog, null, 2));
    logger.info(`Raw trade data saved to ./data/backtest_results_${timestamp}.json`);
}

runBacktest().catch(error => logger.error("Backtest failed", error));