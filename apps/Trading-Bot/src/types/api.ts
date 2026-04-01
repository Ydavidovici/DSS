import type {Candle} from "./candle";
import type {Trade} from "./trade";
import type {SignalLog} from "./signal";

export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}

export interface GetCandlesRequest {
    symbol: string;
    timeframe: string;
    limit?: number;
    start?: string;
    end?: string;
}

export interface GetCandlesResponse extends ApiResponse<Candle[]> {}

export interface PostCandlesRequest {
    candles: Candle[];
}

export interface PostCandlesResponse extends ApiResponse<{inserted: number}> {}

export interface PostTradeRequest {
    trade: Trade;
}

export interface PostTradeResponse extends ApiResponse<{tradeId: string}> {}

export interface PostSignalRequest {
    signal: SignalLog;
}

export interface PostSignalResponse extends ApiResponse<{signalId: string}> {}

export interface Position {
    symbol: string;
    quantity: number;
    avgEntryPrice: number;
    currentPrice: number;
    marketValue: number;
    unrealizedPL: number;
    unrealizedPLPercent: number;
}

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

export interface GetPortfolioResponse extends ApiResponse<Portfolio> {}