/**
 * Trade execution engine
 * Handles order placement, validation, and logging
 */

import type { Signal, SignalResult } from '../types/signal';
import type { OrderRequest, OrderResponse, Trade } from '../types/trade';
import { getBroker } from '../services/broker';
import { getDbClient } from '../services/dbClient';
import { getPortfolio } from './portfolio';
import { logger } from '../utils/logger';
import { formatCurrency, sleep } from '../utils/helpers';

export interface ExecutionConfig {
  /** Position size as percentage of equity (default: 10%) */
  positionSizePercent: number;

  /** Maximum number of concurrent positions (default: 5) */
  maxPositions: number;

  /** Whether to execute trades in dry-run mode (default: false) */
  dryRun: boolean;

  /** Minimum signal strength to execute (default: 0.5) */
  minSignalStrength: number;
}

export class TradeExecutor {
  private config: ExecutionConfig;

  constructor(config: Partial<ExecutionConfig> = {}) {
    this.config = {
      positionSizePercent: config.positionSizePercent || 10,
      maxPositions: config.maxPositions || 5,
      dryRun: config.dryRun || false,
      minSignalStrength: config.minSignalStrength || 0.5,
    };

    logger.info('Trade executor initialized', this.config);
  }

  /**
   * Execute a signal (buy or sell)
   * @param signalResult Signal to execute
   * @returns Executed trade or null if not executed
   */
  async executeSignal(signalResult: SignalResult): Promise<Trade | null> {
    const { signal } = signalResult;

    // Validate signal strength
    if ((signal.strength || 0) < this.config.minSignalStrength) {
      logger.info(`Signal strength too low, skipping execution`, {
        symbol: signal.symbol,
        strength: signal.strength,
        minRequired: this.config.minSignalStrength,
      });
      return null;
    }

    // Route to appropriate execution method
    if (signal.type === 'buy') {
      return this.executeBuy(signal);
    } else if (signal.type === 'sell') {
      return this.executeSell(signal);
    } else {
      logger.debug('Hold signal, no action taken', { symbol: signal.symbol });
      return null;
    }
  }

