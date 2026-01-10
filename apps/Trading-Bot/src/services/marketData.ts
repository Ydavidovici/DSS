/**
 * Market data service
 * Fetches candles and price data from Alpaca
 */

import Alpaca from '@alpacahq/alpaca-trade-api';
import type { Candle, CandleQuery, NormalizedCandle } from '../types/candle';
import { logger } from '../utils/logger';
import { parseDate } from '../utils/helpers';

export class MarketDataService {
  private alpaca: Alpaca;

  constructor() {
    // Initialize Alpaca client with environment variables
    this.alpaca = new Alpaca({
      keyId: process.env.APCA_API_KEY!,
      secretKey: process.env.APCA_SECRET_KEY!,
      paper: process.env.APCA_PAPER === 'true',
      baseUrl: process.env.APCA_API_BASE_URL,
    });

    logger.info('Market data service initialized');
  }

  /**
   * Fetch historical bars/candles for a symbol
   * @param query Candle query parameters
   * @returns Array of candles
   */
  async getCandles(query: CandleQuery): Promise<Candle[]> {
    try {
      logger.debug(`Fetching candles for ${query.symbol}`, {
        symbol: query.symbol,
        timeframe: query.timeframe,
        limit: query.limit,
      });

      const bars = await this.alpaca.getBarsV2(query.symbol, {
        timeframe: this.mapTimeframe(query.timeframe),
        start: query.start ? new Date(query.start).toISOString() : undefined,
        end: query.end ? new Date(query.end).toISOString() : undefined,
        limit: query.limit,
      });

      const candles: Candle[] = [];

      // Alpaca returns an async iterator
      for await (const bar of bars) {
        candles.push({
          symbol: query.symbol,
          timestamp: bar.Timestamp,
          open: bar.OpenPrice,
          high: bar.HighPrice,
          low: bar.LowPrice,
          close: bar.ClosePrice,
          volume: bar.Volume,
          timeframe: query.timeframe,
        });
      }

      logger.info(`Fetched ${candles.length} candles for ${query.symbol}`, {
        symbol: query.symbol,
        count: candles.length,
      });

      return candles;
    } catch (error) {
      logger.error(`Failed to fetch candles for ${query.symbol}`, {
        symbol: query.symbol,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get latest price for a symbol
   * @param symbol Trading symbol
   * @returns Current price
   */
  async getLatestPrice(symbol: string): Promise<number> {
    try {
      const trade = await this.alpaca.getLatestTrade(symbol);
      logger.debug(`Latest price for ${symbol}: $${trade.Price}`, {
        symbol,
        price: trade.Price,
      });
      return trade.Price;
    } catch (error) {
      logger.error(`Failed to fetch latest price for ${symbol}`, {
        symbol,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get latest quote for a symbol
   * @param symbol Trading symbol
   * @returns Latest bid/ask quote
   */
  async getLatestQuote(symbol: string) {
    try {
      const quote = await this.alpaca.getLatestQuote(symbol);
      logger.debug(`Latest quote for ${symbol}`, {
        symbol,
        bid: quote.BidPrice,
        ask: quote.AskPrice,
      });
      return quote;
    } catch (error) {
      logger.error(`Failed to fetch latest quote for ${symbol}`, {
        symbol,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Fetch multiple symbols' data in parallel
   * @param symbols Array of symbols
   * @param timeframe Candle timeframe
   * @param limit Number of candles per symbol
   * @returns Map of symbol to candles
   */
  async getMultipleCandles(
    symbols: string[],
    timeframe: string,
    limit?: number
  ): Promise<Map<string, Candle[]>> {
    const results = new Map<string, Candle[]>();

    await Promise.all(
      symbols.map(async (symbol) => {
        try {
          const candles = await this.getCandles({ symbol, timeframe, limit });
          results.set(symbol, candles);
        } catch (error) {
          logger.warn(`Failed to fetch candles for ${symbol}`, {
            symbol,
            error: error instanceof Error ? error.message : String(error),
          });
          // Continue with other symbols even if one fails
          results.set(symbol, []);
        }
      })
    );

    return results;
  }

  /**
   * Normalize candles with parsed timestamps
   * @param candles Raw candles
   * @returns Normalized candles with Date objects
   */
  normalizeCandles(candles: Candle[]): NormalizedCandle[] {
    return candles.map((candle) => ({
      ...candle,
      timestamp: parseDate(candle.timestamp),
    }));
  }

  /**
   * Map our timeframe format to Alpaca's format
   * @param timeframe Our timeframe string (e.g., '1d', '1h', '5m')
   * @returns Alpaca timeframe string
   */
  private mapTimeframe(timeframe: string): string {
    // Alpaca uses format like '1Day', '1Hour', '5Min'
    const match = timeframe.match(/^(\d+)([a-z]+)$/i);
    if (!match) return '1Day'; // default

    const [, num, unit] = match;
    const unitMap: Record<string, string> = {
      m: 'Min',
      min: 'Min',
      h: 'Hour',
      hour: 'Hour',
      d: 'Day',
      day: 'Day',
      w: 'Week',
      week: 'Week',
    };

    const mappedUnit = unitMap[unit.toLowerCase()] || 'Day';
    return `${num}${mappedUnit}`;
  }

  /**
   * Get asset information
   * @param symbol Trading symbol
   */
  async getAsset(symbol: string) {
    try {
      const asset = await this.alpaca.getAsset(symbol);
      logger.debug(`Fetched asset info for ${symbol}`, {
        symbol,
        tradable: asset.tradable,
        status: asset.status,
      });
      return asset;
    } catch (error) {
      logger.error(`Failed to fetch asset info for ${symbol}`, {
        symbol,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Check if symbol is tradable
   * @param symbol Trading symbol
   */
  async isTradable(symbol: string): Promise<boolean> {
    try {
      const asset = await this.getAsset(symbol);
      return asset.tradable && asset.status === 'active';
    } catch {
      return false;
    }
  }
}

// Export singleton instance
let marketDataInstance: MarketDataService | null = null;

export function getMarketData(): MarketDataService {
  if (!marketDataInstance) {
    marketDataInstance = new MarketDataService();
  }
  return marketDataInstance;
}

export default getMarketData;
