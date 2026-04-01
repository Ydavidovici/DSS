import type { Position, Portfolio } from "../types/api";
import { getBroker } from "../services/broker";
import { getDbClient } from "../services/dbClient";
import { logger } from "../utils/logger";
import { formatCurrency, formatPercent, percentChange } from "../utils/helpers";

export class PortfolioManager {
    private accountId: string;

    constructor(accountId: string = "default") {
        this.accountId = accountId;
    }

    async getPortfolio(): Promise<Portfolio> {
        try {
            const brokerService = getBroker();

            const accountInformation = await brokerService.getAccount();

            const alpacaPositions = await brokerService.getPositions();

            const portfolioPositions: Position[] = alpacaPositions.map((alpacaPosition: any) => ({
                symbol: alpacaPosition.symbol,
                quantity: parseFloat(alpacaPosition.qty),
                avgEntryPrice: parseFloat(alpacaPosition.avg_entry_price),
                currentPrice: parseFloat(alpacaPosition.current_price),
                marketValue: parseFloat(alpacaPosition.market_value),
                unrealizedPL: parseFloat(alpacaPosition.unrealized_pl),
                unrealizedPLPercent: parseFloat(alpacaPosition.unrealized_plpc) * 100,
            }));

            const totalProfitLoss = portfolioPositions.reduce((accumulatedTotal, currentPosition) => accumulatedTotal + currentPosition.unrealizedPL, 0);
            const totalEquity = parseFloat(accountInformation.equity);
            const totalProfitLossPercent = percentChange(totalEquity - totalProfitLoss, totalEquity);

            const portfolio: Portfolio = {
                accountId: this.accountId,
                balance: parseFloat(accountInformation.cash),
                equity: totalEquity,
                buyingPower: parseFloat(accountInformation.buying_power),
                positions: portfolioPositions,
                totalPL: totalProfitLoss,
                totalPLPercent: totalProfitLossPercent,
                lastUpdated: new Date().toISOString(),
            };

            logger.info("Portfolio fetched", {
                equity: formatCurrency(portfolio.equity),
                positions: portfolio.positions.length,
                totalPL: formatCurrency(portfolio.totalPL),
                totalPLPercent: formatPercent(portfolio.totalPLPercent),
            });

            return portfolio;
        } catch (error) {
            logger.error("Failed to fetch portfolio", {
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }

    async getPosition(symbol: string): Promise<Position | null> {
        try {
            const brokerService = getBroker();
            const alpacaPosition = await brokerService.getPosition(symbol);

            if (!alpacaPosition) {
                return null;
            }

            return {
                symbol: alpacaPosition.symbol,
                quantity: parseFloat(alpacaPosition.qty),
                avgEntryPrice: parseFloat(alpacaPosition.avg_entry_price),
                currentPrice: parseFloat(alpacaPosition.current_price),
                marketValue: parseFloat(alpacaPosition.market_value),
                unrealizedPL: parseFloat(alpacaPosition.unrealized_pl),
                unrealizedPLPercent: parseFloat(alpacaPosition.unrealized_plpc) * 100,
            };
        } catch (error) {
            logger.error(`Failed to fetch position for ${symbol}`, {
                symbol,
                error: error instanceof Error ? error.message : String(error),
            });
            return null;
        }
    }

    async hasPosition(symbol: string): Promise<boolean> {
        const currentPosition = await this.getPosition(symbol);
        return currentPosition !== null && currentPosition.quantity !== 0;
    }

    async calculatePositionSize(
        symbol: string,
        currentPrice: number,
        positionSizePercent: number = 10
    ): Promise<number> {
        try {
            const brokerService = getBroker();
            const accountInformation = await brokerService.getAccount();

            const totalEquity = parseFloat(accountInformation.equity);
            const currentBuyingPower = parseFloat(accountInformation.buying_power);

            const positionValue = totalEquity * (positionSizePercent / 100);

            const maximumPositionValue = Math.min(positionValue, currentBuyingPower);

            const calculatedShares = Math.floor(maximumPositionValue / currentPrice);

            logger.debug(`Calculated position size for ${symbol}`, {
                symbol,
                equity: formatCurrency(totalEquity),
                positionSizePercent,
                positionValue: formatCurrency(positionValue),
                currentPrice: formatCurrency(currentPrice),
                shares: calculatedShares,
            });

            return calculatedShares;
        } catch (error) {
            logger.error(`Failed to calculate position size for ${symbol}`, {
                symbol,
                error: error instanceof Error ? error.message : String(error),
            });
            return 0;
        }
    }

    async canAfford(currentPrice: number, quantity: number): Promise<boolean> {
        try {
            const brokerService = getBroker();
            const accountInformation = await brokerService.getAccount();

            const currentBuyingPower = parseFloat(accountInformation.buying_power);
            const estimatedCost = currentPrice * quantity;

            return estimatedCost <= currentBuyingPower;
        } catch (error) {
            logger.error("Failed to check buying power", {
                error: error instanceof Error ? error.message : String(error),
            });
            logger.warn("Proceeding with trade despite error checking buying power");
            return true;
        }
    }

    async getPositionCount(): Promise<number> {
        try {
            const brokerService = getBroker();
            const openPositions = await brokerService.getPositions();
            return openPositions.length;
        } catch (error) {
            logger.error("Failed to get position count", {
                error: error instanceof Error ? error.message : String(error),
            });
            return 0;
        }
    }

    async isAtPositionLimit(maximumPositions: number = 5): Promise<boolean> {
        const currentPositionCount = await this.getPositionCount();
        return currentPositionCount >= maximumPositions;
    }

    async syncToDatabase(): Promise<void> {
        try {
            const currentPortfolio = await this.getPortfolio();
            const databaseClient = getDbClient();

            logger.debug("Portfolio synced to database", {
                accountId: this.accountId,
            });
        } catch (error) {
            logger.warn("Failed to sync portfolio to database", {
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    async logSummary(): Promise<void> {
        const currentPortfolio = await this.getPortfolio();

        logger.info("\n=== Portfolio Summary ===");
        logger.info(`Account ID: ${currentPortfolio.accountId}`);
        logger.info(`Equity: ${formatCurrency(currentPortfolio.equity)}`);
        logger.info(`Cash: ${formatCurrency(currentPortfolio.balance)}`);
        logger.info(`Buying Power: ${formatCurrency(currentPortfolio.buyingPower)}`);
        logger.info(`Total P&L: ${formatCurrency(currentPortfolio.totalPL)} (${formatPercent(currentPortfolio.totalPLPercent)})`);
        logger.info(`\nPositions (${currentPortfolio.positions.length}):`);

        if (currentPortfolio.positions.length === 0) {
            logger.info("  No open positions");
        } else {
            for (const position of currentPortfolio.positions) {
                logger.info(
                    `  ${position.symbol}: ${position.quantity} shares @ ${formatCurrency(position.avgEntryPrice)} ` +
                    `| Current: ${formatCurrency(position.currentPrice)} ` +
                    `| P&L: ${formatCurrency(position.unrealizedPL)} (${formatPercent(position.unrealizedPLPercent)})`
                );
            }
        }

        logger.info("========================\n");
    }
}

const portfolioInstances = new Map<string, PortfolioManager>();

export function getPortfolio(accountId?: string): PortfolioManager {
    const resolvedAccountId = accountId || process.env["ACCOUNT_ID"] || "default";

    if (!portfolioInstances.has(resolvedAccountId)) {
        portfolioInstances.set(resolvedAccountId, new PortfolioManager(resolvedAccountId));
    }

    return portfolioInstances.get(resolvedAccountId)!;
}

export default getPortfolio;