export type OrderSide = "buy" | "sell";

export type OrderType = "market" | "limit" | "stop" | "stop_limit";

export type OrderStatus =
    | "pending"
    | "submitted"
    | "filled"
    | "partial"
    | "cancelled"
    | "rejected";

export interface Trade {
    id: string;
    symbol: string;
    side: OrderSide;
    quantity: number;
    price: number;
    value: number;
    timestamp: string;
    orderType: OrderType;
    status: OrderStatus;
    orderId: string;
    commission?: number;
    strategy?: string;
    metadata?: Record<string, unknown>;
}

export interface OrderRequest {
    symbol: string;
    side: OrderSide;
    quantity: number;
    type: OrderType;
    timeInForce?: "day" | "gtc" | "ioc" | "fok";
    limitPrice?: number;
    stopPrice?: number;
}

export interface OrderResponse {
    orderId: string;
    symbol: string;
    side: OrderSide;
    quantity: number;
    filledQuantity: number;
    status: OrderStatus;
    price?: number;
    timestamp: string;
}