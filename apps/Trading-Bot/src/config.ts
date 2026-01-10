/**
 * Application configuration
 * Loads environment variables and provides typed config objects
 */

import { parseList } from './utils/helpers';

/**
 * Validate required environment variables
 */
function validateEnv(): void {
  const required = [
    'APCA_API_KEY',
    'APCA_SECRET_KEY',
    'DB_SERVICE_URL',
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
        'Please copy .env.example to .env and fill in the values.'
    );
  }
}

/**
 * Alpaca API configuration
 */
export const alpacaConfig = {
  apiKey: process.env.APCA_API_KEY!,
  secretKey: process.env.APCA_SECRET_KEY!,
  paper: process.env.APCA_PAPER === 'true',
  baseUrl: process.env.APCA_API_BASE_URL || 'https://paper-api.alpaca.markets',
};

/**
 * Database service configuration
 */
export const dbConfig = {
  serviceUrl: process.env.DB_SERVICE_URL!,
};

/**
 * Strategy configuration
 */
export const strategyConfig = {
  /** Fast moving average period */
  fastMAPeriod: parseInt(process.env.FAST_MA_PERIOD || '10', 10),

  /** Slow moving average period */
  slowMAPeriod: parseInt(process.env.SLOW_MA_PERIOD || '50', 10),

  /** Candle timeframe (e.g., '1d', '1h', '5m') */
  timeframe: process.env.TIMEFRAME || '1d',

  /** Trading symbols/watchlist */
  symbols: parseList(process.env.SYMBOLS || 'AAPL,SPY'),

  /** Use EMA instead of SMA */
  useEMA: process.env.USE_EMA === 'true',

  /** Minimum signal strength (0-1) */
  minSignalStrength: parseFloat(process.env.MIN_SIGNAL_STRENGTH || '0.5'),
};

/**
 * Trading/execution configuration
 */
export const tradingConfig = {
  /** Position size as percentage of equity */
  positionSizePercent: parseInt(process.env.POSITION_SIZE_PERCENT || '10', 10),

  /** Maximum number of concurrent positions */
  maxPositions: parseInt(process.env.MAX_POSITIONS || '5', 10),

  /** Account identifier */
  accountId: process.env.ACCOUNT_ID || 'default',

  /** Dry run mode (don't execute real trades) */
  dryRun: process.env.DRY_RUN === 'true',
};

/**
 * Scheduling configuration
 */
export const scheduleConfig = {
  /** Cron schedule for execution (default: 4 PM weekdays after market close) */
  executionSchedule: process.env.EXECUTION_SCHEDULE || '0 16 * * 1-5',

  /** Run once on startup instead of scheduling */
  runOnce: process.env.RUN_ONCE === 'true',

  /** Enable scheduled execution */
  enableSchedule: process.env.ENABLE_SCHEDULE !== 'false',
};

/**
 * Logging configuration
 */
export const logConfig = {
  level: (process.env.LOG_LEVEL || 'info') as 'debug' | 'info' | 'warn' | 'error',
};

/**
 * Complete application configuration
 */
export const config = {
  alpaca: alpacaConfig,
  db: dbConfig,
  strategy: strategyConfig,
  trading: tradingConfig,
  schedule: scheduleConfig,
  log: logConfig,
};

/**
 * Initialize and validate configuration
 * Call this before starting the application
 */
export function initConfig(): typeof config {
  validateEnv();
  return config;
}

export default config;
