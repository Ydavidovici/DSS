export interface Candle {
    symbol: string;
    timestamp: string | number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    timeframe: string;
}

export interface NormalizedCandle extends Omit<Candle, "timestamp"> {
    timestamp: Date;
}

export interface CandleQuery {
    symbol: string;
    timeframe: string;
    limit?: number;
    start?: string | Date;
    end?: string | Date;
}