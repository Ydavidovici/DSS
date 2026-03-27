/**
 * OHLCV candle data structure
 */
export interface Candle {
  /** Trading symbol (e.g., 'AAPL', 'BTC-USD') */
  symbol: string;

  /** Candle timestamp (ISO 8601 or Unix ms) */
  timestamp: string | number;

  /** Opening price */
  open: number;

  /** Highest price during period */
  high: number;

  /** Lowest price during period */
  low: number;

  /** Closing price */
  close: number;

  /** Trading volume */
  volume: number;

  /** Timeframe (e.g., '1m', '5m', '1h', '1d') */
  timeframe: string;
}

/**
 * Normalized candle with parsed timestamp
 */
export interface NormalizedCandle extends Omit<Candle, 'timestamp'> {
  timestamp: Date;
}

/**
 * Parameters for fetching historical candles
 */
export interface CandleQuery {
  symbol: string;
  timeframe: string;
  limit?: number;
  start?: string | Date;
  end?: string | Date;
}