  /**
   * Execute a buy signal
   * @param signal Buy signal
   * @returns Executed trade or null
   */
  private async executeBuy(signal: Signal): Promise<Trade | null> {
    try {
      const broker = getBroker();
      const portfolio = getPortfolio();

      // Check if we already have a position
      const hasPosition = await portfolio.hasPosition(signal.symbol);
      if (hasPosition) {
        logger.info(`Already have position in ${signal.symbol}, skipping buy`, {
          symbol: signal.symbol,
        });
        return null;
      }

      // Check position limit
      const atLimit = await portfolio.isAtPositionLimit(this.config.maxPositions);
      if (atLimit) {
        logger.info(`At position limit (${this.config.maxPositions}), skipping buy`, {
          symbol: signal.symbol,
          maxPositions: this.config.maxPositions,
        });
        return null;
      }

      // Calculate position size
      const quantity = await portfolio.calculatePositionSize(
        signal.symbol,
        signal.price,
        this.config.positionSizePercent
      );

      if (quantity === 0) {
        logger.warn(`Calculated position size is 0, skipping buy`, {
          symbol: signal.symbol,
          price: signal.price,
        });
        return null;
      }

      // Check if we can afford it
      const canAfford = await portfolio.canAfford(signal.price, quantity);
      if (!canAfford) {
        logger.warn(`Insufficient buying power for ${signal.symbol}`, {
          symbol: signal.symbol,
          quantity,
          estimatedCost: formatCurrency(signal.price * quantity),
        });
        return null;
      }

      // Create order request
      const orderRequest: OrderRequest = {
        symbol: signal.symbol,
        side: 'buy',
        quantity,
        type: 'market',
        timeInForce: 'day',
      };

      // Execute or simulate
      if (this.config.dryRun) {
        logger.info(`[DRY RUN] Would buy ${quantity} shares of ${signal.symbol}`, {
          symbol: signal.symbol,
          quantity,
          estimatedPrice: signal.price,
          estimatedCost: formatCurrency(signal.price * quantity),
        });
        return null;
      }

      // Place order
      logger.info(`Executing BUY order for ${signal.symbol}`, {
        symbol: signal.symbol,
        quantity,
      });

      const orderResponse = await broker.placeOrder(orderRequest);

      // Wait a bit for order to fill
      await sleep(2000);

      // Get filled order details
      const filledOrder = await broker.getOrder(orderResponse.orderId);

      // Convert to Trade record
      const trade = broker.orderToTrade(filledOrder);

      // Log trade to database
      await this.logTrade(trade);

      logger.trade(trade.symbol, trade.side, trade.quantity, trade.price);

      return trade;
    } catch (error) {
      logger.error(`Failed to execute buy for ${signal.symbol}`, {
        symbol: signal.symbol,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Execute a sell signal
   * @param signal Sell signal
   * @returns Executed trade or null
   */
  private async executeSell(signal: Signal): Promise<Trade | null> {
    try {
      const broker = getBroker();
      const portfolio = getPortfolio();

      // Check if we have a position to sell
      const position = await portfolio.getPosition(signal.symbol);
      if (!position || position.quantity === 0) {
        logger.info(`No position in ${signal.symbol} to sell`, {
          symbol: signal.symbol,
        });
        return null;
      }

      const quantity = position.quantity;

      // Create order request
      const orderRequest: OrderRequest = {
        symbol: signal.symbol,
        side: 'sell',
        quantity,
        type: 'market',
        timeInForce: 'day',
      };

      // Execute or simulate
      if (this.config.dryRun) {
        logger.info(`[DRY RUN] Would sell ${quantity} shares of ${signal.symbol}`, {
          symbol: signal.symbol,
          quantity,
          estimatedPrice: signal.price,
          estimatedProceeds: formatCurrency(signal.price * quantity),
        });
        return null;
      }

      // Place order
      logger.info(`Executing SELL order for ${signal.symbol}`, {
        symbol: signal.symbol,
        quantity,
      });

      const orderResponse = await broker.placeOrder(orderRequest);

      // Wait a bit for order to fill
      await sleep(2000);

      // Get filled order details
      const filledOrder = await broker.getOrder(orderResponse.orderId);

      // Convert to Trade record
      const trade = broker.orderToTrade(filledOrder);

      // Log trade to database
      await this.logTrade(trade);

      logger.trade(trade.symbol, trade.side, trade.quantity, trade.price);

      return trade;
    } catch (error) {
      logger.error(`Failed to execute sell for ${signal.symbol}`, {
        symbol: signal.symbol,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Execute multiple signals
   * @param signals Array of signals to execute
   * @returns Array of executed trades
   */
  async executeSignals(signals: SignalResult[]): Promise<Trade[]> {
    const trades: Trade[] = [];

    for (const signalResult of signals) {
      try {
        const trade = await this.executeSignal(signalResult);
        if (trade) {
          trades.push(trade);
        }

        // Small delay between executions to avoid rate limits
        await sleep(500);
      } catch (error) {
        logger.error(`Failed to execute signal for ${signalResult.signal.symbol}`, {
          symbol: signalResult.signal.symbol,
          error: error instanceof Error ? error.message : String(error),
        });
        // Continue with other signals
      }
    }

    logger.info(`Executed ${trades.length} trades from ${signals.length} signals`, {
      signalsProcessed: signals.length,
      tradesExecuted: trades.length,
    });

    return trades;
  }

  /**
   * Log trade to database service
   * @param trade Trade record
   */
  private async logTrade(trade: Trade): Promise<void> {
    try {
      const db = getDbClient();
      await db.logTrade(trade);
    } catch (error) {
      logger.warn('Failed to log trade to database', {
        tradeId: trade.id,
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't throw - logging failure shouldn't stop execution
    }
  }

  /**
   * Update executor configuration
   * @param config Partial config to update
   */
  updateConfig(config: Partial<ExecutionConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info('Executor configuration updated', this.config);
  }

  /**
   * Get current configuration
   */
  getConfig(): ExecutionConfig {
    return { ...this.config };
  }
}

// Export singleton instance
let executorInstance: TradeExecutor | null = null;

export function getExecutor(config?: Partial<ExecutionConfig>): TradeExecutor {
  if (!executorInstance) {
    executorInstance = new TradeExecutor(config);
  }
  return executorInstance;
}

export default getExecutor;
