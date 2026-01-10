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
      return null;
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

    if (!response || !response.success || !response.data) {
      logger.error('Failed to fetch candles from DB', {
        symbol: params.symbol,
        error: response?.error || 'No response',
      });
      return [];
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

    if (!response || !response.success || !response.data) {
      logger.error('Failed to save candles to DB', {
        candleCount: candles.length,
        error: response?.error || 'No response',
      });
      return 0;
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
  async logTrade(trade: Trade): Promise<string | null> {
    const request: PostTradeRequest = { trade };

    const response = await retry(() =>
      this.request<PostTradeResponse>('/trades', {
        method: 'POST',
        body: JSON.stringify(request),
      })
    );

    if (!response || !response.success || !response.data) {
      logger.error('Failed to log trade to DB', {
        symbol: trade.symbol,
        side: trade.side,
        error: response?.error || 'No response',
      });
      return null;
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
  async logSignal(signal: SignalLog): Promise<string | null> {
    const request: PostSignalRequest = { signal };

    const response = await retry(() =>
      this.request<PostSignalResponse>('/signals', {
        method: 'POST',
        body: JSON.stringify(request),
      })
    );

    if (!response || !response.success || !response.data) {
      logger.error('Failed to log signal to DB', {
        symbol: signal.symbol,
        type: signal.type,
        error: response?.error || 'No response',
      });
      return null;
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
  async getPortfolio(accountId: string): Promise<Portfolio | null> {
    const response = await retry(() =>
      this.request<GetPortfolioResponse>(`/portfolio/${accountId}`)
    );

    if (!response || !response.success || !response.data) {
      logger.error('Failed to fetch portfolio from DB', {
        accountId,
        error: response?.error || 'No response',
      });
      return null;
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
    } catch (error) {
      logger.error('DB health check failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }
}

// Export singleton instances per DB service URL (for multi-account support)
const dbClientInstances = new Map<string, DbClient>();

export function getDbClient(serviceUrl?: string): DbClient {
  const url = serviceUrl || process.env.DB_SERVICE_URL;

  if (!url) {
    throw new Error('DB_SERVICE_URL environment variable is required');
  }

  if (!dbClientInstances.has(url)) {
    dbClientInstances.set(url, new DbClient(url));
  }

  return dbClientInstances.get(url)!;
}

export default getDbClient;
