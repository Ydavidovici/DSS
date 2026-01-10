/**
 * Portfolio management
 * Tracks positions, balance, and P&L
 */

import type { Position, Portfolio } from '../types/api';
import { getBroker } from '../services/broker';
import { getDbClient } from '../services/dbClient';
import { logger } from '../utils/logger';
import { formatCurrency, formatPercent, percentChange } from '../utils/helpers';

export class PortfolioManager {
  private accountId: string;

  constructor(accountId: string = 'default') {
    this.accountId = accountId;
  }

  /**
   * Get current portfolio state from broker
   * @returns Portfolio summary with positions and P&L
   */
  async getPortfolio(): Promise<Portfolio> {
    try {
      const broker = getBroker();

      // Fetch account info
      const account = await broker.getAccount();

      // Fetch all positions
      const alpacaPositions = await broker.getPositions();

      // Convert Alpaca positions to our Position type
      const positions: Position[] = alpacaPositions.map((pos) => ({
        symbol: pos.symbol,
        quantity: parseFloat(pos.qty),
        avgEntryPrice: parseFloat(pos.avg_entry_price),
        currentPrice: parseFloat(pos.current_price),
        marketValue: parseFloat(pos.market_value),
        unrealizedPL: parseFloat(pos.unrealized_pl),
        unrealizedPLPercent: parseFloat(pos.unrealized_plpc) * 100,
      }));

      // Calculate total P&L
      const totalPL = positions.reduce((sum, pos) => sum + pos.unrealizedPL, 0);
      const equity = parseFloat(account.equity);
      const totalPLPercent = percentChange(equity - totalPL, equity);

      const portfolio: Portfolio = {
        accountId: this.accountId,
        balance: parseFloat(account.cash),
        equity,
        buyingPower: parseFloat(account.buying_power),
        positions,
        totalPL,
        totalPLPercent,
        lastUpdated: new Date().toISOString(),
      };

      logger.info('Portfolio fetched', {
        equity: formatCurrency(portfolio.equity),
        positions: portfolio.positions.length,
        totalPL: formatCurrency(portfolio.totalPL),
        totalPLPercent: formatPercent(portfolio.totalPLPercent),
      });

      return portfolio;
    } catch (error) {
      logger.error('Failed to fetch portfolio', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Check if we have an open position for a symbol
   * @param symbol Trading symbol
   * @returns Position or null
   */
  async getPosition(symbol: string): Promise<Position | null> {
    try {
      const broker = getBroker();
      const alpacaPosition = await broker.getPosition(symbol);

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

  /**
   * Check if we have any position (long or short) for a symbol
   * @param symbol Trading symbol
   * @returns True if position exists
   */
  async hasPosition(symbol: string): Promise<boolean> {
    const position = await this.getPosition(symbol);
    return position !== null && position.quantity !== 0;
  }

  /**
   * Calculate position size based on account equity and risk parameters
   * @param symbol Trading symbol
   * @param currentPrice Current market price
   * @param positionSizePercent Percentage of equity to allocate (default: 10%)
   * @returns Number of shares to buy
   */
  async calculatePositionSize(
    symbol: string,
    currentPrice: number,
    positionSizePercent: number = 10
  ): Promise<number> {
    try {
      const broker = getBroker();
      const account = await broker.getAccount();

      const equity = parseFloat(account.equity);
      const buyingPower = parseFloat(account.buying_power);

      // Calculate position value as percentage of equity
      const positionValue = equity * (positionSizePercent / 100);

      // Ensure we don't exceed buying power
      const maxPositionValue = Math.min(positionValue, buyingPower);

      // Calculate number of shares (round down to whole shares)
      const shares = Math.floor(maxPositionValue / currentPrice);

      logger.debug(`Calculated position size for ${symbol}`, {
        symbol,
        equity: formatCurrency(equity),
        positionSizePercent,
        positionValue: formatCurrency(positionValue),
        currentPrice: formatCurrency(currentPrice),
        shares,
      });

      return shares;
    } catch (error) {
      logger.error(`Failed to calculate position size for ${symbol}`, {
        symbol,
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }

  /**
   * Check if we can afford to open a new position
   * @param currentPrice Price per share
   * @param quantity Number of shares
   * @returns True if we have enough buying power
   */
  async canAfford(currentPrice: number, quantity: number): Promise<boolean> {
    try {
      const broker = getBroker();
      const account = await broker.getAccount();

      const buyingPower = parseFloat(account.buying_power);
      const cost = currentPrice * quantity;

      return cost <= buyingPower;
    } catch (error) {
      logger.error('Failed to check buying power', {
        error: error instanceof Error ? error.message : String(error),
      });
      // Log error and continue - don't block trades on transient errors
      logger.warn('Proceeding with trade despite error checking buying power');
      return true;
    }
  }

  /**
   * Get number of open positions
   * @returns Count of positions
   */
  async getPositionCount(): Promise<number> {
    try {
      const broker = getBroker();
      const positions = await broker.getPositions();
      return positions.length;
    } catch (error) {
      logger.error('Failed to get position count', {
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }

  /**
   * Check if we've reached maximum position limit
   * @param maxPositions Maximum allowed positions
   * @returns True if at limit
   */
  async isAtPositionLimit(maxPositions: number = 5): Promise<boolean> {
    const count = await this.getPositionCount();
    return count >= maxPositions;
  }

  /**
   * Sync portfolio to database service
   * Useful for historical tracking and analysis
   * @todo Implement actual DB sync when endpoint is ready
   */
  async syncToDatabase(): Promise<void> {
    try {
      const portfolio = await this.getPortfolio();
      const db = getDbClient();

      // @todo: Send portfolio data to DB service
      // await db.savePortfolio(portfolio);

      logger.debug('Portfolio synced to database', {
        accountId: this.accountId,
      });
    } catch (error) {
      logger.warn('Failed to sync portfolio to database', {
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't throw - syncing to DB is not critical for trading
    }
  }

  /**
   * Log portfolio summary
   */
  async logSummary(): Promise<void> {
    const portfolio = await this.getPortfolio();

    logger.info('\n=== Portfolio Summary ===');
    logger.info(`Account ID: ${portfolio.accountId}`);
    logger.info(`Equity: ${formatCurrency(portfolio.equity)}`);
    logger.info(`Cash: ${formatCurrency(portfolio.balance)}`);
    logger.info(`Buying Power: ${formatCurrency(portfolio.buyingPower)}`);
    logger.info(`Total P&L: ${formatCurrency(portfolio.totalPL)} (${formatPercent(portfolio.totalPLPercent)})`);
    logger.info(`\nPositions (${portfolio.positions.length}):`);

    if (portfolio.positions.length === 0) {
      logger.info('  No open positions');
    } else {
      for (const pos of portfolio.positions) {
        logger.info(
          `  ${pos.symbol}: ${pos.quantity} shares @ ${formatCurrency(pos.avgEntryPrice)} ` +
            `| Current: ${formatCurrency(pos.currentPrice)} ` +
            `| P&L: ${formatCurrency(pos.unrealizedPL)} (${formatPercent(pos.unrealizedPLPercent)})`
        );
      }
    }

    logger.info('========================\n');
  }
}

// Export singleton instances per account
const portfolioInstances = new Map<string, PortfolioManager>();

export function getPortfolio(accountId?: string): PortfolioManager {
  const id = accountId || process.env.ACCOUNT_ID || 'default';

  if (!portfolioInstances.has(id)) {
    portfolioInstances.set(id, new PortfolioManager(id));
  }

  return portfolioInstances.get(id)!;
}

export default getPortfolio;
