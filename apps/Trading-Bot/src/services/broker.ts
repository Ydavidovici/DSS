/**
 * Alpaca broker service
 * Wrapper for Alpaca API to handle orders, positions, and account info
 */

import Alpaca from "@alpacahq/alpaca-trade-api";
import type {
    OrderRequest,
    OrderResponse,
    OrderStatus, OrderType,
    Trade,
} from "../types/trade";
import {logger} from "../utils/logger";
import {formatDate, generateId} from "../utils/helpers";

export class BrokerService {
    private alpaca: Alpaca;

    constructor() {
        this.alpaca = new Alpaca({
            keyId: process.env["APCA_API_KEY"]!,
            secretKey: process.env["APCA_SECRET_KEY"]!,
            paper: process.env["APCA_PAPER"] === "true",
            baseUrl: process.env["APCA_API_BASE_URL"],
        });

        logger.info("Alpaca broker service initialized", {
            paper: process.env["APCA_PAPER"] === "true",
        });
    }

    /**
     * Get account information
     * @returns Account details (balance, equity, buying power)
     */
    async getAccount() {
        try {
            const account = await this.alpaca.getAccount();
            logger.debug("Fetched account info", {
                equity: account.equity,
                cash: account.cash,
                buyingPower: account.buying_power,
            });
            return account;
        } catch (error) {
            logger.error("Failed to fetch account info", {
                error: error instanceof Error ? error.message : String(error),
            });
            return null;
        }
    }

    /**
     * Get all open positions
     * @returns Array of current positions
     */
    async getPositions() {
        try {
            const positions = await this.alpaca.getPositions();
            logger.debug(`Fetched ${positions.length} open positions`);
            return positions;
        } catch (error) {
            logger.error("Failed to fetch positions", {
                error: error instanceof Error ? error.message : String(error),
            });
            return [];
        }
    }

