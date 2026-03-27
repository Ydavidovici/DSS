/**
 * Order side enum
 */
export type OrderSide = 'buy' | 'sell';

/**
 * Order type enum
 */
export type OrderType = 'market' | 'limit' | 'stop' | 'stop_limit';

/**
 * Order status enum
 */
export type OrderStatus =
  | 'pending'
  | 'submitted'
  | 'filled'
  | 'partial'
  | 'cancelled'
  | 'rejected';

/**
 * Executed trade record for logging and analysis
 */
export interface Trade {
  /** Unique trade identifier */
  id: string;

  /** Trading symbol */
  symbol: string;

  /** Buy or sell */
  side: OrderSide;

  /** Number of shares/units */
  quantity: number;

  /** Execution price per unit */
  price: number;

  /** Total trade value (quantity * price) */
  value: number;

  /** Execution timestamp */
  timestamp: string;

  /** Order type used */
  orderType: OrderType;

  /** Current status */
  status: OrderStatus;

  /** Broker order ID */
  orderId: string;

  /** Optional commission/fees paid */
  commission?: number;

  /** Strategy that generated this trade */
  strategy?: string;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Order request to be sent to broker
 */
export interface OrderRequest {
  symbol: string;
  side: OrderSide;
  quantity: number;
  type: OrderType;
  timeInForce?: 'day' | 'gtc' | 'ioc' | 'fok';
  limitPrice?: number;
  stopPrice?: number;
}

/**
 * Order response from broker
 */
export interface OrderResponse {
  orderId: string;
  symbol: string;
  side: OrderSide;
  quantity: number;
  filledQty: number;
  status: OrderStatus;
  price?: number;
  timestamp: string;
}
