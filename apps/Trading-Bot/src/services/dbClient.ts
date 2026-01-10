/**
 * Database service HTTP client
 * Clean abstraction for external DB microservice communication
 * Can be easily swapped for different backend implementations
 */

import type { Candle } from '../types/candle';
import type { Trade } from '../types/trade';
import type { SignalLog } from '../types/signal';
import type {
  GetCandlesRequest,
  GetCandlesResponse,
  PostCandlesRequest,
  PostCandlesResponse,
  PostTradeRequest,
  PostTradeResponse,
  PostSignalRequest,
  PostSignalResponse,
  GetPortfolioResponse,
  Portfolio,
} from '../types/api';
import { logger } from '../utils/logger';
import { retry } from '../utils/helpers';

export class DbClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
  }

  /**
   * Generic HTTP request wrapper with error handling
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `DB Service request failed: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      return await response.json();
    } catch (error) {
      logger.error(`DB Service request error: ${endpoint}`, {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * GET /candles - Fetch historical candles
   * @param params Query parameters for candle retrieval
   * @returns Array of candles
   */
  async getCandles(params: GetCandlesRequest): Promise<Candle[]> {
    const queryParams = new URLSearchParams({
      symbol: params.symbol,
      timeframe: params.timeframe,
      ...(params.limit && { limit: params.limit.toString() }),
      ...(params.start && { start: params.start }),
      ...(params.end && { end: params.end }),
    });

    const response = await retry(() =>
      this.request<GetCandlesResponse>(`/candles?${queryParams.toString()}`)
    );

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to fetch candles');
    }

    logger.debug(`Fetched ${response.data.length} candles for ${params.symbol}`, {
      symbol: params.symbol,
      count: response.data.length,
    });

    return response.data;
  }

  /**
   * POST /candles - Bulk insert candles
   * @param candles Array of candles to insert
   * @returns Number of inserted candles
   */
  async saveCandles(candles: Candle[]): Promise<number> {
    const request: PostCandlesRequest = { candles };

    const response = await retry(() =>
      this.request<PostCandlesResponse>('/candles', {
        method: 'POST',
        body: JSON.stringify(request),
      })
    );

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to save candles');
    }

    logger.debug(`Saved ${response.data.inserted} candles to database`, {
      inserted: response.data.inserted,
    });

    return response.data.inserted;
  }

  /**
   * POST /trades - Log executed trade
   * @param trade Trade record to log
   * @returns Trade ID
   */
  async logTrade(trade: Trade): Promise<string> {
    const request: PostTradeRequest = { trade };

    const response = await retry(() =>
      this.request<PostTradeResponse>('/trades', {
        method: 'POST',
        body: JSON.stringify(request),
      })
    );

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to log trade');
    }

    logger.debug(`Logged trade to database`, {
      tradeId: response.data.tradeId,
      symbol: trade.symbol,
      side: trade.side,
    });

    return response.data.tradeId;
  }

  /**
   * POST /signals - Log generated signal
   * @param signal Signal to log
   * @returns Signal ID
   */
  async logSignal(signal: SignalLog): Promise<string> {
    const request: PostSignalRequest = { signal };

    const response = await retry(() =>
      this.request<PostSignalResponse>('/signals', {
        method: 'POST',
        body: JSON.stringify(request),
      })
    );

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to log signal');
    }

    logger.debug(`Logged signal to database`, {
      signalId: response.data.signalId,
      symbol: signal.symbol,
      type: signal.type,
    });

    return response.data.signalId;
  }

  /**
   * GET /portfolio/:accountId - Fetch portfolio summary
   * @param accountId Account identifier
   * @returns Portfolio summary
   */
  async getPortfolio(accountId: string): Promise<Portfolio> {
    const response = await retry(() =>
      this.request<GetPortfolioResponse>(`/portfolio/${accountId}`)
    );

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to fetch portfolio');
    }

    logger.debug(`Fetched portfolio for account ${accountId}`, {
      accountId,
      equity: response.data.equity,
      positions: response.data.positions.length,
    });

    return response.data;
  }

  /**
   * Health check endpoint (optional, if DB service provides it)
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Assuming DB service has a /health endpoint
      const response = await fetch(`${this.baseUrl}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
let dbClientInstance: DbClient | null = null;

export function getDbClient(): DbClient {
  if (!dbClientInstance) {
    const dbServiceUrl = process.env.DB_SERVICE_URL;
    if (!dbServiceUrl) {
      throw new Error('DB_SERVICE_URL environment variable is required');
    }
    dbClientInstance = new DbClient(dbServiceUrl);
  }
  return dbClientInstance;
}

export default getDbClient;