    /**
     * Get position for specific symbol
     * @param symbol Trading symbol
     * @returns Position or null if not found
     */
    async getPosition(symbol: string) {
        try {
            const position = await this.alpaca.getPosition(symbol);
            logger.debug(`Fetched position for ${symbol}`, {
                symbol,
                quantity: position.quantity,
                marketValue: position.market_value,
            });
            return position;
        } catch (error) {
            if ((error as any).statusCode === 404) {
                return null;
            }
            logger.error(`Failed to fetch position for ${symbol}`, {
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }

    /**
     * Place an order
     * @param orderRequest Order parameters
     * @returns Order response with order ID and status
     */
    async placeOrder(orderRequest: OrderRequest): Promise<OrderResponse> {
        try {
            logger.info(`Placing ${orderRequest.side} order for ${orderRequest.symbol}`, {
                symbol: orderRequest.symbol,
                side: orderRequest.side,
                quantity: orderRequest.quantity,
                type: orderRequest.type,
            });

            const order = await this.alpaca.createOrder({
                symbol: orderRequest.symbol,
                quantity: orderRequest.quantity,
                side: orderRequest.side,
                type: orderRequest.type,
                time_in_force: orderRequest.timeInForce || "day",
                limit_price: orderRequest.limitPrice,
                stop_price: orderRequest.stopPrice,
            });

            const response: OrderResponse = {
                orderId: order.id,
                symbol: order.symbol,
                side: order.side as "buy" | "sell",
                quantity: parseFloat(order.quantity),
                filledQuantity: parseFloat(order.filled_quantity || "0"),
                status: this.mapOrderStatus(order.status),
                price: order.filled_avg_price ? parseFloat(order.filled_avg_price) : undefined,
                timestamp: formatDate(order.created_at),
            };

            logger.info("Order placed successfully", {
                orderId: response.orderId,
                status: response.status,
            });

            return response;
        } catch (error) {
            logger.error("Failed to place order", {
                symbol: orderRequest.symbol,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }

    /**
     * Get order status
     * @param orderId Order identifier
     * @returns Current order status
     */
    async getOrder(orderId: string) {
        try {
            const order = await this.alpaca.getOrder(orderId);
            logger.debug(`Fetched order ${orderId}`, {
                orderId,
                status: order.status,
            });
            return order;
        } catch (error) {
            logger.error(`Failed to fetch order ${orderId}`, {
                error: error instanceof Error ? error.message : String(error),
            });
            return null;
        }
    }

    /**
     * Cancel an order
     * @param orderId Order identifier
     */
    async cancelOrder(orderId: string): Promise<boolean> {
        try {
            await this.alpaca.cancelOrder(orderId);
            logger.info(`Cancelled order ${orderId}`);
            return true;
        } catch (error) {
            logger.error(`Failed to cancel order ${orderId}`, {
                error: error instanceof Error ? error.message : String(error),
            });
            return false;
        }
    }

    /**
     * Get all orders (optionally filtered)
     * @param status Filter by status
     * @param limit Max number of orders to return
     */
    async getOrders(status?: string, limit: number = 50) {
        try {
            const orders = await this.alpaca.getOrders({
                status: status || "all",
                limit,
            } as any);
            logger.debug(`Fetched ${orders.length} orders`);
            return orders;
        } catch (error) {
            logger.error("Failed to fetch orders", {
                error: error instanceof Error ? error.message : String(error),
            });
            return [];
        }
    }

    /**
     * Convert Alpaca order to Trade record
     * @param order Alpaca order object
     * @returns Trade record
     */
    orderToTrade(order: {
        id: string;
        symbol: string;
        side: string;
        qty: string;
        filled_avg_price?: string;
        filled_at?: string;
        created_at: string;
        type: string;
        status: string;
    }): Trade {
        return {
            id: generateId(),
            symbol: order.symbol,
            side: order.side as "buy" | "sell",
            quantity: parseFloat(order.qty),
            price: parseFloat(order.filled_avg_price || "0"),
            value: parseFloat(order.qty) * parseFloat(order.filled_avg_price || "0"),
            timestamp: formatDate(order.filled_at || order.created_at),
            orderType: order.type as OrderType,
            status: this.mapOrderStatus(order.status),
            orderId: order.id,
            strategy: "moving_average_crossover",
        };
    }

    /**
     * Map Alpaca order status to our OrderStatus type
     */
    private mapOrderStatus(alpacaStatus: string): OrderStatus {
        const statusMap: Record<string, OrderStatus> = {
            new: "submitted",
            partially_filled: "partial",
            filled: "filled",
            done_for_day: "submitted",
            canceled: "cancelled",
            expired: "cancelled",
            replaced: "submitted",
            pending_cancel: "submitted",
            pending_replace: "submitted",
            accepted: "submitted",
            pending_new: "pending",
            accepted_for_bidding: "pending",
            stopped: "cancelled",
            rejected: "rejected",
            suspended: "pending",
            calculated: "submitted",
        };

        return statusMap[alpacaStatus] || "pending";
    }

    /**
     * Check if market is open
     * @returns True if market is open, false if closed, throws on error
     */
    async isMarketOpen(): Promise<boolean> {
        try {
            const clock = await this.alpaca.getClock();
            const isOpen = clock.is_open;
            logger.debug(`Market is ${isOpen ? "open" : "closed"}`);
            return isOpen;
        } catch (error) {
            logger.error("Failed to check market status", {
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }

    async getCalendar(start?: Date, end?: Date) {
        try {
            const calendar = await this.alpaca.getCalendar({
                start: start?.toISOString().split("T")[0],
                end: end?.toISOString().split("T")[0],
            });
            return calendar;
        } catch (error) {
            logger.error("Failed to fetch market calendar", {
                error: error instanceof Error ? error.message : String(error),
            });
            return [];
        }
    }
}

const brokerInstances = new Map<string, BrokerService>();

export function getBroker(accountKey?: string): BrokerService {
    const key = accountKey || process.env["APCA_API_KEY"] || "default";

    if (!brokerInstances.has(key)) {
        brokerInstances.set(key, new BrokerService());
    }

    return brokerInstances.get(key)!;
}

export default getBroker;
