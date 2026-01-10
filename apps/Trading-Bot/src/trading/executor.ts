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
   * Wait for order to fill by polling status
   * @param orderId Order ID to poll
   * @param maxAttempts Maximum poll attempts (default: 30)
   * @param delayMs Delay between polls in ms (default: 1000)
   * @returns Filled order or null if timeout
   */
  private async waitForOrderFill(
    orderId: string,
    maxAttempts: number = 30,
    delayMs: number = 1000
  ): Promise<any> {
    const broker = getBroker();

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const order = await broker.getOrder(orderId);

      if (order.status === 'filled') {
        logger.debug(`Order ${orderId} filled after ${attempt + 1} attempts`);
        return order;
      }

      if (order.status === 'rejected' || order.status === 'cancelled') {
        logger.warn(`Order ${orderId} ${order.status}`, {
          orderId,
          status: order.status,
        });
        return null;
      }

      // Still pending, wait and retry
      await sleep(delayMs);
    }

    logger.warn(`Order ${orderId} did not fill within timeout`, { orderId });
    return null;
  }

  /**
   * Common order placement logic
   * @param orderRequest Order request
   * @param signal Original signal
   * @returns Executed trade or null
   */
  private async placeAndWaitForOrder(
    orderRequest: OrderRequest,
    signal: Signal
  ): Promise<Trade | null> {
    const broker = getBroker();

    // Place order
    logger.info(`Executing ${orderRequest.side.toUpperCase()} order for ${signal.symbol}`, {
      symbol: signal.symbol,
      quantity: orderRequest.quantity,
    });

    const orderResponse = await broker.placeOrder(orderRequest);

    // Wait for order to fill
    const filledOrder = await this.waitForOrderFill(orderResponse.orderId);

    if (!filledOrder) {
      logger.error(`Order failed to fill for ${signal.symbol}`, {
        symbol: signal.symbol,
        orderId: orderResponse.orderId,
      });
      return null;
    }

    // Convert to Trade record
    const trade = broker.orderToTrade(filledOrder);

    // Log trade to database (fire and forget)
    this.logTrade(trade).catch(error => {
      logger.warn('Failed to log trade to database', {
        tradeId: trade.id,
        error: error instanceof Error ? error.message : String(error),
      });
    });

    logger.trade(trade.symbol, trade.side, trade.quantity, trade.price);

    return trade;
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

      // Dry run check
      if (this.config.dryRun) {
        logger.info(`[DRY RUN] Would buy ${quantity} shares of ${signal.symbol}`, {
          symbol: signal.symbol,
          quantity,
          estimatedPrice: signal.price,
          estimatedCost: formatCurrency(signal.price * quantity),
        });
        return null;
      }

      // Create and place order
      const orderRequest: OrderRequest = {
        symbol: signal.symbol,
        side: 'buy',
        quantity,
        type: 'market',
        timeInForce: 'day',
      };

      return await this.placeAndWaitForOrder(orderRequest, signal);
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

      // Dry run check
      if (this.config.dryRun) {
        logger.info(`[DRY RUN] Would sell ${quantity} shares of ${signal.symbol}`, {
          symbol: signal.symbol,
          quantity,
          estimatedPrice: signal.price,
          estimatedProceeds: formatCurrency(signal.price * quantity),
        });
        return null;
      }

      // Create and place order
      const orderRequest: OrderRequest = {
        symbol: signal.symbol,
        side: 'sell',
        quantity,
        type: 'market',
        timeInForce: 'day',
      };

      return await this.placeAndWaitForOrder(orderRequest, signal);
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
    const db = getDbClient();
    await db.logTrade(trade);
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
  } else if (config) {
    // Update config if provided
    executorInstance.updateConfig(config);
  }
  return executorInstance;
}

export default getExecutor;
