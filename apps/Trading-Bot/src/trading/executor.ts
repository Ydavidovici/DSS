import type {Signal, SignalResult} from "../types/signal";
import type {OrderRequest, OrderResponse, Trade} from "../types/trade";
import {getBroker} from "../services/broker";
import {getDbClient} from "../services/dbClient";
import {getPortfolio} from "./portfolio";
import {logger} from "../utils/logger";
import {formatCurrency, sleep} from "../utils/helpers";

export interface ExecutionConfig {
    positionSizePercent: number;
    maxPositions: number;
    dryRun: boolean;
    minSignalStrength: number;
}

export class TradeExecutor {
    private config: ExecutionConfig;

    constructor(configuration: Partial<ExecutionConfig> = {}) {
        this.config = {
            positionSizePercent: configuration.positionSizePercent || 10,
            maxPositions: configuration.maxPositions || 5,
            dryRun: configuration.dryRun || false,
            minSignalStrength: configuration.minSignalStrength || 0.5,
        };

        logger.info("Trade executor initialized", {...this.config});
    }

    private async waitForOrderFill(
        orderIdentifier: string,
        maximumAttempts: number = 30,
        delayMilliseconds: number = 1000,
    ): Promise<any> {
        const brokerService = getBroker();

        for (let currentAttempt = 0; currentAttempt < maximumAttempts; currentAttempt++) {
            const orderRecord = await brokerService.getOrder(orderIdentifier);

            if (orderRecord.status === "filled") {
                logger.debug(`Order ${orderIdentifier} filled after ${currentAttempt + 1} attempts`);
                return orderRecord;
            }

            if (orderRecord.status === "rejected" || orderRecord.status === "cancelled") {
                logger.warn(`Order ${orderIdentifier} ${orderRecord.status}`, {
                    orderIdentifier,
                    status: orderRecord.status,
                });
                return null;
            }

            await sleep(delayMilliseconds);
        }

        logger.warn(`Order ${orderIdentifier} did not fill within timeout`, {orderIdentifier});
        return null;
    }

    private async placeAndWaitForOrder(
        orderRequest: OrderRequest,
        signalRecord: Signal,
    ): Promise<Trade | null> {
        const brokerService = getBroker();

        logger.info(`Executing ${orderRequest.side.toUpperCase()} order for ${signalRecord.symbol}`, {
            symbol: signalRecord.symbol,
            quantity: orderRequest.quantity,
        });

        const orderResponse = await brokerService.placeOrder(orderRequest);

        const filledOrder = await this.waitForOrderFill(orderResponse.orderId);

        if (!filledOrder) {
            logger.error(`Order failed to fill for ${signalRecord.symbol}`, {
                symbol: signalRecord.symbol,
                orderIdentifier: orderResponse.orderId,
            });
            return null;
        }

        const tradeRecord = brokerService.orderToTrade(filledOrder);

        this.logTrade(tradeRecord).catch(error => {
            logger.warn("Failed to log trade to database", {
                tradeIdentifier: tradeRecord.id,
                error: error instanceof Error ? error.message : String(error),
            });
        });

        logger.trade(tradeRecord.symbol, tradeRecord.side, tradeRecord.quantity, tradeRecord.price);

        return tradeRecord;
    }

    async executeSignal(signalResult: SignalResult): Promise<Trade | null> {
        const {signal} = signalResult;

        if ((signal.strength || 0) < this.config.minSignalStrength) {
            logger.info(`Signal strength too low, skipping execution`, {
                symbol: signal.symbol,
                strength: signal.strength,
                minimumRequired: this.config.minSignalStrength,
            });
            return null;
        }

        if (signal.type === "buy") {
            return this.executeBuy(signal);
        } else if (signal.type === "sell") {
            return this.executeSell(signal);
        } else {
            logger.debug("Hold signal, no action taken", {symbol: signal.symbol});
            return null;
        }
    }

