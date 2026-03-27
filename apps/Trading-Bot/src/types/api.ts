import type { Candle } from './candle';
import type { Trade } from './trade';
import type { SignalLog } from './signal';

/**
 * Generic API response wrapper
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * GET /candles query parameters
 */
export interface GetCandlesRequest {
  symbol: string;
  timeframe: string;
  limit?: number;
  start?: string;
  end?: string;
}

/**
 * GET /candles response
 */
export interface GetCandlesResponse extends ApiResponse<Candle[]> {}

/**
 * POST /candles bulk insert request
 */
export interface PostCandlesRequest {
  candles: Candle[];
}

/**
 * POST /candles response
 */
export interface PostCandlesResponse extends ApiResponse<{ inserted: number }> {}

/**
 * POST /trades log trade request
 */
export interface PostTradeRequest {
  trade: Trade;
}

/**
 * POST /trades response
 */
export interface PostTradeResponse extends ApiResponse<{ tradeId: string }> {}

/**
 * POST /signals log signal request
 */
export interface PostSignalRequest {
  signal: SignalLog;
}

/**
 * POST /signals response
 */
export interface PostSignalResponse extends ApiResponse<{ signalId: string }> {}

/**
 * Portfolio position
 */
export interface Position {
  symbol: string;
  quantity: number;
  avgEntryPrice: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPL: number;
  unrealizedPLPercent: number;
}

/**
 * Portfolio summary
 */
export interface Portfolio {
  accountId: string;
  balance: number;
  equity: number;
  buyingPower: number;
  positions: Position[];
  totalPL: number;
  totalPLPercent: number;
  lastUpdated: string;
}

/**
 * GET /portfolio/:accountId response
 */
export interface GetPortfolioResponse extends ApiResponse<Portfolio> {}
