export type SignalType = "buy" | "sell" | "hold";

export interface Signal {
    symbol: string;
    type: SignalType;
    timestamp: string;
    strategy: string;
    strength?: number;
    price: number;
    indicators: {
        fastMA?: number;
        slowMA?: number;
        [key: string]: number | undefined;
    };
    reason: string;
    metadata?: Record<string, unknown>;
}

export interface SignalLog extends Signal {
    id?: string;
    executed?: boolean;
    tradeId?: string;
}

export interface SignalResult {
    signal: Signal;
    candles: Array<{timestamp: Date; close: number}>;
    fastMA: number[];
    slowMA: number[];
}