    private async executeBuy(signalRecord: Signal): Promise<Trade | null> {
        try {
            const portfolioManager = getPortfolio();

            const hasExistingPosition = await portfolioManager.hasPosition(signalRecord.symbol);
            if (hasExistingPosition) {
                logger.info(`Already have position in ${signalRecord.symbol}, skipping buy`, {
                    symbol: signalRecord.symbol,
                });
                return null;
            }

            const atMaximumLimit = await portfolioManager.isAtPositionLimit(this.config.maxPositions);
            if (atMaximumLimit) {
                logger.info(`At position limit (${this.config.maxPositions}), skipping buy`, {
                    symbol: signalRecord.symbol,
                    maximumPositions: this.config.maxPositions,
                });
                return null;
            }

            const calculatedQuantity = await portfolioManager.calculatePositionSize(
                signalRecord.symbol,
                signalRecord.price,
                this.config.positionSizePercent,
            );

            if (calculatedQuantity === 0) {
                logger.warn(`Calculated position size is 0, skipping buy`, {
                    symbol: signalRecord.symbol,
                    price: signalRecord.price,
                });
                return null;
            }

            const hasSufficientFunds = await portfolioManager.canAfford(signalRecord.price, calculatedQuantity);
            if (!hasSufficientFunds) {
                logger.warn(`Insufficient buying power for ${signalRecord.symbol}`, {
                    symbol: signalRecord.symbol,
                    quantity: calculatedQuantity,
                    estimatedCost: formatCurrency(signalRecord.price * calculatedQuantity),
                });
                return null;
            }

            if (this.config.dryRun) {
                logger.info(`[DRY RUN] Would buy ${calculatedQuantity} shares of ${signalRecord.symbol}`, {
                    symbol: signalRecord.symbol,
                    quantity: calculatedQuantity,
                    estimatedPrice: signalRecord.price,
                    estimatedCost: formatCurrency(signalRecord.price * calculatedQuantity),
                });
                return null;
            }

            const orderRequest: OrderRequest = {
                symbol: signalRecord.symbol,
                side: "buy",
                quantity: calculatedQuantity,
                type: "market",
                timeInForce: "day",
            };

            return await this.placeAndWaitForOrder(orderRequest, signalRecord);
        } catch (error) {
            logger.error(`Failed to execute buy for ${signalRecord.symbol}`, {
                symbol: signalRecord.symbol,
                error: error instanceof Error ? error.message : String(error),
            });
            return null;
        }
    }

    private async executeSell(signalRecord: Signal): Promise<Trade | null> {
        try {
            const portfolioManager = getPortfolio();

            const currentPosition = await portfolioManager.getPosition(signalRecord.symbol);
            if (!currentPosition || currentPosition.quantity === 0) {
                logger.info(`No position in ${signalRecord.symbol} to sell`, {
                    symbol: signalRecord.symbol,
                });
                return null;
            }

            const positionQuantity = currentPosition.quantity;

            if (this.config.dryRun) {
                logger.info(`[DRY RUN] Would sell ${positionQuantity} shares of ${signalRecord.symbol}`, {
                    symbol: signalRecord.symbol,
                    quantity: positionQuantity,
                    estimatedPrice: signalRecord.price,
                    estimatedProceeds: formatCurrency(signalRecord.price * positionQuantity),
                });
                return null;
            }

            const orderRequest: OrderRequest = {
                symbol: signalRecord.symbol,
                side: "sell",
                quantity: positionQuantity,
                type: "market",
                timeInForce: "day",
            };

            return await this.placeAndWaitForOrder(orderRequest, signalRecord);
        } catch (error) {
            logger.error(`Failed to execute sell for ${signalRecord.symbol}`, {
                symbol: signalRecord.symbol,
                error: error instanceof Error ? error.message : String(error),
            });
            return null;
        }
    }

    async executeSignals(signalResults: SignalResult[]): Promise<Trade[]> {
        const executedTrades: Trade[] = [];

        for (const signalRecord of signalResults) {
            try {
                const completedTrade = await this.executeSignal(signalRecord);
                if (completedTrade) {
                    executedTrades.push(completedTrade);
                }

                await sleep(500);
            } catch (error) {
                logger.error(`Failed to execute signal for ${signalRecord.signal.symbol}`, {
                    symbol: signalRecord.signal.symbol,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }

        logger.info(`Executed ${executedTrades.length} trades from ${signalResults.length} signals`, {
            signalsProcessed: signalResults.length,
            tradesExecuted: executedTrades.length,
        });

        return executedTrades;
    }

    private async logTrade(tradeRecord: Trade): Promise<void> {
        const databaseClient = getDbClient();
        await databaseClient.logTrade(tradeRecord);
    }

    updateConfig(newConfiguration: Partial<ExecutionConfig>): void {
        this.config = {...this.config, ...newConfiguration};
        logger.info("Executor configuration updated", {...this.config});
    }

    getConfig(): ExecutionConfig {
        return {...this.config};
    }
}

let executorInstance: TradeExecutor | null = null;

export function getExecutor(configuration?: Partial<ExecutionConfig>): TradeExecutor {
    if (!executorInstance) {
        executorInstance = new TradeExecutor(configuration);
    } else if (configuration) {
        executorInstance.updateConfig(configuration);
    }
    return executorInstance;
}

export default getExecutor;