/**
 * Trading Bot Entry Point
 * Main loop with scheduled execution for moving average crossover strategy
 */

import { initConfig, config } from './config';
import { logger } from './utils/logger';
import { getMarketData } from './services/marketData';
import { getDbClient } from './services/dbClient';
import { getBroker } from './services/broker';
import { getPortfolio } from './trading/portfolio';
import { getExecutor } from './trading/executor';
import { generateMultipleSignals, getActionableSignals } from './strategy/signals';
import { isMarketOpen } from './utils/helpers';

/**
 * Main trading loop execution
 * This runs on each scheduled interval
 */
async function runTradingLoop(): Promise<void> {
  const startTime = Date.now();

  logger.info('='.repeat(60));
  logger.info('Starting trading loop execution');
  logger.info('='.repeat(60));

  try {
    // Destructure config once to avoid duplication
    const { symbols, timeframe, fastMAPeriod, slowMAPeriod, useEMA, minSignalStrength } = config.strategy;
    const { positionSizePercent, maxPositions, dryRun } = config.trading;

    // 1. Check market status
    const broker = getBroker();
    const marketOpen = await broker.isMarketOpen();

    logger.info(`Market status: ${marketOpen ? 'OPEN' : 'CLOSED'}`);

    // For daily timeframe strategy, we typically run after market close
    if (!marketOpen && timeframe === '1d') {
      logger.info('Market is closed - running end-of-day analysis');
    }

    // 2. Fetch market data for all symbols
    logger.info(`Fetching market data for ${symbols.length} symbols`, { symbols, timeframe });

    const marketData = getMarketData();

    // Fetch enough candles for the slow MA calculation + buffer
    const requiredCandles = slowMAPeriod + 10;

    const candleMap = await marketData.getMultipleCandles(symbols, timeframe, requiredCandles);

    // Normalize candles with Date timestamps
    const normalizedCandleMap = new Map();
    for (const [symbol, candles] of candleMap.entries()) {
      normalizedCandleMap.set(symbol, marketData.normalizeCandles(candles));
    }

    // 3. Generate trading signals
    logger.info('Generating trading signals');

    const signalResults = generateMultipleSignals(
      symbols,
      normalizedCandleMap,
      { fastPeriod: fastMAPeriod, slowPeriod: slowMAPeriod, useEMA, minStrength: minSignalStrength }
    );

    // Filter for actionable signals (buy/sell only)
    const actionableSignals = getActionableSignals(signalResults);

    logger.info(`Generated ${actionableSignals.length} actionable signals`, {
      totalSignals: signalResults.length,
      actionableSignals: actionableSignals.length,
    });

    // 4. Execute trades immediately based on signals
    const db = getDbClient();
    const portfolio = getPortfolio();

    if (actionableSignals.length > 0) {
      logger.info('Executing trading signals');

      const executor = getExecutor({
        positionSizePercent,
        maxPositions,
        dryRun,
        minSignalStrength,
      });

      const trades = await executor.executeSignals(actionableSignals);

      logger.info(`Executed ${trades.length} trades`, {
        tradesExecuted: trades.length,
        dryRun,
      });

      // Log signals to database (fire and forget)
      for (const result of actionableSignals) {
        db.logSignal({
          ...result.signal,
          executed: trades.some(t => t.symbol === result.signal.symbol),
        }).catch(error => {
          logger.warn('Failed to log signal to database', {
            symbol: result.signal.symbol,
            error: error instanceof Error ? error.message : String(error),
          });
        });
      }
    } else {
      logger.info('No actionable signals to execute');
    }

    // 5. Display current portfolio
    await portfolio.logSummary();

    // 6. Save candles to database for historical analysis (fire and forget)
    for (const [symbol, candles] of candleMap.entries()) {
      if (candles.length > 0) {
        db.saveCandles(candles).catch(error => {
          logger.warn('Failed to save candles to database', {
            symbol,
            error: error instanceof Error ? error.message : String(error),
          });
        });
      }
    }

    // 7. Sync portfolio to database (fire and forget)
    portfolio.syncToDatabase().catch(error => {
      logger.warn('Failed to sync portfolio to database', {
        error: error instanceof Error ? error.message : String(error),
      });
    });

    // 8. Log completion
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.info('='.repeat(60));
    logger.info(`Trading loop completed in ${duration}s`);
    logger.info('='.repeat(60));
  } catch (error) {
    // Log error but don't crash the app - let scheduler continue
    logger.error('Trading loop failed', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}

/**
 * Parse cron expression and calculate next execution time
 * This is a simplified version - for production, use a cron library
 */
function getNextExecutionTime(cronExpression: string): Date {
  // For now, just schedule for next day at 4 PM
  // In production, use a proper cron parser
  const next = new Date();
  next.setDate(next.getDate() + 1);
  next.setHours(16, 0, 0, 0);
  return next;
}

/**
 * Schedule execution using cron
 * For production, consider using a library like 'node-cron' or 'cron'
 */
function scheduleExecution(): void {
  logger.info('Scheduling trading bot execution', {
    schedule: config.schedule.executionSchedule,
  });

  // Simple scheduler: run daily at specified time
  // For production, implement proper cron scheduling
  const runDaily = async () => {
    await runTradingLoop();

    // Schedule next run
    const nextRun = getNextExecutionTime(config.schedule.executionSchedule);
    const delay = nextRun.getTime() - Date.now();

    logger.info(`Next execution scheduled for ${nextRun.toISOString()}`, {
      nextRun: nextRun.toISOString(),
      delayMs: delay,
    });

    setTimeout(runDaily, delay);
  };

  // Calculate initial delay
  const nextRun = getNextExecutionTime(config.schedule.executionSchedule);
  const initialDelay = Math.max(0, nextRun.getTime() - Date.now());

  if (initialDelay === 0) {
    // Run immediately if we're past the scheduled time
    runDaily();
  } else {
    logger.info(`First execution scheduled for ${nextRun.toISOString()}`, {
      nextRun: nextRun.toISOString(),
      delayMs: initialDelay,
    });

    setTimeout(runDaily, initialDelay);
  }
}

/**
 * Application entry point
 */
async function main(): Promise<void> {
  try {
    // Initialize configuration and validate environment
    initConfig();

    logger.info('Trading Bot Starting', {
      symbols: config.strategy.symbols,
      timeframe: config.strategy.timeframe,
      fastMA: config.strategy.fastMAPeriod,
      slowMA: config.strategy.slowMAPeriod,
      dryRun: config.trading.dryRun,
      paper: config.alpaca.paper,
    });

    // Check DB service health
    try {
      const db = getDbClient();
      const healthy = await db.healthCheck();
      if (!healthy) {
        logger.warn('DB service health check failed - some features may be unavailable');
      }
    } catch (error) {
      logger.warn('Unable to connect to DB service', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Run once or schedule
    if (config.schedule.runOnce) {
      logger.info('Running once (no scheduling)');
      await runTradingLoop();
      logger.info('Execution complete, exiting');
      process.exit(0);
    } else if (config.schedule.enableSchedule) {
      scheduleExecution();
      logger.info('Bot is running and scheduled. Press Ctrl+C to stop.');
    } else {
      logger.info('Scheduling disabled. Run with RUN_ONCE=true to execute immediately.');
    }
  } catch (error) {
    logger.error('Fatal error during startup', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Catch unhandled errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', {
    error: error.message,
    stack: error.stack,
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', {
    reason: String(reason),
  });
  process.exit(1);
});

// Start the application
main();
